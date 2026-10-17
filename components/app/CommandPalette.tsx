"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  CornerDownLeft,
  FilePlus2,
  Files,
  Code2,
  Globe,
  Home,
  Landmark,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { EVENT_META, poolDelta } from "@/components/app/shared";
import { Amount } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import { CONTRACTS_REPO_URL, POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID, TOKEN_SYMBOL } from "@/lib/config";
import { setHash, useActivity, useMyAdvances } from "@/lib/hooks";
import { cn, explorer, fromUnits, parseDate, truncateMiddle } from "@/lib/utils";

const SCOPES = ["All", "Pages", "Advances", "Transactions"] as const;
type Scope = (typeof SCOPES)[number];
type Group = Exclude<Scope, "All">;

type Item = {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  meta?: React.ReactNode;
  icon: LucideIcon | string;
  href: string;
  external?: boolean;
  /** Extra text the query matches against. */
  keywords?: string;
};

const PAGES: Item[] = [
  { id: "home", group: "Pages", label: "Home", icon: Home, href: "/app" },
  { id: "advances", group: "Pages", label: "Advances", icon: Files, href: "/app/advances", keywords: "invoices repay" },
  { id: "pool", group: "Pages", label: "Pool", icon: Landmark, href: "/app/pool", keywords: "liquidity position" },
  { id: "activity", group: "Pages", label: "Activity", icon: ArrowLeftRight, href: "/app/activity", keywords: "transactions events history" },
  { id: "finance", group: "Pages", label: "Finance an invoice", icon: FilePlus2, href: "/app/advance", keywords: "new advance submit get paid" },
  { id: "deposit", group: "Pages", label: "Deposit to the pool", icon: Plus, href: "/app/pool#deposit", keywords: "fund add" },
  { id: "withdraw", group: "Pages", label: "Withdraw from the pool", icon: ArrowDownLeft, href: "/app/pool#withdraw", keywords: "take out principal" },
  {
    id: "pool-contract",
    group: "Pages",
    label: "Capital Pool contract",
    sub: truncateMiddle(POOL_CONTRACT_ID, 6, 6),
    icon: ArrowUpRight,
    href: explorer.contract(POOL_CONTRACT_ID),
    external: true,
    keywords: `explorer stellar ${POOL_CONTRACT_ID}`,
  },
  {
    id: "receivables-contract",
    group: "Pages",
    label: "Receivables contract",
    sub: truncateMiddle(RECEIVABLES_CONTRACT_ID, 6, 6),
    icon: ArrowUpRight,
    href: explorer.contract(RECEIVABLES_CONTRACT_ID),
    external: true,
    keywords: `explorer stellar ${RECEIVABLES_CONTRACT_ID}`,
  },
  { id: "source", group: "Pages", label: "Contract source", sub: "GitHub", icon: Code2, href: CONTRACTS_REPO_URL, external: true, keywords: "code repo" },
  { id: "website", group: "Pages", label: "Back to website", icon: Globe, href: "/", keywords: "landing" },
];

/**
 * "Search for anything": an 800px panel under the top bar with
 * scope chips, grouped results and keyboard hints in the footer.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { wallet } = useWallet();
  const activity = useActivity(0);
  const records = useMyAdvances(wallet.publicKey, activity.data);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("All");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const all = useMemo<Item[]>(() => {
    const advances: Item[] = [...records]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        id: `adv-${r.invoiceHash}`,
        group: "Advances",
        label: `${r.invoiceNumber} · ${r.clientName}`,
        sub: r.settleTx ? "Repaid" : r.dueDate ? `Due ${shortDate(r.dueDate)}` : undefined,
        meta: (
          <>
            <Amount value={r.advanceAmount} /> {TOKEN_SYMBOL}
          </>
        ),
        icon: initials(r.clientName),
        href: `/app/advances#${r.invoiceHash}`,
        keywords: `${r.invoiceNumber} ${r.clientName} ${r.advanceAmount} ${r.invoiceAmount} ${r.disburseTx}`,
      }));
    const txs: Item[] = (activity.data ?? []).slice(0, 60).map((ev) => {
      const delta = poolDelta(ev);
      return {
        id: `tx-${ev.id}`,
        group: "Transactions",
        label: EVENT_META[ev.kind].label,
        sub: `${shortDate(ev.at)} · ••${ev.actor.slice(-4)} · tx ${truncateMiddle(ev.txHash, 4, 4)}`,
        meta: (
          <span className={delta > 0 ? "text-brand" : undefined}>
            {delta < 0 ? "−" : ""}
            <Amount value={fromUnits(ev.amount)} /> {TOKEN_SYMBOL}
          </span>
        ),
        icon: EVENT_META[ev.kind].initial,
        href: explorer.tx(ev.txHash),
        external: true,
        keywords: `${ev.txHash} ${ev.actor} ${fromUnits(ev.amount)} ${ev.kind}`,
      };
    });
    return [...PAGES, ...advances, ...txs];
  }, [records, activity.data]);

  // Empty query: a few of each. With a query: everything that matches.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = all.filter(
      (i) =>
        (scope === "All" || i.group === scope) &&
        (!q || `${i.label} ${i.sub ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(q)),
    );
    const cap = scope !== "All" ? 50 : q ? 8 : 5;
    return (["Pages", "Advances", "Transactions"] as const)
      .map((g) => {
        const items = matches.filter((i) => i.group === g);
        return { group: g, items: g === "Pages" && !q && scope === "All" ? items.slice(0, 7) : items.slice(0, cap) };
      })
      .filter((g) => g.items.length > 0);
  }, [all, query, scope]);

  const flat = groups.flatMap((g) => g.items);
  const offsets = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0));
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.external) {
      window.open(item.href, "_blank", "noopener");
      return;
    }
    const url = new URL(item.href, window.location.origin);
    // A fragment on the current page: set it directly so listeners react.
    if (url.pathname === window.location.pathname && url.hash) setHash(url.hash.slice(1));
    else router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="fade-in absolute inset-0 bg-[rgba(255,255,255,0.6)]" onMouseDown={onClose} />
      <div
        className="pop-in absolute left-1/2 top-3 flex max-h-[min(564px,calc(100dvh-24px))] w-[min(800px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-[0_1px_4px_rgba(183,187,219,0.14),0_0_1px_rgba(175,178,206,0.9),0_8px_12px_rgba(14,14,45,0.08),0_14px_20px_rgba(4,4,52,0.02)] sm:top-[77px]"
        onKeyDown={onKeyDown}
      >
        <label className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-brand" strokeWidth={2} />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search invoices and transactions"
            className="h-full flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-subtle"
            aria-label="Search for anything"
          />
          <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] text-subtle sm:block">esc</kbd>
        </label>

        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-1 pt-3">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setScope(s);
                setActive(0);
              }}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-[14px] transition-colors duration-150",
                scope === s
                  ? "bg-[rgba(112,115,147,0.1)] text-ink"
                  : "border border-line text-text-2 hover:bg-[rgba(112,115,147,0.06)] hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div ref={list} className="min-h-[240px] flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 ? (
            <p className="px-3 py-10 text-center text-[14px] text-muted">
              {activity.loading && scope !== "Pages" ? "Reading activity from Stellar…" : `Nothing matches “${query}”.`}
            </p>
          ) : (
            groups.map((g, gi) => (
              <div key={g.group} className="pt-2">
                <p className="px-3 pb-1 pt-2 text-[12px] text-muted">
                  {!query && scope === "All" && g.group !== "Pages" ? `Recent ${g.group.toLowerCase()}` : g.group}
                </p>
                {g.items.map((item, k) => {
                  const i = offsets[gi] + k;
                  const Icon = typeof item.icon === "string" ? null : item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={i}
                      onMouseMove={() => i !== current && setActive(i)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                        i === current && "bg-[rgba(112,115,147,0.08)]",
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(112,115,147,0.1)] text-[11px] text-text-2">
                        {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.8} /> : (item.icon as string)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{item.label}</span>
                        {item.sub && <span className="block truncate text-[12px] text-muted">{item.sub}</span>}
                      </span>
                      {item.meta && <span className="nums shrink-0 text-[14px] text-ink">{item.meta}</span>}
                      {item.external && !item.meta && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-subtle" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-5 border-t border-line px-4 py-2.5 text-[12px] text-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <Key>
              <ArrowUp className="h-3 w-3" />
            </Key>
            <Key>
              <ArrowDown className="h-3 w-3" />
            </Key>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Key>
              <CornerDownLeft className="h-3 w-3" />
            </Key>
            Open
          </span>
          <span className="ml-auto">Results read live from Stellar testnet</span>
        </div>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded border border-line px-1 text-text-2">
      {children}
    </span>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function shortDate(value: string) {
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
