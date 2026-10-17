/* ─────────────────────────────────────────────────────────────────────────
 * lib/store.ts — per-wallet invoice details kept in the browser
 *
 * The chain stores only the fingerprint, amounts, parties and status. The
 * human details a borrower typed (invoice number, client name, dates) live
 * here until the off-chain services exist. The chain stays the source of
 * truth for status: the UI always re-reads it.
 * ───────────────────────────────────────────────────────────────────────── */

import { POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID } from "@/lib/config";

export type AdvanceRecord = {
  invoiceHash: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress: string;
  /** Whole tokens. On testnet 1 token stands in for 1 USD. */
  invoiceAmount: number;
  advanceAmount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  documentName?: string;
  documentHash?: string;
  confidence?: string;
  disburseTx: string;
  createdAt: string; // ISO
  settleTx?: string;
  settledAt?: string; // ISO
};

export type DepositRecord = {
  txHash: string;
  amount: number;
  at: string; // ISO
};

const EVENT = "sanwo:store";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string): T[] {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage full or blocked: the chain still has the record.
  }
}

// Scoped to the deployment, so records from a previous contract never show
// up against a new one after a redeploy.
export const advancesKey = (owner: string) =>
  `sanwo.v1.${RECEIVABLES_CONTRACT_ID.slice(0, 8)}.${owner}.advances`;
export const depositsKey = (owner: string) => `sanwo.v1.${POOL_CONTRACT_ID.slice(0, 8)}.${owner}.deposits`;

/** Raw stored string, used as a stable snapshot for useSyncExternalStore. */
export function readRaw(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function parseAdvances(raw: string | null): AdvanceRecord[] {
  return parse<AdvanceRecord>(raw).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function parseDeposits(raw: string | null): DepositRecord[] {
  return parse<DepositRecord>(raw).sort((a, b) => b.at.localeCompare(a.at));
}

export function listAdvances(owner: string): AdvanceRecord[] {
  return parseAdvances(readRaw(advancesKey(owner)));
}

export function saveAdvance(owner: string, record: AdvanceRecord): void {
  const rest = read<AdvanceRecord>(advancesKey(owner)).filter(
    (r) => r.invoiceHash !== record.invoiceHash,
  );
  write(advancesKey(owner), [record, ...rest]);
}

export function updateAdvance(
  owner: string,
  invoiceHash: string,
  patch: Partial<AdvanceRecord>,
): void {
  const all = read<AdvanceRecord>(advancesKey(owner)).map((r) =>
    r.invoiceHash === invoiceHash ? { ...r, ...patch } : r,
  );
  write(advancesKey(owner), all);
}

export function listDeposits(owner: string): DepositRecord[] {
  return parseDeposits(readRaw(depositsKey(owner)));
}

export function saveDeposit(owner: string, record: DepositRecord): void {
  write(depositsKey(owner), [record, ...read<DepositRecord>(depositsKey(owner))]);
}

/** Subscribe to store writes from any component or tab. */
export function onStoreChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
