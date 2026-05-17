"use client";

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  CopyIcon,
  Database02Icon,
  Download01Icon,
  Edit02Icon,
  EyeIcon,
  HashtagIcon,
  Key01Icon,
  LinkBackwardIcon,
  Loading03Icon,
  LockKeyIcon,
  Pin02Icon,
  Refresh01Icon,
  Shield01Icon,
  SparklesIcon,
  StickyNote02Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import {
  useCurrentAccount,
  useCurrentClient,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { SessionKey } from "@mysten/seal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldRenderer } from "@/components/fields/field-renderer";
import { GradientCta } from "@/components/gradient-cta";
import { Icon } from "@/components/icon";
import { NarwhalMark } from "@/components/narwhal-mark";
import { SealedCipher } from "@/components/sealed-cipher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  NARWHAL_CONFIG,
  suiTxExplorerUrl,
  walrusBlobExplorerUrl,
} from "@/lib/config";
import { buildResponseBlob } from "@/lib/responses";
import { Markdown } from "@/lib/markdown";
import { fetchJSON, uploadJSON } from "@/lib/walrus";
import {
  decodeResponseBlob,
  fieldValueToText,
  type DecodedResponse,
  type ResponseBlob,
} from "@/lib/responses";
import {
  formSchemaJson,
  type Field,
  type FieldValue,
  type FormSchemaJson,
} from "@/lib/schema";
import {
  BATCH_MAX,
  buildBatchClearNotesTx,
  buildBatchSetPriorityTx,
  buildBatchSetTagTx,
  buildSubmitTx,
  buildUpdateSubmissionTx,
  getForm,
  getJsonRpcClient,
  listAdminCaps,
  listSubmissions,
  type FormOnChain,
  type SubmissionView,
} from "@/lib/sui";
import {
  forgetSessionKey,
  loadCachedSessionKey,
  persistSessionKey,
  sessionTtlMinutes,
} from "@/lib/seal";
import { blobUrl } from "@/lib/walrus";
import { cn } from "@/lib/utils";

interface LoadedForm {
  onChain: FormOnChain;
  schema: FormSchemaJson;
}

async function loadForm(formId: string): Promise<LoadedForm> {
  const onChain = await getForm(formId);
  if (!onChain) throw new Error("Form not found on-chain.");
  const raw = await fetchJSON<unknown>(onChain.schemaBlobId);
  const parsed = formSchemaJson.parse(raw);
  return { onChain, schema: parsed };
}

// === PUBLIC FORM COMPONENTS ===

type Step =
  | { kind: "intro" }
  | { kind: "field"; index: number }
  | { kind: "review" }
  | { kind: "thanks" };

function PublicFormPage({ formId }: { formId: string }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();

  const { data, isPending, error } = useQuery({
    queryKey: ["form-public", formId],
    queryFn: () => loadForm(formId),
    enabled: !!formId,
  });

  // --- Preflight: check allowlist & duplicate submission BEFORE user starts ---
  const onChain = data?.onChain;
  const preflight = useMemo(() => {
    if (!onChain || !account) return null;
    // Allowlist gate
    if (onChain.requireWallet && onChain.allowlist.length > 0) {
      if (!onChain.allowlist.includes(account.address)) {
        return { blocked: true as const, reason: "allowlist" as const };
      }
    }
    return null;
  }, [onChain, account]);

  // Check duplicate submission (needs async query)
  const duplicateCheck = useQuery({
    queryKey: ["preflight-dup", formId, account?.address],
    queryFn: async () => {
      if (!onChain || !account) return { duplicate: false };
      if (onChain.allowDuplicate) return { duplicate: false };
      // Fetch existing submissions and check if this address already submitted
      const subs = await listSubmissions(formId);
      const already = subs.some((s) => s.submitter === account.address);
      return { duplicate: already };
    },
    enabled: !!onChain && !!account && !onChain.allowDuplicate,
    staleTime: 30_000,
  });

  const preflightError: { reason: "allowlist" | "duplicate" } | null = useMemo(() => {
    if (preflight?.blocked) return { reason: preflight.reason };
    if (duplicateCheck.data?.duplicate) return { reason: "duplicate" };
    return null;
  }, [preflight, duplicateCheck.data]);

  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitted, setSubmitted] = useState<{ digest: string; blobId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(0);

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
    shouldUnregister: false,
    mode: "onSubmit",
  });

  const advance = useCallback((to: Step) => {
    setDirection(1);
    setStep(to);
  }, []);
  const goBack = useCallback((to: Step) => {
    setDirection(-1);
    setStep(to);
  }, []);

  if (isPending) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col gap-6 px-6 py-24">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <NarwhalMark className="mx-auto size-10 text-coral" />
        <h1 className="mt-4 font-display text-4xl text-ink">We can&apos;t surface this form</h1>
        <p className="mt-2 text-sm text-ink/65">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const { schema } = data;
  const fields = schema.fields;

  if (data.onChain.archived) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <NarwhalMark className="mx-auto size-12 text-ink/30" />
        <h1 className="mt-4 font-display text-4xl text-ink">This form is archived</h1>
        <p className="mt-2 text-sm text-ink/65">The creator paused submissions.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-coral hover:underline"
        >
          <Icon icon={LinkBackwardIcon} size={14} /> Back to NARWHAL
        </Link>
      </div>
    );
  }

  const totalSteps = fields.length;
  const currentIndex = step.kind === "field" ? step.index : step.kind === "review" ? totalSteps : 0;
  const progress =
    step.kind === "intro"
      ? 0
      : step.kind === "thanks"
        ? 100
        : ((currentIndex + 1) / (totalSteps + 1)) * 100;

  const validateField = (field: Field): string | null => {
    const value = form.getValues()[field.id];
    return (
      requiredFieldViolation(field, value) ??
      optionalUrlFormatViolation(field, value)
    );
  };

  const goNextFromField = (idx: number) => {
    const field = fields[idx];
    const err = validateField(field);
    if (err) {
      form.setError(field.id, { message: err });
      setShake((n) => n + 1);
      toast.error(err);
      return;
    }
    form.clearErrors(field.id);
    if (idx + 1 < fields.length) {
      advance({ kind: "field", index: idx + 1 });
    } else {
      advance({ kind: "review" });
    }
  };

  const goPrevFromField = (idx: number) => {
    if (idx === 0) {
      goBack({ kind: "intro" });
    } else {
      goBack({ kind: "field", index: idx - 1 });
    }
  };

  const submit = async () => {
    if (schema.requireWallet && !account) {
      toast.error("This form requires a connected wallet.");
      return;
    }
    if (!account) {
      toast.error("Connect a wallet to submit a transaction.");
      return;
    }
    if (!onChain) {
      toast.error("Form is not ready yet.");
      return;
    }
    // Best-effort client-side preflight that mirrors the on-chain guards
    // in `submissions::submit`. The contract is the source of truth — this
    // just turns generic "transaction aborted" into a clearer toast.
    if (onChain.requireWallet && onChain.allowlist.length > 0) {
      if (!onChain.allowlist.includes(account.address)) {
        toast.error("Your address is not on this form's allowlist.");
        return;
      }
    }
    setSubmitting(true);
    const t = toast.loading("Preparing response…");
    try {
      const built = await buildResponseBlob({
        schema,
        values: form.getValues(),
        formId: onChain.formId,
        suiClient,
      });
      toast.loading("Storing on Walrus…", { id: t });
      const blob = await uploadJSON(built.blob);
      toast.loading("Submitting to Sui…", { id: t });
      const tx = buildSubmitTx({
        formId: onChain.formId,
        responseBlobId: blob.blobId,
        encryptedFieldIds: built.encryptedFieldIds,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }
      toast.success("Signal received · echoing through the ice", {
        id: t,
        description: "Stored on Walrus and indexed on Sui.",
      });
      setSubmitted({ digest: result.Transaction.digest, blobId: blob.blobId });
      advance({ kind: "thanks" });
    } catch (e) {
      toast.error("Could not submit", {
        id: t,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-warm-mesh">
      <PublicHeader progress={progress} />

      <div className="flex flex-1 items-center justify-center px-4 pb-32 pt-10 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait" custom={direction}>
          {step.kind === "intro" && (
            <IntroStep
              key="intro"
              direction={direction}
              schema={schema}
              account={account?.address}
              preflightError={preflightError}
              preflightLoading={!!onChain && !onChain.allowDuplicate && duplicateCheck.isPending}
              onStart={() => advance(fields.length > 0 ? { kind: "field", index: 0 } : { kind: "review" })}
            />
          )}
          {step.kind === "field" && (
            <FieldStep
              key={`field-${step.index}`}
              direction={direction}
              shakeKey={shake}
              field={fields[step.index]}
              index={step.index}
              total={fields.length}
              control={form.control}
              errors={form.formState.errors}
              onNext={() => goNextFromField(step.index)}
              onPrev={() => goPrevFromField(step.index)}
            />
          )}
          {step.kind === "review" && (
            <ReviewStep
              key="review"
              direction={direction}
              schema={schema}
              account={account?.address}
              submitting={submitting}
              onBack={() =>
                fields.length > 0
                  ? goBack({ kind: "field", index: fields.length - 1 })
                  : goBack({ kind: "intro" })
              }
              onSubmit={submit}
            />
          )}
          {step.kind === "thanks" && submitted && (
            <ThanksStep key="thanks" submitted={submitted} />
          )}
        </AnimatePresence>
      </div>

      {step.kind === "field" && (
        <FooterHints
          isLast={step.index === fields.length - 1}
          totalSteps={totalSteps}
          currentIndex={currentIndex}
          onNext={() => goNextFromField(step.index)}
          onPrev={() => goPrevFromField(step.index)}
        />
      )}
    </div>
  );
}

function PublicHeader({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-x-0 top-16 z-40 h-1 bg-ink/8">
      <motion.div
        initial={false}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="h-full bg-coral"
      />
    </div>
  );
}

const slide = {
  initial: (dir: 1 | -1) => ({ opacity: 0, y: dir > 0 ? 36 : -36 }),
  animate: { opacity: 1, y: 0 },
  exit: (dir: 1 | -1) => ({ opacity: 0, y: dir > 0 ? -36 : 36 }),
};

function IntroStep({
  schema,
  direction,
  account,
  preflightError,
  preflightLoading,
  onStart,
}: {
  schema: FormSchemaJson;
  direction: 1 | -1;
  account?: string;
  preflightError: { reason: "allowlist" | "duplicate" } | null;
  preflightLoading: boolean;
  onStart: () => void;
}) {
  const canStart = !!account && !preflightError && !preflightLoading;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canStart) onStart();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStart, canStart]);

  return (
    <motion.section
      variants={slide}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={direction}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto max-w-3xl text-center"
    >
      <span className="chip mx-auto border border-coral/40 bg-coral/10 text-coral">
        <Icon icon={SparklesIcon} size={12} />
        narwhal · live form
      </span>
      <h1 className="mt-6 font-display text-balance text-5xl leading-[1.04] text-ink md:text-7xl">
        {schema.title}
      </h1>
      {schema.description && (
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-ink/65">
          {schema.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-ink/55">
        {schema.isPrivate && (
          <span className="chip border border-coral/40 bg-coral/8 text-coral">
            <Icon icon={LockKeyIcon} size={12} />
            sealed end-to-end
          </span>
        )}
        {!schema.isPrivate && schema.fields.some((f) => f.sensitive) && (
          <span className="chip border border-coral/30 bg-coral/5 text-coral">
            <Icon icon={LockKeyIcon} size={12} />
            sensitive fields encrypted
          </span>
        )}
        {schema.requireWallet ? (
          <span className="chip border border-ink/15 text-ink/60">
            <Icon icon={UserCheck01Icon} size={12} />
            wallet attribution
          </span>
        ) : (
          <span className="chip border border-ink/15 text-ink/60">anonymous on-chain</span>
        )}
      </div>

      {/* --- Preflight error banner --- */}
      {account && preflightError && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-8 max-w-md rounded-2xl border-2 border-destructive/40 bg-destructive/8 px-5 py-4 text-left"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <AlertCircleIcon size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base text-ink">
                {preflightError.reason === "allowlist"
                  ? "Your address is not on this form's allowlist"
                  : "You've already submitted a response"}
              </p>
              <p className="mt-1 text-sm text-ink/65">
                {preflightError.reason === "allowlist"
                  ? "Only pre-approved wallet addresses can fill out this form. Contact the form creator if you believe this is a mistake."
                  : "This form only allows one submission per wallet address. Your previous response has already been recorded."}
              </p>
              <p className="mt-2 font-mono-display text-[10.5px] uppercase tracking-[0.2em] text-ink/45">
                {account.slice(0, 6)}…{account.slice(-4)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="mt-10 flex flex-col items-center gap-3">
        {account ? (
          preflightError ? (
            <>
              <GradientCta tone="coral" size="xl" disabled>
                {preflightError.reason === "allowlist" ? "Not on allowlist" : "Already submitted"}
              </GradientCta>
              <Link
                href="/"
                className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45 hover:text-ink"
              >
                ← back to narwhal
              </Link>
            </>
          ) : preflightLoading ? (
            <>
              <GradientCta tone="coral" size="xl" disabled>
                <Icon icon={Loading03Icon} size={18} className="animate-spin" />
                Checking eligibility…
              </GradientCta>
              <span className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45">
                verifying your wallet
              </span>
            </>
          ) : (
            <>
              <GradientCta tone="coral" size="xl" onClick={onStart}>
                Start
                <Icon icon={ArrowRight01Icon} size={20} strokeWidth={2.2} />
              </GradientCta>
              <span className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45">
                press enter ↵ to begin · {schema.fields.length} questions ·{" "}
                <span className="text-ink/65">
                  signed in as {account.slice(0, 6)}…{account.slice(-4)}
                </span>
              </span>
            </>
          )
        ) : (
          <>
            <div className="mx-auto max-w-md rounded-2xl border border-coral/30 bg-coral/8 px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
                  <Icon icon={UserCheck01Icon} size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-base text-ink">
                    Connect a wallet before you start
                  </p>
                  <p className="mt-1 text-sm text-ink/65">
                    Submitting this form requires signing a Sui transaction so your
                    response can be stored on Walrus
                    {schema.isPrivate ? " and sealed with Seal" : ""}. Connect now to
                    avoid losing your answers later.
                  </p>
                </div>
              </div>
            </div>
            <ConnectButton />
            <span className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45">
              {schema.fields.length} questions · unlocked once connected
            </span>
          </>
        )}
      </div>
    </motion.section>
  );
}

function FieldStep({
  field,
  index,
  total,
  control,
  errors,
  direction,
  shakeKey,
  onNext,
  onPrev,
}: {
  field: Field;
  index: number;
  total: number;
  control: ReturnType<typeof useForm<Record<string, unknown>>>["control"];
  errors: ReturnType<typeof useForm<Record<string, unknown>>>["formState"]["errors"];
  direction: 1 | -1;
  shakeKey: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "Enter") {
        if (target && target.tagName === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        onNext();
        return;
      }
      if (!inEditable && (e.key === "ArrowRight")) {
        e.preventDefault();
        onNext();
      } else if (!inEditable && (e.key === "ArrowLeft")) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev]);

  return (
    <motion.section
      ref={wrapRef}
      variants={slide}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={direction}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto w-full max-w-2xl"
    >
      <motion.div
        key={shakeKey}
        animate={shakeKey > 0 ? { x: [-8, 8, -6, 6, -2, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <FieldRenderer
          field={field}
          control={control}
          errors={errors}
          index={index}
          autoFocus
        />
      </motion.div>

      <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GradientCta tone="coral" size="lg" onClick={onNext}>
            {index === total - 1 ? "Review" : "OK"}
            <Icon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.2} />
          </GradientCta>
          <span className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45">
            {field.type === "rich_text" ? "ctrl + enter ↵" : "press enter ↵"}
          </span>
        </div>
        {!field.required && (
          <button
            type="button"
            onClick={onNext}
            className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45 hover:text-ink"
          >
            skip →
          </button>
        )}
      </div>
    </motion.section>
  );
}

function FooterHints({
  isLast,
  totalSteps,
  currentIndex,
  onNext,
  onPrev,
}: {
  isLast: boolean;
  totalSteps: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 sm:p-6">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-ink/12 bg-cream/85 px-2 py-1.5 backdrop-blur-md shadow-soft">
        <button
          type="button"
          aria-label="Previous question"
          onClick={onPrev}
          className="grid size-8 place-items-center rounded-full text-ink/65 transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <Icon icon={ArrowLeft01Icon} size={16} />
        </button>
        <button
          type="button"
          aria-label="Next question"
          onClick={onNext}
          className="grid size-8 place-items-center rounded-full text-ink/65 transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <Icon icon={ArrowRight01Icon} size={16} />
        </button>
        <span className="px-1 font-mono-display text-[10.5px] uppercase tracking-[0.24em] text-ink/55">
          {String(currentIndex + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
        </span>
      </div>
      <span className="pointer-events-auto rounded-full bg-cream/85 px-3 py-1.5 font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/55 shadow-soft">
        {isLast ? "almost there ↗" : "↑ ↓ to navigate"}
      </span>
    </div>
  );
}

function ReviewStep({
  schema,
  account,
  submitting,
  direction,
  onBack,
  onSubmit,
}: {
  schema: FormSchemaJson;
  account?: string;
  submitting: boolean;
  direction: 1 | -1;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.section
      variants={slide}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={direction}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-2xl text-center"
    >
      <span className="chip mx-auto border border-coral/40 bg-coral/10 text-coral">
        <Icon icon={SparklesIcon} size={12} />
        ready when you are
      </span>
      <h2 className="mt-5 font-display text-5xl leading-tight text-ink md:text-6xl">
        Last step.
        <br />
        <span className="italic text-coral">Sign &amp; submit.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-md text-base text-ink/65">
        Your answers will be stored on Walrus
        {schema.isPrivate ? ", encrypted with Seal" : ""} and indexed on Sui.
        {schema.requireWallet ? " Your wallet address will be recorded as the submitter." : ""}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {!account ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-ink/65">Connect a wallet to submit your response.</p>
            <ConnectButton />
          </div>
        ) : (
          <p className="font-mono-display text-[11px] uppercase tracking-[0.22em] text-ink/55">
            signing as {account.slice(0, 6)}…{account.slice(-4)}
          </p>
        )}
        <GradientCta
          tone="coral"
          size="xl"
          onClick={onSubmit}
          disabled={submitting || !account}
        >
          {submitting ? "Sealing your response…" : "Submit response"}
          <Icon icon={ArrowRight01Icon} size={20} strokeWidth={2.2} />
        </GradientCta>
        <button
          type="button"
          onClick={onBack}
          className="font-mono-display text-[11px] uppercase tracking-[0.22em] text-ink/55 hover:text-ink"
        >
          ← back to last question
        </button>
      </div>
    </motion.section>
  );
}

function truncateMiddle(value: string, head = 8, tail = 6) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function ThanksStep({ submitted }: { submitted: { digest: string; blobId: string } }) {
  const url = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    [],
  );

  const network = NARWHAL_CONFIG.network;
  const blobHref = walrusBlobExplorerUrl(submitted.blobId, network);
  const txHref = suiTxExplorerUrl(submitted.digest, network);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mx-auto w-full max-w-xl text-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      >
        <Icon icon={SparklesIcon} className="mx-auto text-coral" size={56} />
      </motion.div>
      <p className="mt-5 font-mono-display text-[11px] uppercase tracking-[0.24em] text-coral">
        signal received · trajectory logged
      </p>
      <h1 className="mt-2 font-display text-7xl text-ink md:text-8xl">
        Thanks<span className="italic text-coral">!</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-base text-ink/65">
        Your response has been stored on Walrus and indexed on Sui. The form owner can decrypt your
        sensitive answers from their admin console.
      </p>
      <div className="mt-7 grid gap-3 rounded-3xl border border-ink/10 bg-card p-5 text-left shadow-soft">
        <ReceiptRow
          icon={Database02Icon}
          label="walrus blob"
          value={submitted.blobId}
          href={blobHref}
          hrefLabel="walruscan"
          network={network}
          onCopy={() => copyValue("Blob id", submitted.blobId)}
        />
        <div className="border-t border-ink/8" />
        <ReceiptRow
          icon={HashtagIcon}
          label="tx digest"
          value={submitted.digest}
          href={txHref}
          hrefLabel="suiscan"
          network={network}
          onCopy={() => copyValue("Tx digest", submitted.digest)}
        />
      </div>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <GradientCta tone="ink" size="lg" onClick={copyShare}>
          Copy share link
        </GradientCta>
        <Link href="/">
          <GradientCta tone="ghost" size="lg">
            <Icon icon={LinkBackwardIcon} size={16} /> Back to NARWHAL
          </GradientCta>
        </Link>
      </div>
    </motion.section>
  );
}

function ReceiptRow({
  icon,
  label,
  value,
  href,
  hrefLabel,
  network,
  onCopy,
}: {
  icon: typeof Database02Icon;
  label: string;
  value: string;
  href: string;
  hrefLabel: string;
  network: "testnet" | "mainnet";
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-coral/10 text-coral">
          <Icon icon={icon} size={14} />
        </span>
        <div className="min-w-0">
          <div className="font-mono-display text-[10.5px] uppercase tracking-[0.2em] text-ink/55">
            {label} · {network}
          </div>
          <button
            type="button"
            onClick={onCopy}
            title={`${value}\nClick to copy`}
            className="mt-0.5 block truncate font-mono-display text-[12px] text-ink hover:text-coral"
          >
            {truncateMiddle(value, 10, 8)}
          </button>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-cream px-2.5 py-1 font-mono-display text-[10.5px] uppercase tracking-[0.18em] text-ink/70 transition-colors hover:border-coral/50 hover:text-coral"
      >
        {hrefLabel}
        <Icon icon={ArrowUpRight01Icon} size={12} />
      </a>
    </div>
  );
}

// === ADMIN CONSOLE COMPONENTS ===

interface AdminContext {
  form: FormOnChain;
  schema: FormSchemaJson;
  capId: string | null;
  isAuthorized: boolean;
}

async function loadAdminContext(
  formId: string,
  account: string | undefined,
): Promise<AdminContext> {
  const form = await getForm(formId);
  if (!form) throw new Error("Form not found");
  const raw = await fetchJSON<unknown>(form.schemaBlobId);
  const schema = formSchemaJson.parse(raw);
  let capId: string | null = null;
  let isAuthorized = false;
  if (account) {
    const caps = await listAdminCaps(account);
    const match = caps.find((c) => c.formId === form.formId);
    capId = match?.capId ?? null;
    isAuthorized = form.creator === account || form.admins.includes(account);
  }
  return { form, schema, capId, isAuthorized };
}

interface RowState {
  decoded?: DecodedResponse;
  rawBlob?: ResponseBlob;
  loading?: boolean;
  error?: string;
}

function AdminConsolePage({ formId }: { formId: string }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();
  const queryClient = useQueryClient();

  const ctxQuery = useQuery({
    queryKey: ["admin-ctx", formId, account?.address],
    queryFn: () => loadAdminContext(formId, account?.address),
    enabled: !!formId,
  });

  const subsQuery = useQuery({
    queryKey: ["submissions", formId],
    queryFn: () => listSubmissions(formId),
    enabled: !!formId,
    refetchInterval: 12_000,
  });

  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const accountAddress = account?.address;
  useEffect(() => {
    if (!accountAddress) {
      setSessionKey(null);
      return;
    }
    const cached = loadCachedSessionKey(accountAddress, suiClient);
    if (cached) setSessionKey(cached);
  }, [accountAddress, suiClient]);

  const ctx = ctxQuery.data;
  const subs = useMemo(() => subsQuery.data ?? [], [subsQuery.data]);

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      if (filterPriority !== null && s.priority !== filterPriority) return false;
      if (filterTag && !s.tag.toLowerCase().includes(filterTag.toLowerCase()))
        return false;
      return true;
    });
  }, [subs, filterPriority, filterTag]);

  const unlock = async () => {
    if (!account) return;
    setUnlocking(true);
    try {
      const sk = await SessionKey.create({
        address: account.address,
        packageId: NARWHAL_CONFIG.packageId,
        ttlMin: sessionTtlMinutes,
        suiClient,
      });
      const message = sk.getPersonalMessage();
      const { signature } = await dAppKit.signPersonalMessage({ message });
      await sk.setPersonalMessageSignature(signature);
      persistSessionKey(account.address, sk);
      setSessionKey(sk);
      toast.success("Session key ready", {
        description: `Valid for ${sessionTtlMinutes} minutes.`,
      });
    } catch (e) {
      toast.error("Could not unlock", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const lock = () => {
    if (account) forgetSessionKey(account.address);
    setSessionKey(null);
    setRows({});
    autoLoadedRef.current.clear();
    toast.message("Session key forgotten");
  };

  const autoLoadedRef = useRef<Set<string>>(new Set());

  const decryptOne = async (s: SubmissionView): Promise<DecodedResponse | null> => {
    if (!ctx) return null;
    setRows((r) => ({
      ...r,
      [s.index]: { ...r[s.index], loading: true, error: undefined },
    }));
    try {
      const blob = (await fetchJSON<unknown>(s.responseBlobId)) as ResponseBlob;
      let decoded: DecodedResponse;
      const hasEncrypted =
        blob.envelope === "form" ||
        (blob.envelope === "fields" &&
          Object.values(blob.values).some(
            (v) => (v as { kind?: string }).kind === "encrypted",
          ));
      if (hasEncrypted) {
        if (!sessionKey) {
          // Without a session key we cannot fetch decryption keys from Seal.
          // For a "form" envelope the entire payload is sealed, so there is
          // nothing to surface — keep behaviour as before (gated by Decrypt).
          if (blob.envelope === "form") {
            throw new Error("Unlock the session key first.");
          }
          // For a "fields" envelope we can still expose the plaintext
          // (non-sensitive) fields immediately so the row preview isn't
          // entirely empty while the admin is still locked.
          const values: Record<string, FieldValue> = {};
          for (const [fid, v] of Object.entries(blob.values)) {
            if ((v as { kind?: string }).kind !== "encrypted") {
              values[fid] = v as FieldValue;
            }
          }
          decoded = {
            values,
            submittedAtMs: blob.submittedAtMs,
            partial: true,
            errors: [],
          };
        } else {
          decoded = await decodeResponseBlob({
            blob,
            suiClient,
            sessionKey,
            formId: ctx.form.formId,
          });
        }
      } else {
        const values = (blob as { values: Record<string, FieldValue> }).values;
        decoded = {
          values,
          submittedAtMs: blob.submittedAtMs,
          partial: false,
          errors: [],
        };
      }
      setRows((r) => ({ ...r, [s.index]: { decoded, rawBlob: blob, loading: false } }));
      return decoded;
    } catch (e) {
      autoLoadedRef.current.delete(`${s.index}:locked`);
      autoLoadedRef.current.delete(`${s.index}:unlocked`);
      setRows((r) => ({
        ...r,
        [s.index]: {
          ...r[s.index],
          loading: false,
          error: e instanceof Error ? e.message : "Failed",
        },
      }));
      return null;
    }
  };

  const decryptAll = async () => {
    for (const s of filtered) {
      const cur = rows[s.index]?.decoded;
      // Skip rows that are already fully decoded; re-run for rows that were
      // only partially decoded while the session was locked.
      if (cur && !cur.partial) continue;
      await decryptOne(s);
    }
  };

  useEffect(() => {
    if (!ctx) return;
    for (const s of subs) {
      // Re-trigger when the session state changes so previously-locked rows
      // can be fully decrypted now that a session key is available.
      const key = `${s.index}:${sessionKey ? "unlocked" : "locked"}`;
      if (autoLoadedRef.current.has(key)) continue;
      autoLoadedRef.current.add(key);
      const cur = rows[s.index]?.decoded;
      if (cur && !cur.partial) continue;
      void decryptOne(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, subs, sessionKey]);

  const collectExportSnapshot = async (): Promise<Record<number, DecodedResponse>> => {
    const snapshot: Record<number, DecodedResponse> = {};
    for (const s of subs) {
      const cur = rows[s.index]?.decoded;
      if (cur) snapshot[s.index] = cur;
    }
    if (!ctx) return snapshot;
    const sessionRequired =
      ctx.form.isPrivate || ctx.schema.fields.some((f) => f.sensitive);
    if (sessionRequired) return snapshot;
    const missing = subs.filter((s) => !snapshot[s.index]);
    if (missing.length === 0) return snapshot;
    const t = toast.loading(
      `Loading ${missing.length} submission${missing.length > 1 ? "s" : ""} for export…`,
    );
    const results = await Promise.allSettled(missing.map((s) => decryptOne(s)));
    toast.dismiss(t);
    missing.forEach((s, i) => {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) snapshot[s.index] = r.value;
    });
    return snapshot;
  };

  const exportCsv = async () => {
    if (!ctx) return;
    const snapshot = await collectExportSnapshot();
    const cols = [
      "index",
      "submitter",
      "submitted_at",
      "priority",
      "tag",
      "note_blob_url",
      ...ctx.schema.fields.map((f) => f.label),
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/"/g, '""');
      return `"${s}"`;
    };
    const valueToCell = (v: FieldValue | undefined): string => {
      if (v && v.kind === "blob") return blobUrl(v.blobId);
      return fieldValueToText(v);
    };
    const placeholderFor = (s: SubmissionView, f: { sensitive: boolean }): string => {
      if (ctx.form.isPrivate || f.sensitive) return "(encrypted)";
      return rows[s.index]?.error ? "(unavailable)" : "(loading)";
    };
    const lines = [cols.map(escape).join(",")];
    for (const s of subs) {
      const decoded = snapshot[s.index];
      const valuesByLabel = ctx.schema.fields.map((f) => {
        if (!decoded) return placeholderFor(s, f);
        const v = decoded.values[f.id];
        // A sensitive field whose plaintext is missing means the export is
        // running while the row is still sealed — surface that explicitly.
        if (v === undefined && (ctx.form.isPrivate || f.sensitive)) {
          return "(encrypted)";
        }
        return valueToCell(v);
      });
      lines.push(
        [
          s.index,
          s.submitter ?? "(anonymous)",
          new Date(s.createdAtMs).toISOString(),
          s.priority,
          s.tag,
          s.noteBlobId ? blobUrl(s.noteBlobId) : "",
          ...valuesByLabel,
        ]
          .map(escape)
          .join(","),
      );
    }
    const csv = "﻿" + lines.join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `narwhal-${ctx.form.title.replace(/[^a-z0-9]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = async () => {
    if (!ctx) return;
    const snapshot = await collectExportSnapshot();
    const out = subs.map((s) => ({
      index: s.index,
      submitter: s.submitter,
      submittedAt: new Date(s.createdAtMs).toISOString(),
      priority: s.priority,
      tag: s.tag,
      noteBlobId: s.noteBlobId,
      values: snapshot[s.index]?.values ?? null,
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `narwhal-${ctx.form.title.replace(/[^a-z0-9]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateRow = async (
    s: SubmissionView,
    patch: { priority?: number; tag?: string; note?: string | null },
  ) => {
    if (!ctx?.capId) {
      toast.error("Need AdminCap (creator only).");
      return;
    }
    const t = toast.loading("Updating on Sui…");
    try {
      let noteBlobId = s.noteBlobId ?? "";
      let setNote = !!s.noteBlobId;
      if (patch.note !== undefined) {
        if (patch.note === null) {
          setNote = false;
          noteBlobId = "";
        } else {
          const noteBlob = await uploadJSON({ note: patch.note, at: Date.now() });
          noteBlobId = noteBlob.blobId;
          setNote = true;
        }
      }
      const tx = buildUpdateSubmissionTx({
        formId: ctx.form.formId,
        adminCapId: ctx.capId,
        index: s.index,
        priority: patch.priority ?? s.priority,
        tag: patch.tag ?? s.tag,
        setNote,
        noteBlobId,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Tx failed",
        );
      }
      await getJsonRpcClient().waitForTransaction({
        digest: result.Transaction.digest,
      });
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
      toast.success("Saved", { id: t });
    } catch (e) {
      toast.error("Update failed", {
        id: t,
        description: e instanceof Error ? e.message : "?",
      });
    }
  };

  type BatchAction =
    | { kind: "priority"; priority: number }
    | { kind: "tag"; tag: string }
    | { kind: "clearNotes" };

  const runBatch = async (action: BatchAction) => {
    if (!ctx) return;
    const indices = Array.from(selected);
    if (indices.length === 0) {
      toast.error("Nothing selected.");
      return;
    }
    if (indices.length > BATCH_MAX) {
      toast.error(`Batch too large`, {
        description: `Max ${BATCH_MAX} rows per call. Currently selected: ${indices.length}.`,
      });
      return;
    }
    const verb =
      action.kind === "priority"
        ? `priority → ${["none", "low", "med", "high"][action.priority] ?? action.priority}`
        : action.kind === "tag"
          ? action.tag
            ? `tag → "${action.tag}"`
            : "tag cleared"
          : "notes unpinned";
    const t = toast.loading(`Updating ${indices.length} row${indices.length > 1 ? "s" : ""}…`, {
      description: verb,
    });
    setBatchBusy(true);
    try {
      const tx =
        action.kind === "priority"
          ? buildBatchSetPriorityTx({
              formId: ctx.form.formId,
              indices,
              priority: action.priority,
            })
          : action.kind === "tag"
            ? buildBatchSetTagTx({
                formId: ctx.form.formId,
                indices,
                tag: action.tag,
              })
            : buildBatchClearNotesTx({
                formId: ctx.form.formId,
                indices,
              });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Tx failed",
        );
      }
      await getJsonRpcClient().waitForTransaction({
        digest: result.Transaction.digest,
      });
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
      toast.success(`Updated ${indices.length} row${indices.length > 1 ? "s" : ""}`, {
        id: t,
        description: verb,
      });
      setSelected(new Set());
    } catch (e) {
      toast.error("Batch update failed", {
        id: t,
        description: e instanceof Error ? e.message : "?",
      });
    } finally {
      setBatchBusy(false);
    }
  };

  if (!account) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <NarwhalMark className="mx-auto size-10 text-coral" withSparkle />
        <h1 className="mt-4 font-display text-4xl text-ink">Connect a wallet</h1>
        <p className="mt-2 text-sm text-ink/65">
          The admin console is creator + allowlist only.
        </p>
        <div className="mt-6 inline-block">
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (ctxQuery.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (ctxQuery.error || !ctx) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-ink">Form not loadable</h1>
        <p className="mt-2 text-sm text-destructive">
          {ctxQuery.error instanceof Error ? ctxQuery.error.message : "?"}
        </p>
      </div>
    );
  }

  if (!ctx.isAuthorized) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <AlertCircleIcon className="mx-auto text-destructive" size={40} />
        <h1 className="mt-4 font-display text-4xl text-ink">Not authorized</h1>
        <p className="mt-2 text-sm text-ink/65">
          Only the creator of this form and allowlisted admins can view this console.
        </p>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/forms?id=${ctx.form.formId}`
      : "";

  const needsSession =
    ctx.form.isPrivate || ctx.schema.fields.some((f) => f.sensitive);

  return (
    <div className="bg-warm-fade">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip border border-ink/15 text-ink/65">
              <Icon icon={SparklesIcon} size={12} className="text-coral" />
              admin console
            </span>
            <h1 className="mt-3 font-display text-5xl leading-[1.04] tracking-tight text-ink md:text-6xl">
              {ctx.form.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="font-mono-display text-[11px] text-ink/55">
                {ctx.form.formId.slice(0, 10)}…{ctx.form.formId.slice(-6)}
              </p>
              {ctx.form.archived ? (
                <span className="chip border border-destructive/40 bg-destructive/10 text-destructive">
                  archived · paused
                </span>
              ) : ctx.form.isPrivate ? (
                <span className="chip border border-coral/40 bg-coral/12 text-coral">
                  <Icon icon={LockKeyIcon} size={12} />
                  private vault · sealed
                </span>
              ) : (
                <span className="chip border border-ink/15 text-ink/55">
                  public channel · cleartext
                </span>
              )}
              <span className="chip border border-ink/15 text-ink/55">
                role · {ctx.form.creator === account.address ? "creator" : "admin"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("Share link copied");
              }}
            >
              <Icon icon={CopyIcon} size={14} className="mr-1.5" /> Share link
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportCsv}>
              <Icon icon={Download01Icon} size={14} className="mr-1.5" /> CSV
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportJson}>
              <Icon icon={Download01Icon} size={14} className="mr-1.5" /> JSON
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => subsQuery.refetch()}
              title="Refresh submissions"
            >
              <Icon
                icon={Refresh01Icon}
                size={14}
                className={cn(subsQuery.isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <AdminStat label="Submissions" value={subs.length} />
          <AdminStat
            label="Priority ≥ medium"
            value={subs.filter((s) => s.priority >= 2).length}
          />
          <AdminStat label="Notes attached" value={subs.filter((s) => s.noteBlobId).length} />
        </div>

        {needsSession && (
          <AdminSessionGate
            sessionKey={sessionKey}
            onUnlock={unlock}
            onLock={lock}
            unlocking={unlocking}
            onDecryptAll={decryptAll}
          />
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-3xl border border-ink/10 bg-card p-3 shadow-soft">
          <span className="chip border border-ink/15 text-ink/55">filter scope</span>
          <select
            className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm"
            value={filterPriority ?? ""}
            onChange={(e) =>
              setFilterPriority(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">All priorities</option>
            <option value={0}>None</option>
            <option value={1}>Low</option>
            <option value={2}>Medium</option>
            <option value={3}>High</option>
          </select>
          <Input
            placeholder="tag contains…"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="h-9 w-48 rounded-full"
          />
          {ctx.capId && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-coral/25 bg-coral/8 px-3 py-1 text-[11px] text-coral/85">
              <Icon icon={SparklesIcon} size={11} strokeWidth={2} />
              <span>
                Tap any <span className="font-medium">priority</span>,{" "}
                <span className="font-medium">tag</span>, or{" "}
                <Icon
                  icon={Pin02Icon}
                  size={10}
                  className="-mt-0.5 inline align-middle"
                />{" "}
                to edit inline
              </span>
            </div>
          )}
        </div>

        {ctx.capId && selected.size > 0 && (
          <AdminBatchToolbar
            count={selected.size}
            visibleCount={filtered.length}
            busy={batchBusy}
            onClear={() => setSelected(new Set())}
            onSelectAllVisible={() =>
              setSelected(new Set(filtered.map((s) => s.index)))
            }
            onSetPriority={(p) => runBatch({ kind: "priority", priority: p })}
            onSetTag={(t) => runBatch({ kind: "tag", tag: t })}
            onClearNotes={() => runBatch({ kind: "clearNotes" })}
          />
        )}

        <div className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-cream font-mono-display text-[10.5px] uppercase tracking-[0.2em] text-ink/55">
              <tr>
                {ctx.capId && (
                  <th className="w-10 px-4 py-3 text-left">
                    <AdminHeaderCheckbox
                      visible={filtered}
                      selected={selected}
                      onChange={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            for (const s of filtered) next.add(s.index);
                          } else {
                            for (const s of filtered) next.delete(s.index);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">submitter</th>
                <th className="px-4 py-3 text-left">received</th>
                <th className="px-4 py-3 text-left">priority</th>
                <th className="px-4 py-3 text-left">tag</th>
                <th className="px-4 py-3 text-left">status</th>
                <th className="px-4 py-3 text-right">actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={ctx.capId ? 8 : 7}
                    className="px-4 py-12 text-center text-sm text-ink/55"
                  >
                    {subsQuery.isPending ? (
                      "Listening for responses…"
                    ) : subs.length === 0 ? (
                      <div className="flex flex-col items-center gap-4">
                        <p className="font-script text-2xl text-coral">
                          silence on the line ✦
                        </p>
                        <p className="text-sm text-ink/55">
                          First signal pending — share the form with someone.
                        </p>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            await navigator.clipboard.writeText(shareUrl);
                            toast.success("Share link copied");
                          }}
                        >
                          <Icon icon={CopyIcon} size={14} className="mr-1.5" /> Share
                          form link
                        </Button>
                      </div>
                    ) : (
                      "No submissions match this filter."
                    )}
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const row = rows[s.index];
                const open = openIndex === s.index;
                return (
                  <AdminRow
                    key={s.index}
                    s={s}
                    schema={ctx.schema}
                    row={row}
                    open={open}
                    isCreator={!!ctx.capId}
                    isSelected={selected.has(s.index)}
                    onSelectToggle={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.index)) next.delete(s.index);
                        else next.add(s.index);
                        return next;
                      })
                    }
                    onToggle={() => setOpenIndex(open ? null : s.index)}
                    onDecrypt={() => decryptOne(s)}
                    onUpdate={(patch) => updateRow(s, patch)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-card px-5 py-4 shadow-soft">
      <div className="font-display text-4xl leading-none text-ink">{value}</div>
      <div className="mt-1 font-mono-display text-[10.5px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
    </div>
  );
}

function AdminSessionGate({
  sessionKey,
  unlocking,
  onUnlock,
  onLock,
  onDecryptAll,
}: {
  sessionKey: SessionKey | null;
  unlocking: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onDecryptAll: () => void;
}) {
  const ready = !!sessionKey && !sessionKey.isExpired();
  return (
    <div
      className={cn(
        "mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 p-4 shadow-soft",
        ready ? "border-coral/40 bg-coral/8" : "border-ink/10 bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-2xl",
            ready ? "bg-coral text-coral-foreground" : "bg-ink/8 text-ink/65",
          )}
        >
          <Icon icon={ready ? Shield01Icon : LockKeyIcon} size={20} />
        </span>
        <div>
          <div className="text-sm font-medium text-ink">
            {ready ? "Session key active" : "This form contains encrypted data"}
          </div>
          <div className="text-xs text-ink/55">
            {ready
              ? `Will expire in ~${sessionTtlMinutes} minutes. Decryption is local — keys never leave Seal's threshold.`
              : "Sign once with your wallet to unlock decryption for all rows below."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {ready ? (
          <>
            <GradientCta tone="coral" size="default" onClick={onDecryptAll}>
              <Icon icon={Key01Icon} size={14} strokeWidth={2.2} />
              Decrypt all
            </GradientCta>
            <Button variant="ghost" className="rounded-full" onClick={onLock}>
              Lock
            </Button>
          </>
        ) : (
          <GradientCta
            tone="coral"
            size="default"
            onClick={onUnlock}
            disabled={unlocking}
          >
            <Icon icon={Key01Icon} size={14} strokeWidth={2.2} />
            {unlocking ? "Awaiting wallet…" : "Unlock decryption"}
          </GradientCta>
        )}
      </div>
    </div>
  );
}

function AdminRow({
  s,
  schema,
  row,
  open,
  isCreator,
  isSelected,
  onSelectToggle,
  onToggle,
  onDecrypt,
  onUpdate,
}: {
  s: SubmissionView;
  schema: FormSchemaJson;
  row?: RowState;
  open: boolean;
  isCreator: boolean;
  isSelected: boolean;
  onSelectToggle: () => void;
  onToggle: () => void;
  onDecrypt: () => void;
  onUpdate: (patch: { priority?: number; tag?: string; note?: string | null }) => void;
}) {
  const decoded = row?.decoded;
  const fullyDecrypted = !!decoded && !decoded.partial;
  const hasEncrypted =
    schema.isPrivate || schema.fields.some((f) => f.sensitive);

  return (
    <>
      <tr
        className={cn(
          "border-t border-ink/8 transition-colors hover:bg-cream",
          (open || isSelected) && "bg-cream",
          isSelected && "shadow-[inset_3px_0_0_0_var(--coral)]",
        )}
      >
        {isCreator && (
          <td className="px-4 py-3 align-top">
            <AdminRowCheckbox checked={isSelected} onChange={onSelectToggle} label={`Select submission #${s.index}`} />
          </td>
        )}
        <td className="px-4 py-3 align-top font-mono-display text-xs text-ink/70">
          {s.index}
        </td>
        <td className="px-4 py-3 align-top font-mono-display text-[11px] text-ink/55">
          {s.submitter
            ? `${s.submitter.slice(0, 6)}…${s.submitter.slice(-4)}`
            : "anonymous"}
        </td>
        <td className="px-4 py-3 align-top text-xs text-ink/65">
          {new Date(s.createdAtMs).toLocaleString()}
        </td>
        <td className="px-4 py-3 align-top">
          <AdminPriorityCell
            value={s.priority}
            editable={isCreator}
            onChange={(p) => onUpdate({ priority: p })}
          />
        </td>
        <td className="px-4 py-3 align-top">
          <AdminTagCell
            value={s.tag}
            editable={isCreator}
            onChange={(t) => onUpdate({ tag: t })}
          />
        </td>
        <td className="px-4 py-3 align-top">
          {hasEncrypted ? (
            fullyDecrypted ? (
              <Badge className="gap-1 rounded-full border-leaf/40 bg-leaf/12 text-leaf">
                <Icon icon={CheckmarkCircle02Icon} size={11} strokeWidth={2.2} />
                decrypted
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-ink/15 bg-cream text-ink/65"
              >
                <Icon icon={LockKeyIcon} size={11} strokeWidth={2} /> sealed
              </Badge>
            )
          ) : (
            <Badge
              variant="outline"
              className="gap-1 rounded-full border-mint/60 bg-mint/30 text-ink/75"
            >
              <Icon icon={EyeIcon} size={11} strokeWidth={2} /> cleartext
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 align-top text-right">
          <div className="flex items-center justify-end gap-1">
            {hasEncrypted && !fullyDecrypted && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onDecrypt}
                disabled={row?.loading}
                title={row?.loading ? "Decrypting…" : "Decrypt this row"}
                aria-label="Decrypt this row"
                className={cn(
                  "rounded-full text-coral transition-transform hover:scale-110 hover:bg-coral/12 hover:text-coral disabled:hover:scale-100",
                  row?.loading && "animate-pulse",
                )}
              >
                <Icon
                  icon={row?.loading ? Loading03Icon : Key01Icon}
                  size={15}
                  strokeWidth={2}
                  className={cn(row?.loading && "animate-spin")}
                />
              </Button>
            )}
            {fullyDecrypted && hasEncrypted && (
              <span
                title="Decrypted in this session"
                aria-label="Decrypted"
                className="grid size-8 place-items-center rounded-full bg-leaf/12 text-leaf"
              >
                <Icon icon={CheckmarkCircle02Icon} size={15} strokeWidth={2.2} />
              </span>
            )}
            {isCreator && (
              <AdminNotePopover
                noteBlobId={s.noteBlobId}
                onChange={(note) => onUpdate({ note })}
              />
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onToggle}
              title={open ? "Close details" : "Open details"}
              aria-label={open ? "Close details" : "Open details"}
              className={cn(
                "rounded-full transition-all hover:scale-110",
                open
                  ? "bg-ink text-cream hover:bg-ink/85 hover:text-cream"
                  : "text-ink/60 hover:bg-ink/8 hover:text-ink",
              )}
            >
              <Icon
                icon={ArrowDown01Icon}
                size={16}
                strokeWidth={2.2}
                className={cn(
                  "transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </Button>
          </div>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {open && (
          <tr className="border-t border-ink/8 bg-cream">
            <td colSpan={isCreator ? 8 : 7} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.15, ease: "easeOut" },
                }}
                style={{ overflow: "hidden" }}
              >
                <div className="px-4 py-5">
                  <AdminResponseDetails
                    schema={schema}
                    decoded={decoded}
                    hasEncrypted={hasEncrypted}
                    loading={!!row?.loading}
                    error={row?.error}
                    onRetry={onDecrypt}
                  />
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

function AdminResponseDetails({
  schema,
  decoded,
  hasEncrypted,
  loading,
  error,
  onRetry,
}: {
  schema: FormSchemaJson;
  decoded?: DecodedResponse;
  hasEncrypted: boolean;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink/65">
        <Icon icon={Loading03Icon} size={14} className="animate-spin text-coral" />
        {hasEncrypted ? "Decrypting…" : "Loading field data…"}
      </p>
    );
  }
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        <AlertCircleIcon size={14} />
        <span className="break-all">{error}</span>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={onRetry}
          >
            <Icon icon={Refresh01Icon} size={12} className="mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (!decoded && hasEncrypted && schema.isPrivate) {
    // Whole-form envelope: nothing can be surfaced until the session unlocks.
    return (
      <div className="space-y-3">
        {schema.fields.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-ink/10 bg-card p-3 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-ink">{f.label}</div>
              <Badge className="rounded-full border-coral/40 bg-coral/12 px-2 py-0 text-[10px] text-coral">
                <Icon icon={LockKeyIcon} size={10} className="mr-1" /> sealed
              </Badge>
            </div>
            <div className="mt-2">
              <SealedCipher size="sm" hideLabel seed={f.id} />
            </div>
          </div>
        ))}
        <p className="text-xs text-ink/55">
          Click <span className="text-ink">Decrypt</span> on this row, or unlock the
          session key to bulk-decrypt everything.
        </p>
      </div>
    );
  }
  if (!decoded) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink/65">
        <Icon icon={Loading03Icon} size={14} className="animate-spin text-coral" />
        <span>Fetching field data from Walrus…</span>
        {onRetry && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-ink/65 hover:text-ink"
            onClick={onRetry}
          >
            Load now
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {schema.fields.map((f) => {
        const v = decoded.values[f.id];
        // A sensitive field still without a plaintext value means it is
        // currently sealed (session locked or decryption pending).
        const stillSealed = f.sensitive && v === undefined;
        return (
          <div
            key={f.id}
            className="rounded-2xl border border-ink/10 bg-card p-3 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-ink">{f.label}</div>
              {f.sensitive && (
                <Badge className="rounded-full border-coral/40 bg-coral/12 px-2 py-0 text-[10px] text-coral">
                  <Icon icon={LockKeyIcon} size={10} className="mr-1" /> sealed
                </Badge>
              )}
            </div>
            {stillSealed ? (
              <div className="mt-2">
                <SealedCipher size="sm" hideLabel seed={f.id} />
              </div>
            ) : (
              <AdminFieldDisplay value={v} />
            )}
          </div>
        );
      })}
      {decoded.partial && decoded.errors.length > 0 && (
        <p className="text-xs text-destructive">
          Partial decode: {decoded.errors.join("; ")}
        </p>
      )}
    </div>
  );
}

function AdminFieldDisplay({ value }: { value: FieldValue | undefined }) {
  if (!value) return <p className="mt-1 text-sm text-ink/55">—</p>;
  switch (value.kind) {
    case "blob": {
      const isImage = value.mediaType.startsWith("image/");
      return (
        <div className="mt-2 space-y-2">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl(value.blobId)}
              alt=""
              className="max-h-72 rounded-xl border border-ink/10 object-contain"
            />
          ) : (
            <video
              src={blobUrl(value.blobId)}
              controls
              className="max-h-72 rounded-xl border border-ink/10"
            />
          )}
          <a
            href={blobUrl(value.blobId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono-display text-[10.5px] text-ink/55 underline decoration-dotted"
          >
            {value.blobId}
          </a>
        </div>
      );
    }
    case "text":
      return (
        <div className="mt-1">
          <Markdown source={value.value} size="compact" />
        </div>
      );
    case "url":
      return (
        <a
          className="mt-1 break-all text-sm text-coral underline decoration-dotted"
          href={value.value}
          target="_blank"
          rel="noopener noreferrer"
        >
          {value.value}
        </a>
      );
    default:
      return <p className="mt-1 text-sm text-ink">{fieldValueToText(value)}</p>;
  }
}

function AdminPriorityBadge({ value }: { value: number }) {
  const map = [
    { label: "—", className: "border-ink/15 bg-cream text-ink/55" },
    { label: "low", className: "border-mint/60 bg-mint/40 text-ink" },
    { label: "med", className: "border-sun/60 bg-sun/40 text-ink" },
    { label: "high", className: "border-coral/60 bg-coral/15 text-coral" },
  ] as const;
  const m = map[Math.min(3, Math.max(0, value))];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
        m.className,
      )}
    >
      {m.label}
    </span>
  );
}

const TAG_SUGGESTIONS = ["triage", "dupe", "shipped", "ignore", "follow-up"];
const NOTE_MAX = 600;

function AdminPriorityCell({
  value,
  editable,
  onChange,
}: {
  value: number;
  editable: boolean;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!editable) return <AdminPriorityBadge value={value} />;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Click to change priority"
          aria-label="Edit priority"
          aria-haspopup="dialog"
          className={cn(
            "group/prio inline-flex items-center gap-0.5 rounded-full pr-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50",
            open ? "bg-ink/8" : "hover:bg-ink/8",
          )}
        >
          <AdminPriorityBadge value={value} />
          <Icon
            icon={ArrowDown01Icon}
            size={11}
            strokeWidth={2.2}
            className={cn(
              "text-ink/40 transition-all duration-150",
              "group-hover/prio:text-ink/75 group-hover/prio:translate-y-px",
              open && "rotate-180 text-ink/75",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto flex-row items-center gap-1 p-1.5"
      >
        {[0, 1, 2, 3].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className={cn(
              "rounded-full p-1 transition-colors",
              value === p
                ? "bg-ink/8 ring-1 ring-coral/40"
                : "hover:bg-cream",
            )}
            aria-pressed={value === p}
          >
            <AdminPriorityBadge value={p} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AdminTagCell({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [lastSynced, setLastSynced] = useState(value);
  if (value !== lastSynced) {
    setLastSynced(value);
    setDraft(value);
  }

  if (!editable) {
    return <span className="text-xs text-ink/80">{value || "—"}</span>;
  }

  const commit = () => {
    const v = draft.trim();
    if (v !== value.trim()) onChange(v);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value ? "Click to edit tag" : "Click to add a tag"}
          aria-label={value ? `Edit tag, current value ${value}` : "Add tag"}
          aria-haspopup="dialog"
          className={cn(
            "group/tagcell inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50",
            value
              ? "text-ink/80 hover:bg-ink/8"
              : "border border-dashed border-ink/20 text-ink/40 hover:border-coral/50 hover:bg-coral/5 hover:text-coral",
            open && (value ? "bg-ink/8" : "border-coral/60 bg-coral/8 text-coral"),
          )}
        >
          {value ? (
            <>
              <span className="truncate">{value}</span>
              <Icon
                icon={Edit02Icon}
                size={10}
                strokeWidth={2}
                className={cn(
                  "shrink-0 text-ink/30 transition-colors",
                  "group-hover/tagcell:text-ink/70",
                  open && "text-ink/70",
                )}
              />
            </>
          ) : (
            <>
              <Icon icon={HashtagIcon} size={11} strokeWidth={2} />
              <span>add tag</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 gap-3">
        <div className="flex items-center justify-between">
          <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/55">
            edit tag
          </div>
          <span className="font-mono-display text-[9.5px] tracking-wider text-ink/40">
            ↵ save · esc cancel
          </span>
        </div>
        <div className="relative">
          <Icon
            icon={HashtagIcon}
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
          />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(value);
                setOpen(false);
              }
            }}
            className="h-9 rounded-full bg-cream pl-8"
            placeholder="label this thread"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {TAG_SUGGESTIONS.map((sug) => {
            const isCurrent = sug === value;
            return (
              <button
                key={sug}
                type="button"
                onClick={() => {
                  if (isCurrent) {
                    setOpen(false);
                    return;
                  }
                  onChange(sug);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono-display text-[10px] uppercase tracking-[0.16em] transition-colors",
                  isCurrent
                    ? "cursor-default border-coral/30 bg-coral/10 text-coral"
                    : "border-ink/12 bg-cream text-ink/55 hover:border-coral/40 hover:bg-coral/8 hover:text-coral",
                )}
              >
                #{sug}
              </button>
            );
          })}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="ml-auto rounded-full px-2 py-0.5 font-mono-display text-[10px] uppercase tracking-[0.16em] text-ink/45 transition-colors hover:text-destructive"
            >
              clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminNotePopover({
  noteBlobId,
  onChange,
}: {
  noteBlobId: string | null;
  onChange: (note: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const has = !!noteBlobId;

  const noteQuery = useQuery({
    queryKey: ["pinned-note", noteBlobId],
    queryFn: async () => {
      if (!noteBlobId) return null;
      const data = await fetchJSON<{ note?: unknown; at?: unknown }>(noteBlobId);
      return {
        note: typeof data?.note === "string" ? data.note : "",
        at: typeof data?.at === "number" ? data.at : undefined,
      };
    },
    enabled: open && !!noteBlobId,
    staleTime: 5 * 60 * 1000,
  });

  const existingNote = noteQuery.data?.note ?? "";
  const existingAt = noteQuery.data?.at;

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (open && has && noteQuery.data && hydratedFor !== noteBlobId) {
    setHydratedFor(noteBlobId);
    setDraft(noteQuery.data.note);
  }

  const loading = has && noteQuery.isPending;
  const trimmed = draft.trim();
  const dirty = has ? trimmed !== "" && draft !== existingNote : trimmed !== "";
  const count = draft.length;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setHydratedFor(null);
          setDraft("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          title={
            has
              ? "Internal note pinned — click to view or replace"
              : "No note yet — click to pin one"
          }
          aria-label={has ? "Internal note (pinned)" : "Pin an internal note"}
          aria-haspopup="dialog"
          className={cn(
            "relative rounded-full transition-all hover:scale-110",
            has
              ? "bg-coral/12 text-coral hover:bg-coral/20"
              : "border border-dashed border-ink/20 text-ink/45 hover:border-coral/50 hover:bg-coral/8 hover:text-coral",
          )}
        >
          <Icon icon={Pin02Icon} size={15} strokeWidth={2} />
          {has ? (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-coral ring-2 ring-card" />
          ) : (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-card font-mono-display text-[8px] font-bold leading-none text-ink/40 ring-1 ring-ink/15 transition-colors group-hover/button:text-coral group-hover/button:ring-coral/40"
            >
              +
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/55">
            <Icon
              icon={StickyNote02Icon}
              size={11}
              strokeWidth={2}
              className="text-coral/80"
            />
            internal note
          </div>
          <span className="font-mono-display text-[9.5px] tracking-wider text-ink/40">
            walrus · admin-only
          </span>
        </div>
        {has && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-ink/15 bg-cream/60 px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <Icon icon={Pin02Icon} size={10} className="shrink-0 text-coral/80" />
              <span
                className="truncate font-mono-display text-[10px] text-ink/55"
                title={noteBlobId!}
              >
                {noteBlobId!.slice(0, 18)}…
              </span>
            </div>
            <a
              href={blobUrl(noteBlobId!)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open raw blob on the aggregator"
              className="font-mono-display text-[9.5px] uppercase tracking-[0.16em] text-ink/45 transition-colors hover:text-coral"
            >
              raw
            </a>
          </div>
        )}
        <div className="relative">
          <Textarea
            rows={5}
            autoFocus
            disabled={loading}
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v.length > NOTE_MAX ? v.slice(0, NOTE_MAX) : v);
            }}
            placeholder={
              loading
                ? "Loading current note from Walrus…"
                : has
                  ? "Edit the pinned note…"
                  : "Visible only to admins."
            }
            className={cn(
              "resize-none rounded-2xl",
              loading && "cursor-wait opacity-70",
            )}
          />
          {loading && (
            <Icon
              icon={Loading03Icon}
              size={12}
              className="pointer-events-none absolute right-3 top-3 animate-spin text-coral"
            />
          )}
        </div>
        {noteQuery.isError && has && (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircleIcon size={11} />
              Could not load current note
            </p>
            <button
              type="button"
              onClick={() => noteQuery.refetch()}
              className="font-mono-display text-[10px] uppercase tracking-[0.16em] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
            >
              retry
            </button>
          </div>
        )}
        <div className="flex items-center justify-between font-mono-display text-[10px] text-ink/40">
          <span>
            {has
              ? loading
                ? "loading…"
                : existingAt
                  ? `pinned · ${new Date(existingAt).toLocaleString()}`
                  : "pinned"
              : ""}
          </span>
          <span>
            <span className={cn(count >= NOTE_MAX && "text-coral")}>{count}</span>
            <span className="text-ink/30"> / {NOTE_MAX}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!dirty || loading}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
            className={cn(
              "flex-1 rounded-full border-2 transition-all",
              dirty && !loading
                ? "border-coral bg-coral text-coral-foreground hover:bg-coral/90"
                : "border-ink/15 bg-cream text-ink/45",
            )}
          >
            <Icon icon={Pin02Icon} size={12} strokeWidth={2.2} className="mr-1" />
            {has ? "Save changes" : "Pin note"}
          </Button>
          {has && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-ink/55 hover:text-destructive"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Unpin
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminRowCheckbox({
  checked,
  onChange,
  label,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <label
      className="inline-flex cursor-pointer items-center"
      onClick={(e) => e.stopPropagation()}
      title={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded-md border-2 transition-all",
          checked
            ? "border-coral bg-coral text-coral-foreground"
            : indeterminate
              ? "border-coral bg-coral/15 text-coral"
              : "border-ink/25 bg-card hover:border-ink/50 peer-focus-visible:ring-2 peer-focus-visible:ring-coral/50 peer-focus-visible:ring-offset-1",
        )}
      >
        {indeterminate ? (
          <span className="block h-0.5 w-2 rounded-full bg-current" />
        ) : checked ? (
          <Icon icon={CheckmarkCircle02Icon} size={11} strokeWidth={3} />
        ) : null}
      </span>
    </label>
  );
}

function AdminHeaderCheckbox({
  visible,
  selected,
  onChange,
}: {
  visible: SubmissionView[];
  selected: Set<number>;
  onChange: (next: boolean) => void;
}) {
  const visibleIndices = visible.map((s) => s.index);
  const total = visibleIndices.length;
  const matched = visibleIndices.filter((i) => selected.has(i)).length;
  const all = total > 0 && matched === total;
  const some = matched > 0 && !all;
  return (
    <AdminRowCheckbox
      checked={all}
      indeterminate={some}
      onChange={() => onChange(!all)}
      label={
        all
          ? "Deselect all on this page"
          : some
            ? `Select remaining ${total - matched} row${total - matched > 1 ? "s" : ""}`
            : `Select all ${total} visible row${total > 1 ? "s" : ""}`
      }
    />
  );
}

function AdminBatchToolbar({
  count,
  visibleCount,
  busy,
  onClear,
  onSelectAllVisible,
  onSetPriority,
  onSetTag,
  onClearNotes,
}: {
  count: number;
  visibleCount: number;
  busy: boolean;
  onClear: () => void;
  onSelectAllVisible: () => void;
  onSetPriority: (p: number) => void;
  onSetTag: (t: string) => void;
  onClearNotes: () => void;
}) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const tooBig = count > BATCH_MAX;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "sticky top-4 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-full border-2 px-4 py-2 shadow-pop",
        tooBig
          ? "border-destructive/60 bg-destructive/10"
          : "border-coral bg-card",
      )}
    >
      <span className="grid size-7 place-items-center rounded-full bg-coral text-coral-foreground font-mono-display text-[11px] font-bold">
        {count}
      </span>
      <span className="text-sm text-ink">
        {count === 1 ? "row" : "rows"} selected
        {tooBig && (
          <span className="ml-1 text-destructive">
            · exceeds {BATCH_MAX}, deselect some first
          </span>
        )}
      </span>

      {count < visibleCount && (
        <button
          type="button"
          onClick={onSelectAllVisible}
          className="ml-1 font-mono-display text-[10px] uppercase tracking-[0.18em] text-coral underline-offset-2 hover:underline disabled:opacity-50"
          disabled={busy}
        >
          + select all {visibleCount} visible
        </button>
      )}

      <div className="mx-2 hidden h-5 w-px bg-ink/15 sm:block" />

      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || tooBig}
            className="rounded-full"
          >
            <Icon icon={ArrowDown01Icon} size={12} className="mr-1" />
            Priority
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto flex-row items-center gap-1 p-1.5"
        >
          {[0, 1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onSetPriority(p);
                setPriorityOpen(false);
              }}
              className="rounded-full p-1 transition-colors hover:bg-cream"
            >
              <AdminPriorityBadge value={p} />
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Popover
        open={tagOpen}
        onOpenChange={(o) => {
          setTagOpen(o);
          if (!o) setTagDraft("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || tooBig}
            className="rounded-full"
          >
            <Icon icon={HashtagIcon} size={12} className="mr-1" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-72 gap-3">
          <div className="flex items-center justify-between">
            <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/55">
              tag {count} row{count > 1 ? "s" : ""}
            </div>
            <span className="font-mono-display text-[9.5px] tracking-wider text-ink/40">
              ↵ apply · esc cancel
            </span>
          </div>
          <div className="relative">
            <Icon
              icon={HashtagIcon}
              size={13}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            />
            <Input
              autoFocus
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSetTag(tagDraft.trim());
                  setTagOpen(false);
                }
                if (e.key === "Escape") {
                  setTagOpen(false);
                }
              }}
              className="h-9 rounded-full bg-cream pl-8"
              placeholder="apply to all selected"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {TAG_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => {
                  onSetTag(sug);
                  setTagOpen(false);
                }}
                className="rounded-full border border-ink/12 bg-cream px-2 py-0.5 font-mono-display text-[10px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:border-coral/40 hover:bg-coral/8 hover:text-coral"
              >
                #{sug}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onSetTag("");
                setTagOpen(false);
              }}
              className="ml-auto rounded-full px-2 py-0.5 font-mono-display text-[10px] uppercase tracking-[0.16em] text-ink/45 transition-colors hover:text-destructive"
            >
              clear tags
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={confirmClear} onOpenChange={setConfirmClear}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || tooBig}
            className="rounded-full text-ink/65 hover:text-destructive"
          >
            <Icon icon={Pin02Icon} size={12} className="mr-1" />
            Unpin notes
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-64 gap-3">
          <div className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/55">
            confirm unpin
          </div>
          <p className="text-sm text-ink/75">
            Clear pinned notes on{" "}
            <span className="font-medium text-ink">{count}</span> selected
            row{count > 1 ? "s" : ""}? The Walrus blobs stay on the network — only
            the on-chain pointer is removed.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-full border-2 border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                onClearNotes();
                setConfirmClear(false);
              }}
            >
              Unpin
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-1">
        {busy && (
          <Icon
            icon={Loading03Icon}
            size={14}
            className="animate-spin text-coral"
          />
        )}
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="font-mono-display text-[10px] uppercase tracking-[0.18em] text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
        >
          clear selection
        </button>
      </div>
    </motion.div>
  );
}

// === MISSING VALIDATION FUNCTIONS ===
function requiredFieldViolation(field: Field, value: unknown): string | null {
  if (field.required && (value === undefined || value === null || value === "")) {
    return `"${field.label}" is required.`;
  }
  return null;
}

function optionalUrlFormatViolation(field: Field, value: unknown): string | null {
  if (field.type === "url" && typeof value === "string" && value !== "") {
    try {
      new URL(value);
    } catch {
      return `Please enter a valid URL for "${field.label}".`;
    }
  }
  return null;
}

function AlertCircleIcon(props: { className?: string; size?: number }) {
  const { className, size = 24, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={8} x2={12} y2={12} />
      <line x1={12} y1={16} x2={12.01} y2={16} />
    </svg>
  );
}

// === MAIN PAGE COMPONENT ===
export default function FormsPage() {
  const searchParams = useSearchParams();
  const formId = searchParams.get("id");
  const mode = searchParams.get("mode");

  if (!formId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <NarwhalMark className="mx-auto size-12 text-ink/30" />
        <h1 className="mt-4 font-display text-4xl text-ink">No form selected</h1>
        <p className="mt-2 text-sm text-ink/65">
          Please provide a form ID via the <code>?id=</code> query parameter.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-coral hover:underline"
        >
          <Icon icon={LinkBackwardIcon} size={14} /> Back to NARWHAL
        </Link>
      </div>
    );
  }

  if (mode === "admin") {
    return <AdminConsolePage formId={formId} />;
  }

  return <PublicFormPage formId={formId} />;
}