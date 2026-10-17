/* ─────────────────────────────────────────────────────────────────────────
 * lib/verify.ts — automated invoice checks for the PoC
 *
 * Every check here runs for real: against the form, Horizon, or the deployed
 * contracts. Signals the concept relies on but the PoC cannot reach yet
 * (government e-invoice, platform records, payment history, client
 * confirmation) are listed as "not connected" rather than faked.
 * ───────────────────────────────────────────────────────────────────────── */

import { StrKey } from "@stellar/stellar-sdk";
import { ADVANCE_RATE } from "@/lib/config";
import { getLoan, getPoolStats } from "@/lib/contracts";
import { getAccountInfo } from "@/lib/stellar";
import { daysBetween, daysFromToday, formatAmount, formatDate, parseDate, toUnits } from "@/lib/utils";

export type CheckStatus = "pending" | "running" | "pass" | "warn" | "fail" | "offline";

export type Check = {
  id: string;
  label: string;
  source: string;
  status: CheckStatus;
  detail?: string;
};

export type InvoiceInput = {
  borrower: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress: string;
  amount: number;
  currency: "USD";
  issueDate: string;
  dueDate: string;
  invoiceHash: string;
};

export const NOT_CONNECTED: Check[] = [
  {
    id: "einvoice",
    label: "Government e-invoice record",
    source: "Tax authority API",
    status: "offline",
    detail: "Not connected in the PoC.",
  },
  {
    id: "platform",
    label: "Platform attestation",
    source: "Invoicing or contracting platform",
    status: "offline",
    detail: "Not connected in the PoC.",
  },
  {
    id: "history",
    label: "Prior payments from this client",
    source: "Open banking or on-chain history",
    status: "offline",
    detail: "Not connected in the PoC.",
  },
  {
    id: "client-confirm",
    label: "Client confirmation of acceptance",
    source: "Client sign-off",
    status: "offline",
    detail: "Not connected in the PoC.",
  },
];

export const AUTOMATED: Check[] = [
  { id: "currency", label: "Invoice is in a supported currency", source: "Invoice", status: "pending" },
  { id: "terms", label: "Payment terms are within range", source: "Invoice", status: "pending" },
  { id: "independent", label: "Client is independent of the borrower", source: "Entity check", status: "pending" },
  { id: "client-account", label: "Client has a live Stellar account", source: "Stellar Horizon", status: "pending" },
  { id: "duplicate", label: "Invoice has never been financed", source: "Receivables contract", status: "pending" },
  { id: "liquidity", label: "Pool can fund this advance", source: "Capital pool contract", status: "pending" },
];

type Runner = (input: InvoiceInput) => Promise<Pick<Check, "status" | "detail">>;

const runners: Record<string, Runner> = {
  async currency(input) {
    return input.currency === "USD"
      ? { status: "pass", detail: "USD receivable. No currency mismatch with the advance." }
      : { status: "fail", detail: "Only USD invoices are supported in v1." };
  },

  async terms(input) {
    const issue = parseDate(input.issueDate);
    const due = parseDate(input.dueDate);
    const term = daysBetween(issue, due);
    const remaining = daysFromToday(input.dueDate);
    if (remaining < 1) return { status: "fail", detail: "The due date has already passed." };
    if (term < 1) return { status: "fail", detail: "The due date must be after the issue date." };
    if (remaining > 180)
      return { status: "fail", detail: "Due more than 180 days out. Terms this long are not financed." };
    if (term < 14 || term > 120)
      return {
        status: "warn",
        detail: `${term}-day terms. Typical terms are 30 to 90 days.`,
      };
    return { status: "pass", detail: `${term}-day terms, due ${formatDate(due)}.` };
  },

  async independent(input) {
    if (!StrKey.isValidEd25519PublicKey(input.clientAddress)) {
      return { status: "fail", detail: "The client address is not a valid Stellar address." };
    }
    if (input.clientAddress === input.borrower) {
      return {
        status: "fail",
        detail: "The client wallet is the borrower's own wallet. Self-issued invoices are rejected.",
      };
    }
    return { status: "pass", detail: "Client and borrower wallets are distinct." };
  },

  async "client-account"(input) {
    try {
      const info = await getAccountInfo(input.clientAddress);
      if (!info.exists) {
        return {
          status: "warn",
          detail: "No account yet. In v1 the client needs one to pay the invoice's collection address.",
        };
      }
      const since = info.firstSeen ? ` Active since ${formatDate(info.firstSeen)}.` : "";
      const ops =
        info.operationCount != null
          ? ` ${info.operationCount >= 200 ? "200+" : info.operationCount} ${info.operationCount === 1 ? "operation" : "operations"} on record.`
          : "";
      return { status: "pass", detail: `Account found.${since}${ops}` };
    } catch {
      return { status: "warn", detail: "Horizon unavailable. This signal was skipped, not failed." };
    }
  },

  async duplicate(input) {
    const existing = await getLoan(input.invoiceHash);
    if (existing) {
      return {
        status: "fail",
        detail: `This fingerprint was already financed (${existing.status.toLowerCase()}).`,
      };
    }
    return { status: "pass", detail: "Fingerprint is not registered on-chain." };
  },

  async liquidity(input) {
    const stats = await getPoolStats();
    const advance = toUnits(input.amount * ADVANCE_RATE);
    if (advance > stats.poolBalance) {
      return {
        status: "fail",
        detail: `The pool holds ${formatAmount(Number(stats.poolBalance) / 1e7)} and cannot fund this advance.`,
      };
    }
    return { status: "pass", detail: "Enough liquidity in the pool buffer to disburse now." };
  },
};

export async function runCheck(id: string, input: InvoiceInput): Promise<Pick<Check, "status" | "detail">> {
  try {
    return await runners[id](input);
  } catch {
    return { status: "warn", detail: "This check could not complete. It was skipped, not failed." };
  }
}

export type Confidence = {
  level: "High" | "Medium" | "Low" | "Blocked";
  summary: string;
};

/**
 * Combine results into a confidence level. With only automated entity and
 * chain checks available, the PoC tops out at Medium: the stronger signals
 * that would justify High are not connected yet.
 */
export function confidenceFrom(checks: Check[]): Confidence {
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  if (fails > 0) {
    return {
      level: "Blocked",
      summary: "At least one hard rule failed. This invoice cannot be financed.",
    };
  }
  if (warns > 1) {
    return {
      level: "Low",
      summary: "Several signals were weak. In production this request goes to manual review.",
    };
  }
  return {
    level: "Medium",
    summary:
      warns === 1
        ? "The automated checks passed with one warning. Stronger signals, such as an e-invoice record or platform attestation, are not connected yet."
        : "Every automated check passed. Stronger signals, such as an e-invoice record or platform attestation, are not connected yet.",
  };
}
