"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { Amount, Badge, Card } from "@/components/ui/primitives";
import { ConnectOptions } from "@/components/app/ConnectOptions";
import { TOKEN_SYMBOL } from "@/lib/config";
import type { ActivityEvent, LoanStatus, PoolStats } from "@/lib/contracts";
import { useNow } from "@/lib/hooks";
import type { TxPhase } from "@/lib/stellar";
import { cn, explorer, fromUnits, parseDate, truncateMiddle } from "@/lib/utils";

/** Share of the pool's capital currently out in advances. */
export function utilization(stats: PoolStats): number {
  const outstanding = Number(stats.totalDisbursed - stats.totalRepaid);
  const total = Number(stats.poolBalance) + outstanding;
  return total > 0 ? Math.max(outstanding, 0) / total : 0;
}

// ─── Pool balance chart ─────────────────────────────────────────────────────

/** Signed effect of an event on the pool's token balance. */
export function poolDelta(ev: ActivityEvent): number {
  if (ev.kind === "deposited" || ev.kind === "settled") return fromUnits(ev.amount);
  if (ev.kind === "financed" || ev.kind === "withdrawn") return -fromUnits(ev.amount);
  return 0;
}

/** Money into the pool (deposits, repayments) and out of it (advances, withdrawals) since `from`. */
export function poolFlows(events: ActivityEvent[] | null, from = 0): { moneyIn: number; moneyOut: number } {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const ev of events ?? []) {
    if (parseDate(ev.at).getTime() < from) continue;
    const d = poolDelta(ev);
    if (d > 0) moneyIn += d;
    else moneyOut -= d;
  }
  return { moneyIn, moneyOut };
}

/**
 * Pool balance chart, built from real contract events. The series is
 * anchored to the live balance and walked backwards, so it stays correct
 * even when the oldest events fall outside the RPC's retention window. It
 * starts at `from` (or the first event, if later) and runs to now. With no
 * events in the window, it draws the live balance flat, so a quiet pool
 * never looks like it is still loading.
 */
export function PoolChart({
  events,
  balance,
  from,
  className = "h-[150px]",
}: {
  events: ActivityEvent[] | null;
  balance: number | null;
  from?: number;
  /** Sets the chart's height. */
  className?: string;
}) {
  const to = useNow();
  const points = useMemo(() => {
    if (!events || balance === null) return null;
    if (events.length === 0) {
      if (!to) return null;
      return [
        { t: from ?? to - 7 * 86_400_000, v: balance },
        { t: to, v: balance },
      ];
    }
    const desc = [...events].sort((a, b) => b.ledger - a.ledger);
    const steps: { t: number; before: number; after: number }[] = [];
    let after = balance;
    for (const ev of desc) {
      const before = Math.max(after - poolDelta(ev), 0);
      steps.push({ t: parseDate(ev.at).getTime(), before, after });
      after = before;
    }
    steps.reverse();

    const first = steps[0].t;
    const last = steps[steps.length - 1].t;
    const end = Math.max(to || 0, last + 60_000);
    // A little lead-in before the first event, so its step reads as a step.
    const start = Math.max(from ?? 0, first - Math.max((end - first) * 0.04, 60_000));
    let v = steps.filter((s) => s.t <= start).at(-1)?.after ?? steps[0].before;
    const pts = [{ t: start, v }];
    for (const s of steps) {
      if (s.t <= start) continue;
      pts.push({ t: s.t, v: s.before }, { t: s.t, v: s.after });
      v = s.after;
    }
    pts.push({ t: end, v });
    return pts;
  }, [events, balance, from, to]);

  if (!points) {
    return <div className={cn("animate-pulse rounded-lg bg-paper", className)} />;
  }

  const W = 600;
  const H = 150;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const vMax = Math.max(...points.map((p) => p.v)) * 1.15 || 1;
  const x = (t: number) => ((t - t0) / Math.max(t1 - t0, 1)) * W;
  const y = (v: number) => H - (v / vMax) * (H - 6);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ticks = [0, 1, 2, 3].map((i) => t0 + ((t1 - t0) * (i + 0.5)) / 4);
  // Under a day and a half of history, dates repeat, so label by time instead.
  const short = t1 - t0 < 36 * 3_600_000;
  const tickLabel = (t: number) =>
    short
      ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("block w-full", className)}>
        <defs>
          <linearGradient id="pool-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#pool-fill)" />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2.5 flex justify-around text-[12px] text-subtle">
        {ticks.map((t) => (
          <span key={t}>{tickLabel(t)}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Activity table ─────────────────────────────────────────────────────────

export const EVENT_META = {
  deposited: { label: "Deposit to pool", initial: "D", tone: "bg-blue-bg text-blue" },
  financed: { label: "Invoice financed", initial: "A", tone: "bg-mint text-brand-strong" },
  settled: { label: "Advance repaid", initial: "R", tone: "bg-paper-2 text-ink-3" },
  withdrawn: { label: "Withdrawal", initial: "W", tone: "bg-amber-bg text-amber" },
} as const;

/** Activity table: date, event with an avatar, amount, wallet, transaction. */
export function ActivityTable({
  events,
  loading,
  highlight,
  limit = 8,
  emptyText = "No activity yet.",
}: {
  events: ActivityEvent[] | null;
  loading: boolean;
  highlight?: string | null;
  limit?: number;
  emptyText?: string;
}) {
  const rows = (events ?? []).slice(0, limit);

  if (loading && !events) {
    return (
      <div className="space-y-2 py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-paper" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="mx-auto max-w-[420px] py-10 text-center text-[14px] leading-relaxed text-muted">{emptyText}</p>;
  }

  return (
    <>
      {/* Phones: a list, event and date on the left, amount on the right. */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((ev) => {
          const meta = EVENT_META[ev.kind];
          const mine = !!highlight && ev.actor === highlight;
          const delta = poolDelta(ev);
          return (
            <li key={ev.id}>
              <a
                href={explorer.tx(ev.txHash)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 py-3"
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px]", meta.tone)}>
                  {meta.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] text-ink">
                    <span className="truncate">{meta.label}</span>
                    {mine && <Badge tone="green">You</Badge>}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {parseDate(ev.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ••{ev.actor.slice(-4)}
                  </span>
                </span>
                <span className={cn("nums shrink-0 text-[15px]", delta > 0 ? "text-brand" : "text-ink")}>
                  {delta < 0 ? "−" : ""}
                  <Amount value={fromUnits(ev.amount)} />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="-mx-1 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[620px] text-left text-[14px]">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="px-1 pb-2.5 font-normal">Date</th>
              <th className="px-1 pb-2.5 font-normal">Event</th>
              <th className="px-1 pb-2.5 text-right font-normal">Amount</th>
              <th className="px-1 pb-2.5 pl-8 font-normal">Wallet</th>
              <th className="px-1 pb-2.5 font-normal">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ev) => {
              const meta = EVENT_META[ev.kind];
              const mine = !!highlight && ev.actor === highlight;
              const delta = poolDelta(ev);
              return (
                <tr key={ev.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-1 py-3 text-ink">
                    {parseDate(ev.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-1 py-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]",
                          meta.tone,
                        )}
                      >
                        {meta.initial}
                      </span>
                      <span className="whitespace-nowrap text-ink">{meta.label}</span>
                      {mine && <Badge tone="green">You</Badge>}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "nums whitespace-nowrap px-1 py-3 text-right",
                      delta > 0 ? "text-brand" : delta < 0 ? "text-ink" : "text-muted",
                    )}
                  >
                    {delta < 0 ? "−" : ""}
                    <Amount value={fromUnits(ev.amount)} />
                    <span className="ml-1 text-[12px] text-muted">{TOKEN_SYMBOL}</span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-3 pl-8 font-mono text-[12px] text-muted">
                    ••{ev.actor.slice(-4)}
                  </td>
                  <td className="px-1 py-3">
                    <a
                      href={explorer.tx(ev.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[12px] text-muted hover:text-brand"
                    >
                      {truncateMiddle(ev.txHash, 4, 4)}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Dropdown ───────────────────────────────────────────────────────────────

/**
 * A small dropdown: the current choice with a chevron, opening a short menu.
 * `plain` is borderless text (the balance card's period); `pill` matches the
 * outlined filter pills.
 */
export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = "plain",
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  /** Shown before the value on pills, e.g. "Date". */
  label?: string;
  variant?: "plain" | "pill";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-8 items-center gap-1.5 transition-colors duration-150",
          variant === "plain"
            ? "rounded-full px-2 text-ink hover:bg-[rgba(112,115,147,0.08)]"
            : "rounded-lg border border-line px-3 text-[14px] text-ink hover:bg-[rgba(112,115,147,0.06)]",
        )}
      >
        {label && <span className="text-text-2">{label}:</span>}
        {current}
        <ChevronDown className="h-4 w-4 text-text-2" />
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute left-0 z-30 mt-1 min-w-44 rounded-xl bg-surface p-1 shadow-[0_0_2px_rgba(175,178,206,0.56),0_8px_24px_-8px_rgba(4,4,52,0.18)]"
        >
          {options.map((o) => (
            <button
              key={o.id}
              role="menuitemradio"
              aria-checked={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={cn(
                "block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-[14px] hover:bg-[rgba(112,115,147,0.06)]",
                o.id === value ? "text-brand" : "text-ink",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status ─────────────────────────────────────────────────────────────────

export function LoanBadge({ status, overdue }: { status: LoanStatus | null | undefined; overdue?: boolean }) {
  if (!status) return <Badge tone="neutral">Checking</Badge>;
  if (status === "Repaid") return <Badge tone="neutral">Settled</Badge>;
  if (status === "Pending") return <Badge tone="blue">Pending</Badge>;
  if (overdue) return <Badge tone="red">Overdue</Badge>;
  return <Badge tone="green">Active</Badge>;
}

// ─── Transaction progress ───────────────────────────────────────────────────

const PHASES: { id: TxPhase; label: string }[] = [
  { id: "preparing", label: "Simulating on Soroban" },
  { id: "signing", label: "Waiting for your signature" },
  { id: "submitting", label: "Submitting to Stellar" },
  { id: "confirming", label: "Confirming on-chain" },
];

export function TxProgress({ phase }: { phase: TxPhase | "done" | null }) {
  const current = phase === "done" ? PHASES.length : PHASES.findIndex((p) => p.id === phase);
  return (
    <ol className="space-y-3">
      {PHASES.map((p, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={p.id} className="flex items-center gap-3 text-[14px]">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                state === "done" && "bg-brand text-white",
                state === "active" && "text-brand",
                state === "todo" && "border border-line-strong",
              )}
            >
              {state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : state === "active" ? (
                <Loader2 className="spin h-4 w-4" />
              ) : null}
            </span>
            <span className={cn(state === "todo" ? "text-subtle" : "text-ink")}>{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function TxLink({ hash, label = "View transaction" }: { hash: string; label?: string }) {
  return (
    <a
      href={explorer.tx(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:underline"
    >
      {label}
      <span className="font-mono text-[12px] text-muted">{truncateMiddle(hash, 6, 6)}</span>
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

// ─── Connect gate ───────────────────────────────────────────────────────────

/** Empty state: a centred line, a short explanation, then the action. */
export function ConnectGate({ title, body }: { title: string; body: string }) {
  return (
    <Card className="mx-auto max-w-[520px] px-6 py-10 text-center sm:px-10">
      <h2 className="text-[20px] text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[400px] text-[14px] leading-relaxed text-muted">{body}</p>
      <div className="mt-7 text-left">
        <ConnectOptions />
      </div>
    </Card>
  );
}
