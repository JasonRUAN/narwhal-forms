"use client";

import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

type Tone = "ink" | "coral" | "ghost" | "outline";
type Size = "default" | "lg" | "xl" | "sm";

interface GradientCtaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  asChild?: boolean;
}

const toneClass: Record<Tone, string> = {
  ink: "bg-ink text-on-ink hover:bg-[color-mix(in_oklab,var(--ink)_88%,var(--coral)_12%)]",
  coral: "bg-coral text-coral-foreground hover:brightness-105",
  ghost:
    "bg-cream text-ink hover:bg-[color-mix(in_oklab,var(--cream)_75%,var(--coral)_18%)] border border-ink/15",
  outline:
    "bg-transparent text-ink border border-ink/25 hover:bg-ink/5",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  default: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-8 text-lg",
};

export const GradientCta = React.forwardRef<HTMLButtonElement, GradientCtaProps>(
  ({ className, tone = "ink", size = "default", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        data-tone={tone}
        className={cn(
          "group relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium tracking-tight outline-none transition-all duration-200",
          "shadow-pop hover:-translate-y-0.5 active:translate-y-0",
          "focus-visible:ring-4 focus-visible:ring-coral/40",
          "disabled:pointer-events-none disabled:opacity-60",
          toneClass[tone],
          sizeClass[size],
          className,
        )}
        {...props}
      />
    );
  },
);
GradientCta.displayName = "GradientCta";
