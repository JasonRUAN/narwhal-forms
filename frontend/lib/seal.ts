"use client";

import { SealClient, SessionKey, type ExportedSessionKey } from "@mysten/seal";
import type { SealCompatibleClient } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";

import { NARWHAL_CONFIG } from "./config";
import { buildSealApproveBatchTx } from "./sui";

const STORAGE_KEY = "narwhal:seal-session-keys";
const SESSION_TTL_MIN = 30;

let _sealClient: SealClient | null = null;

export function getSealClient(suiClient: SealCompatibleClient): SealClient {
  if (!_sealClient) {
    _sealClient = new SealClient({
      suiClient,
      serverConfigs: [...NARWHAL_CONFIG.seal.keyServers],
      verifyKeyServers: false,
    });
  }
  return _sealClient;
}

/**
 * Build the Seal identity for a given form (and optional field). The on-chain
 * `seal_approve` policy enforces that the identity bytes start with the form's
 * 32-byte object ID, so we always prefix with that.
 */
export function buildIdentityHex(formId: string, fieldId?: string): string {
  // strip 0x prefix and pad to 64 hex chars (32 bytes)
  let formHex = formId.startsWith("0x") ? formId.slice(2) : formId;
  if (formHex.length < 64) formHex = formHex.padStart(64, "0");
  const suffix = fieldId ? new TextEncoder().encode(`:${fieldId}`) : new TextEncoder().encode("__form__");
  const formBytes = fromHex(formHex);
  const out = new Uint8Array(formBytes.length + suffix.length);
  out.set(formBytes, 0);
  out.set(suffix, formBytes.length);
  return toHex(out);
}

export async function encryptForForm(opts: {
  suiClient: SealCompatibleClient;
  formId: string;
  fieldId?: string;
  plaintext: Uint8Array;
}): Promise<{ ciphertext: Uint8Array; identityHex: string; backupKey: Uint8Array }> {
  const seal = getSealClient(opts.suiClient);
  const identityHex = buildIdentityHex(opts.formId, opts.fieldId);
  const { encryptedObject, key } = await seal.encrypt({
    threshold: NARWHAL_CONFIG.seal.threshold,
    packageId: NARWHAL_CONFIG.packageId,
    id: identityHex,
    data: opts.plaintext,
  });
  return { ciphertext: encryptedObject, identityHex, backupKey: key };
}

// --- Session key persistence (plain localStorage; sufficient for testnet UX) ---

interface StoredSessionKey {
  exported: ExportedSessionKey;
  expiresAt: number;
}

function loadStore(): Record<string, StoredSessionKey> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredSessionKey>) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, StoredSessionKey>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

function storageKeyFor(address: string): string {
  return `${NARWHAL_CONFIG.packageId}:${address.toLowerCase()}`;
}

/** Try to restore a non-expired session key from storage. */
export function loadCachedSessionKey(
  address: string,
  suiClient: SealCompatibleClient,
): SessionKey | null {
  const store = loadStore();
  const entry = store[storageKeyFor(address)];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    delete store[storageKeyFor(address)];
    saveStore(store);
    return null;
  }
  try {
    return SessionKey.import(entry.exported, suiClient);
  } catch {
    return null;
  }
}

/** Persist a fully-initialised SessionKey for later reuse. */
export function persistSessionKey(address: string, sessionKey: SessionKey) {
  const store = loadStore();
  store[storageKeyFor(address)] = {
    exported: sessionKey.export(),
    expiresAt: Date.now() + SESSION_TTL_MIN * 60_000,
  };
  saveStore(store);
}

export function forgetSessionKey(address: string) {
  const store = loadStore();
  delete store[storageKeyFor(address)];
  saveStore(store);
}

export const sessionTtlMinutes = SESSION_TTL_MIN;

/**
 * Construct the Sui transaction bytes that key servers will dry-run when
 * decrypting any of the given identities for a single form.
 */
export async function buildDecryptTxBytes(opts: {
  suiClient: SealCompatibleClient;
  formId: string;
  identityHexes: string[];
}): Promise<Uint8Array> {
  const tx = buildSealApproveBatchTx({
    formId: opts.formId,
    identityHexes: opts.identityHexes,
  });
  return tx.build({ client: opts.suiClient, onlyTransactionKind: true });
}

export async function decryptForForm(opts: {
  suiClient: SealCompatibleClient;
  sessionKey: SessionKey;
  formId: string;
  ciphertexts: { id: string; identityHex: string; ciphertext: Uint8Array }[];
}): Promise<Map<string, Uint8Array>> {
  const seal = getSealClient(opts.suiClient);
  const txBytes = await buildDecryptTxBytes({
    suiClient: opts.suiClient,
    formId: opts.formId,
    identityHexes: opts.ciphertexts.map((c) => c.identityHex),
  });
  if (opts.ciphertexts.length > 1) {
    await seal.fetchKeys({
      ids: opts.ciphertexts.map((c) => c.identityHex),
      txBytes,
      sessionKey: opts.sessionKey,
      threshold: NARWHAL_CONFIG.seal.threshold,
    });
  }
  const out = new Map<string, Uint8Array>();
  await Promise.all(
    opts.ciphertexts.map(async (c) => {
      const data = await seal.decrypt({
        data: c.ciphertext,
        sessionKey: opts.sessionKey,
        txBytes,
      });
      out.set(c.id, data);
    }),
  );
  return out;
}
