"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NarwhalMark } from "@/components/narwhal-mark";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/forms/new", label: "Create" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const onPublicForm =
    !!pathname &&
    pathname.startsWith("/forms/") &&
    !pathname.endsWith("/admin") &&
    pathname !== "/forms/new";

  if (onPublicForm) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-2.5 outline-none">
          <NarwhalMark className="size-7 text-ink transition-transform group-hover:-rotate-6" />
          <div className="flex items-baseline gap-2 leading-none">
            <span className="font-display text-2xl tracking-tight text-ink">
              NARWHAL
            </span>
            <span className="hidden font-script text-sm text-coral sm:inline-block underline-squiggle">
              forms
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium text-ink/65 transition-colors hover:text-ink",
                  active && "bg-ink/8 text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
