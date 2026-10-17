"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  CircleX,
  FileUp,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { ConnectOptions } from "@/components/app/ConnectOptions";
import { TxProgress } from "@/components/app/shared";
import { LogoMark } from "@/components/brand/Logo";
import { Badge, Button, Field, Money, Notice, buttonClass, inputClass } from "@/components/ui/primitives";
import { useWallet } from "@/context/WalletContext";
import {
  ADVANCE_RATE,
  MAX_ADVANCE_RATE,
  PLANNED_ORIGINATION_FEE,
  TOKEN_IS_STAND_IN,
  TOKEN_SYMBOL,
} from "@/lib/config";
import { submitReceivable } from "@/lib/contracts";
import { refreshSoon, usePoolStats } from "@/lib/hooks";
import { errorMessage, type TxPhase } from "@/lib/stellar";
import { saveAdvance } from "@/lib/store";
import {
  addDays,
  cn,
  daysFromToday,
  explorer,
  formatAmount,
  formatDate,
  formatPercent,
  fromUnits,
  invoiceFingerprint,
  sha256Hex,
  toDateInput,
  toUnits,
  truncateMiddle,
} from "@/lib/utils";
import {
  AUTOMATED,
  NOT_CONNECTED,
  confidenceFrom,
  runCheck,
  type Check as VerifyCheck,
  type Confidence,
  type InvoiceInput,
} from "@/lib/verify";
import { fundWithFriendbot } from "@/lib/wallet";

type Step = "details" | "verify" | "offer" | "disburse";
const STEPS: Step[] = ["details", "verify", "offer", "disburse"];
const STEP_LABELS: Record<Step, string> = { details: "Invoice", verify: "Verification", offer: "Review", disburse: "Paid" };

type Form = {
  invoiceNumber: string;
  clientName: string;
  clientAddress: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  documentName: string;
  documentHash: string;
};

const EMPTY_FORM: Form = {
  invoiceNumber: "",
  clientName: "",
  clientAddress: "",
  amount: "",
  issueDate: toDateInput(addDays(new Date(), -3)),
  dueDate: toDateInput(addDays(new Date(), 57)),
  documentName: "",
  documentHash: "",
};

/**
 * The invoice flow: a full-screen takeover with the form on the left,
 * a live document preview on a soft gradient to the right, and Back and
 * Continue pills centred along the bottom.
 */
export default function FinanceInvoicePage() {
  const { wallet, ready, balance, sign, refreshBalance } = useWallet();
  const pool = usePoolStats(15_000);
  const scroller = useRef<HTMLDivElement>(null);

  const [step, setStepState] = useState<Step>("details");
  const setStep = (next: Step) => {
    setStepState(next);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [preview, setPreview] = useState<"invoice" | "receivable">("invoice");

  const [checks, setChecks] = useState<VerifyCheck[]>(AUTOMATED);
  const [verifying, setVerifying] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<TxPhase | "done" | null>(null);
  const [result, setResult] = useState<{ hash: string; advance: bigint } | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const amount = Number(form.amount) || 0;
  const advance = amount * ADVANCE_RATE;
  const held = amount - advance;
  const liquidity = pool.data ? fromUnits(pool.data.poolBalance) : null;
  const maxInvoice = liquidity !== null ? Math.floor(liquidity / ADVANCE_RATE) : null;

  const fingerprint = useMemo(() => {
    if (!wallet.publicKey || !form.clientAddress || !form.invoiceNumber.trim()) return null;
    return invoiceFingerprint(wallet.publicKey, form.clientAddress.trim(), form.invoiceNumber);
  }, [wallet.publicKey, form.clientAddress, form.invoiceNumber]);

  const errors = validate(form, wallet.publicKey, maxInvoice);
  const formValid = Object.values(errors).every((e) => !e);
  const done = phase === "done" && !!result;
  const busy = phase !== null && phase !== "done";
  const blocked = confidence?.level === "Blocked";
  const connected = !ready || wallet.connected;

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function createDemoClient() {
    setCreatingClient(true);
    try {
      const kp = Keypair.random();
      await fundWithFriendbot(kp.publicKey());
      setForm((f) => ({ ...f, clientAddress: kp.publicKey(), clientName: f.clientName || "Northwind Labs GmbH" }));
    } catch {
      setForm((f) => ({ ...f, clientAddress: Keypair.random().publicKey() }));
    } finally {
      setCreatingClient(false);
    }
  }

  function fillSample() {
    const suggested = maxInvoice !== null ? Math.max(10, Math.min(1200, Math.floor(maxInvoice * 0.4))) : 1000;
    setForm((f) => ({
      ...f,
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: f.clientName || "Northwind Labs GmbH",
      amount: String(suggested),
      issueDate: toDateInput(addDays(new Date(), -3)),
      dueDate: toDateInput(addDays(new Date(), 57)),
    }));
    if (!form.clientAddress) createDemoClient();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    setForm((f) => ({ ...f, documentName: file.name, documentHash: sha256Hex(buf) }));
  }

  async function runVerification() {
    if (!wallet.publicKey || !fingerprint) return;
    setStep("verify");
    setVerifying(true);
    const input: InvoiceInput = {
      borrower: wallet.publicKey,
      invoiceNumber: form.invoiceNumber.trim(),
      clientName: form.clientName.trim(),
      clientAddress: form.clientAddress.trim(),
      amount,
      currency: "USD",
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      invoiceHash: fingerprint,
    };
    let current = AUTOMATED.map((c) => ({ ...c }));
    setChecks(current);
    for (const check of AUTOMATED) {
      current = current.map((c) => (c.id === check.id ? { ...c, status: "running" } : c));
      setChecks(current);
      const [res] = await Promise.all([runCheck(check.id, input), new Promise((r) => setTimeout(r, 380))]);
      current = current.map((c) => (c.id === check.id ? { ...c, ...res } : c));
      setChecks(current);
    }
    setConfidence(confidenceFrom(current));
    setVerifying(false);
  }

  async function disburse() {
    if (!wallet.publicKey || !fingerprint) return;
    setStep("disburse");
    setTxError(null);
    setPhase("preparing");
    try {
      const res = await submitReceivable(
        {
          borrower: wallet.publicKey,
          invoiceHash: fingerprint,
          invoiceAmount: toUnits(amount),
          buyer: form.clientAddress.trim(),
        },
        { sign, onPhase: setPhase },
      );
      setPhase("done");
      setResult(res);
      saveAdvance(wallet.publicKey, {
        invoiceHash: fingerprint,
        invoiceNumber: form.invoiceNumber.trim(),
        clientName: form.clientName.trim(),
        clientAddress: form.clientAddress.trim(),
        invoiceAmount: amount,
        advanceAmount: fromUnits(res.advance) || advance,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        documentName: form.documentName || undefined,
        documentHash: form.documentHash || undefined,
        confidence: confidence?.level,
        disburseTx: res.hash,
        createdAt: new Date().toISOString(),
      });
      refreshSoon(refreshBalance, pool.reload);
    } catch (err) {
      setTxError(errorMessage(err));
      setPhase(null);
    }
  }

  /** Going back to edit invalidates verification and acceptance. */
  function backToDetails() {
    setChecks(AUTOMATED);
    setConfidence(null);
    setAgreed(false);
    setStep("details");
  }

  function reset() {
    setForm(EMPTY_FORM);
    setTouched(false);
    setResult(null);
    setPhase(null);
    setTxError(null);
    backToDetails();
  }

  const titles: Record<Step, string> = {
    details: "Invoice details",
    verify: "Verification",
    offer: "Review your advance",
    disburse: done ? "Your advance is paid" : "Paying your advance",
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-surface">
      {/* ── Left: the form ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col lg:w-1/2 lg:flex-none">
        {/* Flow header: mark, a hairline divider, the workspace name. */}
        <div className="flex h-[72px] shrink-0 items-center justify-between px-6 lg:px-10">
          <Link href="/app" className="flex items-center gap-3.5 text-ink" aria-label="Back to the app">
            <LogoMark size={30} />
            <span className="h-6 w-px bg-[rgba(112,115,147,0.2)]" />
            <span className="text-[15px]">Sanwo</span>
          </Link>
          <Link
            href="/app"
            aria-label="Close"
            className="rounded-full p-1.5 text-text-2 transition-colors hover:bg-[rgba(112,115,147,0.08)] hover:text-ink lg:hidden"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[540px] px-6 pb-12 pt-4 lg:pt-10">
            {!connected ? (
              <>
                <h1 className="text-[28px] leading-tight tracking-[-0.025em] text-ink">Connect a wallet</h1>
                <p className="mt-2 text-[15px] text-text-2">
                  The advance is paid to the connected wallet, and that wallet signs the receivable on-chain.
                </p>
                <div className="mt-8">
                  <ConnectOptions />
                </div>
              </>
            ) : (
              <>
                {/* Step list: active in ink, done with a check, upcoming in grey. */}
                <ol className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]">
                  {STEPS.map((s, i) => {
                    const at = STEPS.indexOf(step);
                    const state = i < at || (done && i === at) ? "done" : i === at ? "active" : "todo";
                    return (
                      <li
                        key={s}
                        aria-current={state === "active" ? "step" : undefined}
                        className={cn(
                          "flex items-center gap-1.5",
                          state === "active" && "font-[500] text-ink",
                          state === "done" && "text-ink",
                          state === "todo" && "text-[#9d9da8]",
                        )}
                      >
                        {state === "done" && <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2.5} />}
                        {STEP_LABELS[s]}
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-6 flex items-center justify-between gap-4">
                  <h1 className="text-[28px] leading-tight tracking-[-0.025em] text-ink">{titles[step]}</h1>
                  {step === "details" && (
                    <button onClick={fillSample} className={buttonClass("chip", "pill", "shrink-0")}>
                      <Sparkles className="h-4 w-4" />
                      Fill sample
                    </button>
                  )}
                </div>

                {step === "details" && (
                  <DetailsStep
                    form={form}
                    set={set}
                    errors={touched ? errors : null}
                    maxInvoice={maxInvoice}
                    creatingClient={creatingClient}
                    onDemoClient={createDemoClient}
                    onFile={onFile}
                    payee={wallet.publicKey}
                    payeeKind={wallet.kind}
                    balance={balance !== null ? fromUnits(balance) : null}
                    onSubmit={() => {
                      setTouched(true);
                      if (formValid) runVerification();
                    }}
                  />
                )}

                {step === "verify" && <VerifyStep checks={checks} confidence={confidence} />}

                {step === "offer" && (
                  <OfferStep
                    form={form}
                    amount={amount}
                    advance={advance}
                    held={held}
                    agreed={agreed}
                    setAgreed={setAgreed}
                  />
                )}

                {step === "disburse" &&
                  (done && result ? (
                    <PaidStep
                      advance={fromUnits(result.advance) || advance}
                      hash={result.hash}
                      fingerprint={fingerprint}
                      clientName={form.clientName}
                      dueDate={form.dueDate}
                      payee={wallet.publicKey}
                    />
                  ) : (
                    <div className="mt-8">
                      <p className="text-[15px] text-text-2">
                        {wallet.kind === "freighter"
                          ? "Approve the transaction in Freighter when it opens."
                          : "Your test wallet signs automatically."}
                      </p>
                      <div className="mt-6 rounded-xl border border-line p-5">
                        <TxProgress phase={phase} />
                      </div>
                      {txError && (
                        <Notice tone="red" className="mt-5" icon={<AlertTriangle className="h-4 w-4" />}>
                          {txError}
                        </Notice>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        {/* Flow footer: a hairline divider, then "Go back" and "Next" on the content column. */}
        <div className="shrink-0 border-t border-[rgba(112,115,147,0.12)]">
          <div className="mx-auto flex max-w-[540px] flex-wrap items-center gap-3 px-6 py-4">
          {!connected || step === "details" ? (
            <>
              <Link href="/app" className={buttonClass("soft", "flow")}>
                Cancel
              </Link>
              {connected && (
                <Button size="flow" type="submit" form="invoice-form" disabled={touched && !formValid}>
                  Run verification
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : step === "verify" ? (
            <>
              <Button variant="soft" size="flow" onClick={backToDetails} disabled={verifying}>
                <ChevronLeft className="h-4 w-4" />
                Go back
              </Button>
              <Button size="flow" disabled={verifying || !confidence || blocked} onClick={() => setStep("offer")}>
                {verifying ? "Verifying" : "Review offer"}
                {verifying ? <Loader2 className="spin h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </>
          ) : step === "offer" ? (
            <>
              <Button variant="soft" size="flow" onClick={() => setStep("verify")}>
                <ChevronLeft className="h-4 w-4" />
                Go back
              </Button>
              <Button size="flow" disabled={!agreed} onClick={disburse}>
                Accept and receive {formatAmount(advance)} {TOKEN_SYMBOL}
              </Button>
            </>
          ) : done ? (
            <>
              <Button variant="soft" size="flow" onClick={reset}>
                Finance another
              </Button>
              <Link href={`/app/advances#${fingerprint}`} className={buttonClass("primary", "flow")}>
                Track this advance
              </Link>
            </>
          ) : txError ? (
            <>
              <Button variant="soft" size="flow" onClick={() => setStep("offer")}>
                <ChevronLeft className="h-4 w-4" />
                Go back
              </Button>
              <Button size="flow" onClick={disburse}>
                Try again
              </Button>
            </>
          ) : (
            <Button size="flow" loading={busy} disabled>
              Working on it
            </Button>
          )}
          </div>
        </div>
      </div>

      {/* ── Right: live preview ────────────────────────────────────────── */}
      <div className="relative hidden w-1/2 flex-col bg-[linear-gradient(165deg,#f3f5f4_0%,#ecf1ee_45%,#e2ebe6_100%)] lg:flex">
        <div className="flex items-end justify-between px-[7%] pt-10">
          <div className="flex gap-6 border-b border-line-strong/60">
            {(["invoice", "receivable"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPreview(t)}
                className={cn(
                  "-mb-px border-b-2 pb-2.5 text-[15px] capitalize",
                  preview === t ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Link href="/app" aria-label="Close" className="mb-2 rounded-full p-1.5 text-muted hover:bg-white/60 hover:text-ink">
            <X className="h-6 w-6" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[7%] pt-8">
          {preview === "invoice" ? (
            <InvoicePaper form={form} amount={amount} payee={wallet.publicKey} assigned={done ? advance : null} />
          ) : (
            <ReceivablePaper
              fingerprint={fingerprint}
              borrower={wallet.publicKey}
              buyer={form.clientAddress}
              amount={amount}
              advance={advance}
              status={done ? "Active" : "Not submitted"}
              hash={result?.hash ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Steps ──────────────────────────────────────────────────────────────────

function DetailsStep({
  form,
  set,
  errors,
  maxInvoice,
  creatingClient,
  onDemoClient,
  onFile,
  payee,
  payeeKind,
  balance,
  onSubmit,
}: {
  form: Form;
  set: (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: ReturnType<typeof validate> | null;
  maxInvoice: number | null;
  creatingClient: boolean;
  onDemoClient: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  payee: string | null;
  payeeKind: string | null;
  balance: number | null;
  onSubmit: () => void;
}) {
  return (
    <form
      id="invoice-form"
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-[13px] text-muted">Advance paid to</p>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-line px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-2 text-[12px] text-brand-strong">
          {payee?.slice(-2) ?? "–"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-ink">
            {payeeKind === "freighter" ? "Freighter" : "Test wallet"} ••{payee?.slice(-4)}
          </span>
          <span className="block truncate font-mono text-[12px] text-muted">{payee && truncateMiddle(payee, 8, 8)}</span>
        </span>
        {balance !== null && (
          <span className="text-[14px] text-text-2">
            <Money value={balance} unit={TOKEN_SYMBOL} />
          </span>
        )}
      </div>

      <h2 className="mt-9 text-[17px] text-ink">Client</h2>
      <div className="mt-4 space-y-5">
        <Field label="Client name" error={errors?.clientName}>
          <input className={inputClass} value={form.clientName} onChange={set("clientName")} placeholder="Northwind Labs GmbH" />
        </Field>
        <Field
          label="Client Stellar address"
          error={errors?.clientAddress}
          hint="Recorded on-chain as the buyer on this receivable. Not verified on testnet."
        >
          <div className="flex gap-2">
            <input
              className={cn(inputClass, "font-mono text-[13px]")}
              value={form.clientAddress}
              onChange={set("clientAddress")}
              placeholder="G…"
              spellCheck={false}
            />
            <Button type="button" variant="chip" className="h-11 shrink-0 rounded-lg" onClick={onDemoClient} loading={creatingClient}>
              Demo client
            </Button>
          </div>
        </Field>
      </div>

      <h2 className="mt-9 text-[17px] text-ink">Invoice</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Field label="Invoice number" error={errors?.invoiceNumber}>
          <input className={inputClass} value={form.invoiceNumber} onChange={set("invoiceNumber")} placeholder="INV-2041" />
        </Field>
        <Field
          label="Amount"
          error={errors?.amount}
          hint={maxInvoice !== null ? `The pool can fund up to ${formatAmount(maxInvoice)} right now.` : "Checking pool liquidity…"}
        >
          <div className="relative">
            <input
              className={cn(inputClass, "nums pr-14")}
              value={form.amount}
              onChange={set("amount")}
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">USD</span>
          </div>
        </Field>
        <Field label="Invoice date" error={errors?.issueDate}>
          <input className={inputClass} type="date" value={form.issueDate} onChange={set("issueDate")} />
        </Field>
        <Field label="Due date" error={errors?.dueDate}>
          <input className={inputClass} type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-3 text-[14px] text-brand hover:underline">
        <FileUp className="h-4 w-4" />
        {form.documentName ? `${form.documentName} · hashed locally` : "Attach the invoice PDF (optional)"}
        <input type="file" accept=".pdf,image/*" className="hidden" onChange={onFile} />
      </label>
      {form.documentHash && (
        <p className="mt-1.5 font-mono text-[11px] text-subtle">SHA-256 {truncateMiddle(form.documentHash, 12, 12)}</p>
      )}
      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        v1 finances US dollar invoices that the client has accepted and is not disputing.
      </p>
    </form>
  );
}

function VerifyStep({ checks, confidence }: { checks: VerifyCheck[]; confidence: Confidence | null }) {
  const blocked = confidence?.level === "Blocked";
  return (
    <div className="mt-3">
      <p className="text-[15px] leading-relaxed text-text-2">
        These checks run against live data: your form, Stellar Horizon and the deployed contracts.
      </p>

      <ul className="mt-7 space-y-4">
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>

      <h2 className="mt-10 text-[17px] text-ink">Stronger signals</h2>
      <p className="mt-1 text-[13px] text-muted">Not connected in the proof of concept.</p>
      <ul className="mt-4 space-y-3">
        {NOT_CONNECTED.map((c) => (
          <li key={c.id} className="flex items-start gap-3 text-[14px]">
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
            <span>
              <span className="block text-muted">{c.label}</span>
              <span className="block text-[12px] text-subtle">{c.source}</span>
            </span>
          </li>
        ))}
      </ul>

      {confidence && (
        <div
          className={cn(
            "mt-8 rounded-xl px-5 py-4",
            blocked ? "bg-red-bg" : confidence.level === "Low" ? "bg-amber-bg" : "bg-mint",
          )}
        >
          <div className="flex items-center gap-2 text-[14px] text-ink">
            Confidence
            <Badge tone={blocked ? "red" : confidence.level === "Low" ? "amber" : "green"}>{confidence.level}</Badge>
          </div>
          <p className="mt-1.5 text-[14px] text-text-2">{confidence.summary}</p>
        </div>
      )}
    </div>
  );
}

function OfferStep({
  form,
  amount,
  advance,
  held,
  agreed,
  setAgreed,
}: {
  form: Form;
  amount: number;
  advance: number;
  held: number;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-[14px] text-text-2">You receive now</p>
      <p className="mt-1 text-[44px] leading-none tracking-[-0.02em] text-ink">
        <Money value={advance} unit={TOKEN_SYMBOL} />
      </p>
      <p className="mt-2 text-[14px] text-muted">
        {formatPercent(ADVANCE_RATE)} of {form.invoiceNumber}. Settles when {form.clientName} pays on{" "}
        {formatDate(form.dueDate)}.
      </p>

      <dl className="mt-8 space-y-4 text-[15px]">
        <ReviewRow label="Invoice value" value={`${formatAmount(amount)} USD`} />
        <ReviewRow
          label="Advance rate"
          value={formatPercent(ADVANCE_RATE)}
          note={`Fixed by the testnet contract. v1 prices each invoice, up to ${formatPercent(MAX_ADVANCE_RATE)}.`}
        />
        <ReviewRow
          label="Fee"
          value={`0.00 ${TOKEN_SYMBOL}`}
          note={`Waived on testnet. Planned at about ${formatPercent(PLANNED_ORIGINATION_FEE, 1)}.`}
        />
        <ReviewRow
          label="Not advanced"
          value={`${formatAmount(held)} ${TOKEN_SYMBOL}`}
          note="The rest of the invoice. In v1 it reaches you when the client pays."
        />
        <ReviewRow
          label="Expected settlement"
          value={formatDate(form.dueDate)}
          note={`${daysFromToday(form.dueDate)} days from today`}
        />
      </dl>

      <div className="mt-8 rounded-xl bg-paper px-5 py-4">
        <p className="text-[14px] text-ink">Repayment and recourse</p>
        <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-text-2">
          <li>
            On testnet you repay the advance yourself, from this wallet, on the Advances page. The full{" "}
            {formatAmount(advance)} {TOKEN_SYMBOL} goes back into the pool.
          </li>
          <li>
            In v1, {form.clientName || "your client"} pays a collection address set up for this invoice,
            and that payment settles the advance. It is not live on testnet, so no one should pay the
            contract directly.
          </li>
          <li>You confirm the client accepted the invoice and is not disputing it.</li>
        </ul>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
          />
          I agree to repay the advance and to the recourse terms.
        </label>
      </div>
      {TOKEN_IS_STAND_IN && (
        <p className="mt-4 text-[12px] text-subtle">
          Testnet pays {TOKEN_SYMBOL} in place of USDC, one token per dollar.
        </p>
      )}
    </div>
  );
}

/** The confirmation card once the advance is paid. */
function PaidStep({
  advance,
  hash,
  fingerprint,
  clientName,
  dueDate,
  payee,
}: {
  advance: number;
  hash: string;
  fingerprint: string | null;
  clientName: string;
  dueDate: string;
  payee: string | null;
}) {
  return (
    <div className="mt-2">
      <p className="text-[15px] text-text-2">Registered and paid out in one Stellar transaction.</p>
      <div className="mt-7 rounded-xl border border-line shadow-[0_2px_10px_-4px_rgba(20,30,25,0.1)]">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-text-2">Advance to ••{payee?.slice(-4)}</p>
            <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[12px] text-text-2">Due {formatDate(dueDate)}</span>
          </div>
          <p className="mt-2 text-[34px] leading-tight text-ink">
            <Money value={advance} unit={TOKEN_SYMBOL} />
          </p>
          <p className="mt-1 text-[14px] text-ink">Repay it from your wallet when {clientName} pays you</p>
        </div>
        <div className="mt-5 space-y-3 border-t border-line px-5 py-4 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Transaction</span>
            <a
              href={explorer.tx(hash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-mono text-[12px] text-brand hover:underline"
            >
              {truncateMiddle(hash, 8, 8)}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          {fingerprint && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Fingerprint</span>
              <span className="font-mono text-[12px] text-ink">{truncateMiddle(fingerprint, 8, 8)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Previews ───────────────────────────────────────────────────────────────

function InvoicePaper({
  form,
  amount,
  payee,
  assigned,
}: {
  form: Form;
  amount: number;
  payee: string | null;
  assigned: number | null;
}) {
  const blank = <span className="inline-block h-2.5 w-24 rounded-full bg-paper-2 align-middle" />;
  return (
    <div className="relative min-h-full rounded-t-lg bg-surface px-[8%] pb-16 pt-12 shadow-[0_0_40px_-12px_rgba(20,30,25,0.18)]">
      {assigned !== null && (
        <div className="absolute right-8 top-10 rotate-[-4deg] rounded-md border-2 border-brand px-3 py-1.5 text-center text-brand">
          <p className="text-[12px] tracking-[0.12em]">ASSIGNED TO SANWO</p>
          <p className="text-[11px]">
            {formatAmount(assigned)} {TOKEN_SYMBOL} advanced
          </p>
        </div>
      )}
      <p className="text-[44px] leading-none tracking-[-0.02em] text-ink">Invoice</p>

      <div className="mt-12 grid grid-cols-[1fr_1fr_0.9fr] gap-6 text-[12px]">
        {["From", "To", "Details"].map((h) => (
          <p key={h} className="border-b border-line pb-2 text-ink">
            {h}
          </p>
        ))}
        <div className="space-y-1 text-text-2">
          <p>Your business</p>
          <p className="font-mono text-[11px]">{payee ? truncateMiddle(payee, 6, 6) : blank}</p>
        </div>
        <div className="space-y-1 text-text-2">
          <p>{form.clientName || blank}</p>
          <p className="font-mono text-[11px]">{form.clientAddress ? truncateMiddle(form.clientAddress, 6, 6) : blank}</p>
        </div>
        <dl className="space-y-1 text-text-2">
          <div className="flex justify-between gap-2">
            <dt>Invoice no.</dt>
            <dd>{form.invoiceNumber || blank}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-14 text-[12px]">
        <div className="grid grid-cols-[2fr_0.6fr_1fr_1fr] border-b border-line pb-2 text-ink">
          <span>Item</span>
          <span className="text-right">Quantity</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Total</span>
        </div>
        <div className="grid grid-cols-[2fr_0.6fr_1fr_1fr] border-b border-line py-3 text-text-2">
          <span>{amount ? "Professional services" : blank}</span>
          <span className="text-right">1</span>
          <span className="text-right">{amount ? formatAmount(amount) : blank}</span>
          <span className="text-right">{amount ? formatAmount(amount) : blank}</span>
        </div>
        <div className="ml-auto mt-4 flex w-[62%] justify-between text-[17px] text-ink">
          <span>Total</span>
          <span className="nums">${formatAmount(amount)}</span>
        </div>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-6 text-[12px]">
        <p className="border-b border-line pb-2 text-ink">Terms</p>
        <p className="border-b border-line pb-2 text-ink">Payment</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-text-2">
          <dt>Invoice date</dt>
          <dd>{form.issueDate ? formatDate(form.issueDate) : blank}</dd>
          <dt>Due date</dt>
          <dd>{form.dueDate ? formatDate(form.dueDate) : blank}</dd>
        </dl>
        <p className="leading-relaxed text-text-2">
          {assigned !== null ? "USDC on Stellar. Assigned to Sanwo." : "USDC on Stellar"}
        </p>
      </div>
    </div>
  );
}

function ReceivablePaper({
  fingerprint,
  borrower,
  buyer,
  amount,
  advance,
  status,
  hash,
}: {
  fingerprint: string | null;
  borrower: string | null;
  buyer: string;
  amount: number;
  advance: number;
  status: string;
  hash: string | null;
}) {
  const rows: [string, React.ReactNode][] = [
    ["invoice_hash", fingerprint ? truncateMiddle(fingerprint, 12, 12) : "–"],
    ["borrower", borrower ? truncateMiddle(borrower, 8, 8) : "–"],
    ["buyer", buyer ? truncateMiddle(buyer, 8, 8) : "–"],
    ["invoice_amount", amount ? toUnits(amount).toString() : "–"],
    ["loan_amount", amount ? toUnits(advance).toString() : "–"],
    ["status", status],
  ];
  return (
    <div className="min-h-full rounded-t-lg bg-surface px-[8%] pb-16 pt-12 shadow-[0_0_40px_-12px_rgba(20,30,25,0.18)]">
      <p className="text-[13px] text-muted">Receivables contract</p>
      <p className="mt-1 text-[28px] leading-tight tracking-[-0.01em] text-ink">What goes on-chain</p>
      <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-text-2">
        Only a fingerprint and the amounts are stored. The invoice itself never leaves your browser.
      </p>

      <p className="mt-10 font-mono text-[12px] text-muted">
        submit_receivable(borrower, invoice_hash, invoice_amount, buyer)
      </p>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 py-3">
            <dt className="font-mono text-[12px] text-muted">{k}</dt>
            <dd className="truncate font-mono text-[12px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12px] leading-relaxed text-subtle">
        Amounts are in stroops: seven decimal places, as the token contract stores them. The fingerprint is
        sha256 of your wallet, the client and the invoice number, so the same invoice cannot be financed twice.
      </p>
      {hash && (
        <a
          href={explorer.tx(hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1 text-[14px] text-brand hover:underline"
        >
          View the transaction
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function validate(form: Form, borrower: string | null, maxInvoice: number | null) {
  const amount = Number(form.amount);
  const client = form.clientAddress.trim();
  return {
    invoiceNumber: form.invoiceNumber.trim() ? null : "Enter the invoice number.",
    clientName: form.clientName.trim() ? null : "Enter the client's name.",
    clientAddress: !client
      ? "Enter the client's Stellar address, or create a demo client."
      : !StrKey.isValidEd25519PublicKey(client)
        ? "This is not a valid Stellar address."
        : client === borrower
          ? "The client cannot be your own wallet."
          : null,
    amount:
      !form.amount || !(amount > 0)
        ? "Enter the amount owed."
        : maxInvoice !== null && amount > maxInvoice
          ? `The pool can fund up to ${formatAmount(maxInvoice)} right now.`
          : null,
    issueDate: form.issueDate ? null : "Enter the invoice date.",
    dueDate: !form.dueDate
      ? "Enter the due date."
      : form.issueDate && form.dueDate <= form.issueDate
        ? "The due date must be after the invoice date."
        : null,
  };
}

function CheckRow({ check }: { check: VerifyCheck }) {
  const icon = {
    pending: <span className="h-4 w-4 rounded-full border border-line-strong" />,
    running: <Loader2 className="spin h-4 w-4 text-brand" />,
    pass: <Check className="h-4 w-4 text-brand" strokeWidth={2.5} />,
    warn: <AlertTriangle className="h-4 w-4 text-amber" />,
    fail: <CircleX className="h-4 w-4 text-red" />,
    offline: <CircleDashed className="h-4 w-4 text-subtle" />,
  }[check.status];

  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cn("text-[15px]", check.status === "pending" ? "text-muted" : "text-ink")}>{check.label}</p>
          <p className="text-[12px] text-subtle">{check.source}</p>
        </div>
        {check.detail && (
          <p
            className={cn(
              "mt-0.5 text-[13px]",
              check.status === "fail" ? "text-red" : check.status === "warn" ? "text-amber" : "text-muted",
            )}
          >
            {check.detail}
          </p>
        )}
      </div>
    </li>
  );
}

function ReviewRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <dt className="text-ink">{label}</dt>
        {note && <p className="mt-0.5 max-w-[320px] text-[13px] text-muted">{note}</p>}
      </div>
      <dd className="nums shrink-0 text-right text-ink">{value}</dd>
    </div>
  );
}
