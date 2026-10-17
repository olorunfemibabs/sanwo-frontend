"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Droplets,
  FilePlus2,
  LineChart,
  Plus,
  ReceiptText,
  ShieldCheck,
  Table2,
  Wallet,
} from "lucide-react";
import { ActivityTable, MenuSelect, PoolChart, poolFlows, utilization } from "@/components/app/shared";
import { ConnectOptions } from "@/components/app/ConnectOptions";
import { LogoTile } from "@/components/brand/Logo";
import { Amount, Card, CardFooter, CardHeader, Money, buttonClass } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import { POOL_CONTRACT_ID, TOKEN_IS_STAND_IN, TOKEN_SYMBOL } from "@/lib/config";
import { useActivity, useDeposit, useLoans, useMyAdvances, useNow, usePoolStats } from "@/lib/hooks";
import { maskAmount, usePrivateMode } from "@/lib/privacy";
import { cn, daysFromToday, explorer, formatCompact, fromUnits, parseDate, truncateMiddle } from "@/lib/utils";

const PERIODS = [
  { id: "day", label: "Last 24 hours", ms: 86_400_000 },
  { id: "week", label: "Last 7 days", ms: 7 * 86_400_000 },
  { id: "month", label: "Last 30 days", ms: 30 * 86_400_000 },
  { id: "all", label: "All time", ms: 0 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

/** Dashboard: actions, balance and accounts, three summary cards, recent activity. */
export default function HomePage() {
  const { wallet, ready, balance, fund } = useWallet();
  const pool = usePoolStats();
  const activity = useActivity();
  const records = useMyAdvances(wallet.publicKey, activity.data);
  const { loans } = useLoans(records.map((r) => r.invoiceHash));
  const principal = useDeposit(wallet.publicKey);
  const [funding, setFunding] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const stats = pool.data;
  const events = activity.data;

  const settledHashes = useMemo(
    () => new Set((events ?? []).filter((e) => e.kind === "settled").map((e) => e.invoiceHash)),
    [events],
  );

  // Your advances: open ones, the overdue among them, and the next one due.
  const advances = useMemo(() => {
    const acc = { open: 0, outstanding: 0, overdue: 0, settled: 0, next: null as (typeof records)[number] | null };
    for (const r of records) {
      const settled = loans[r.invoiceHash]?.status === "Repaid" || !!r.settleTx || settledHashes.has(r.invoiceHash);
      if (settled) {
        acc.settled += 1;
        continue;
      }
      acc.open += 1;
      acc.outstanding += r.advanceAmount;
      if (r.dueDate && daysFromToday(r.dueDate) < 0) acc.overdue += 1;
      if (r.dueDate && (!acc.next || r.dueDate < acc.next.dueDate)) acc.next = r;
    }
    return acc;
  }, [records, loans, settledHashes]);

  const inPool = principal.data !== null ? fromUnits(principal.data) : null;
  const netDeposits = stats ? fromUnits(stats.totalDeposited - stats.totalWithdrawn) : 0;
  const share = inPool && netDeposits > 0 ? inPool / netDeposits : 0;
  const withdrawable = inPool !== null && stats ? Math.min(inPool, fromUnits(stats.poolBalance)) : null;

  const getFunds = async () => {
    setFunding(true);
    try {
      await fund();
    } finally {
      setFunding(false);
    }
  };

  const shown = mineOnly && wallet.publicKey ? (events ?? []).filter((e) => e.actor === wallet.publicKey) : events;

  return (
    <>
      <h1 className="text-[28px] leading-tight tracking-[-0.01em] text-ink">Welcome to Sanwo</h1>

      <div className="-mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <Link href="/app/advance" className={buttonClass("primary", "pill")}>
          <FilePlus2 className="h-4 w-4" />
          Finance an invoice
        </Link>
        <Link href="/app/pool#deposit" className={buttonClass("chip", "pill")}>
          <Plus className="h-4 w-4" />
          Deposit
        </Link>
        <Link href="/app/pool#withdraw" className={buttonClass("chip", "pill")}>
          <ArrowDownLeft className="h-4 w-4" />
          Withdraw
        </Link>
        <Link
          href={advances.next ? `/app/advances#${advances.next.invoiceHash}` : "/app/advances"}
          className={buttonClass("chip", "pill")}
        >
          <ReceiptText className="h-4 w-4" />
          Repay
        </Link>
        {wallet.connected && (
          <button className={buttonClass("chip", "pill")} disabled={funding} onClick={getFunds}>
            <Droplets className="h-4 w-4" />
            {funding ? "Requesting…" : "Get testnet funds"}
          </button>
        )}
        <a
          href={explorer.contract(POOL_CONTRACT_ID)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto hidden items-center gap-1 text-[15px] text-text-2 hover:text-ink md:flex"
        >
          View contracts
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <BalanceCard />

        {/* Accounts: each place your money sits, with its balance. */}
        <Card className="flex flex-col">
          <CardHeader
            title="Accounts"
            description={TOKEN_IS_STAND_IN ? `${TOKEN_SYMBOL} stands in for USDC on testnet` : undefined}
            action={
              <Link
                href="/app/pool#deposit"
                aria-label="Deposit"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(112,115,147,0.1)] hover:bg-[rgba(112,115,147,0.16)]"
              >
                <Plus className="h-4 w-4" />
              </Link>
            }
          />
          {ready && !wallet.connected ? (
            <div className="flex-1 px-5 pb-5 pt-4">
              <p className="mb-3 text-[14px] text-text-2">
                Connect a wallet to see your balances. Every action here is a real testnet transaction.
              </p>
              <ConnectOptions compact />
            </div>
          ) : (
            <>
              <ul className="flex-1 px-3 pb-3 pt-3">
                <AccountRow
                  href={wallet.publicKey ? explorer.account(wallet.publicKey) : undefined}
                  external
                  avatar={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line">
                      <Wallet className="h-4 w-4 text-ink" strokeWidth={1.5} />
                    </span>
                  }
                  name={wallet.publicKey ? `${wallet.kind === "test" ? "Test wallet" : "Freighter"} ••${wallet.publicKey.slice(-4)}` : "Wallet"}
                  value={balance !== null ? fromUnits(balance) : null}
                />
                <AccountRow
                  href="/app/pool"
                  avatar={<LogoTile size={32} />}
                  name="Pool position"
                  value={inPool}
                />
                <AccountRow
                  href="/app/advances"
                  avatar={<LogoTile size={32} />}
                  name="Open advances"
                  sub={advances.open ? `${advances.open} owed back to the pool` : undefined}
                  value={wallet.publicKey ? advances.outstanding : null}
                />
                <AccountRow
                  href={explorer.contract(POOL_CONTRACT_ID)}
                  external
                  avatar={<LogoTile size={32} />}
                  name="Capital Pool"
                  sub={`Contract ${truncateMiddle(POOL_CONTRACT_ID, 4, 4)}`}
                  value={stats ? fromUnits(stats.poolBalance) : null}
                />
              </ul>
              <CardFooter className="py-3">
                <div>
                  <p className="text-muted">Testnet funds</p>
                  <p className="mt-0.5 text-[14px] text-ink">10,000 {TOKEN_SYMBOL} from Friendbot</p>
                </div>
                <button
                  onClick={getFunds}
                  disabled={funding || !wallet.connected}
                  className={buttonClass("soft", "sm", "h-8 px-4 text-[14px]")}
                >
                  {funding ? "Requesting…" : "Get funds"}
                </button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Capital in use: one figure, a usage bar, the next thing due. */}
        <Card className="flex flex-col">
          <CardHeader title="Out in advances" />
          <div className="flex-1 px-5 pb-5 pt-1">
            <p className="text-[26px] leading-tight text-ink">
              {stats ? (
                <Money value={Math.max(fromUnits(stats.totalDisbursed - stats.totalRepaid), 0)} />
              ) : (
                <Skeleton w="w-32" h="h-7" />
              )}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${stats ? Math.max(utilization(stats) * 100, utilization(stats) > 0 ? 2 : 0) : 0}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px] text-text-2">
              <span className="flex items-center gap-1.5">
                Advanced <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              <span>
                {stats ? <Amount value={fromUnits(stats.poolBalance)} /> : "…"} available
              </span>
            </div>
          </div>
          <CardFooter className="py-3">
            {advances.next ? (
              <>
                <div>
                  <p className="text-muted">Your next repayment</p>
                  <p className="mt-0.5 text-[14px] text-ink">
                    {shortDate(advances.next.dueDate)} · {advances.next.invoiceNumber}
                  </p>
                </div>
                <Link
                  href={`/app/advances#${advances.next.invoiceHash}`}
                  className={buttonClass("soft", "sm", "h-8 px-4 text-[14px]")}
                >
                  Repay
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted">Your next repayment</p>
                  <p className="mt-0.5 text-[14px] text-ink">Nothing due</p>
                </div>
                <Link href="/app/advance" className={buttonClass("soft", "sm", "h-8 px-4 text-[14px]")}>
                  Finance
                </Link>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Your advances by state. */}
        <Card className="flex flex-col">
          <CardHeader
            title="Advances"
            action={
              <Link
                href="/app/advance"
                aria-label="Finance an invoice"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(112,115,147,0.1)] hover:bg-[rgba(112,115,147,0.16)]"
              >
                <Plus className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid flex-1 grid-cols-3 gap-3 px-5 pb-5 pt-5 text-[14px]">
            <Stat label="Outstanding" value={advances.open || "–"} />
            <Stat label="Overdue" value={advances.overdue || "–"} />
            <Stat label="Settled" value={advances.settled || "–"} />
          </div>
          <CardFooter className="py-3">
            <div>
              <p className="text-muted">Open</p>
              <p className="mt-0.5 text-[14px] text-ink">
                {advances.open} item{advances.open === 1 ? "" : "s"} · <Amount value={advances.outstanding} /> {TOKEN_SYMBOL}
              </p>
            </div>
            <ViewLink href="/app/advances" />
          </CardFooter>
        </Card>

        {/* Your share of the pool. */}
        <Card className="flex flex-col md:col-span-2 lg:col-span-1">
          <CardHeader
            title="Your pool position"
            action={
              <Link
                href="/app/pool#deposit"
                aria-label="Deposit"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(112,115,147,0.1)] hover:bg-[rgba(112,115,147,0.16)]"
              >
                <Plus className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid flex-1 grid-cols-2 gap-3 px-5 pb-5 pt-5 text-[14px]">
            <Stat
              label="In the pool"
              value={inPool === null ? <Skeleton w="w-16" /> : inPool ? <Money value={inPool} /> : "–"}
            />
            <Stat
              label="Share"
              value={inPool === null ? <Skeleton w="w-12" /> : inPool ? `${(share * 100).toFixed(1)}%` : "–"}
            />
          </div>
          <CardFooter className="py-3">
            <div>
              <p className="text-muted">Withdraw</p>
              <p className="mt-0.5 text-[14px] text-ink">
                {withdrawable !== null && withdrawable > 0 ? (
                  <>
                    Up to <Amount value={withdrawable} /> {TOKEN_SYMBOL}
                  </>
                ) : (
                  "Up to what you deposited"
                )}
              </p>
            </div>
            <ViewLink href="/app/pool#withdraw" />
          </CardFooter>
        </Card>
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="text-[20px] text-ink">Recent activity</h2>
        <Link href="/app/activity" className="flex items-center gap-0.5 text-[15px] text-brand hover:underline">
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <Card className="mt-4 px-5 pb-2 pt-4">
        <div className="flex gap-5 border-b border-line text-[14px]">
          {[
            { id: false, label: "All activity" },
            { id: true, label: "Yours" },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setMineOnly(f.id)}
              disabled={f.id && !wallet.connected}
              className={cn(
                "-mb-px border-b-2 pb-2.5 transition-colors disabled:opacity-50",
                mineOnly === f.id ? "border-ink text-ink" : "border-transparent text-text-2 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <ActivityTable events={shown} loading={activity.loading} highlight={wallet.publicKey} limit={8} />
        </div>
      </Card>
    </>
  );
}

// ─── Balance card ───────────────────────────────────────────────────────────

/** Balance card: figure, period picker with money in and out, chart or table. */
function BalanceCard() {
  const pool = usePoolStats();
  const activity = useActivity();
  const now = useNow();
  const hidden = usePrivateMode();
  const [view, setView] = useState<"chart" | "table">("chart");
  const [period, setPeriod] = useState<PeriodId>("month");

  const stats = pool.data;
  const ms = PERIODS.find((p) => p.id === period)!.ms;
  const from = ms && now ? now - ms : undefined;
  const { moneyIn, moneyOut } = poolFlows(activity.data, from);
  const short = (n: number) => {
    const text = n >= 10_000 ? formatCompact(n) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return hidden ? maskAmount(text) : text;
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] text-ink">
            Pool liquidity
            <ShieldCheck className="h-4 w-4 text-brand" />
          </p>
          <p className="mt-1 text-[30px] leading-tight text-ink">
            {stats ? <Money value={fromUnits(stats.poolBalance)} unit={TOKEN_SYMBOL} /> : <Skeleton w="w-40" h="h-8" />}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              aria-label={v === "chart" ? "Balance chart" : "Balance table"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex h-8 w-9 items-center justify-center transition-colors",
                view === v ? "bg-surface text-brand" : "bg-paper text-muted hover:text-ink",
              )}
            >
              {v === "chart" ? <LineChart className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-2 text-[15px]">
        <div className="-ml-2">
          <MenuSelect value={period} options={PERIODS} onChange={setPeriod} />
        </div>
        <span className="nums flex items-center gap-3 text-ink">
          <span className="flex items-center gap-1" title="Deposits and repayments">
            <ArrowUpRight className="h-4 w-4 text-brand" />
            {activity.data ? short(moneyIn) : "…"}
          </span>
          <span className="flex items-center gap-1" title="Advances and withdrawals">
            <ArrowDownRight className="h-4 w-4 text-red" />
            {activity.data ? `${moneyOut ? "−" : ""}${short(moneyOut)}` : "…"}
          </span>
        </span>
      </div>

      <div className="mt-4 flex-1 pb-4">
        {view === "chart" ? (
          <PoolChart
            events={activity.data}
            balance={stats ? fromUnits(stats.poolBalance) : null}
            from={from}
            className="h-[170px]"
          />
        ) : (
          <dl className="space-y-2.5 border-t border-line px-5 pt-4 text-[14px]">
            <Row label="Deposited" value={stats ? fromUnits(stats.totalDeposited) : null} />
            <Row label="Advanced" value={stats ? fromUnits(stats.totalDisbursed) : null} />
            <Row label="Repaid" value={stats ? fromUnits(stats.totalRepaid) : null} />
            <Row label="Withdrawn" value={stats ? fromUnits(stats.totalWithdrawn) : null} />
            <Row label="Open advances" text={stats ? String(stats.activeLoans) : null} />
          </dl>
        )}
      </div>
    </Card>
  );
}

// ─── Small parts ────────────────────────────────────────────────────────────

function AccountRow({
  avatar,
  name,
  sub,
  value,
  href,
  external,
}: {
  avatar: React.ReactNode;
  name: string;
  sub?: string;
  value: number | null;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-ink">{name}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </span>
      <span className="text-[15px] text-ink">{value !== null ? <Money value={value} /> : <Skeleton w="w-16" />}</span>
    </>
  );
  const cls = "flex min-h-[52px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[rgba(112,115,147,0.05)]";
  return (
    <li>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className={cls}>
            {body}
          </a>
        ) : (
          <Link href={href} className={cls}>
            {body}
          </Link>
        )
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-text-2">{label}</p>
      <p className="mt-1.5 text-[15px] text-ink">{value}</p>
    </div>
  );
}

function Row({ label, value, text }: { label: string; value?: number | null; text?: string | null }) {
  const content =
    text !== undefined ? text : value !== null && value !== undefined ? <Amount value={value} /> : null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-2">{label}</dt>
      <dd className="nums text-ink">{content ?? <Skeleton w="w-16" />}</dd>
    </div>
  );
}

function ViewLink({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-0.5 text-[14px] text-brand hover:underline">
      View
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function Skeleton({ w, h = "h-5" }: { w: string; h?: string }) {
  return <span className={cn("inline-block animate-pulse rounded bg-paper-2 align-middle", w, h)} />;
}

function shortDate(value: string) {
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
