"use client";

import { LockKeyIcon } from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const HEX = "0123456789abcdef";

// FNV-1a 32-bit hash. `Math.imul` keeps the multiplication in 32-bit space,
// avoiding the silent precision loss that occurs when `state * prime` exceeds
// `Number.MAX_SAFE_INTEGER` (which previously made the low bits collapse to 0).
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 0x9e3779b1;
}

// xorshift32: cheap, all bitwise, full 32-bit period — used so every nibble of
// the resulting chunk is well-mixed instead of being dominated by the low bits.
function xorshift32(state: number): number {
  let s = state >>> 0;
  s ^= s << 13;
  s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5;
  return s >>> 0;
}

/**
 * Deterministically derive `count` 4-char hex chunks from a seed. Same seed
 * always produces the same chunks so different fields stay visually stable
 * across re-renders, but each field looks distinct.
 */
export function deriveCipherChunks(seed: string, count: number): string[] {
  let state = hashSeed(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    state = xorshift32(state);
    let chunk = "";
    for (let j = 0; j < 4; j++) {
      chunk += HEX[(state >>> (j * 4)) & 0xf];
    }
    out.push(chunk);
  }
  return out;
}

export interface SealedCipherProps {
  /** Deterministic seed so different fields render different hex chunks. */
  seed?: string;
  chunkCount?: number;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /** Hide the trailing `sealed` label, useful inside dense tables. */
  hideLabel?: boolean;
}

/**
 * Visual placeholder for a Seal-encrypted value. Renders a lock icon plus a
 * stream of hex "ciphertext" chunks that gently pulse to suggest live
 * encryption. Replaces the older "▢▢▢▢▢▢ sealed" boxed glyph treatment.
 */
export function SealedCipher({
  seed = "narwhal",
  chunkCount = 4,
  label = "sealed",
  className,
  size = "md",
  hideLabel = false,
}: SealedCipherProps) {
  const parts = deriveCipherChunks(seed, chunkCount);
  const small = size === "sm";
  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-full items-center gap-2.5 rounded-xl border border-coral/30 bg-coral/[0.06]",
        small ? "px-2.5 py-1.5" : "px-3 py-2",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-coral/15 text-coral",
          small ? "size-6" : "size-7",
        )}
      >
        <Icon icon={LockKeyIcon} size={small ? 12 : 14} />
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap font-mono-display tracking-[0.04em] text-coral/90",
          small ? "text-[11px]" : "text-[12px]",
        )}
      >
        {parts.map((c, i) => (
          <motion.span
            key={`${seed}-${i}`}
            className="shrink min-w-0 truncate"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.22,
              ease: "easeInOut",
            }}
          >
            {c}
          </motion.span>
        ))}
      </div>
      {!hideLabel && (
        <span className="ml-auto shrink-0 font-mono-display text-[10px] uppercase tracking-[0.24em] text-coral/75">
          {label}
        </span>
      )}
    </div>
  );
}
