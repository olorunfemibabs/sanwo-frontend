/* ─────────────────────────────────────────────────────────────────────────
 * lib/stellar.ts — low-level Soroban plumbing
 *
 * Read calls are simulations from a throwaway source. Writes go through
 * simulate → assemble → sign (Freighter or test wallet) → send → poll.
 * Written against @stellar/stellar-sdk 17 (testnet runs protocol 29; older
 * SDKs fail to decode some of its XDR).
 * ───────────────────────────────────────────────────────────────────────── */

import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk";
import {
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  POOL_CONTRACT_ID,
  RECEIVABLES_CONTRACT_ID,
  RPC_URL,
  TOKEN_CONTRACT_ID,
} from "@/lib/config";

export const server = new rpc.Server(RPC_URL, { allowHttp: false });

/** Signs a base64 transaction envelope and returns the signed envelope. */
export type Signer = (txXdr: string) => Promise<string>;

export type TxPhase = "preparing" | "signing" | "submitting" | "confirming";

// ─── Errors ─────────────────────────────────────────────────────────────────

const RECEIVABLES_ERRORS: Record<number, string> = {
  1: "The receivables contract is already initialized.",
  2: "The receivables contract is not initialized.",
  3: "The invoice fingerprint is empty.",
  4: "The invoice amount is too low.",
  5: "This invoice has already been financed. Each invoice can only be financed once.",
  6: "No advance exists for this invoice.",
  7: "This advance is not active, so it cannot be settled.",
  8: "The repayment is lower than the amount advanced.",
};

const POOL_ERRORS: Record<number, string> = {
  1: "The pool is already initialized.",
  2: "The pool is not initialized.",
  3: "This caller is not authorized to move pool funds.",
  4: "The pool does not have enough available liquidity right now. Some of it is out in advances.",
  5: "Enter an amount greater than zero.",
  6: "There are no active advances to close.",
  7: "The repayment did not reach the pool.",
  8: "You can only withdraw up to what you deposited.",
};

export class ContractError extends Error {
  constructor(
    message: string,
    public readonly contract: "pool" | "receivables" | "token" | "unknown",
    public readonly code: number | null,
  ) {
    super(message);
    this.name = "ContractError";
  }
}

/**
 * Turn a simulation/host error string into a readable ContractError. The
 * receivables contract re-raises pool failures with the same code, so a pool
 * error anywhere in the diagnostic log takes precedence.
 */
export function parseContractError(raw: string): ContractError {
  const matches = [
    ...raw.matchAll(/contract:(C[A-Z0-9]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g),
  ].map((m) => ({ contract: m[1], code: Number(m[2]) }));

  const pool = matches.find((m) => m.contract === POOL_CONTRACT_ID);
  if (pool) {
    return new ContractError(
      POOL_ERRORS[pool.code] ?? `Pool error ${pool.code}.`,
      "pool",
      pool.code,
    );
  }
  const token = matches.find((m) => m.contract === TOKEN_CONTRACT_ID);
  if (token) {
    return new ContractError(
      "Your wallet balance is too low for this transaction.",
      "token",
      token.code,
    );
  }
  const rec = matches.find((m) => m.contract === RECEIVABLES_CONTRACT_ID);
  if (rec) {
    return new ContractError(
      RECEIVABLES_ERRORS[rec.code] ?? `Receivables error ${rec.code}.`,
      "receivables",
      rec.code,
    );
  }
  if (/resulting balance is not within the allowed range|balance/i.test(raw)) {
    return new ContractError(
      "Your wallet balance is too low for this transaction.",
      "token",
      null,
    );
  }
  return new ContractError(
    "The network rejected this transaction. Please try again.",
    "unknown",
    null,
  );
}

/** Human-readable message for anything thrown by a write. */
export function errorMessage(err: unknown): string {
  if (err instanceof ContractError) return err.message;
  if (err instanceof Error) {
    if (/not found/i.test(err.message) && /account/i.test(err.message)) {
      return "This wallet is not funded on testnet yet. Fund it, then try again.";
    }
    if (/declined|rejected|denied|cancel/i.test(err.message)) {
      return "The request was cancelled in the wallet.";
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

// ─── Reads ──────────────────────────────────────────────────────────────────

const READ_SOURCE = Keypair.random().publicKey();

export async function simulateRead<T = unknown>(
  contractId: string,
  method: string,
  ...args: xdr.ScVal[]
): Promise<T> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }
  if (!sim.result) throw new Error(`${method} returned no result`);
  return scValToNative(sim.result.retval) as T;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

const CONFIRM_POLL_MS = 1200;
const CONFIRM_MAX_ATTEMPTS = 30;

export type InvokeResult<T> = { hash: string; value: T };

export async function invoke<T = unknown>(opts: {
  source: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  sign: Signer;
  onPhase?: (phase: TxPhase) => void;
}): Promise<InvokeResult<T>> {
  const { source, contractId, method, args, sign, onPhase } = opts;

  onPhase?.("preparing");
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();

  onPhase?.("signing");
  const signedXdr = await sign(prepared.toXDR());

  onPhase?.("submitting");
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction;
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new Error(
      sent.status === "TRY_AGAIN_LATER"
        ? "The network is busy. Please try again in a moment."
        : "The network rejected the transaction.",
    );
  }

  onPhase?.("confirming");
  let res = await server.getTransaction(sent.hash);
  let attempts = 0;
  while (
    res.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < CONFIRM_MAX_ATTEMPTS
  ) {
    await new Promise((r) => setTimeout(r, CONFIRM_POLL_MS));
    res = await server.getTransaction(sent.hash);
    attempts++;
  }
  if (res.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      res.status === rpc.Api.GetTransactionStatus.FAILED
        ? "The transaction failed on-chain."
        : "Timed out waiting for confirmation. Check the explorer before retrying.",
    );
  }
  const value = res.returnValue ? (scValToNative(res.returnValue) as T) : (undefined as T);
  return { hash: sent.hash, value };
}

// ─── Horizon (classic account info) ─────────────────────────────────────────

export type AccountInfo = {
  exists: boolean;
  firstSeen: string | null;
  operationCount: number | null;
};

/** Whether a Stellar account exists, and when it first transacted. */
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return { exists: false, firstSeen: null, operationCount: null };
  if (!res.ok) throw new Error("Horizon unavailable");

  let firstSeen: string | null = null;
  let operationCount: number | null = null;
  try {
    const ops = await fetch(
      `${HORIZON_URL}/accounts/${address}/operations?order=asc&limit=1`,
    ).then((r) => r.json());
    firstSeen = ops?._embedded?.records?.[0]?.created_at ?? null;
    const recent = await fetch(
      `${HORIZON_URL}/accounts/${address}/operations?order=desc&limit=200`,
    ).then((r) => r.json());
    operationCount = recent?._embedded?.records?.length ?? null;
  } catch {
    // History is a supporting signal; existence alone is enough to proceed.
  }
  return { exists: true, firstSeen, operationCount };
}
