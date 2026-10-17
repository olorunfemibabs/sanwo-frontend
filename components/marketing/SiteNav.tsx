"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#businesses", label: "Businesses" },
  { href: "#depositors", label: "Depositors" },
  { href: "#protection", label: "Protection" },
  { href: "#roadmap", label: "Roadmap" },
];

/**
 * Nav: fixed, transparent over the hero scene, then filled
 * with the current section's colour. Colours come from the page theme, so
 * the nav cross-fades with the page.
 */
export function SiteNav() {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const onScroll = () => setOverHero(window.scrollY < window.innerHeight - 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color] duration-500 ease-[cubic-bezier(0,0,0.6,1)]",
        overHero ? "bg-transparent" : "bg-page",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 text-page-fg sm:px-8">
        <Link href="/" aria-label="Sanwo home">
          <Logo tone="inherit" />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-[15px] font-[420] transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--page-fg)_8%,transparent)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#proof"
            className="hidden rounded-full px-4 py-2 text-[15px] font-[420] transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--page-fg)_8%,transparent)] sm:block"
          >
            Contracts
          </a>
          <Link
            href="/app"
            className="btn-glow hidden h-10 items-center rounded-full bg-brand px-5 text-[15px] font-[420] text-white transition-colors duration-300 ease-out hover:bg-brand-strong sm:inline-flex"
          >
            Open testnet app
          </Link>

          <details className="relative lg:hidden">
            <summary
              aria-label="Menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--page-fg)_10%,transparent)]"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 text-ink shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="block rounded-xl px-3 py-2.5 text-[15px] hover:bg-paper">
                  {l.label}
                </a>
              ))}
              <a href="#proof" className="block rounded-xl px-3 py-2.5 text-[15px] hover:bg-paper">
                Contracts
              </a>
              <Link
                href="/app"
                className="mt-2 flex h-10 items-center justify-center rounded-full bg-brand text-[15px] text-white"
              >
                Open testnet app
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
