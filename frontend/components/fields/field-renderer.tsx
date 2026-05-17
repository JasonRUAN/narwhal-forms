"use client";

import {
  CheckmarkCircle02Icon,
  CloudUploadIcon,
  Image01Icon,
  LockKeyIcon,
  StarIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";

import { Icon } from "@/components/icon";
import { MarkdownField } from "@/components/fields/markdown-field";
import { Progress } from "@/components/ui/progress";
import { uploadFile, blobUrl } from "@/lib/walrus";
import { getFieldRules } from "@/lib/required-fields";
import type { Field } from "@/lib/schema";
import { cn } from "@/lib/utils";

interface FieldRendererProps {
  field: Field;
  control: Control<Record<string, unknown>>;
  errors: FieldErrors;
  index?: number;
  autoFocus?: boolean;
}

/**
 * Typeform-flavored renderer. Inputs sit on a soft underline, select/checkbox
 * options are rendered as A/B/C cards with keyboard letter shortcuts, and
 * star rating uses oversized clickable stars.
 */
export function FieldRenderer({ field, control, errors, index, autoFocus }: FieldRendererProps) {
  const errorMessage = errors[field.id]?.message as string | undefined;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          {typeof index === "number" && (
            <span className="font-mono-display text-xs uppercase tracking-[0.32em] text-ink/45">
              {String(index + 1).padStart(2, "0")}
              <span className="mx-1.5 text-coral">→</span>
            </span>
          )}
          <label
            htmlFor={field.id}
            className="font-display text-3xl leading-tight text-ink md:text-4xl"
          >
            {field.label}
            {field.required && <span className="ml-1 text-coral">*</span>}
          </label>
          {field.sensitive && (
            <span className="chip border border-coral/45 bg-coral/12 text-coral">
              <Icon icon={LockKeyIcon} size={12} strokeWidth={2} />
              encrypted with Seal
            </span>
          )}
        </div>
        {field.description && (
          <p className="max-w-prose text-base text-ink/60">{field.description}</p>
        )}
      </div>
      <FieldInput field={field} control={control} autoFocus={autoFocus} />
      {errorMessage && (
        <p className="flex items-center gap-2 text-sm font-medium text-destructive" role="alert">
          <span aria-hidden>⚠</span>
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function FieldInput({
  field,
  control,
  autoFocus,
}: {
  field: Field;
  control: Control<Record<string, unknown>>;
  autoFocus?: boolean;
}) {
  switch (field.type) {
    case "short_text":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue=""
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <input
              id={field.id}
              type="text"
              autoFocus={autoFocus}
              maxLength={field.maxLength ?? 120}
              placeholder="Type your answer here…"
              {...f}
              value={(f.value as string) ?? ""}
              className="input-typeform"
            />
          )}
        />
      );
    case "number":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue=""
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <input
              id={field.id}
              type="number"
              inputMode="decimal"
              autoFocus={autoFocus}
              min={field.min}
              max={field.max}
              placeholder="0"
              {...f}
              value={(f.value as string | number | undefined) ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              className="input-typeform"
            />
          )}
        />
      );
    case "rich_text":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue=""
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <MarkdownField
              id={field.id}
              autoFocus={autoFocus}
              value={(f.value as string) ?? ""}
              onChange={f.onChange}
              onBlur={f.onBlur}
              placeholder="Type your answer here…"
            />
          )}
        />
      );
    case "url":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue=""
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <input
              id={field.id}
              type="url"
              inputMode="url"
              autoFocus={autoFocus}
              placeholder="https://"
              {...f}
              value={(f.value as string) ?? ""}
              className="input-typeform"
            />
          )}
        />
      );
    case "dropdown":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue=""
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <LetterChoice
              options={field.options ?? []}
              value={typeof f.value === "string" ? f.value : ""}
              onChange={f.onChange}
              multi={false}
            />
          )}
        />
      );
    case "checkbox":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue={[]}
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <LetterChoice
              options={field.options ?? []}
              value={Array.isArray(f.value) ? (f.value as string[]) : []}
              onChange={f.onChange}
              multi
            />
          )}
        />
      );
    case "confirm":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue={false}
          rules={getFieldRules(field)}
          render={({ field: f }) => {
            const checked = !!f.value;
            return (
              <button
                type="button"
                onClick={() => f.onChange(!checked)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border-2 bg-card px-5 py-4 text-left transition-colors",
                  checked
                    ? "border-coral bg-coral/8 text-ink"
                    : "border-ink/12 hover:border-ink/30",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
                    checked
                      ? "border-coral bg-coral text-coral-foreground"
                      : "border-ink/25",
                  )}
                >
                  {checked && <Icon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.4} />}
                </span>
                <span className="text-base font-medium">I confirm</span>
              </button>
            );
          }}
        />
      );
    case "star_rating": {
      const max = field.maxStars ?? 5;
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue={0}
          rules={getFieldRules(field)}
          render={({ field: f }) => {
            const value = Number(f.value ?? 0);
            return (
              <StarRow
                max={max}
                value={value}
                onChange={(n) => f.onChange(n)}
                autoFocus={autoFocus}
              />
            );
          }}
        />
      );
    }
    case "screenshot":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue={null}
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <MediaUpload
              kind="image"
              maxMb={field.maxFileMb ?? 10}
              value={f.value as MediaValue | null}
              onChange={f.onChange}
            />
          )}
        />
      );
    case "video":
      return (
        <Controller
          control={control}
          name={field.id}
          defaultValue={null}
          rules={getFieldRules(field)}
          render={({ field: f }) => (
            <MediaUpload
              kind="video"
              maxMb={field.maxFileMb ?? 50}
              value={f.value as MediaValue | null}
              onChange={f.onChange}
            />
          )}
        />
      );
  }
}

function letterFor(idx: number) {
  return String.fromCharCode(65 + idx);
}

function LetterChoice({
  options,
  value,
  onChange,
  multi,
}: {
  options: string[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (opt: string) => {
    if (multi) {
      const next = selected.includes(opt)
        ? selected.filter((o) => o !== opt)
        : [...selected, opt];
      onChange(next);
    } else {
      onChange(opt);
    }
  };

  // Keyboard letter shortcuts: A → first, B → second, …
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const code = e.key.toUpperCase().charCodeAt(0);
      const idx = code - 65;
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        toggle(options[idx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value]);

  return (
    <ul className="grid gap-2.5">
      {options.map((opt, i) => {
        const on = selected.includes(opt);
        return (
          <li key={opt}>
            <button
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "group flex w-full items-center gap-4 rounded-2xl border-2 bg-card px-4 py-3.5 text-left text-base transition-all",
                on
                  ? "border-coral bg-coral/8 text-ink shadow-coral"
                  : "border-ink/12 hover:border-ink/35 hover:bg-ink/[0.02]",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border-2 font-mono-display text-sm font-semibold transition-colors",
                  on
                    ? "border-coral bg-coral text-coral-foreground"
                    : "border-ink/25 text-ink/55 group-hover:border-ink/55 group-hover:text-ink",
                )}
              >
                {letterFor(i)}
              </span>
              <span className="flex-1 font-medium">{opt}</span>
              {on && (
                <Icon icon={CheckmarkCircle02Icon} className="text-coral" size={18} strokeWidth={2} />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StarRow({
  max,
  value,
  onChange,
  autoFocus,
}: {
  max: number;
  value: number;
  onChange: (n: number) => void;
  autoFocus?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          autoFocus={autoFocus && n === 1}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded-full p-1 transition-transform hover:scale-110"
        >
          <Icon
            icon={StarIcon}
            size={42}
            strokeWidth={1.6}
            className={cn(
              "transition-colors",
              n <= display ? "text-coral" : "text-ink/20",
            )}
            primaryColor={n <= display ? "var(--coral)" : "transparent"}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-3 font-mono-display text-sm text-ink/55">
          {value} / {max}
        </span>
      )}
    </div>
  );
}

interface MediaValue {
  blobId: string;
  size: number;
  mediaType: string;
  fileName?: string;
}

function MediaUpload({
  kind,
  maxMb,
  value,
  onChange,
}: {
  kind: "image" | "video";
  maxMb: number;
  value: MediaValue | null;
  onChange: (v: MediaValue | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = kind === "image" ? "image/*" : "video/*";
  const HeroIcon = kind === "image" ? Image01Icon : Video01Icon;

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File exceeds ${maxMb} MB limit.`);
      return;
    }
    setUploading(true);
    setProgress(`Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB to Walrus…`);
    try {
      const info = await uploadFile(file);
      onChange({
        blobId: info.blobId,
        size: info.size || file.size,
        mediaType: info.mediaType,
        fileName: file.name,
      });
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border-2 border-ink/12 bg-card p-4">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blobUrl(value.blobId)}
            alt={value.fileName ?? "screenshot"}
            className="size-24 rounded-xl object-cover"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-xl bg-blush text-coral">
            <Icon icon={Video01Icon} size={32} />
          </div>
        )}
        <div className="flex-1 space-y-1 text-sm">
          <p className="font-medium text-ink">{value.fileName ?? "Uploaded file"}</p>
          <p className="break-all font-mono-display text-xs text-ink/55">
            walrus blob: {value.blobId.slice(0, 18)}…
          </p>
          <button
            type="button"
            className="text-xs font-medium text-coral hover:underline"
            onClick={() => onChange(null)}
          >
            Replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-ink/25 bg-cream/60 px-6 py-10 text-center transition-colors hover:border-coral hover:bg-coral/5",
        uploading && "pointer-events-none opacity-70",
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-coral/10 text-coral">
        <Icon icon={HeroIcon} size={28} />
      </span>
      <p className="text-base font-medium text-ink">
        {uploading ? "Uploading…" : `Drop a ${kind} here, or click to browse`}
      </p>
      <p className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/55">
        max {maxMb} MB · stored on walrus
      </p>
      {progress && (
        <div className="w-full max-w-xs space-y-2">
          <Progress value={uploading ? 60 : 0} className="h-1.5" />
          <p className="text-xs text-ink/60">{progress}</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <span className="flex items-center gap-2 text-[12px] text-ink/55">
        <Icon icon={CloudUploadIcon} size={14} /> walrus publisher
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export type { MediaValue };
