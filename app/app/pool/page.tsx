"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { ActivityTable, ConnectGate, PoolChart, TxLink, TxProgress, utilization } from "@/components/app/shared";
import { Amount, Button, Card, CardFooter, Money, Notice, inputClass } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import { POOL_CONTRACT_ID, TOKEN_IS_STAND_IN, TOKEN_SYMBOL } from "@/lib/config";
import { deposit, withdraw } from "@/lib/contracts";
import { refreshSoon, setHash, useActivity, useDeposit, useDepositRecords, useHash, usePoolStats } from "@/lib/hooks";
import { errorMessage, type TxPhase } from "@/lib/stellar";
import { saveDeposit } from "@/lib/store";
import { cn, formatAmount, formatDateTime, fromUnits, toUnits, truncateMiddle } from "@/lib/utils";

/** Leave enough XLM behind for fees and the account reserve. */
const FEE_RESERVE = 5;

export default function PoolPage() {
  const { wallet, ready, balance, sign, refreshBalance } = useWallet();
  const pool = usePoolStats(15_000);
  const activity = useActivity(30_000);
  const localDeposits = useDepositRecords(wallet.publicKey);
  const principal = useDeposit(wallet.publicKey);

  // The fragment picks the tab, so "Withdraw" links elsewhere land on it.
  const mode: "deposit" | "withdraw" = useHash() === "withdraw" ? "withdraw" : "deposit";
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<TxPhase | "done" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const stats = pool.data;
  const busy = phase !== null && phase !== "done";
  const value = Number(amount) || 0;

  // Your principal comes from the contract; deposit and withdrawal rows from events.
  const myPrincipal = principal.data !== null ? fromUnits(principal.data) : null;
  const rows = useMemo(() => {
    const mine = (activity.data ?? []).filter(
      (e) => (e.kind === "deposited" || e.kind === "withdrawn") && e.actor === wallet.publicKey,
    );
    const seen = new Set(mine.map((e) => e.txHash));
    const pending = localDeposits
      .filter((d) => !seen.has(d.txHash))
      .map((d) => ({ txHash: d.txHash, amount: d.amount, at: d.at }));
    return [
      ...mine.map((e) => ({
        txHash: e.txHash,
        amount: e.kind === "withdrawn" ? -fromUnits(e.amount) : fromUnits(e.amount),
        at: e.at,
      })),
      ...pending,
    ].sort((a, b) => b.at.localeCompare(a.at));
  }, [activity.data, localDeposits, wallet.publicKey]);

  const netDeposits = stats ? fromUnits(stats.totalDeposited - stats.totalWithdrawn) : 0;
  const share = myPrincipal && netDeposits > 0 ? myPrincipal / netDeposits : 0;

  // What this action can move: wallet funds for a deposit; for a withdrawal,
  // your own principal, capped by liquidity that is not out on loan.
  const walletAvailable = balance !== null ? Math.max(fromUnits(balance) - FEE_RESERVE, 0) : null;
  const withdrawable =
    myPrincipal !== null && stats ? Math.min(myPrincipal, fromUnits(stats.poolBalance)) : null;
  const available = mode === "deposit" ? walletAvailable : withdrawable;
  const tooMuch = available !== null && value > available;

  const setMode = (next: "deposit" | "withdraw") => {
    setHash(next);
    setAmount("");
    setError(null);
    setLastTx(null);
    setPhase(null);
  };

  async function submit() {
    if (!wallet.publicKey || !(value > 0) || tooMuch) return;
    setError(null);
    setLastTx(null);
    setPhase("preparing");
    try {
      const args = { depositor: wallet.publicKey, amount: toUnits(value) };
      const res =
        mode === "deposit"
          ? await deposit(args, { sign, onPhase: setPhase })
          : await withdraw(args, { sign, onPhase: setPhase });
      setPhase("done");
      setLastTx(res.hash);
      if (mode === "deposit") {
        saveDeposit(wallet.publicKey, { txHash: res.hash, amount: value, at: new Date().toISOString() });
      }
      setAmount("");
      refreshSoon(refreshBalance, pool.reload, activity.reload, principal.reload);
    } catch (err) {
      setError(errorMessage(err));
      setPhase(null);
    }
  }

  return (
    <>
      <PageHeader title="Pool" />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="px-5 pt-5">
              <p className="flex items-center gap-1.5 text-[15px] text-ink">
                Pool liquidity
                <ShieldCheck className="h-4 w-4 text-brand" />
              </p>
              <p className="mt-1 text-[34px] leading-tight text-ink">
                {stats ? <Money value={fromUnits(stats.poolBalance)} unit={TOKEN_SYMBOL} /> : <span className="inline-block h-8 w-48 animate-pulse rounded bg-paper-2" />}
              </p>
              <p className="text-[13px] text-muted">
                {stats ? `${(utilization(stats) * 100).toFixed(1)}% of capital is out in advances` : " "}
              </p>
            </div>
            <div className="pb-4 pt-5">
              <PoolChart
                events={activity.data}
                balance={stats ? fromUnits(stats.poolBalance) : null}
                className="h-[120px] sm:h-[190px]"
              />
            </div>
            <div className="grid grid-cols-2 border-t border-line text-[14px] sm:grid-cols-4">
              {[
                { label: "Deposited", v: stats ? fromUnits(stats.totalDeposited) : null },
                { label: "Advanced", v: stats ? fromUnits(stats.totalDisbursed) : null },
                { label: "Repaid", v: stats ? fromUnits(stats.totalRepaid) : null },
                { label: "Withdrawn", v: stats ? fromUnits(stats.totalWithdrawn) : null },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className={cn("border-line px-5 py-4", i % 2 === 1 && "border-l", i > 1 && "max-sm:border-t", i === 2 && "sm:border-l")}
                >
                  <p className="text-text-2">{c.label}</p>
                  <p className="mt-1 text-[16px] text-ink">
                    {c.v !== null ? <Money value={c.v} /> : <span className="inline-block h-5 w-16 animate-pulse rounded bg-paper-2 align-middle" />}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="px-5 pt-5">
              <p className="text-[15px] text-ink">How depositors earn</p>
              <p className="mt-0.5 text-[13px] text-muted">Targets for v1, not promises. Returns depend on utilization.</p>
            </div>
            <dl className="mt-3 divide-y divide-line px-5 text-[14px]">
              {[
                { l: "Advance spread", d: "Blended rate businesses pay on deployed capital", v: "~28% a year" },
                { l: "Idle capital", d: "Liquidity not lent out is routed to Blend", v: "Baseline" },
                { l: "Depositor target", d: "After the first-loss reserve and protocol share", v: "~10% a year" },
              ].map((r) => (
                <div key={r.l} className="flex items-start justify-between gap-6 py-3.5">
                  <div>
                    <dt className="text-ink">{r.l}</dt>
                    <p className="text-[13px] text-muted">{r.d}</p>
                  </div>
                  <dd className="shrink-0 text-ink">{r.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 border-t border-line px-5 py-4">
              <p className="text-[14px] text-ink">Who absorbs a loss first</p>
              <ol className="mt-3 grid gap-2 text-[13px] sm:grid-cols-4">
                {["Advance cushion", "Borrower recourse", "First-loss reserve", "Depositor capital"].map((l, i) => (
                  <li
                    key={l}
                    className={cn(
                      "rounded-lg px-3 py-2.5",
                      i === 3 ? "bg-mint text-brand-strong" : "bg-paper text-text-2",
                    )}
                  >
                    <span className="block text-[11px] opacity-70">{i + 1}</span>
                    {l}
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <div>
            <h2 className="text-[20px] text-ink">Pool activity</h2>
            <div className="mt-4">
              <ActivityTable events={activity.data} loading={activity.loading} highlight={wallet.publicKey} limit={12} />
            </div>
          </div>
        </div>

        <aside id="deposit" className="relative order-first scroll-mt-28 space-y-6 lg:order-none lg:sticky lg:top-24">
          <span id="withdraw" className="absolute top-0 scroll-mt-28" aria-hidden />
          {ready && !wallet.connected ? (
            <ConnectGate title="Connect to deposit" body="Deposits are signed by your wallet and recorded on-chain." />
          ) : (
            <>
              <Card>
                {/* Segmented switch between the two actions. */}
                <div className="px-5 pt-5">
                  <div className="grid grid-cols-2 rounded-lg bg-[rgba(112,115,147,0.1)] p-0.5 text-[14px]">
                    {(["deposit", "withdraw"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        disabled={busy}
                        className={cn(
                          "h-8 rounded-md capitalize transition-colors duration-150",
                          mode === m ? "bg-surface text-ink shadow-[0_1px_2px_rgba(4,4,52,0.12)]" : "text-text-2 hover:text-ink",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[13px] text-muted">
                    {mode === "deposit"
                      ? "Fund the pool that pays advances. Takes effect in one transaction."
                      : "Take out up to what you deposited, from funds not out in advances."}
                  </p>
                </div>
                <div className="px-5 pt-5">
                  <label className="text-[13px] text-muted" htmlFor="deposit-amount">
                    Amount
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="deposit-amount"
                      className={cn(inputClass, "nums h-14 pr-24 text-[22px]")}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={busy}
                    />
                    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <span className="text-[13px] text-muted">{TOKEN_SYMBOL}</span>
                      <button
                        type="button"
                        className="rounded-md bg-mint px-1.5 py-0.5 text-[11px] text-brand-strong hover:bg-mint-2"
                        onClick={() =>
                          available !== null &&
                          setAmount(String(mode === "deposit" ? Math.floor(available) : available))
                        }
                      >
                        Max
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    {[100, 500, 1000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        className="h-7 rounded-full bg-paper-2 px-3 text-[12px] text-text-2 hover:bg-line"
                      >
                        {v.toLocaleString("en-US")}
                      </button>
                    ))}
                  </div>
                  {tooMuch && (
                    <p className="mt-2 text-[12px] text-red">
                      {mode === "deposit"
                        ? "That is more than your wallet can spend after fees."
                        : `You can withdraw up to ${formatAmount(available ?? 0)} ${TOKEN_SYMBOL} right now.`}
                    </p>
                  )}
                </div>

                <dl className="mt-5 space-y-3 border-t border-line px-5 py-4 text-[14px]">
                  {(() => {
                    const walletLabel = wallet.publicKey
                      ? `${wallet.kind === "test" ? "Test wallet" : "Freighter"} ••${wallet.publicKey.slice(-4)}`
                      : "–";
                    const poolLabel = (
                      <>
                        Capital Pool{" "}
                        <span className="font-mono text-[12px] text-muted">{truncateMiddle(POOL_CONTRACT_ID, 4, 4)}</span>
                      </>
                    );
                    return (
                      <>
                        <div className="flex justify-between gap-4">
                          <dt className="text-text-2">From</dt>
                          <dd className="text-ink">{mode === "deposit" ? walletLabel : poolLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-text-2">To</dt>
                          <dd className="text-ink">{mode === "deposit" ? poolLabel : walletLabel}</dd>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-2">{mode === "deposit" ? "Wallet balance" : "Available to withdraw"}</dt>
                    <dd className="text-ink">
                      {mode === "deposit"
                        ? balance !== null ? <Money value={fromUnits(balance)} /> : <Pending />
                        : withdrawable !== null ? <Money value={withdrawable} /> : <Pending />}
                    </dd>
                  </div>
                </dl>

                <div className="px-5 pb-5">
                  <Button className="w-full" size="lg" disabled={!(value > 0) || tooMuch} loading={busy} onClick={submit}>
                    {busy
                      ? mode === "deposit" ? "Depositing" : "Withdrawing"
                      : `${mode === "deposit" ? "Deposit" : "Withdraw"} ${value > 0 ? formatAmount(value) : ""} ${TOKEN_SYMBOL}`}
                  </Button>
                  {phase && phase !== "done" && (
                    <div className="mt-5">
                      <TxProgress phase={phase} />
                    </div>
                  )}
                  {lastTx && (
                    <Notice tone="green" className="mt-4">
                      {mode === "deposit" ? "Deposit" : "Withdrawal"} confirmed. <TxLink hash={lastTx} />
                    </Notice>
                  )}
                  {error && (
                    <Notice tone="red" className="mt-4" icon={<AlertTriangle className="h-4 w-4" />}>
                      {error}
                    </Notice>
                  )}
                </div>
                <CardFooter className="text-[12px] leading-relaxed text-muted">
                  Withdrawals return principal. v1 issues pool share tokens, so yield and any losses are
                  shared pro rata.
                </CardFooter>
              </Card>

              <Card>
                <div className="px-5 pt-5">
                  <p className="text-[15px] text-ink">Your position</p>
                  <p className="mt-1 text-[28px] leading-tight text-ink">
                    {myPrincipal !== null ? (
                      <Money value={myPrincipal} unit={TOKEN_SYMBOL} />
                    ) : (
                      <span className="inline-block h-7 w-32 animate-pulse rounded bg-paper-2" />
                    )}
                  </p>
                  <p className="text-[13px] text-muted">
                    {myPrincipal !== null ? (
                      `${(share * 100).toFixed(2)}% of the pool's deposits · read from the contract`
                    ) : (
                      <span className="inline-block h-3.5 w-48 animate-pulse rounded bg-paper-2 align-middle" />
                    )}
                  </p>
                </div>
                {rows.length > 0 && (
                  <ul className="mt-4 divide-y divide-line border-t border-line px-5 pb-1">
                    {rows.slice(0, 6).map((d) => (
                      <li key={d.txHash} className="flex items-center justify-between py-2.5 text-[13px]">
                        <span className="text-muted">
                          {d.amount < 0 ? "Withdrawal" : "Deposit"} · {formatDateTime(d.at)}
                        </span>
                        <span className={cn("nums", d.amount < 0 ? "text-ink" : "text-brand")}>
                          {d.amount < 0 ? "−" : "+"}
                          <Amount value={Math.abs(d.amount)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {TOKEN_IS_STAND_IN && (
                <p className="px-1 text-[12px] leading-relaxed text-subtle">
                  Testnet pool holds {TOKEN_SYMBOL} as a stand-in for USDC. One token stands in for one dollar.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function Pending() {
  return <span className="inline-block h-4 w-16 animate-pulse rounded bg-paper-2 align-middle" />;
}
