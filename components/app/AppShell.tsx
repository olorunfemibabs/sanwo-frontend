"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ArrowUpRight, Eye, EyeOff, FilePlus2, Files, Home, Landmark, Search } from "lucide-react";
import { LogoTile } from "@/components/brand/Logo";
import { CommandPalette } from "@/components/app/CommandPalette";
import { SetupGuide } from "@/components/app/SetupGuide";
import { WalletButton } from "@/components/app/WalletButton";
import { Amount, Badge } from "@/components/ui/primitives";
import { CONTRACTS_REPO_URL, POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID, TOKEN_SYMBOL } from "@/lib/config";
import { useHash, usePoolStats } from "@/lib/hooks";
import { setPrivateMode, usePrivateMode } from "@/lib/privacy";
import { cn, explorer, fromUnits } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/advances", label: "Advances", icon: Files },
  { href: "/app/pool", label: "Pool", icon: Landmark },
  { href: "/app/activity", label: "Activity", icon: ArrowLeftRight },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App frame: a 220px sidebar a hair off white with a hairline edge, ink nav items with a soft active
 * tint, and a borderless top bar with search on the left and private mode,
 * "Move money" and the avatar on the right.
 */
const NAV_ITEM =
  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[15px] text-ink transition-colors duration-150 ease-out";
const NAV_ACTIVE = "bg-[rgba(112,115,147,0.1)]";
const NAV_IDLE = "hover:bg-[rgba(112,115,147,0.06)]";
const TOP_ICON =
  "flex h-8 w-8 items-center justify-center rounded-full text-text-2 transition-colors duration-150 ease-out hover:bg-[rgba(112,115,147,0.08)] hover:text-ink";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pool = usePoolStats(30_000);
  const stats = pool.data;
  const hidden = usePrivateMode();
  const hash = useHash();
  const [searching, setSearching] = useState(false);

  // ⌘K / Ctrl+K anywhere, or "/" when not typing, opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearching((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-[rgba(112,115,147,0.1)] bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-3.5">
          <Link href="/app" className="flex min-w-0 flex-1 items-center gap-2.5">
            <LogoTile size={30} />
            <span className="truncate text-[15px] text-ink">Sanwo</span>
          </Link>
          <Badge tone="dark">Testnet</Badge>
        </div>

        <nav className="flex-1 overflow-y-auto pb-4">
          <div className="space-y-0.5 px-2 pt-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_IDLE)}>
                  <item.icon className="h-4 w-4 text-text-2" strokeWidth={1.6} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="my-3 h-px bg-[rgba(112,115,147,0.1)]" />

          <p className="px-4 pb-1.5 pt-1 text-[12px] font-[500] tracking-[0.01em] text-[#70707d]">On-chain</p>
          <div className="space-y-0.5 px-2">
            {[
              {
                label: "Capital Pool",
                href: explorer.contract(POOL_CONTRACT_ID),
                sub: stats ? (
                  <>
                    <Amount value={fromUnits(stats.poolBalance)} /> {TOKEN_SYMBOL}
                  </>
                ) : null,
              },
              {
                label: "Receivables",
                href: explorer.contract(RECEIVABLES_CONTRACT_ID),
                sub: stats ? `${stats.activeLoans} open` : null,
              },
              { label: "Contract source", href: CONTRACTS_REPO_URL, sub: "GitHub" },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className={cn("group block rounded-lg px-2.5 py-1.5 transition-colors duration-150 ease-out", NAV_IDLE)}
              >
                <span className="flex items-center gap-2.5 text-[15px] text-ink">
                  <ArrowUpRight className="h-4 w-4 text-text-2" strokeWidth={1.6} />
                  {c.label}
                </span>
                <span className="nums ml-[26px] block h-[18px] text-[13px] text-muted">
                  {c.sub ?? <span className="inline-block h-3 w-16 animate-pulse rounded bg-paper-2 align-middle" />}
                </span>
              </a>
            ))}
          </div>
        </nav>

        <Link
          href="/"
          className={cn("mx-2 mb-3 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-text-2 transition-colors", NAV_IDLE)}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          Back to website
        </Link>
      </aside>

      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/app" className="flex items-center gap-2 lg:hidden" aria-label="Sanwo home">
              <LogoTile size={28} />
              <Badge tone="dark">Testnet</Badge>
            </Link>
            <button
              onClick={() => setSearching(true)}
              className="hidden h-8 items-center gap-2 rounded-full pl-3 pr-4 text-[15px] text-text-2 transition-colors duration-150 ease-out hover:bg-[rgba(112,115,147,0.08)] hover:text-ink lg:flex"
            >
              <Search className="h-4 w-4" strokeWidth={1.8} />
              Search for anything
            </button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button onClick={() => setSearching(true)} aria-label="Search" className={cn(TOP_ICON, "lg:hidden")}>
                <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <NewMenu />
              <button
                onClick={() => setPrivateMode(!hidden)}
                aria-label={hidden ? "Show balances" : "Hide balances"}
                aria-pressed={hidden}
                title={hidden ? "Show balances" : "Hide balances"}
                className={TOP_ICON}
              >
                {hidden ? (
                  <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />
                ) : (
                  <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} />
                )}
              </button>
              <span className="ml-1">
                <WalletButton />
              </span>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 pb-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {[...NAV, { href: "/app/advance", label: "Finance", icon: FilePlus2 }].map((item) => {
              const active = isActive(pathname, item.href) && !(item.href === "/app/advances" && pathname === "/app/advance");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]",
                    active ? "bg-paper-2 text-ink" : "text-muted",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mx-auto max-w-[1040px]">{children}</div>
        </main>
      </div>

      {/* The guide steps aside for the invoice flow and for an open advance drawer. */}
      {pathname !== "/app/advance" && !(pathname === "/app/advances" && hash) && (
        <SetupGuide onSearch={() => setSearching(true)} />
      )}
      {searching && <CommandPalette onClose={() => setSearching(false)} />}
    </div>
  );
}

/** The "⇄ Move money" text button in the top bar, opening a short menu. */
function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-full px-3 text-[15px] text-ink transition-colors duration-150 ease-out hover:bg-[rgba(112,115,147,0.08)]"
      >
        <ArrowLeftRight className="h-4 w-4 text-text-2" strokeWidth={1.6} />
        Move money
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl bg-surface p-1.5 shadow-[0_0_2px_rgba(175,178,206,0.56),0_8px_24px_-8px_rgba(4,4,52,0.18)]">
          {[
            { href: "/app/advance", label: "Finance an invoice", note: "Get paid now" },
            { href: "/app/advances", label: "Repay an advance", note: "Send it back to the pool" },
            { href: "/app/pool#deposit", label: "Deposit to the pool", note: "Fund advances" },
            { href: "/app/pool#withdraw", label: "Withdraw from the pool", note: "Up to what you deposited" },
          ].map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 transition-colors hover:bg-[rgba(112,115,147,0.06)]"
            >
              <span className="block text-[14px] text-ink">{i.label}</span>
              <span className="block text-[12px] text-muted">{i.note}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-[28px] leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
