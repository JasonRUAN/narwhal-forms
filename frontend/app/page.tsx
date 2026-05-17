"use client";

import {
  ArrowRight01Icon,
  Bug01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  CloudUploadIcon,
  CursorTextIcon,
  Database01Icon,
  HashtagIcon,
  Image01Icon,
  Key01Icon,
  Link04Icon,
  LockKeyIcon,
  ParagraphIcon,
  Shield01Icon,
  SortByDown01Icon,
  SparklesIcon,
  StarIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import Link from "next/link";

import { GradientCta } from "@/components/gradient-cta";
import { Icon } from "@/components/icon";
import { MarqueeStrip } from "@/components/marquee-strip";
import { NarwhalMark } from "@/components/narwhal-mark";
import { SealedCipher, deriveCipherChunks } from "@/components/sealed-cipher";
import { FIELD_DESCRIPTIONS } from "@/lib/schema";
import { cn } from "@/lib/utils";

const fieldCards = [
  { type: "short_text", icon: CursorTextIcon, label: "Short text" },
  { type: "rich_text", icon: ParagraphIcon, label: "Rich text" },
  { type: "number", icon: HashtagIcon, label: "Number" },
  { type: "dropdown", icon: SortByDown01Icon, label: "Dropdown" },
  { type: "checkbox", icon: CheckmarkSquare02Icon, label: "Checkboxes" },
  { type: "star_rating", icon: StarIcon, label: "Star rating" },
  { type: "screenshot", icon: Image01Icon, label: "Screenshot" },
  { type: "video", icon: Video01Icon, label: "Video upload" },
  { type: "url", icon: Link04Icon, label: "URL" },
  { type: "confirm", icon: CheckmarkCircle02Icon, label: "Confirmation" },
] as const;

const stack = [
  {
    icon: Database01Icon,
    headline: "Walrus is the spine.",
    body: "Every schema, every response, every screenshot or video lives on Walrus — content-addressed, verifiable, organised by form.",
    accent: "01",
  },
  {
    icon: Key01Icon,
    headline: "Seal keeps the secrets.",
    body: "Mark a form private, or just a single field sensitive. Threshold-encrypted with Seal, the rest of the world sees only ciphertext.",
    accent: "02",
  },
  {
    icon: Shield01Icon,
    headline: "Sui keeps the receipts.",
    body: "Your AdminCap is an on-chain object. Allowlists are Move state. seal_approve is a pure function anyone can audit.",
    accent: "03",
  },
];

const useCases = [
  "Bug reports",
  "Feature requests",
  "Surveys",
  "Applications",
  "Beta sign-ups",
  "Customer interviews",
];

export default function Home() {
  return (
    <div className="relative isolate overflow-hidden">
      <Hero />
      <MarqueeStrip items={useCases} />
      <FieldGrid />
      <StackTriptych />
      <FinalCta />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-warm-mesh">
      <FloatingBlobs />
      <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-4 pb-24 pt-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:pt-24 lg:px-10">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 inline-flex w-fit items-center gap-2 rounded-full bg-ink/8 px-3 py-1.5 text-ink/75"
          >
            <Icon icon={SparklesIcon} size={14} className="text-coral" />
            <span className="font-mono-display text-[11px] uppercase tracking-[0.24em]">
              live on sui testnet
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-display text-balance text-[clamp(3rem,8.5vw,6.5rem)] leading-[0.95] tracking-tight text-ink"
          >
            Forms that feel
            <br />
            like a{" "}
            <span className="relative inline-block italic text-coral">
              conversation
              <svg
                className="absolute -bottom-3 left-0 right-0 mx-auto w-full"
                height="14"
                viewBox="0 0 220 14"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M3 8 C 50 1 110 14 218 5"
                  stroke="var(--coral)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mt-7 max-w-lg text-balance text-lg leading-relaxed text-ink/65"
          >
            <strong className="text-ink">NARWHAL</strong> is a feedback and forms platform native
            to Walrus. Bug reports, surveys, applications &mdash; collected one beautiful question
            at a time, encrypted with Seal, and owned by you on Sui.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href="/forms/new">
              <GradientCta tone="ink" size="xl">
                Get started, it&apos;s free
                <Icon icon={ArrowRight01Icon} size={18} strokeWidth={2} />
              </GradientCta>
            </Link>
            <Link href="/dashboard">
              <GradientCta tone="ghost" size="xl">
                See your forms
              </GradientCta>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-12 grid max-w-md grid-cols-3 gap-4 text-xs"
          >
            {[
              { k: "10", label: "field types" },
              { k: "2/2", label: "Seal threshold" },
              { k: "0", label: "servers you trust" },
            ].map((m) => (
              <div key={m.label} className="border-l-2 border-coral/40 pl-3">
                <div className="font-display text-3xl text-ink">{m.k}</div>
                <div className="mt-1 font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/55">
                  {m.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative flex items-center justify-center">
          <PhoneCard />
        </div>
      </div>
    </section>
  );
}

function FloatingBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="blob-drift absolute -left-20 top-10 h-72 w-72 rounded-full bg-blush blur-3xl opacity-70" />
      <div
        className="blob-drift absolute right-[-8%] top-32 h-96 w-96 rounded-full bg-sun blur-3xl opacity-70"
        style={{ animationDelay: "-4s" }}
      />
      <div
        className="blob-drift absolute left-1/3 -bottom-32 h-80 w-80 rounded-full bg-mint blur-3xl opacity-60"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}

const phoneSteps = [
  {
    label: "What's broken?",
    body: "The submit button vanishes after I attach a screenshot…",
    chip: "01 / Rich text",
    Comp: () => (
      <div className="space-y-3">
        <div className="text-base text-ink/85 leading-relaxed">
          The submit button vanishes after I attach a screenshot…
        </div>
        <div className="h-0.5 w-full bg-coral" />
      </div>
    ),
  },
  {
    label: "How frustrating was it?",
    chip: "02 / Star rating",
    Comp: () => (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon
            key={n}
            icon={StarIcon}
            size={36}
            strokeWidth={1.5}
            className={n <= 4 ? "text-coral" : "text-ink/20"}
          />
        ))}
      </div>
    ),
  },
  {
    label: "Page URL?",
    chip: "03 / URL",
    Comp: () => (
      <div className="space-y-3">
        <div className="text-base text-ink/85">https://narwhal.app/forms/new</div>
        <div className="h-0.5 w-full bg-coral" />
      </div>
    ),
  },
  {
    label: "Encrypted notes for the team",
    chip: "04 / Sensitive ⌖",
    Comp: () => <SealedCipher seed="phone-notes" size="sm" chunkCount={3} />,
  },
];

function PhoneCard() {
  return (
    <div className="relative w-full max-w-md">
      {/* speech bubble accents */}
      <div
        aria-hidden
        className="absolute -left-6 -top-6 hidden md:block font-script text-2xl text-coral"
      >
        beautiful by default ✦
      </div>
      <div
        aria-hidden
        className="absolute -right-3 bottom-12 hidden md:block font-script text-xl text-ink/65"
      >
        owned by you ↗
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.7 }}
        className="relative flex min-h-[34rem] w-full flex-col rounded-[40px] border border-ink/12 bg-card p-6 shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-ink/8 pb-3">
          <div className="flex items-center gap-2">
            <NarwhalMark className="size-5 text-coral" />
            <span className="font-display text-sm tracking-tight text-ink">narwhal · live preview</span>
          </div>
          <span className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/45">
            04 of 10
          </span>
        </div>

        <div className="relative mt-6 flex flex-1 flex-col gap-5">
          {phoneSteps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.18 }}
              className={cn(
                "space-y-2",
                i === phoneSteps.length - 1 && "rounded-2xl bg-cream/70 p-3",
              )}
            >
              <div className="font-mono-display text-[10px] uppercase tracking-[0.2em] text-ink/45">
                {s.chip}
              </div>
              <div className="font-display text-lg text-ink">{s.label}</div>
              <s.Comp />
            </motion.div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/8 pt-4">
          <span className="inline-flex items-center gap-1.5 font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/50">
            press
            <kbd className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-1.5 py-0.5 text-[10.5px] font-medium normal-case tracking-normal text-ink/70 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
              enter ↵
            </kbd>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-1.5 text-sm font-medium text-coral-foreground">
            OK
            <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.2} />
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function FieldGrid() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-3">
            <span className="chip border border-ink/15 text-ink/65">
              <Icon icon={SparklesIcon} size={12} className="text-coral" />
              the kit
            </span>
            <h2 className="font-display text-balance text-5xl leading-[1.04] tracking-tight text-ink md:text-6xl">
              Ten fields,
              <span className="italic text-coral"> infinite forms.</span>
            </h2>
            <p className="text-base text-ink/65">
              Compose a form once. Drag, mark required, mark sensitive. NARWHAL gives respondents the
              cleanest one-question-at-a-time experience they have ever scrolled past.
            </p>
          </div>
          <Link href="/forms/new">
            <GradientCta tone="coral" size="lg">
              Build one now <Icon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </GradientCta>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {fieldCards.map((f, i) => (
            <motion.div
              key={f.type}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 5) * 0.05 }}
              className="group flex flex-col gap-4 rounded-3xl border border-ink/10 bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-coral/40 hover:shadow-coral"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl text-coral transition-colors",
                    "bg-coral/10 group-hover:bg-coral group-hover:text-coral-foreground",
                  )}
                >
                  <Icon icon={f.icon} size={22} />
                </span>
                <span className="font-mono-display text-[10px] uppercase tracking-[0.22em] text-ink/40">
                  /{(i + 1).toString().padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="font-display text-2xl leading-tight text-ink">{f.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  {FIELD_DESCRIPTIONS[f.type]}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackTriptych() {
  return (
    <section className="border-y border-ink/10 bg-cream">
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-10">
        <div className="max-w-2xl space-y-3">
          <span className="chip border border-ink/15 text-ink/65">
            <Icon icon={LockKeyIcon} size={12} className="text-coral" />
            stack
          </span>
          <h2 className="font-display text-5xl leading-[1.04] tracking-tight text-ink md:text-6xl">
            Three pieces,
            <span className="italic text-coral"> one promise.</span>
          </h2>
          <p className="text-base text-ink/65">
            Walrus, Seal and Sui have been quietly building the storage, encryption and ledger
            primitives we needed. NARWHAL stitches them together so you get a feedback platform that
            never asks you to trust a server again.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {stack.map((s, i) => (
            <motion.div
              key={s.headline}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft"
            >
              <span className="font-mono-display text-[11px] uppercase tracking-[0.24em] text-coral">
                {s.accent}
                {" //"}
              </span>
              <span className="ml-2 font-mono-display text-[11px] uppercase tracking-[0.24em] text-ink/45">
                {i === 0 ? "storage" : i === 1 ? "encryption" : "ownership"}
              </span>
              <span className="mt-5 inline-flex size-12 items-center justify-center rounded-2xl bg-ink text-coral">
                <Icon icon={s.icon} size={22} />
              </span>
              <h3 className="mt-4 font-display text-3xl leading-tight text-ink">{s.headline}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/65">{s.body}</p>
            </motion.div>
          ))}
        </div>

        <ResponsePreview />
      </div>
    </section>
  );
}

function ResponsePreview() {
  const rows = [
    { label: "name", value: "Ada", encrypted: false },
    { label: "email", value: "ada@…", encrypted: true },
    { label: "rating", value: "★ ★ ★ ★ ☆", encrypted: false },
    { label: "screenshot", value: "blob:0x9f…", encrypted: false },
    {
      label: "private notes",
      value: "I think the pricing page…",
      encrypted: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6 }}
      className="mt-14 grid gap-8 md:grid-cols-[1.05fr_0.95fr]"
    >
      <div className="space-y-4">
        <span className="chip border border-coral/40 bg-coral/10 text-coral">
          <Icon icon={LockKeyIcon} size={12} />
          hybrid encryption
        </span>
        <h3 className="font-display text-4xl leading-tight text-ink md:text-5xl">
          Encrypt the whole envelope, or just the bits that matter.
        </h3>
        <p className="max-w-prose text-base text-ink/65">
          Toggle <span className="text-ink">private</span> on a form to encrypt every response, or
          mark individual fields <span className="text-ink">sensitive</span> to wrap just those
          values. Only the creator and allowlisted admins can ever decrypt.
        </p>
        <ul className="mt-4 grid gap-3 text-sm text-ink/65">
          <li className="flex items-start gap-3">
            <Icon icon={LockKeyIcon} className="mt-0.5 text-coral" size={16} />
            AES-GCM data encryption with Seal-derived keys.
          </li>
          <li className="flex items-start gap-3">
            <Icon icon={Shield01Icon} className="mt-0.5 text-coral" size={16} />
            seal_approve enforces creator + allowlist on Sui.
          </li>
          <li className="flex items-start gap-3">
            <Icon icon={Key01Icon} className="mt-0.5 text-coral" size={16} />
            SessionKey gives admins one-prompt batch decrypt.
          </li>
        </ul>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between border-b border-ink/8 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-coral/70" />
            <span className="size-2.5 rounded-full bg-sun" />
            <span className="size-2.5 rounded-full bg-mint" />
            <span className="ml-3 font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/45">
              response.json · walrus stream
            </span>
          </div>
          <span className="font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/45">
            v1
          </span>
        </div>
        <div className="mt-4 space-y-2.5 font-mono-display text-[12.5px]">
          {rows.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border px-3 py-2",
                r.encrypted
                  ? "border-coral/40 bg-coral/8 text-coral"
                  : "border-ink/10 bg-cream text-ink/85",
              )}
            >
              <span className="text-ink/55">{r.label}</span>
              {r.encrypted ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Icon icon={LockKeyIcon} size={11} strokeWidth={2} />
                  <span className="tracking-normal">
                    {deriveCipherChunks(r.label, 3).join("·")}
                  </span>
                </span>
              ) : (
                <span className="font-medium">{r.value}</span>
              )}
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/45">
          <span className="inline-flex items-center gap-1.5">
            <Icon icon={CloudUploadIcon} size={12} /> walrus blob
          </span>
          <span>↘ admin · sui · seal_approve ↗</span>
        </div>
      </div>
    </motion.div>
  );
}

function FinalCta() {
  return (
    <section className="bg-ink py-24 text-on-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-10 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="max-w-2xl space-y-5">
          <span className="chip border border-on-ink/20 text-on-ink/70">
            <Icon icon={Bug01Icon} size={12} className="text-coral" />
            ship better
          </span>
          <h2 className="font-display text-5xl leading-[1.05] text-on-ink md:text-7xl">
            Get the answers
            <br />
            <span className="italic text-coral">your roadmap deserves.</span>
          </h2>
          <p className="text-base text-on-ink/65">
            Forge your first NARWHAL in about 30 seconds. No account, no SaaS, no credit card &mdash;
            just a wallet and a form people will actually finish.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/forms/new">
            <GradientCta tone="coral" size="xl">
              Forge a NARWHAL
              <Icon icon={ArrowRight01Icon} size={20} strokeWidth={2} />
            </GradientCta>
          </Link>
          <Link href="/dashboard">
            <GradientCta tone="ghost" size="xl" className="bg-transparent text-on-ink border-on-ink/30 hover:bg-on-ink/10">
              View dashboard
            </GradientCta>
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-20 flex w-full max-w-7xl flex-col items-start gap-3 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          <NarwhalMark className="size-7 text-coral" />
          <div>
            <div className="font-display text-lg leading-none text-on-ink">NARWHAL</div>
            <div className="mt-1 font-mono-display text-[10.5px] uppercase tracking-[0.28em] text-on-ink/55">
              the tusk that listens
            </div>
          </div>
        </div>
        <div className="font-mono-display text-[10.5px] uppercase tracking-[0.24em] text-on-ink/55">
          transmitted from walrus sessions · ⌖ 2026 · narwhal collective
        </div>
      </div>
    </section>
  );
}
