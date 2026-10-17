/* ─────────────────────────────────────────────────────────────────────────
 * lib/contracts.ts — the Sanwo engine as the app sees it
 *
 * Components import from here and never touch the SDK directly.
 *
 * Deployed interface (verified from the WASM spec on testnet):
 *   pool.deposit(depositor, amount) -> Result<i128>         new pool balance
 *   pool.withdraw(depositor, amount) -> Result<i128>        new pool balance
 *   pool.get_deposit(depositor) -> i128                     principal in the pool
 *   pool.get_pool_stats() -> { pool_balance, total_deposited, total_disbursed,
 *                              total_repaid, total_withdrawn, active_loans }
 *   receivables.submit_receivable(borrower, invoice_hash: BytesN<32>,
 *                              invoice_amount, buyer) -> Result<i128>  advance
 *   receivables.repay_loan(invoice_hash, repayment_amount) -> Result<()>
 *                              moves the advance from the borrower back into
 *                              the pool (the PoC charges no fee)
 *   receivables.get_loan_status(invoice_hash) -> Result<LoanRecord>
 *
 * Known PoC contract gaps (tracked for the next contract release):
 *   - withdrawals return principal only; there are no share tokens yet, so
 *     yield and losses are not shared pro rata.
 *   - the advance rate is fixed at 75% and no origination fee is charged.
 * ───────────────────────────────────────────────────────────────────────── */

import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  DEPLOY_LEDGER,
  POOL_CONTRACT_ID,
  RECEIVABLES_CONTRACT_ID,
  TOKEN_CONTRACT_ID,
} from "@/lib/config";
import {
  ContractError,
  invoke,
  server,
  simulateRead,
  type Signer,
  type TxPhase,
} from "@/lib/stellar";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PoolStats = {
  poolBalance: bigint;
  totalDeposited: bigint;
  totalDisbursed: bigint;
  totalRepaid: bigint;
  totalWithdrawn: bigint;
  activeLoans: number;
};

export type LoanStatus = "Pending" | "Active" | "Repaid";

export type LoanRecord = {
  borrower: string;
  buyer: string;
  invoiceAmount: bigint;
  loanAmount: bigint;
  status: LoanStatus;
  timestamp: number; // unix seconds
};

export type ActivityKind = "deposited" | "financed" | "settled" | "withdrawn";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  txHash: string;
  ledger: number;
  at: string; // ISO
  actor: string;
  amount: bigint;
  invoiceAmount?: bigint;
  invoiceHash?: string;
};

type WriteOpts = { sign: Signer; onPhase?: (phase: TxPhase) => void };

// ─── Helpers ────────────────────────────────────────────────────────────────

const i128 = (units: bigint) => nativeToScVal(units, { type: "i128" });
const addr = (a: string) => new Address(a).toScVal();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const bytes32 = (hex: string) => xdr.ScVal.scvBytes(hexToBytes(hex));

function toHex(value: unknown): string | undefined {
  if (value instanceof Uint8Array) {
    return Array.from(value)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return undefined;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getPoolStats(): Promise<PoolStats> {
  const raw = await simulateRead<{
    pool_balance: bigint;
    total_deposited: bigint;
    total_disbursed: bigint;
    total_repaid?: bigint;
    total_withdrawn?: bigint;
    active_loans: number;
  }>(POOL_CONTRACT_ID, "get_pool_stats");
  return {
    poolBalance: BigInt(raw.pool_balance),
    totalDeposited: BigInt(raw.total_deposited),
    totalDisbursed: BigInt(raw.total_disbursed),
    totalRepaid: BigInt(raw.total_repaid ?? 0),
    totalWithdrawn: BigInt(raw.total_withdrawn ?? 0),
    activeLoans: Number(raw.active_loans),
  };
}

/** Principal a depositor has in the pool, in on-chain units. */
export async function getDeposit(depositor: string): Promise<bigint> {
  const raw = await simulateRead<bigint>(POOL_CONTRACT_ID, "get_deposit", addr(depositor));
  return BigInt(raw ?? 0);
}

/** Token balance of any address, in on-chain units. */
export async function getTokenBalance(address: string): Promise<bigint> {
  const raw = await simulateRead<bigint>(TOKEN_CONTRACT_ID, "balance", addr(address));
  return BigInt(raw);
}

/** The on-chain record for an invoice fingerprint, or null if never financed. */
export async function getLoan(invoiceHash: string): Promise<LoanRecord | null> {
  try {
    const raw = await simulateRead<{
      borrower: string;
      buyer: string;
      invoice_amount: bigint;
      loan_amount: bigint;
      status: string | string[];
      timestamp: bigint;
    }>(RECEIVABLES_CONTRACT_ID, "get_loan_status", bytes32(invoiceHash));
    // Unit enum variants decode as a one-element array, e.g. ["Active"].
    const status = (Array.isArray(raw.status) ? raw.status[0] : raw.status) as LoanStatus;
    return {
      borrower: raw.borrower,
      buyer: raw.buyer,
      invoiceAmount: BigInt(raw.invoice_amount),
      loanAmount: BigInt(raw.loan_amount),
      status,
      timestamp: Number(raw.timestamp),
    };
  } catch (err) {
    if (err instanceof ContractError && err.contract === "receivables" && err.code === 6) {
      return null;
    }
    throw err;
  }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Register the receivable and disburse the advance from the pool. */
export async function submitReceivable(
  input: {
    borrower: string;
    invoiceHash: string;
    invoiceAmount: bigint;
    buyer: string;
  },
  opts: WriteOpts,
): Promise<{ hash: string; advance: bigint }> {
  const { hash, value } = await invoke<bigint>({
    source: input.borrower,
    contractId: RECEIVABLES_CONTRACT_ID,
    method: "submit_receivable",
    args: [
      addr(input.borrower),
      bytes32(input.invoiceHash),
      i128(input.invoiceAmount),
      addr(input.buyer),
    ],
    ...opts,
  });
  return { hash, advance: BigInt(value ?? 0) };
}

/**
 * Repay an advance. The contract moves exactly what is owed (the advance)
 * from the borrower back into the pool; `amount` must cover it.
 */
export async function repayLoan(
  input: { borrower: string; invoiceHash: string; amount: bigint },
  opts: WriteOpts,
): Promise<{ hash: string }> {
  const { hash } = await invoke({
    source: input.borrower,
    contractId: RECEIVABLES_CONTRACT_ID,
    method: "repay_loan",
    args: [bytes32(input.invoiceHash), i128(input.amount)],
    ...opts,
  });
  return { hash };
}

/** Deposit into the pool. Returns the pool balance after the deposit. */
export async function deposit(
  input: { depositor: string; amount: bigint },
  opts: WriteOpts,
): Promise<{ hash: string; poolBalance: bigint }> {
  const { hash, value } = await invoke<bigint>({
    source: input.depositor,
    contractId: POOL_CONTRACT_ID,
    method: "deposit",
    args: [addr(input.depositor), i128(input.amount)],
    ...opts,
  });
  return { hash, poolBalance: BigInt(value ?? 0) };
}

/** Withdraw principal from the pool. Returns the pool balance afterwards. */
export async function withdraw(
  input: { depositor: string; amount: bigint },
  opts: WriteOpts,
): Promise<{ hash: string; poolBalance: bigint }> {
  const { hash, value } = await invoke<bigint>({
    source: input.depositor,
    contractId: POOL_CONTRACT_ID,
    method: "withdraw",
    args: [addr(input.depositor), i128(input.amount)],
    ...opts,
  });
  return { hash, poolBalance: BigInt(value ?? 0) };
}

// ─── Activity (contract events) ─────────────────────────────────────────────

const MAX_EVENT_PAGES = 16;

function ledgerFromCursor(cursor: string): number {
  try {
    return Number(BigInt(cursor.split("-")[0]) >> BigInt(32));
  } catch {
    return 0;
  }
}

/**
 * Every pool and receivables event since deployment, newest first. The RPC
 * scans a bounded ledger window per call, so this pages forward by cursor.
 */
export async function getActivity(): Promise<ActivityEvent[]> {
  const filters = [
    { type: "contract" as const, contractIds: [POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID] },
  ];
  const latest = (await server.getLatestLedger()).sequence;

  let page: Awaited<ReturnType<typeof server.getEvents>>;
  try {
    page = await server.getEvents({ startLedger: DEPLOY_LEDGER, filters, limit: 200 });
  } catch {
    // Deployment is older than RPC retention: start from what is retained.
    page = await server.getEvents({
      startLedger: Math.max(1, latest - 110_000),
      filters,
      limit: 200,
    });
  }

  const raw = [...page.events];
  for (let i = 0; i < MAX_EVENT_PAGES; i++) {
    if (!page.cursor || ledgerFromCursor(page.cursor) >= page.latestLedger) break;
    page = await server.getEvents({ cursor: page.cursor, filters, limit: 200 });
    raw.push(...page.events);
  }

  const byTx = new Map<string, ActivityEvent>();
  for (const ev of raw) {
    const topic = ev.topic.map((t) => scValToNative(t));
    const name = String(topic[0] ?? "");
    const data = scValToNative(ev.value) as Record<string, unknown>;
    const base = { txHash: ev.txHash, ledger: ev.ledger, at: ev.ledgerClosedAt };

    if (name === "deposited") {
      byTx.set(ev.txHash, {
        ...base,
        id: ev.id,
        kind: "deposited",
        actor: String(data.depositor),
        amount: BigInt(data.amount as bigint),
      });
    } else if (name === "submitted") {
      byTx.set(ev.txHash, {
        ...base,
        id: ev.id,
        kind: "financed",
        actor: String(data.borrower),
        amount: BigInt(data.loan_amount as bigint),
        invoiceAmount: BigInt(data.invoice_amount as bigint),
        invoiceHash: toHex(data.invoice_hash),
      });
    } else if (name === "disbursed" && !byTx.has(ev.txHash)) {
      byTx.set(ev.txHash, {
        ...base,
        id: ev.id,
        kind: "financed",
        actor: String(data.borrower),
        amount: BigInt(data.loan_amount as bigint),
      });
    } else if (name === "withdrawn") {
      byTx.set(ev.txHash, {
        ...base,
        id: ev.id,
        kind: "withdrawn",
        actor: String(data.depositor),
        amount: BigInt(data.amount as bigint),
      });
    } else if (name === "repaid") {
      byTx.set(ev.txHash, {
        ...base,
        id: ev.id,
        kind: "settled",
        actor: String(data.borrower),
        amount: BigInt(data.repayment_amount as bigint),
        invoiceHash: toHex(data.invoice_hash),
      });
    }
  }

  return [...byTx.values()].sort((a, b) => b.ledger - a.ledger);
}
