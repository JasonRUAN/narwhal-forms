import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

import { ClientProviders } from "./providers-client";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NARWHAL — Forms that feel like a conversation",
  description:
    "NARWHAL is a feedback and forms platform native to Walrus. Bug reports, feature requests, surveys and applications — encrypted with Seal, owned on Sui, and built one beautiful question at a time.",
  applicationName: "NARWHAL",
  authors: [{ name: "rzexin(X@jasonruan)" }],
  keywords: [
    "Walrus",
    "Sui",
    "Seal",
    "Forms",
    "Feedback",
    "Encrypted",
    "Decentralized",
    "Typeform",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-background text-foreground">
        <ClientProviders>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </ClientProviders>
      </body>
    </html>
  );
}
