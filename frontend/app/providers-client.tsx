"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

function Splash() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background">
      <div className="splash-surface relative">
        <Image
          src="/narwhal.png"
          alt="Narwhal surfacing"
          width={160}
          height={160}
          priority
          className="splash-bob h-32 w-32 object-contain drop-shadow-[0_18px_24px_color-mix(in_oklab,var(--coral)_28%,transparent)] md:h-40 md:w-40"
        />
      </div>

      <style jsx>{`
        @keyframes splash-surface-up {
          0% {
            transform: translateY(60%) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes splash-bob {
          0%,
          100% {
            transform: translateY(0) rotate(-2deg);
          }
          50% {
            transform: translateY(-10px) rotate(2deg);
          }
        }
        .splash-surface {
          animation: splash-surface-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .splash-bob {
          animation: splash-bob 0.6s ease-in-out 3;
          animation-delay: 0.5s;
          transform-origin: center bottom;
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-surface,
          .splash-bob {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

const Providers = dynamic(() => import("./providers").then((m) => m.Providers), {
  ssr: false,
  loading: () => <Splash />,
});

// Total splash time: 0.5s surface-up + 3 * 0.6s bob ≈ 2.3s
const SPLASH_MS = 2300;

export function ClientProviders({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  if (showSplash) {
    return <Splash />;
  }

  return <Providers>{children}</Providers>;
}
