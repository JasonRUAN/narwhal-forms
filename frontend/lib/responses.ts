"use client";

import type { SealCompatibleClient, SessionKey } from "@mysten/seal";

import { encryptForForm, decryptForForm } from "./seal";
import { assertRequiredFieldValues } from "./required-fields";
import type {
  EncryptedRef,
  Field,
  FieldValue,
  FormSchemaJson,
} from "./schema";
import { base64ToBytes, bytesToBase64 } from "./encoding";

export interface ResponseBlobBase {
  version: 1;
  submittedAtMs: number;
}

export interface FormEnvelopeBlob extends ResponseBlobBase {
  envelope: "form";
  ciphertextB64: string;
  identityHex: string;
}

export interface FieldsEnvelopeBlob extends ResponseBlobBase {
  envelope: "fields";
  values: Record<string, FieldValue | EncryptedRef>;
}

export type ResponseBlob = FormEnvelopeBlob | FieldsEnvelopeBlob;

export function toFieldValue(field: Field, raw: unknown): FieldValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  switch (field.type) {
    case "short_text":
    case "rich_text": {
      const v = String(raw).trim();
      return v ? { kind: "text", value: v } : undefined;
    }
    case "number": {
      if (raw === "") return undefined;
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      return { kind: "number", value: n };
    }
    case "url": {
      const v = String(raw).trim();
      return v ? { kind: "url", value: v } : undefined;
    }
    case "dropdown": {
      const v = String(raw).trim();
      return v ? { kind: "selection", value: v } : undefined;
    }
    case "checkbox": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      return arr.length > 0 ? { kind: "selections", value: arr } : undefined;
    }
    case "star_rating": {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return undefined;
      return { kind: "rating", value: n };
    }
    case "screenshot":
    case "video": {
      const m = raw as { blobId?: string; size?: number; mediaType?: string } | null;
      if (!m || !m.blobId) return undefined;
      return {
        kind: "blob",
        blobId: m.blobId,
        size: m.size ?? 0,
        mediaType: m.mediaType ?? "application/octet-stream",
      };
    }
    case "confirm":
      return { kind: "bool", value: !!raw };
  }
}

export interface BuildResponseResult {
  blob: ResponseBlob;
  encryptedFieldIds: string[];
}

export async function buildResponseBlob(opts: {
  schema: FormSchemaJson;
  values: Record<string, unknown>;
  formId: string;
  suiClient: SealCompatibleClient;
}): Promise<BuildResponseResult> {
  assertRequiredFieldValues(opts.schema, opts.values);
  const valueMap: Record<string, FieldValue | EncryptedRef> = {};
  const sensitiveIds: string[] = [];

  for (const f of opts.schema.fields) {
    const fv = toFieldValue(f, opts.values[f.id]);
    if (fv === undefined) continue;
    if (!opts.schema.isPrivate && f.sensitive) {
      const plaintext = new TextEncoder().encode(JSON.stringify(fv));
      const enc = await encryptForForm({
        suiClient: opts.suiClient,
        formId: opts.formId,
        fieldId: f.id,
        plaintext,
      });
      valueMap[f.id] = {
        kind: "encrypted",
        ciphertextB64: bytesToBase64(enc.ciphertext),
        identityHex: enc.identityHex,
      };
      sensitiveIds.push(f.id);
    } else {
      valueMap[f.id] = fv;
    }
  }

  const submittedAtMs = Date.now();
  if (opts.schema.isPrivate) {
    const inner = JSON.stringify({ values: valueMap, submittedAtMs });
    const enc = await encryptForForm({
      suiClient: opts.suiClient,
      formId: opts.formId,
      plaintext: new TextEncoder().encode(inner),
    });
    return {
      blob: {
        version: 1,
        envelope: "form",
        ciphertextB64: bytesToBase64(enc.ciphertext),
        identityHex: enc.identityHex,
        submittedAtMs,
      },
      encryptedFieldIds: ["__form__"],
    };
  }
  return {
    blob: {
      version: 1,
      envelope: "fields",
      values: valueMap,
      submittedAtMs,
    },
    encryptedFieldIds: sensitiveIds,
  };
}

// === Decoding (admin side) ===

export interface DecodedResponse {
  values: Record<string, FieldValue>;
  submittedAtMs: number;
  partial: boolean;
  errors: string[];
}

/**
 * Decode a response blob back to plaintext field values, decrypting any
 * encrypted fragments using the supplied SessionKey.
 */
export async function decodeResponseBlob(opts: {
  blob: ResponseBlob;
  suiClient: SealCompatibleClient;
  sessionKey: SessionKey;
  formId: string;
}): Promise<DecodedResponse> {
  const errors: string[] = [];

  if (opts.blob.envelope === "form") {
    try {
      const decrypted = await decryptForForm({
        suiClient: opts.suiClient,
        sessionKey: opts.sessionKey,
        formId: opts.formId,
        ciphertexts: [
          {
            id: "__form__",
            identityHex: opts.blob.identityHex,
            ciphertext: base64ToBytes(opts.blob.ciphertextB64),
          },
        ],
      });
      const bytes = decrypted.get("__form__");
      if (!bytes) throw new Error("Decryption returned no data");
      const inner = JSON.parse(new TextDecoder().decode(bytes)) as {
        values: Record<string, FieldValue>;
        submittedAtMs: number;
      };
      return {
        values: inner.values,
        submittedAtMs: inner.submittedAtMs,
        partial: false,
        errors,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Decryption failed");
      return { values: {}, submittedAtMs: opts.blob.submittedAtMs, partial: true, errors };
    }
  }

  // Field-level envelope: decrypt only the encrypted entries.
  const encrypted: { id: string; identityHex: string; ciphertext: Uint8Array }[] = [];
  const result: Record<string, FieldValue> = {};
  for (const [fid, v] of Object.entries(opts.blob.values)) {
    if ((v as EncryptedRef).kind === "encrypted") {
      const ref = v as EncryptedRef;
      if (ref.ciphertextB64) {
        encrypted.push({
          id: fid,
          identityHex: ref.identityHex,
          ciphertext: base64ToBytes(ref.ciphertextB64),
        });
      }
    } else {
      result[fid] = v as FieldValue;
    }
  }

  if (encrypted.length > 0) {
    try {
      const decrypted = await decryptForForm({
        suiClient: opts.suiClient,
        sessionKey: opts.sessionKey,
        formId: opts.formId,
        ciphertexts: encrypted,
      });
      for (const e of encrypted) {
        const bytes = decrypted.get(e.id);
        if (!bytes) {
          errors.push(`${e.id}: no key returned`);
          continue;
        }
        try {
          result[e.id] = JSON.parse(new TextDecoder().decode(bytes)) as FieldValue;
        } catch {
          errors.push(`${e.id}: malformed plaintext`);
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Batch decryption failed");
    }
  }

  return {
    values: result,
    submittedAtMs: opts.blob.submittedAtMs,
    partial: errors.length > 0,
    errors,
  };
}

export function fieldValueToText(v: FieldValue | undefined): string {
  if (!v) return "—";
  switch (v.kind) {
    case "text":
    case "url":
    case "selection":
      return v.value;
    case "selections":
      return v.value.join(", ");
    case "rating":
      return `${v.value} ★`;
    case "number":
      return String(v.value);
    case "blob":
      return `blob:${v.blobId.slice(0, 8)}…`;
    case "bool":
      return v.value ? "yes" : "no";
  }
}
