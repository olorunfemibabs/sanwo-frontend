/* ─────────────────────────────────────────────────────────────────────────
 * lib/config.ts — network, contract and product constants
 *
 * Contract IDs come from env so a redeploy is a config change, not a code
 * change. The fallbacks are the current testnet deployment.
 * ───────────────────────────────────────────────────────────────────────── */

import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_NAME = "testnet";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

/** Public source for the Soroban contracts. */
export const CONTRACTS_REPO_URL =
  process.env.NEXT_PUBLIC_CONTRACTS_REPO_URL ?? "https://github.com/JoshdfG/sanwo";

export const POOL_CONTRACT_ID =
  process.env.NEXT_PUBLIC_POOL_CONTRACT_ID ??
  "CBFWEYF3B4CESQAS4RVKJLEU52EZLWPEJL4KVRTSUFI73DBI4RY3MV34";
export const RECEIVABLES_CONTRACT_ID =
  process.env.NEXT_PUBLIC_RECEIVABLES_CONTRACT_ID ??
  "CBYOWRE3PCTVA53DWVCRXNCGP5NCG4ZB62ZJ6S5ZYWKJGQIYKNRFVR2O";
/** The asset the pool holds. On testnet this is the wrapped native XLM SAC. */
export const TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** Display symbol for pool amounts. Switch to "USDC" when the pool holds USDC. */
export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "XLM";
export const TOKEN_DECIMALS = 7;
export const TOKEN_IS_STAND_IN = TOKEN_SYMBOL !== "USDC";

/** First ledger to scan for contract events (just before the deployment). */
export const DEPLOY_LEDGER = Number(
  process.env.NEXT_PUBLIC_DEPLOY_LEDGER ?? 5241360,
);

/**
 * Advance rate enforced on-chain by the receivables contract. The concept caps
 * this at 85% and flexes it with the credit score; the PoC contract fixes it.
 */
export const ADVANCE_RATE = 0.75;
/** Planned origination fee. Not charged by the PoC contracts. */
export const PLANNED_ORIGINATION_FEE = 0.035;
/** Planned maximum advance rate once score-based pricing ships. */
export const MAX_ADVANCE_RATE = 0.85;
