"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  CursorTextIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  HashtagIcon,
  Image01Icon,
  Link04Icon,
  LockKeyIcon,
  ParagraphIcon,
  SortByDown01Icon,
  SparklesIcon,
  StarIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { GradientCta } from "@/components/gradient-cta";
import { Icon } from "@/components/icon";
import { NarwhalMark } from "@/components/narwhal-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultFieldFor,
  FIELD_LABELS,
  FIELD_TYPES,
  formSchemaJson,
  type Field,
  type FieldType,
  type FormSchemaJson,
} from "@/lib/schema";
import {
  buildAddAdminTx,
  buildAddAllowlistTx,
  buildCreateFormTx,
  getJsonRpcClient,
} from "@/lib/sui";
import { uploadJSON } from "@/lib/walrus";
import { cn } from "@/lib/utils";

const ICONS: Record<FieldType, typeof ParagraphIcon> = {
  short_text: CursorTextIcon,
  rich_text: ParagraphIcon,
  number: HashtagIcon,
  dropdown: SortByDown01Icon,
  checkbox: CheckmarkSquare02Icon,
  star_rating: StarIcon,
  screenshot: Image01Icon,
  video: Video01Icon,
  url: Link04Icon,
  confirm: CheckmarkCircle02Icon,
};

const FIELD_PALETTE: { type: FieldType; label: string }[] = FIELD_TYPES.map((t) => ({
  type: t,
  label: FIELD_LABELS[t],
}));

export default function NewFormPage() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [requireWallet, setRequireWallet] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(true);
  const [admins, setAdmins] = useState<string[]>([]);
  const [adminInput, setAdminInput] = useState("");
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [allowlistInput, setAllowlistInput] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const activeField = fields.find((f) => f.id === activeId) ?? null;

  const addField = (type: FieldType) => {
    const f = defaultFieldFor(type, fields.length);
    setFields((prev) => [...prev, f]);
    setActiveId(f.id);
  };

  const updateField = (id: string, patch: Partial<Field>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const moveField = (id: string, dir: -1 | 1) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      const [removed] = copy.splice(idx, 1);
      copy.splice(j, 0, removed);
      return copy;
    });
  };

  const addAdmin = () => {
    const v = adminInput.trim();
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(v)) {
      toast.error("Admin address must look like 0x…");
      return;
    }
    if (admins.includes(v)) return;
    setAdmins([...admins, v]);
    setAdminInput("");
  };

  const addAllowlistAddr = () => {
    const v = allowlistInput.trim();
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(v)) {
      toast.error("Allowlist address must look like 0x…");
      return;
    }
    if (allowlist.includes(v)) return;
    setAllowlist([...allowlist, v]);
    setAllowlistInput("");
  };

  /**
   * "Require wallet" gates both `allow_duplicate=false` and the allowlist.
   * When the creator turns it OFF we proactively relax the dependent
   * options so the form passes both client-side `superRefine` and the
   * on-chain `EAllowlistRequiresWallet` / `ENoDuplicateRequiresWallet`
   * guards in `forms.move`.
   */
  const handleRequireWalletChange = (v: boolean) => {
    setRequireWallet(v);
    if (!v) {
      setAllowDuplicate(true);
      if (allowlist.length > 0) setAllowlist([]);
    }
  };

  const publish = async () => {
    if (!account) {
      toast.error("Connect a wallet to publish a form.");
      return;
    }
    const draft: FormSchemaJson = {
      version: 1,
      title,
      description,
      isPrivate,
      requireWallet,
      allowDuplicate,
      allowlist,
      fields,
    };
    const parsed = formSchemaJson.safeParse(draft);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".") || "form"}: ${first.message}`);
      return;
    }
    setPublishing(true);
    const t = toast.loading("Uploading schema to Walrus…");
    try {
      const blob = await uploadJSON(parsed.data);
      toast.message("Walrus blob created", { id: t, description: blob.blobId });

      toast.loading("Submitting Sui transaction…", { id: t });
      const tx = buildCreateFormTx({
        title: parsed.data.title,
        schemaBlobId: blob.blobId,
        isPrivate: parsed.data.isPrivate,
        requireWallet: parsed.data.requireWallet,
        allowDuplicate: parsed.data.allowDuplicate,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Transaction failed",
        );
      }
      const digest = result.Transaction.digest;

      const client = getJsonRpcClient();
      await client.waitForTransaction({ digest });
      const tx2 = await client.getTransactionBlock({
        digest,
        options: { showObjectChanges: true, showEvents: true },
      });
      const created = (tx2.objectChanges ?? []).find(
        (c) =>
          c.type === "created" &&
          typeof c.objectType === "string" &&
          c.objectType.endsWith("::forms::Form"),
      );
      const formId = created && "objectId" in created ? created.objectId : undefined;

      // Both `add_admin` and `add_allowlist` need the AdminCap, so we look
      // it up once and reuse it for both follow-up batches.
      const needsFollowup = formId && (admins.length > 0 || allowlist.length > 0);
      if (needsFollowup) {
        const cap = (tx2.objectChanges ?? []).find(
          (c) =>
            c.type === "created" &&
            typeof c.objectType === "string" &&
            c.objectType.endsWith("::forms::AdminCap"),
        );
        const capId = cap && "objectId" in cap ? cap.objectId : undefined;
        if (capId) {
          for (const admin of admins) {
            const adminTx = buildAddAdminTx({ formId, adminCapId: capId, admin });
            await dAppKit.signAndExecuteTransaction({ transaction: adminTx });
          }
          for (const addr of allowlist) {
            const allowTx = buildAddAllowlistTx({ formId, adminCapId: capId, addr });
            await dAppKit.signAndExecuteTransaction({ transaction: allowTx });
          }
        }
      }

      if (formId) {
        toast.success("Locked on-chain", {
          id: t,
          description: "Redirecting to admin console…",
        });
        router.push(`/forms?id=${formId}&mode=admin`);
      } else {
        toast.success("Form created. Check your dashboard.", { id: t });
        router.push("/dashboard");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error("Publish failed", { id: t, description: msg });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="bg-warm-mesh">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-12 sm:px-6 lg:px-10">
          <div>
            <span className="chip border border-ink/15 text-ink/65">
              <Icon icon={SparklesIcon} size={12} className="text-coral" />
              forge studio
            </span>
            <h1 className="mt-3 font-display text-5xl leading-[1.04] tracking-tight text-ink md:text-6xl">
              Build something{" "}
              <span className="italic text-coral">people will fill out.</span>
            </h1>
            <p className="mt-2 max-w-xl text-base text-ink/65">
              Drag in fields, mark them required or sensitive, and publish to Walrus + Sui in one
              click.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GradientCta
              tone="coral"
              size="lg"
              disabled={publishing || !account || fields.length === 0}
              onClick={publish}
            >
              {publishing ? "Publishing…" : "Publish form"}
              <Icon icon={ArrowRight01Icon} size={18} strokeWidth={2.2} />
            </GradientCta>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-10">
        <div className="space-y-6">
          <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-coral/10 text-coral">
                <Icon icon={SparklesIcon} size={18} />
              </span>
              <div>
                <h2 className="font-display text-2xl text-ink">Identity</h2>
                <p className="text-sm text-ink/60">
                  Title and description appear at the top of the public form.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="e.g. Bug report"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Tell respondents what this form is for."
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-coral/10 text-coral">
                  <Icon icon={CheckmarkSquare02Icon} size={18} />
                </span>
                <div>
                  <h2 className="font-display text-2xl text-ink">Fields</h2>
                  <p className="text-sm text-ink/60">
                    Add, remove, reorder. Mark per-field required or sensitive.
                  </p>
                </div>
              </div>
              <FieldPaletteMenu onPick={addField} />
            </div>

            {fields.length === 0 ? (
              <ul className="mt-5">
                <li className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center text-sm text-ink/55">
                  Pick a field type to get started.
                </li>
              </ul>
            ) : (
              <Reorder.Group
                as="ul"
                axis="y"
                values={fields}
                onReorder={setFields}
                className="mt-5 space-y-2"
              >
                {fields.map((f, idx) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    index={idx}
                    total={fields.length}
                    active={f.id === activeId}
                    onSelect={() => setActiveId(f.id)}
                    onMove={(dir) => moveField(f.id, dir)}
                    onRemove={() => removeField(f.id)}
                  />
                ))}
              </Reorder.Group>
            )}
          </section>

          {activeField && (
            <FieldEditor
              field={activeField}
              onChange={(patch) => updateField(activeField.id, patch)}
              key={activeField.id}
            />
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <NarwhalMark className="size-6 text-coral" />
              <h2 className="font-display text-xl text-ink">Privacy</h2>
            </div>
            <div className="mt-4 space-y-4">
              <Toggle
                label="Private form"
                description="Encrypt every response end-to-end with Seal. Only creator + admins decrypt."
                value={isPrivate}
                onChange={setIsPrivate}
              />
              <Toggle
                label="Require wallet"
                description="Record each respondent's Sui address. When off, NARWHAL stores submitter as anonymous."
                value={requireWallet}
                onChange={handleRequireWalletChange}
              />
              <Toggle
                label="Allow duplicate submissions"
                description="When off, the same wallet can only submit once. Requires 'Require wallet'."
                value={allowDuplicate}
                onChange={setAllowDuplicate}
                disabled={!requireWallet}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl text-ink">Submission allowlist</h2>
            <p className="mt-1 text-sm text-ink/65">
              {requireWallet ? (
                allowlist.length > 0
                  ? "Only listed addresses can submit a response."
                  : "Optional. Leave empty to let any wallet submit. Add addresses to gate submissions."
              ) : (
                <span className="text-ink/45">
                  Enable <span className="font-medium">Require wallet</span> to gate submissions
                  by address.
                </span>
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                value={allowlistInput}
                onChange={(e) => setAllowlistInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAllowlistAddr();
                  }
                }}
                placeholder="0x…"
                className="font-mono-display text-xs"
                disabled={!requireWallet}
              />
              <Button
                variant="secondary"
                onClick={addAllowlistAddr}
                disabled={!requireWallet}
              >
                Add
              </Button>
            </div>
            {allowlist.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {allowlist.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => setAllowlist((prev) => prev.filter((x) => x !== a))}
                      className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono-display text-[10.5px] text-ink/70 transition-colors hover:border-destructive hover:text-destructive"
                      title="Remove"
                    >
                      {a.slice(0, 6)}…{a.slice(-4)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl text-ink">Admin allowlist</h2>
            <p className="mt-1 text-sm text-ink/65">
              These addresses can read encrypted responses, set priority, tag, and add notes.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAdmin();
                  }
                }}
                placeholder="0x…"
                className="font-mono-display text-xs"
              />
              <Button variant="secondary" onClick={addAdmin}>
                Add
              </Button>
            </div>
            {admins.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {admins.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => setAdmins((prev) => prev.filter((x) => x !== a))}
                      className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono-display text-[10.5px] text-ink/70 transition-colors hover:border-destructive hover:text-destructive"
                      title="Remove"
                    >
                      {a.slice(0, 6)}…{a.slice(-4)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="px-1 text-xs text-ink/55">
            Need help?{" "}
            <Link href="/" className="font-medium text-coral underline decoration-dotted">
              Back to NARWHAL
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream/60 p-3",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs leading-relaxed text-ink/60">{description}</div>
      </div>
    </label>
  );
}

function FieldRow({
  field,
  index,
  total,
  active,
  onSelect,
  onMove,
  onRemove,
}: {
  field: Field;
  index: number;
  total: number;
  active: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const FieldIcon = ICONS[field.type];
  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={controls}
      whileDrag={{
        scale: 1.015,
        boxShadow: "0 18px 40px -18px rgba(15, 23, 42, 0.28)",
      }}
      transition={{ type: "spring", stiffness: 600, damping: 40 }}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border-2 bg-card p-3 transition-colors",
        active ? "border-coral bg-coral/5" : "border-ink/10 hover:border-ink/30",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="-ml-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink/70 active:cursor-grabbing"
      >
        <Icon icon={DragDropVerticalIcon} size={16} />
      </button>
      <button
        type="button"
        className="flex flex-1 items-center gap-3 text-left"
        onClick={onSelect}
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-cream text-ink/80">
          <Icon icon={FieldIcon} size={16} />
        </span>
        <div>
          <div className="text-sm font-medium text-ink">
            {field.label || "(untitled)"}
          </div>
          <div className="font-mono-display text-[10.5px] uppercase tracking-[0.22em] text-ink/55">
            {FIELD_LABELS[field.type]}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5">
        {field.required && (
          <Badge variant="outline" className="rounded-full border-ink/25 px-2 py-0 text-[10px]">
            required
          </Badge>
        )}
        {field.sensitive && (
          <Badge className="rounded-full border-coral/40 bg-coral/12 px-2 py-0 text-[10px] text-coral">
            <Icon icon={LockKeyIcon} size={10} strokeWidth={2} className="mr-1" />
            sealed
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          <Icon icon={ArrowUp01Icon} size={14} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
        >
          <Icon icon={ArrowDown01Icon} size={14} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          className="text-destructive"
        >
          <Icon icon={Delete02Icon} size={14} />
        </Button>
      </div>
    </Reorder.Item>
  );
}

function FieldPaletteMenu({ onPick }: { onPick: (t: FieldType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} variant="outline" className="rounded-full">
        <Icon icon={Add01Icon} size={14} className="mr-1" /> Add field
      </Button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-3xl border border-ink/15 bg-popover shadow-pop"
        >
          <ul className="grid grid-cols-2 gap-px bg-ink/8">
            {FIELD_PALETTE.map((p) => {
              const FieldIcon = ICONS[p.type];
              return (
                <li key={p.type}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p.type);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 bg-popover px-4 py-3 text-left text-xs transition-colors hover:bg-coral/8 hover:text-coral"
                  >
                    <Icon icon={FieldIcon} size={14} />
                    <span className="font-medium text-ink">{p.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
}: {
  field: Field;
  onChange: (patch: Partial<Field>) => void;
}) {
  const usesOptions = field.type === "dropdown" || field.type === "checkbox";
  const usesStars = field.type === "star_rating";
  const usesFileLimit = field.type === "screenshot" || field.type === "video";
  const usesMaxLength = field.type === "short_text";
  const usesNumberBounds = field.type === "number";
  return (
    <section className="rounded-3xl border border-ink/10 bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Field</h2>
          <p className="font-mono-display text-[11px] uppercase tracking-[0.22em] text-ink/55">
            {field.id} · {FIELD_LABELS[field.type]}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <Switch
              checked={field.required}
              onCheckedChange={(v) => onChange({ required: v })}
            />
            <span>Required</span>
          </label>
          <label className="flex items-center gap-1.5">
            <Switch
              checked={field.sensitive}
              onCheckedChange={(v) => onChange({ sensitive: v })}
            />
            <span className="flex items-center gap-1 text-coral">
              <Icon icon={LockKeyIcon} size={12} /> Sensitive
            </span>
          </label>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Helper text</Label>
          <Input
            value={field.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>
      {usesOptions && (
        <div className="mt-5 space-y-2">
          <Label>Options (one per line)</Label>
          <Textarea
            rows={4}
            value={(field.options ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      )}
      {usesStars && (
        <div className="mt-5 grid w-40 gap-2">
          <Label>Max stars</Label>
          <Input
            type="number"
            min={3}
            max={10}
            value={field.maxStars ?? 5}
            onChange={(e) =>
              onChange({
                maxStars: Math.max(3, Math.min(10, Number(e.target.value) || 5)),
              })
            }
          />
        </div>
      )}
      {usesFileLimit && (
        <div className="mt-5 grid w-40 gap-2">
          <Label>Max size (MB)</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={field.maxFileMb ?? 10}
            onChange={(e) =>
              onChange({
                maxFileMb: Math.max(1, Math.min(200, Number(e.target.value) || 10)),
              })
            }
          />
        </div>
      )}
      {usesMaxLength && (
        <div className="mt-5 grid w-40 gap-2">
          <Label>Max length</Label>
          <Input
            type="number"
            min={1}
            max={2000}
            value={field.maxLength ?? 120}
            onChange={(e) =>
              onChange({
                maxLength: Math.max(1, Math.min(2000, Number(e.target.value) || 120)),
              })
            }
          />
        </div>
      )}
      {usesNumberBounds && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Min (optional)</Label>
            <Input
              type="number"
              value={field.min ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ min: v === "" ? undefined : Number(v) });
              }}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label>Max (optional)</Label>
            <Input
              type="number"
              value={field.max ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ max: v === "" ? undefined : Number(v) });
              }}
              placeholder="—"
            />
          </div>
        </div>
      )}
    </section>
  );
}
