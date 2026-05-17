import type { RegisterOptions } from "react-hook-form";

import type { Field, FormSchemaJson } from "./schema";

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns an error message if the value does not satisfy `field.required`, otherwise null. */
export function requiredFieldViolation(field: Field, raw: unknown): string | null {
  if (!field.required) return null;
  switch (field.type) {
    case "confirm":
      return raw ? null : `${field.label} is required`;
    case "short_text":
    case "rich_text":
    case "dropdown": {
      const s = String(raw ?? "").trim();
      return s ? null : `${field.label} is required`;
    }
    case "number": {
      if (raw === null || raw === undefined || raw === "") {
        return `${field.label} is required`;
      }
      const n = Number(raw);
      return Number.isFinite(n) ? null : "Enter a valid number";
    }
    case "url": {
      const s = String(raw ?? "").trim();
      if (!s) return `${field.label} is required`;
      if (!isValidHttpUrl(s)) return "Enter a valid http(s) URL";
      return null;
    }
    case "checkbox": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      return arr.length > 0 ? null : `${field.label} is required`;
    }
    case "star_rating": {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? null : `${field.label} is required`;
    }
    case "screenshot":
    case "video": {
      const m = raw as { blobId?: string } | null;
      return m?.blobId ? null : `${field.label} is required`;
    }
    default:
      return null;
  }
}

export function optionalUrlFormatViolation(field: Field, raw: unknown): string | null {
  if (field.type !== "url" || field.required) return null;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return isValidHttpUrl(s) ? null : "Enter a valid http(s) URL";
}

/** Numeric bounds + format check; runs whether the field is required or not. */
export function numberFormatViolation(field: Field, raw: unknown): string | null {
  if (field.type !== "number") return null;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a valid number";
  if (typeof field.min === "number" && n < field.min) return `Must be ≥ ${field.min}`;
  if (typeof field.max === "number" && n > field.max) return `Must be ≤ ${field.max}`;
  return null;
}

export function getFieldRules(
  field: Field,
): RegisterOptions<Record<string, unknown>, string> | undefined {
  if (field.type === "url") {
    return {
      validate: (v) => {
        const req = requiredFieldViolation(field, v);
        if (req) return req;
        const fmt = optionalUrlFormatViolation(field, v);
        return fmt ?? true;
      },
    };
  }
  if (field.type === "number") {
    return {
      validate: (v) => {
        const req = requiredFieldViolation(field, v);
        if (req) return req;
        const fmt = numberFormatViolation(field, v);
        return fmt ?? true;
      },
    };
  }
  if (!field.required) return undefined;
  return {
    validate: (v) => requiredFieldViolation(field, v) ?? true,
  };
}

export function assertRequiredFieldValues(
  schema: FormSchemaJson,
  values: Record<string, unknown>,
): void {
  for (const f of schema.fields) {
    const msg = requiredFieldViolation(f, values[f.id]);
    if (msg) throw new Error(msg);
    const fmt = optionalUrlFormatViolation(f, values[f.id]);
    if (fmt) throw new Error(fmt);
    const numFmt = numberFormatViolation(f, values[f.id]);
    if (numFmt) throw new Error(numFmt);
  }
}
