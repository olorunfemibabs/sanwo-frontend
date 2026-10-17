"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { ActivityTable, EVENT_META, MenuSelect, poolDelta, poolFlows } from "@/components/app/shared";
import { Money, buttonClass } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import { TOKEN_SYMBOL } from "@/lib/config";
import type { ActivityEvent, ActivityKind } from "@/lib/contracts";
import { useActivity, useNow } from "@/lib/hooks";
import { cn, fromUnits, parseDate, toDateInput } from "@/lib/utils";

const TYPES: { id: ActivityKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposited", label: "Deposits" },
  { id: "financed", label: "Advances" },
  { id: "settled", label: "Repayments" },
  { id: "withdrawn", label: "Withdrawals" },
];

const RANGES = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: 0 },
  { id: "custom", label: "Custom range", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "largest", label: "Largest amount" },
  { id: "smallest", label: "Smallest amount" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const DAY = 86_400_000;
const PAGE = 25;

/**
 * Every pool and receivables event since deployment: filters, a date range
 * and sorting across the top, net change with money in and out, then the
 * full table. History is kept by /api/activity, so it reaches back past the
 * RPC's seven days.
 */
export default function ActivityPage() {
  const { wallet } = useWallet();
  const activity = useActivity();
  const [type, setType] = useState<ActivityKind | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeId>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortId>("newest");
  const [shown, setShown] = useState(PAGE);
  const now = useNow();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Date bounds in ms; a custom range covers both whole days.
    const days = RANGES.find((r) => r.id === range)!.days;
    const lo = range === "custom" ? (from ? parseDate(from).getTime() : -Infinity) : days && now ? now - days * DAY : -Infinity;
    const hi = range === "custom" && to ? parseDate(to).getTime() + DAY : Infinity;
    const rows = (activity.data ?? []).filter((e) => {
      const t = parseDate(e.at).getTime();
      return (
        t >= lo &&
        t < hi &&
        (type === "all" || e.kind === type) &&
        (!mineOnly || e.actor === wallet.publicKey) &&
        (!q || `${e.txHash} ${e.actor} ${fromUnits(e.amount)}`.toLowerCase().includes(q))
      );
    });
    const byAmount = (a: ActivityEvent, b: ActivityEvent) => (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0);
    if (sort === "oldest") rows.sort((a, b) => a.ledger - b.ledger);
    else if (sort === "largest") rows.sort((a, b) => byAmount(b, a) || b.ledger - a.ledger);
    else if (sort === "smallest") rows.sort((a, b) => byAmount(a, b) || b.ledger - a.ledger);
    else rows.sort((a, b) => b.ledger - a.ledger);
    return rows;
  }, [activity.data, type, mineOnly, query, wallet.publicKey, range, from, to, sort, now]);

  const { moneyIn, moneyOut } = poolFlows(filtered);
  const net = moneyIn - moneyOut;
  const resetPaging = () => setShown(PAGE);

  return (
    <>
      <PageHeader
        title="Activity"
        action={
          <button
            className={buttonClass("chip", "md", "h-8 text-[15px]")}
            disabled={filtered.length === 0}
            onClick={() => exportCsv(filtered)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setType(t.id);
                resetPaging();
              }}
              className={cn(
                "h-8 rounded-lg px-3 text-[14px] transition-colors duration-150",
                type === t.id
                  ? "bg-[rgba(112,115,147,0.1)] text-ink"
                  : "border border-line text-text-2 hover:bg-[rgba(112,115,147,0.06)] hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <button
          onClick={() => {
            setMineOnly((v) => !v);
            resetPaging();
          }}
          disabled={!wallet.connected}
          aria-pressed={mineOnly}
          className={cn(
            "h-8 rounded-lg px-3 text-[14px] transition-colors duration-150 disabled:opacity-50",
            mineOnly
              ? "bg-mint text-brand-strong"
              : "border border-line text-text-2 hover:bg-[rgba(112,115,147,0.06)] hover:text-ink",
          )}
        >
          Yours only
        </button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <MenuSelect
          variant="pill"
          label="Date"
          value={range}
          options={RANGES}
          onChange={(r) => {
            setRange(r);
            if (r === "custom" && !from) {
              // Start from the last 30 days; either end can be changed.
              setFrom(toDateInput(new Date(Date.now() - 30 * DAY)));
              setTo(toDateInput(new Date()));
            }
            resetPaging();
          }}
        />
        {range === "custom" && (
          <span className="flex items-center gap-1.5 text-[14px] text-text-2">
            <input
              type="date"
              aria-label="From"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPaging();
              }}
              className="h-8 rounded-lg border border-line bg-transparent px-2 text-ink outline-none focus:border-brand"
            />
            to
            <input
              type="date"
              aria-label="To"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                resetPaging();
              }}
              className="h-8 rounded-lg border border-line bg-transparent px-2 text-ink outline-none focus:border-brand"
            />
          </span>
        )}
        <MenuSelect
          variant="pill"
          label="Sort"
          value={sort}
          options={SORTS}
          onChange={(v) => {
            setSort(v);
            resetPaging();
          }}
        />
        <label className="flex h-8 w-full items-center gap-2 rounded-lg border border-line px-3 text-[14px] focus-within:border-brand sm:ml-auto sm:w-64">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            placeholder="Wallet, transaction or amount"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-y border-line py-5">
        {[
          { label: "Net change", value: net, tone: net >= 0 ? "text-brand" : "text-ink" },
          { label: "Money in", value: moneyIn, tone: "text-brand" },
          { label: "Money out", value: -moneyOut, tone: "text-ink" },
        ].map((s) => (
          <div key={s.label}>
            <dt className="text-[14px] text-text-2">{s.label}</dt>
            <dd className={cn("mt-1 text-[22px] leading-tight", s.tone)}>
              {activity.data ? (
                <>
                  {s.value < 0 ? "−" : ""}
                  <Money value={Math.abs(s.value)} unit={TOKEN_SYMBOL} />
                </>
              ) : (
                <span className="inline-block h-6 w-28 animate-pulse rounded bg-paper-2 align-middle" />
              )}
            </dd>
          </div>
        ))}
        <div className="self-end sm:ml-auto">
          <dt className="sr-only">Transactions</dt>
          <dd className="text-[14px] text-text-2">
            {activity.data ? `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}` : " "}
          </dd>
        </div>
      </dl>

      <div className="mt-2">
        <ActivityTable
          events={filtered}
          loading={activity.loading}
          highlight={wallet.publicKey}
          limit={shown}
          emptyText={activity.data?.length ? "No activity matches these filters." : undefined}
        />
      </div>

      {filtered.length > shown && (
        <div className="mt-4 flex justify-center">
          <button className={buttonClass("soft", "md")} onClick={() => setShown((n) => n + PAGE)}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}

function exportCsv(events: ActivityEvent[]) {
  const rows = [
    ["date", "event", "amount", "token", "pool_effect", "wallet", "transaction", "ledger"],
    ...events.map((e) => [
      e.at,
      EVENT_META[e.kind].label,
      fromUnits(e.amount).toFixed(7),
      TOKEN_SYMBOL,
      poolDelta(e) >= 0 ? "in" : "out",
      e.actor,
      e.txHash,
      String(e.ledger),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "sanwo-testnet-activity.csv";
  a.click();
  URL.revokeObjectURL(url);
}
