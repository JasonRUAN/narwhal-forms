import { z } from "zod";

/** All input types supported by NARWHAL forms. */
export const FIELD_TYPES = [
  "short_text",
  "rich_text",
  "number",
  "dropdown",
  "checkbox",
  "star_rating",
  "screenshot",
  "video",
  "url",
  "confirm",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  rich_text: "Rich text",
  number: "Number",
  dropdown: "Dropdown",
  checkbox: "Checkboxes",
  star_rating: "Star rating",
  screenshot: "Screenshot",
  video: "Video upload",
  url: "URL",
  confirm: "Confirmation",
};

export const FIELD_DESCRIPTIONS: Record<FieldType, string> = {
  short_text: "Single-line text. Best for names, emails, short identifiers.",
  rich_text: "Multi-line text with line breaks. Great for bug reports and free-form feedback.",
  number: "Numeric input. Supports optional min / max bounds.",
  dropdown: "Single-select from a list of options.",
  checkbox: "Multi-select boxes. Good for tagging or multi-choice surveys.",
  star_rating: "1–5 star satisfaction rating.",
  screenshot: "Image upload stored on Walrus.",
  video: "Video upload stored on Walrus.",
  url: "Validated URL (https://…).",
  confirm: "Single confirmation checkbox — handy for terms and consent.",
};

export const fieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
  maxStars: z.number().int().min(3).max(10).optional(),
  maxFileMb: z.number().int().min(1).max(200).optional(),
  maxLength: z.number().int().min(1).max(2000).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type Field = z.infer<typeof fieldSchema>;

/**
 * Loose Sui address validator: 0x followed by 1–64 hex chars. Matches the
 * regex used in the form builder UI; the on-chain layer will normalize via
 * `pure.address` so this only needs to catch obvious typos client-side.
 */
const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

export const formSchemaJson = z
  .object({
    version: z.literal(1),
    title: z.string().min(1).max(140),
    description: z.string().max(500).optional(),
    isPrivate: z.boolean(),
    requireWallet: z.boolean(),
    /**
     * When `false`, the same wallet address can only submit once. Requires
     * `requireWallet=true` (otherwise the contract has no submitter
     * identity to dedupe on). Defaults to `true` for backward compat.
     */
    allowDuplicate: z.boolean().default(true),
    /**
     * Optional submission allowlist. When non-empty, only these addresses
     * may submit a response. Requires `requireWallet=true`. Stored on
     * Walrus only as a hint for the UI — the authoritative copy lives
     * on-chain inside the Form's `allowlist` VecSet.
     */
    allowlist: z
      .array(z.string().regex(SUI_ADDRESS_RE, "Must be a 0x… Sui address"))
      .max(256)
      .default([]),
    fields: z.array(fieldSchema).min(1).max(40),
  })
  .superRefine((data, ctx) => {
    if (!data.requireWallet && !data.allowDuplicate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowDuplicate"],
        message: "Disallowing duplicate submissions requires 'Require wallet'.",
      });
    }
    if (!data.requireWallet && data.allowlist.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowlist"],
        message: "Allowlist gating requires 'Require wallet'.",
      });
    }
  });

export type FormSchemaJson = z.infer<typeof formSchemaJson>;

/** Defaults used when adding a new field of a given type in the builder. */
export function defaultFieldFor(type: FieldType, idx: number): Field {
  const base: Field = {
    id: `f_${idx}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: FIELD_LABELS[type],
    required: false,
    sensitive: false,
  };
  if (type === "dropdown" || type === "checkbox") base.options = ["Option A", "Option B"];
  if (type === "star_rating") base.maxStars = 5;
  if (type === "screenshot") base.maxFileMb = 10;
  if (type === "video") base.maxFileMb = 50;
  if (type === "short_text") base.maxLength = 120;
  return base;
}

/**
 * Decrypted/cleartext value type per field. We use a discriminated structure
 * indexed by field id at runtime.
 */
export type FieldValue =
  | { kind: "text"; value: string }
  | { kind: "selection"; value: string }
  | { kind: "selections"; value: string[] }
  | { kind: "rating"; value: number }
  | { kind: "number"; value: number }
  | { kind: "blob"; blobId: string; size: number; mediaType: string }
  | { kind: "url"; value: string }
  | { kind: "bool"; value: boolean };

export interface ResponseDocument {
  version: 1;
  /** Field id → field value, with sensitive fields replaced by ciphertext refs. */
  values: Record<string, FieldValue | EncryptedRef>;
  /** Submitted timestamp (client-side). */
  submittedAtMs: number;
}

export interface EncryptedRef {
  kind: "encrypted";
  /** Base64 of the Seal-encrypted bytes (for inline ciphertext). */
  ciphertextB64?: string;
  /** Or, the Walrus blob id storing the ciphertext (for large fields). */
  blobId?: string;
  /** Hex of the identity used during encryption. */
  identityHex: string;
}

export function valueIsEncrypted(v: FieldValue | EncryptedRef): v is EncryptedRef {
  return (v as EncryptedRef).kind === "encrypted";
}
