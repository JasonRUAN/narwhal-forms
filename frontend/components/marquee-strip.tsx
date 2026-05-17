import { cn } from "@/lib/utils";

interface MarqueeStripProps {
  items: string[];
  className?: string;
  glyph?: string;
}

export function MarqueeStrip({ items, className, glyph = "✦" }: MarqueeStripProps) {
  const doubled = [...items, ...items];
  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden border-y border-ink/10 bg-ink py-4 text-on-ink",
        className,
      )}
      aria-hidden
    >
      <div className="marquee-track flex shrink-0 items-center gap-12 whitespace-nowrap pr-12">
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-12">
            <span className="font-display text-2xl italic md:text-3xl">{item}</span>
            <span className="text-coral text-xl">{glyph}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
