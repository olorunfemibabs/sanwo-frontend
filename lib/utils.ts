import { sha256 } from "@noble/hashes/sha2";
import { EXPLORER_URL, TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/config";

const UNIT = 10 ** TOKEN_DECIMALS;

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ─── Hashing ────────────────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sha256Hex(data: string | Uint8Array): string {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return bytesToHex(sha256(input));
}

/**
 * The receivable fingerprint registered on-chain. It is derived from the
 * invoice's identity (who issued it, who owes it, and its number), not from
 * the file or the amount, so re-uploading an edited copy or changing the
 * amount cannot get the same invoice financed twice.
 */
export function invoiceFingerprint(
  borrower: string,
  clientAddress: string,
  invoiceNumber: string,
): string {
  const normalized = invoiceNumber.trim().toUpperCase().replace(/\s+/g, "");
  return sha256Hex(`sanwo-invoice-v1|${borrower}|${clientAddress}|${normalized}`);
}

// ─── Amounts ────────────────────────────────────────────────────────────────

/** Whole-token number → on-chain units (7 decimals). */
export function toUnits(amount: number): bigint {
  return BigInt(Math.round(amount * UNIT));
}

/** On-chain units → whole-token number. */
export function fromUnits(units: bigint | number): number {
  return Number(units) / UNIT;
}

const numberFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** `1,234.50 XLM` from on-chain units. */
export function formatToken(units: bigint | number, symbol = TOKEN_SYMBOL): string {
  return `${numberFmt.format(fromUnits(units))} ${symbol}`;
}

/** `1,234.50` from a whole-token number. */
export function formatAmount(amount: number): string {
  return numberFmt.format(amount);
}

export function formatCompact(amount: number): string {
  return compactFmt.format(amount);
}

/** `$1,234.50` from a whole-dollar number. */
export function formatUSD(amount: number): string {
  return `$${numberFmt.format(amount)}`;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

// ─── Strings, dates, links ──────────────────────────────────────────────────

export function truncateMiddle(value: string, lead = 4, tail = 4): string {
  if (!value || value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/**
 * Parse a date. Date-only strings (YYYY-MM-DD) are read as local calendar
 * dates; `new Date("2026-12-12")` would be UTC midnight and show as the
 * previous day west of Greenwich.
 */
export function parseDate(value: string | number | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** Whole calendar days from today (local) until a date. Negative if past. */
export function daysFromToday(value: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDate(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(value: string | number | Date): string {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function timeAgo(value: string | number | Date): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
}

/** YYYY-MM-DD for <input type="date">, in local time. */
export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const explorer = {
  tx: (hash: string) => `${EXPLORER_URL}/tx/${hash}`,
  contract: (id: string) => `${EXPLORER_URL}/contract/${id}`,
  account: (id: string) => `${EXPLORER_URL}/account/${id}`,
};
