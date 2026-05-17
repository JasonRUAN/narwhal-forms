import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";

import { NARWHAL_CONFIG } from "./config";

const SUI_CLOCK = "0x6";

let _jsonClient: SuiJsonRpcClient | null = null;

/** Lazy JSON-RPC client used for read APIs (events, dynamic fields, owned objects). */
export function getJsonRpcClient(): SuiJsonRpcClient {
  if (!_jsonClient) {
    _jsonClient = new SuiJsonRpcClient({
      url: NARWHAL_CONFIG.fullnodeUrl,
      network: NARWHAL_CONFIG.network,
    });
  }
  return _jsonClient;
}

// === PTB builders ===

export function buildCreateFormTx(args: {
  title: string;
  schemaBlobId: string;
  isPrivate: boolean;
  requireWallet: boolean;
  /**
   * Whether the same wallet address may submit more than once.
   * Setting this to `false` requires `requireWallet=true` (otherwise the
   * contract has no submitter identity to deduplicate on).
   */
  allowDuplicate: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::create_and_share`,
    arguments: [
      tx.pure.string(args.title),
      tx.pure.string(args.schemaBlobId),
      tx.pure.bool(args.isPrivate),
      tx.pure.bool(args.requireWallet),
      tx.pure.bool(args.allowDuplicate),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

export function buildSubmitTx(args: {
  formId: string;
  responseBlobId: string;
  encryptedFieldIds: string[];
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::submissions::submit_entry`,
    arguments: [
      tx.object(args.formId),
      tx.pure.string(args.responseBlobId),
      tx.pure.vector("string", args.encryptedFieldIds),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

export function buildAddAdminTx(args: {
  formId: string;
  adminCapId: string;
  admin: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::add_admin`,
    arguments: [tx.object(args.formId), tx.object(args.adminCapId), tx.pure.address(args.admin)],
  });
  return tx;
}

export function buildRemoveAdminTx(args: {
  formId: string;
  adminCapId: string;
  admin: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::remove_admin`,
    arguments: [tx.object(args.formId), tx.object(args.adminCapId), tx.pure.address(args.admin)],
  });
  return tx;
}

/**
 * Add an address to the form's submission allowlist. Once the allowlist is
 * non-empty, only listed addresses may submit. The form must have been
 * created with `requireWallet=true`.
 */
export function buildAddAllowlistTx(args: {
  formId: string;
  adminCapId: string;
  addr: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::add_allowlist`,
    arguments: [tx.object(args.formId), tx.object(args.adminCapId), tx.pure.address(args.addr)],
  });
  return tx;
}

export function buildRemoveAllowlistTx(args: {
  formId: string;
  adminCapId: string;
  addr: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::remove_allowlist`,
    arguments: [tx.object(args.formId), tx.object(args.adminCapId), tx.pure.address(args.addr)],
  });
  return tx;
}

/**
 * Toggle whether the same address may submit more than once. Switching to
 * `false` requires `requireWallet=true`.
 */
export function buildSetAllowDuplicateTx(args: {
  formId: string;
  adminCapId: string;
  allowDuplicate: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::set_allow_duplicate`,
    arguments: [
      tx.object(args.formId),
      tx.object(args.adminCapId),
      tx.pure.bool(args.allowDuplicate),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

export function buildSetArchivedTx(args: {
  formId: string;
  adminCapId: string;
  archived: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::forms::set_archived`,
    arguments: [
      tx.object(args.formId),
      tx.object(args.adminCapId),
      tx.pure.bool(args.archived),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

export function buildUpdateSubmissionTx(args: {
  formId: string;
  adminCapId: string;
  index: number;
  priority: number;
  tag: string;
  setNote: boolean;
  noteBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::submissions::update_submission`,
    arguments: [
      tx.object(args.formId),
      tx.object(args.adminCapId),
      tx.pure.u64(BigInt(args.index)),
      tx.pure.u8(args.priority),
      tx.pure.string(args.tag),
      tx.pure.bool(args.setNote),
      tx.pure.string(args.noteBlobId),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

/**
 * Per-contract cap on indices passed in a single batch call. Mirrors
 * `MAX_BATCH` in `submissions.move`. The frontend should chunk client-side
 * before this kicks in so the user never sees a generic abort code.
 */
export const BATCH_MAX = 256;

function bigIntIndices(indices: number[]): bigint[] {
  return indices.map((i) => BigInt(i));
}

/** Apply the same priority to many submissions in one tx. */
export function buildBatchSetPriorityTx(args: {
  formId: string;
  indices: number[];
  priority: number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::submissions::batch_set_priority`,
    arguments: [
      tx.object(args.formId),
      tx.pure.vector("u64", bigIntIndices(args.indices)),
      tx.pure.u8(args.priority),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

/** Apply the same tag string to many submissions in one tx. */
export function buildBatchSetTagTx(args: {
  formId: string;
  indices: number[];
  tag: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::submissions::batch_set_tag`,
    arguments: [
      tx.object(args.formId),
      tx.pure.vector("u64", bigIntIndices(args.indices)),
      tx.pure.string(args.tag),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

/** Unpin (clear) internal notes on many submissions in one tx. */
export function buildBatchClearNotesTx(args: {
  formId: string;
  indices: number[];
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::submissions::batch_clear_notes`,
    arguments: [
      tx.object(args.formId),
      tx.pure.vector("u64", bigIntIndices(args.indices)),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

/** Build the seal_approve PTB used for fetching decryption keys. */
export function buildSealApproveTx(args: {
  formId: string;
  identityHex: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${NARWHAL_CONFIG.packageId}::access::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(args.identityHex))),
      tx.object(args.formId),
    ],
  });
  return tx;
}

/** Build a PTB that calls seal_approve once per identity (useful for batch decrypt). */
export function buildSealApproveBatchTx(args: {
  formId: string;
  identityHexes: string[];
}): Transaction {
  const tx = new Transaction();
  for (const idHex of args.identityHexes) {
    tx.moveCall({
      target: `${NARWHAL_CONFIG.packageId}::access::seal_approve`,
      arguments: [
        tx.pure.vector("u8", Array.from(fromHex(idHex))),
        tx.object(args.formId),
      ],
    });
  }
  return tx;
}

// === Read-side helpers ===

export interface FormSummary {
  formId: string;
  creator: string;
  title: string;
  schemaBlobId: string;
  isPrivate: boolean;
  requireWallet: boolean;
  allowDuplicate: boolean;
  createdAtMs: number;
}

const FORM_CREATED_TYPE = (pkg: string) => `${pkg}::forms::FormCreated`;
const SUB_ADDED_TYPE = (pkg: string) => `${pkg}::submissions::SubmissionAdded`;
const SUB_UPDATED_TYPE = (pkg: string) => `${pkg}::submissions::SubmissionUpdated`;

interface FormCreatedEvent {
  form_id: string;
  creator: string;
  title: string;
  schema_blob_id: string;
  is_private: boolean;
  require_wallet: boolean;
  allow_duplicate: boolean;
  created_at_ms: string;
}

/**
 * Returns all forms ever created by `creator` on the configured package.
 * Uses event indexing — works without parsing dynamic field BCS.
 */
export async function listFormsByCreator(creator: string): Promise<FormSummary[]> {
  const client = getJsonRpcClient();
  const events = await client.queryEvents({
    query: { MoveEventType: FORM_CREATED_TYPE(NARWHAL_CONFIG.packageId) },
    limit: 100,
    order: "descending",
  });
  const out: FormSummary[] = [];
  for (const ev of events.data) {
    const p = ev.parsedJson as FormCreatedEvent | undefined;
    if (!p) continue;
    if (p.creator !== creator) continue;
    out.push({
      formId: p.form_id,
      creator: p.creator,
      title: p.title,
      schemaBlobId: p.schema_blob_id,
      isPrivate: !!p.is_private,
      requireWallet: !!p.require_wallet,
      // Older deployments emit events without `allow_duplicate`; default to
      // `true` so legacy forms keep their pre-feature behavior.
      allowDuplicate: p.allow_duplicate === undefined ? true : !!p.allow_duplicate,
      createdAtMs: Number(p.created_at_ms),
    });
  }
  return out;
}

export interface FormOnChain {
  formId: string;
  creator: string;
  title: string;
  schemaBlobId: string;
  isPrivate: boolean;
  requireWallet: boolean;
  allowDuplicate: boolean;
  archived: boolean;
  admins: string[];
  allowlist: string[];
  submissionCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Fetch authoritative form state by reading the shared object directly. */
export async function getForm(formId: string): Promise<FormOnChain | null> {
  const client = getJsonRpcClient();
  const obj = await client.getObject({ id: formId, options: { showContent: true } });
  const fields =
    obj.data?.content?.dataType === "moveObject"
      ? (obj.data.content.fields as Record<string, unknown>)
      : null;
  if (!fields) return null;
  const admins = ((fields.admins as { fields?: { contents?: string[] } } | undefined)?.fields?.contents ?? []) as string[];
  const allowlist = ((fields.allowlist as { fields?: { contents?: string[] } } | undefined)?.fields?.contents ?? []) as string[];
  return {
    formId,
    creator: fields.creator as string,
    title: fields.title as string,
    schemaBlobId: fields.schema_blob_id as string,
    isPrivate: !!fields.is_private,
    requireWallet: !!fields.require_wallet,
    // Same legacy guard as listFormsByCreator: pre-upgrade forms simply
    // don't have the field on-chain, so we treat them as duplicate-allowed.
    allowDuplicate: fields.allow_duplicate === undefined ? true : !!fields.allow_duplicate,
    archived: !!fields.archived,
    admins,
    allowlist,
    submissionCount: Number(fields.submission_count ?? 0),
    createdAtMs: Number(fields.created_at_ms ?? 0),
    updatedAtMs: Number(fields.updated_at_ms ?? 0),
  };
}

export interface SubmissionView {
  index: number;
  submitter: string | null;
  responseBlobId: string;
  encryptedFieldIds: string[];
  priority: number;
  tag: string;
  noteBlobId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

interface SubmissionAddedEvent {
  form_id: string;
  index: string;
  submitter: { vec?: string[] } | string | null;
  response_blob_id: string;
  encrypted_field_ids: string[];
  created_at_ms: string;
}

interface SubmissionUpdatedEvent {
  form_id: string;
  index: string;
  priority: number;
  tag: string;
  note_blob_id: { vec?: string[] } | string | null;
  updated_at_ms: string;
}

function parseOptionAddress(v: SubmissionAddedEvent["submitter"]): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const arr = v.vec ?? [];
  return arr.length > 0 ? arr[0] : null;
}

function parseOptionString(v: SubmissionUpdatedEvent["note_blob_id"]): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const arr = v.vec ?? [];
  return arr.length > 0 ? arr[0] : null;
}

/**
 * List submissions by replaying SubmissionAdded + SubmissionUpdated events
 * for a given form. Cheap and avoids BCS parsing.
 */
export async function listSubmissions(formId: string): Promise<SubmissionView[]> {
  const client = getJsonRpcClient();
  const [added, updated] = await Promise.all([
    client.queryEvents({
      query: { MoveEventType: SUB_ADDED_TYPE(NARWHAL_CONFIG.packageId) },
      limit: 1000,
      order: "ascending",
    }),
    client.queryEvents({
      query: { MoveEventType: SUB_UPDATED_TYPE(NARWHAL_CONFIG.packageId) },
      limit: 1000,
      order: "ascending",
    }),
  ]);

  const map = new Map<number, SubmissionView>();
  for (const ev of added.data) {
    const p = ev.parsedJson as SubmissionAddedEvent | undefined;
    if (!p || p.form_id !== formId) continue;
    const idx = Number(p.index);
    map.set(idx, {
      index: idx,
      submitter: parseOptionAddress(p.submitter),
      responseBlobId: p.response_blob_id,
      encryptedFieldIds: p.encrypted_field_ids ?? [],
      priority: 0,
      tag: "",
      noteBlobId: null,
      createdAtMs: Number(p.created_at_ms),
      updatedAtMs: Number(p.created_at_ms),
    });
  }
  for (const ev of updated.data) {
    const p = ev.parsedJson as SubmissionUpdatedEvent | undefined;
    if (!p || p.form_id !== formId) continue;
    const idx = Number(p.index);
    const cur = map.get(idx);
    if (!cur) continue;
    cur.priority = Number(p.priority);
    cur.tag = p.tag;
    cur.noteBlobId = parseOptionString(p.note_blob_id);
    cur.updatedAtMs = Number(p.updated_at_ms);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export interface AdminCapInfo {
  capId: string;
  formId: string;
}

/** Find AdminCaps owned by the given address (one per form they created). */
export async function listAdminCaps(owner: string): Promise<AdminCapInfo[]> {
  const client = getJsonRpcClient();
  const result = await client.getOwnedObjects({
    owner,
    filter: { StructType: `${NARWHAL_CONFIG.packageId}::forms::AdminCap` },
    options: { showContent: true },
  });
  const caps: AdminCapInfo[] = [];
  for (const item of result.data) {
    const f =
      item.data?.content?.dataType === "moveObject"
        ? (item.data.content.fields as Record<string, unknown>)
        : null;
    if (!f) continue;
    caps.push({
      capId: item.data!.objectId,
      formId: f.form_id as string,
    });
  }
  return caps;
}
