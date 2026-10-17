"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, Info, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { ConnectGate, LoanBadge, TxLink, TxProgress } from "@/components/app/shared";
import { Badge, Button, Money, Notice, buttonClass } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import { RECEIVABLES_CONTRACT_ID, TOKEN_SYMBOL } from "@/lib/config";
import { repayLoan, type LoanRecord } from "@/lib/contracts";
import { refreshSoon, setHash, useActivity, useHash, useLoans, useMyAdvances, type MyAdvance } from "@/lib/hooks";
import { errorMessage, type TxPhase } from "@/lib/stellar";
import { updateAdvance, type AdvanceRecord } from "@/lib/store";
import {
  cn,
  daysFromToday,
  explorer,
  formatAmount,
  formatDate,
  formatDateTime,
  parseDate,
  toUnits,
  truncateMiddle,
} from "@/lib/utils";

type Row = MyAdvance;
type Filter = "all" | "open" | "overdue" | "settled";

export default function AdvancesPage() {
  const { wallet, ready, sign, refreshBalance } = useWallet();
  const activity = useActivity(45_000);
  const [filter, setFilter] = useState<Filter>("all");

  const rows: Row[] = useMyAdvances(wallet.publicKey, activity.data);

  const { loans, reload } = useLoans(rows.map((r) => r.invoiceHash));
  // The URL fragment (#<fingerprint>) is the open drawer, so deep links,
  // search results and the back-to-list close all agree.
  const picked = useHash() || null;

  const settledTxFor = (hash: string, own?: string) =>
    own ?? activity.data?.find((e) => e.kind === "settled" && e.invoiceHash === hash)?.txHash;
  const stateOf = (r: Row) => {
    const loan = loans[r.invoiceHash];
    const settled = loan?.status === "Repaid" || !!settledTxFor(r.invoiceHash, r.settleTx);
    return { loan, settled, overdue: !settled && isOverdue(r, loan) };
  };

  if (ready && !wallet.connected) {
    return (
      <>
        <PageHeader title="Advances" />
        <ConnectGate
          title="Connect a wallet to see your advances"
          body="Advances belong to the wallet that signed them."
        />
      </>
    );
  }

  const totals = rows.reduce(
    (acc, r) => {
      const s = stateOf(r);
      if (s.settled) {
        acc.settled.n += 1;
        acc.settled.v += r.advanceAmount;
      } else {
        acc.open.n += 1;
        acc.open.v += r.advanceAmount;
        if (s.overdue) {
          acc.overdue.n += 1;
          acc.overdue.v += r.advanceAmount;
        }
      }
      return acc;
    },
    { open: { n: 0, v: 0 }, overdue: { n: 0, v: 0 }, settled: { n: 0, v: 0 } },
  );

  const visible = rows.filter((r) => {
    const s = stateOf(r);
    if (filter === "open") return !s.settled;
    if (filter === "overdue") return s.overdue;
    if (filter === "settled") return s.settled;
    return true;
  });
  const current = rows.find((r) => r.invoiceHash === picked) ?? null;

  function open(next: string | null) {
    setHash(next);
  }

  return (
    <>
      <PageHeader
        title="Advances"
        action={
          <Link href="/app/advance" className={buttonClass("chip", "md")}>
            <Plus className="h-4 w-4" />
            Finance an invoice
          </Link>
        }
      />

      {/* Summary band: outstanding, overdue and settled totals. */}
      <dl className="flex flex-wrap gap-x-12 gap-y-4 border-y border-[rgba(112,115,147,0.12)] py-5">
        <Summary label="Outstanding" value={totals.open.v} count={totals.open.n} />
        <Summary label="Overdue" value={totals.overdue.v} count={totals.overdue.n} tone={totals.overdue.n ? "red" : undefined} />
        <Summary label="Settled" value={totals.settled.v} count={totals.settled.n} tone={totals.settled.n ? "green" : undefined} />
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["open", "Open"],
            ["overdue", "Overdue"],
            ["settled", "Settled"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "h-8 rounded-lg border px-3 text-[14px] transition-colors duration-150 ease-out",
              filter === id
                ? "border-ink/80 text-ink"
                : "border-[rgba(112,115,147,0.2)] text-text-2 hover:bg-[rgba(112,115,147,0.06)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center py-12 text-center">
          <p className="text-[17px] text-ink">Finance your first invoice</p>
          <p className="mt-1 text-[14px] text-muted">Every advance you take shows up here, with its on-chain status.</p>
          <Link href="/app/advance" className={buttonClass("chip", "md", "mt-4")}>
            <Plus className="h-4 w-4" />
            Finance an invoice
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead>
              <tr className="text-[13px] text-muted">
                <th className="py-2.5 pr-3 font-normal">Due date</th>
                <th className="py-2.5 pr-3 font-normal">Status</th>
                <th className="py-2.5 pr-3 font-normal">Client</th>
                <th className="py-2.5 pr-3 text-right font-normal">Advance ({TOKEN_SYMBOL})</th>
                <th className="py-2.5 pl-6 pr-3 font-normal">Invoice no.</th>
                <th className="py-2.5 font-normal">Financed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const s = stateOf(r);
                const days = r.dueDate ? daysFromToday(r.dueDate) : null;
                return (
                  <tr
                    key={r.invoiceHash}
                    onClick={() => open(r.invoiceHash)}
                    className={cn(
                      "h-[52px] cursor-pointer border-t border-[rgba(112,115,147,0.1)] transition-colors duration-150 ease-out hover:bg-[rgba(112,115,147,0.06)]",
                      picked === r.invoiceHash && "bg-[rgba(112,115,147,0.06)]",
                    )}
                  >
                    <td className="py-3 pr-3">
                      <span className="block text-ink">{r.dueDate ? shortDate(r.dueDate) : "–"}</span>
                      {days !== null && !s.settled && (
                        <span className={cn("block text-[12px]", days < 0 ? "text-red" : "text-muted")}>
                          {days < 0 ? `${-days} days late` : `in ${days} days`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <LoanBadge status={s.settled ? "Repaid" : s.loan?.status} overdue={s.overdue} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-3">
                        <Initials name={r.clientName} />
                        <span className="min-w-0">
                          <span className="block text-ink">{r.clientName}</span>
                          {r.clientAddress && (
                            <span className="block font-mono text-[12px] text-muted">
                              {truncateMiddle(r.clientAddress, 4, 4)}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right text-ink">
                      <Money value={r.advanceAmount} />
                    </td>
                    <td className="py-3 pl-6 pr-3 text-ink">{r.invoiceNumber}</td>
                    <td className="py-3 text-ink">{shortDate(r.createdAt)}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr className="border-t border-[rgba(112,115,147,0.1)]">
                  <td colSpan={6} className="py-10 text-center text-muted">
                    No advances match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <Drawer onClose={() => open(null)}>
          <AdvanceDetail
            key={current.invoiceHash}
            record={current}
            loan={loans[current.invoiceHash]}
            settledTx={settledTxFor(current.invoiceHash, current.settleTx)}
            onClose={() => open(null)}
            settle={(onPhase) =>
              repayLoan(
                {
                  borrower: wallet.publicKey!,
                  invoiceHash: current.invoiceHash,
                  // The contract collects exactly what is owed (the advance; no fee in
                  // the PoC) and moves it from the borrower back into the pool.
                  amount: loans[current.invoiceHash]?.loanAmount ?? toUnits(current.advanceAmount),
                },
                { sign, onPhase },
              )
            }
            onSettled={async (hash) => {
              if (wallet.publicKey && !current.imported) {
                updateAdvance(wallet.publicKey, current.invoiceHash, {
                  settleTx: hash,
                  settledAt: new Date().toISOString(),
                });
              }
              refreshSoon(reload, refreshBalance, activity.reload);
            }}
          />
        </Drawer>
      )}
    </>
  );
}

function shortDate(value: string) {
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(r: AdvanceRecord, loan: LoanRecord | null | undefined) {
  return loan?.status === "Active" && !!r.dueDate && daysFromToday(r.dueDate) < 0;
}

function Summary({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: number;
  count: number;
  tone?: "green" | "red";
}) {
  return (
    <div>
      <dt className="text-[15px] text-text-2">
        {label} <span className="text-muted">· {count}</span>
      </dt>
      <dd
        className={cn(
          "mt-1 text-[24px] leading-tight tracking-[-0.02em]",
          tone === "green" ? "text-brand" : tone === "red" ? "text-red" : "text-ink",
        )}
      >
        <Money value={value} unit={TOKEN_SYMBOL} />
      </dd>
    </div>
  );
}

/** Counterparty avatar: initials in a soft tinted circle. */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-[12px] text-brand-strong">
      {letters || "?"}
    </span>
  );
}

/**
 * Detail panel: a floating card beside the table, not a full-height
 * drawer. No backdrop, so the table stays usable and another row can be
 * picked while it is open.
 */
function Drawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="Advance details"
      className="drawer-in fixed inset-x-3 bottom-3 top-[116px] z-40 flex flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_0_2px_rgba(175,178,206,0.56),0_1px_4px_rgba(4,4,52,0.1),0_24px_48px_-24px_rgba(4,4,52,0.18)] sm:inset-x-auto sm:right-4 sm:w-[424px] lg:top-[76px]"
    >
      {children}
    </aside>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────

function AdvanceDetail({
  record,
  loan,
  settle,
  onSettled,
  onClose,
  settledTx,
}: {
  record: Row;
  loan: LoanRecord | null | undefined;
  settle: (onPhase: (p: TxPhase) => void) => Promise<{ hash: string }>;
  onSettled: (hash: string) => Promise<void>;
  onClose: () => void;
  settledTx?: string;
}) {
  const [phase, setPhase] = useState<TxPhase | "done" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const status = loan?.status;
  // A confirmed settlement tx counts even if the RPC read is a ledger behind.
  const settled = status === "Repaid" || !!settledTx;
  const overdue = !settled && isOverdue(record, loan);
  const held = Math.max(record.invoiceAmount - record.advanceAmount, 0);
  const daysLeft = record.dueDate ? daysFromToday(record.dueDate) : null;
  const busy = phase !== null && phase !== "done";

  async function run() {
    setError(null);
    setPhase("preparing");
    try {
      const { hash } = await settle(setPhase);
      setPhase("done");
      await onSettled(hash);
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
      setPhase(null);
    }
  }

  const timeline: { title: string; meta?: React.ReactNode; state: "done" | "current" | "todo" | "planned" }[] = [
    {
      title: "Verified and registered",
      meta: (
        <>
          {formatDateTime(record.createdAt)}
          {record.confidence && <> · {record.confidence} confidence</>}
        </>
      ),
      state: "done",
    },
    {
      title: "Assigned to Sanwo",
      meta: record.clientAddress
        ? `Client ${truncateMiddle(record.clientAddress, 4, 4)} recorded as the buyer on-chain`
        : "Recorded on-chain",
      state: "done",
    },
    {
      title: `${formatAmount(record.advanceAmount)} ${TOKEN_SYMBOL} paid to your wallet`,
      meta: <TxLink hash={record.disburseTx} label="Disbursement" />,
      state: "done",
    },
    {
      title: record.dueDate ? `Invoice due ${formatDate(record.dueDate)}` : "Invoice due",
      meta: settled
        ? "Advance repaid"
        : daysLeft !== null
          ? daysLeft >= 0
            ? `${daysLeft} days to go`
            : `${Math.abs(daysLeft)} days overdue`
          : undefined,
      state: settled ? "done" : "current",
    },
    {
      title: `${formatAmount(record.advanceAmount)} ${TOKEN_SYMBOL} repaid to the pool`,
      meta: settledTx ? <TxLink hash={settledTx} label="Repayment" /> : "Repay from your wallet below",
      state: settled ? "done" : "todo",
    },
    {
      title: held ? `${formatAmount(held)} ${TOKEN_SYMBOL} released to you` : "Remaining balance released to you",
      meta: "With collection from the client, in v1",
      state: "planned",
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
        <p className="truncate text-[15px] text-text-2">
          {record.invoiceNumber} · {record.clientName}
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 rounded-full p-1.5 text-text-2 transition-colors hover:bg-[rgba(112,115,147,0.08)] hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted">Advance</p>
          <LoanBadge status={settled ? "Repaid" : status} overdue={overdue} />
        </div>
        <p className="mt-1 text-[32px] leading-tight tracking-[-0.02em] text-ink">
          <Money value={record.advanceAmount} unit={TOKEN_SYMBOL} />
        </p>
        <p className="text-[14px] text-text-2">
          against an invoice of {record.invoiceAmount ? `${formatAmount(record.invoiceAmount)} USD` : "unknown value"}
        </p>

        <ol className="relative mt-8 space-y-5">
          <span className="absolute bottom-3 left-[9px] top-3 w-px bg-line" aria-hidden />
          {timeline.map((t) => (
            <li key={t.title} className="relative flex gap-3.5">
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  t.state === "done" && "bg-brand text-white",
                  t.state === "current" && "border-2 border-brand bg-surface",
                  t.state === "todo" && "border border-line-strong bg-surface",
                  t.state === "planned" && "border border-dashed border-line-strong bg-surface",
                )}
              >
                {t.state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
                {t.state === "current" && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[14px]", t.state === "planned" ? "text-muted" : "text-ink")}>{t.title}</p>
                {t.meta && <div className="mt-0.5 text-[13px] text-muted">{t.meta}</div>}
              </div>
            </li>
          ))}
        </ol>

        <dl className="mt-8 space-y-3 border-t border-line pt-5 text-[13px]">
          <DetailRow label="Fingerprint" value={truncateMiddle(record.invoiceHash, 10, 10)} mono />
          {record.clientAddress && (
            <DetailRow
              label="Client"
              value={truncateMiddle(record.clientAddress, 6, 6)}
              href={explorer.account(record.clientAddress)}
              mono
            />
          )}
          <DetailRow
            label="Registered in"
            value={`Receivables ${truncateMiddle(RECEIVABLES_CONTRACT_ID, 4, 4)}`}
            href={explorer.contract(RECEIVABLES_CONTRACT_ID)}
            mono
          />
          {record.documentHash && (
            <DetailRow label="Document" value={`${record.documentName} · ${truncateMiddle(record.documentHash, 6, 6)}`} />
          )}
          {record.imported && (
            <div className="pt-1">
              <Badge tone="neutral">Recovered from on-chain events</Badge>
            </div>
          )}
        </dl>
      </div>

      {!settled && status === "Active" && (
        <div className="border-t border-line px-6 py-5">
          {!confirming ? (
            <Button size="lg" className="w-full" onClick={() => setConfirming(true)}>
              Repay advance
            </Button>
          ) : (
            <div className="space-y-4">
              <Notice tone="blue" icon={<Info className="h-4 w-4" />}>
                On testnet you repay the advance from your wallet: {formatAmount(record.advanceAmount)}{" "}
                {TOKEN_SYMBOL} moves back into the pool in one transaction. In v1 the client&apos;s payment to
                a collection address settles it instead.
              </Notice>
              {phase && <TxProgress phase={phase} />}
              {error && (
                <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
                  {error}
                </Notice>
              )}
              <div className="flex gap-2">
                <Button variant="soft" size="lg" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="lg" className="flex-1" loading={busy} onClick={run}>
                  Repay {formatAmount(record.advanceAmount)} {TOKEN_SYMBOL}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  const content = (
    <span className={cn("truncate", mono && "font-mono text-[12px]")}>
      {value}
      {href && <ArrowUpRight className="ml-1 inline h-3 w-3" />}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="hover:text-brand">
            {content}
          </a>
        ) : (
          content
        )}
      </dd>
    </div>
  );
}
