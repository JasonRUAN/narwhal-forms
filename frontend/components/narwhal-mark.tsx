import { cn } from "@/lib/utils";

interface NarwhalMarkProps {
  className?: string;
  withSparkle?: boolean;
}

/**
 * NARWHAL brand mark — friendly, organic version for the light theme.
 * The first stroke doubles as the narwhal's tusk; the optional sparkle adds
 * a hand-drawn highlight popular on Typeform-style marketing surfaces.
 */
export function NarwhalMark({ className, withSparkle = false }: NarwhalMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-ink", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="nw-tusk-light" x1="6" y1="56" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <path
        d="M10 56 V8 L52 50 V8"
        stroke="url(#nw-tusk-light)"
        strokeWidth="6.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {withSparkle && (
        <g stroke="var(--coral)" strokeWidth="2" strokeLinecap="round">
          <path d="M55 14 L57 12" />
          <path d="M58 18 L60.5 19" />
          <path d="M52 9 L52 6" />
        </g>
      )}
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45">
        <path d="M14 12 L14 14" />
        <path d="M14 19 L14 21" />
        <path d="M14 26 L14 28" />
        <path d="M14 33 L14 35" />
        <path d="M14 40 L14 42" />
        <path d="M14 47 L14 49" />
      </g>
    </svg>
  );
}
