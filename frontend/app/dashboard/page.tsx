"use client";

import {
  Add01Icon,
  ArrowUpRight01Icon,
  CopyIcon,
  LockKeyIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

import { GradientCta } from "@/components/gradient-cta";
import { Icon } from "@/components/icon";
import { NarwhalMark } from "@/components/narwhal-mark";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getForm,
  listAdminCaps,
  listFormIdsWhereAdmin,
  type FormOnChain,
} from "@/lib/sui";

interface DashboardForm extends FormOnChain {
  /** Present when the wallet owns the AdminCap (i.e. the form's creator). */
  capId: string | null;
  /** "creator" → owns AdminCap; "admin" → on the form's `admins` allowlist. */
  role: "creator" | "admin";
}

async function loadDashboard(owner: string): Promise<DashboardForm[]> {
  // Two parallel sources of "forms I can administer":
  //   1. AdminCaps owned by `owner` (forms I created).
  //   2. AdminAdded events naming `owner` (forms whose creator granted me
  //      admin rights via `forms::add_admin`). These never transfer an
  //      AdminCap, so they wouldn't appear via path (1).
  const [caps, adminFormIds] = await Promise.all([
    listAdminCaps(owner),
    listFormIdsWhereAdmin(owner),
  ]);

  const capByFormId = new Map(caps.map((c) => [c.formId, c.capId]));
  // De-duplicate: if I'm both creator and listed as admin (unusual but
  // possible), the creator role wins because it carries the AdminCap.
  const formIds = new Set<string>([...capByFormId.keys(), ...adminFormIds]);

  const results = await Promise.all(
    Array.from(formIds).map(async (formId) => {
      const form = await getForm(formId);
      if (!form) return null;
      const capId = capByFormId.get(formId) ?? null;
      // Re-verify on-chain that I'm still an admin; `remove_admin` would
      // have cleared the VecSet entry while the historical event remains.
      const stillAdmin = capId !== null || form.admins.includes(owner);
      if (!stillAdmin) return null;
      return {
        ...form,
        capId,
        role: capId ? "creator" : "admin",
      } as DashboardForm;
    }),
  );
  return results
    .filter((f): f is DashboardForm => f !== null)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export default function DashboardPage() {
  const account = useCurrentAccount();
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard", account?.address],
    queryFn: () => loadDashboard(account!.address),
    enabled: !!account,
  });

  return (
    <div className="bg-warm-fade">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip border border-ink/15 text-ink/65">
              <Icon icon={SparklesIcon} size={12} className="text-coral" />
              your forms
            </span>
            <h1 className="mt-3 font-display text-5xl leading-[1.04] tracking-tight text-ink md:text-6xl">
              The forms you&apos;ve <span className="italic text-coral">already shipped.</span>
            </h1>
            <p className="mt-3 max-w-md text-base text-ink/65">
              Forms you created with this wallet. Click any one to triage submissions or copy a
              fresh sharing link.
            </p>
          </div>
          <Link href="/forms/new">
            <GradientCta tone="coral" size="lg">
              <Icon icon={Add01Icon} size={16} strokeWidth={2.2} /> New form
            </GradientCta>
          </Link>
        </div>

        {!account ? (
          <ConnectGate />
        ) : error ? (
          <p className="text-sm text-destructive">
            Failed to load: {error instanceof Error ? error.message : "?"}
          </p>
        ) : isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-3xl" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((f, i) => (
              <FormCard key={f.formId} form={f} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function ConnectGate() {
  return (
    <div className="rounded-4xl border border-dashed border-ink/15 bg-card p-12 text-center shadow-soft">
      <NarwhalMark className="mx-auto size-10 text-coral" withSparkle />
      <h2 className="mt-4 font-display text-3xl text-ink">Connect a wallet</h2>
      <p className="mt-2 text-sm text-ink/65">
        Your AdminCaps live on Sui. Connect to see the forms you own.
      </p>
      <div className="mt-6 inline-block">
        <ConnectButton />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-4xl border border-dashed border-ink/15 bg-card p-12 text-center shadow-soft">
      <NarwhalMark className="mx-auto size-10 text-coral" withSparkle />
      <p className="mt-4 font-script text-2xl text-coral">No tusks deployed yet ✦</p>
      <h2 className="mt-1 font-display text-3xl text-ink">Ready when you are</h2>
      <p className="mt-2 text-sm text-ink/65">
        It takes about 30 seconds to publish your first form.
      </p>
      <div className="mt-6">
        <Link href="/forms/new">
          <GradientCta tone="coral" size="lg">
            <Icon icon={Add01Icon} size={16} strokeWidth={2.2} /> Forge a form
          </GradientCta>
        </Link>
      </div>
    </div>
  );
}

function FormCard({ form, index }: { form: DashboardForm; index: number }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/forms?id=${form.formId}`
      : `/forms?id=${form.formId}`;
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-ink/10 bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-coral/40 hover:shadow-coral"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono-display text-[10.5px] uppercase tracking-[0.32em] text-ink/45">
          /{(index + 1).toString().padStart(2, "0")}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {form.role === "admin" && (
            <Badge
              variant="outline"
              className="rounded-full border-mint/50 bg-mint/15 px-2 py-0 text-[10px] text-ink/75"
              title="You were added to this form's admin allowlist by its creator."
            >
              admin
            </Badge>
          )}
          {form.isPrivate && (
            <Badge className="rounded-full border-coral/40 bg-coral/12 px-2 py-0 text-[10px] text-coral">
              <Icon icon={LockKeyIcon} size={10} strokeWidth={2.2} className="mr-1" /> private
            </Badge>
          )}
          {form.requireWallet && (
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
              wallet
            </Badge>
          )}
          {form.archived && (
            <Badge
              variant="outline"
              className="rounded-full border-destructive/40 px-2 py-0 text-[10px] text-destructive"
            >
              archived
            </Badge>
          )}
        </div>
      </div>

      <Link href={`/forms?id=${form.formId}&mode=admin`} className="space-y-1.5 outline-none">
        <h3 className="font-display text-3xl leading-tight tracking-tight text-ink transition-colors group-hover:text-coral">
          {form.title}
        </h3>
        <p className="font-mono-display text-[10.5px] text-ink/55">
          {form.formId.slice(0, 8)}…{form.formId.slice(-6)}
        </p>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
        <div>
          <div className="font-display text-4xl leading-none text-ink">
            {form.submissionCount}
          </div>
          <div className="mt-1 font-mono-display text-[10.5px] uppercase tracking-[0.18em] text-ink/55">
            submissions
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyShare}
            aria-label="Copy share link"
            title="Copy share link"
            className="grid size-10 place-items-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-colors hover:bg-ink/8 hover:text-ink"
          >
            <Icon icon={CopyIcon} size={16} />
          </button>
          <Link
            href={`/forms?id=${form.formId}&mode=admin`}
            aria-label="Open admin console"
            title="Open admin"
            className="grid size-10 place-items-center rounded-full bg-ink text-on-ink transition-colors hover:bg-coral"
          >
            <Icon icon={ArrowUpRight01Icon} size={16} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
