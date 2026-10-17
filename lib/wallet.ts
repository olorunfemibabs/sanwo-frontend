/* ─────────────────────────────────────────────────────────────────────────
 * lib/wallet.ts — wallet providers behind one interface
 *
 * Two providers:
 *   freighter — the user's own Freighter extension.
 *   test      — a testnet-only keypair generated in the browser and funded
 *               by Friendbot, so reviewers can run the full loop without
 *               installing anything. Its secret lives in localStorage (in
 *               memory when storage is blocked) and it must never be used
 *               on mainnet.
 *
 * Everything else in the app signs through `signerFor()`, so an embedded or
 * custodial wallet can be added later without touching the flows (the
 * concept's v2 "wallet created and managed for the user").
 * ───────────────────────────────────────────────────────────────────────── */

import {
  getAddress,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { FRIENDBOT_URL, NETWORK_PASSPHRASE } from "@/lib/config";
import type { Signer } from "@/lib/stellar";

export type WalletKind = "freighter" | "test";

export type WalletState = {
  connected: boolean;
  publicKey: string | null;
  kind: WalletKind | null;
};

export const DISCONNECTED: WalletState = { connected: false, publicKey: null, kind: null };

const KIND_KEY = "sanwo.wallet.kind";
const TEST_SECRET_KEY = "sanwo.testWallet.secret";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Write to storage if the browser allows it. Returns false when it does not. */
function save(key: string, value: string): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// When storage is blocked (some private windows), the test wallet lives in
// memory for this visit instead, so it can still sign. It is gone on reload.
let memoryKeypair: Keypair | null = null;

function freighterError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

// ─── Freighter ──────────────────────────────────────────────────────────────

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected: present } = await isConnected();
    return present;
  } catch {
    return false;
  }
}

export async function connectFreighter(): Promise<WalletState> {
  if (!(await isFreighterInstalled())) {
    throw new Error("Freighter is not installed. Get it at freighter.app, or use a test wallet.");
  }
  const { address, error } = await requestAccess();
  if (error || !address) throw new Error(freighterError(error, "Connection was rejected."));
  save(KIND_KEY, "freighter");
  return { connected: true, publicKey: address, kind: "freighter" };
}

// ─── Test wallet ────────────────────────────────────────────────────────────

function loadTestKeypair(): Keypair | null {
  const secret = read(TEST_SECRET_KEY);
  if (!secret) return memoryKeypair;
  try {
    return Keypair.fromSecret(secret);
  } catch {
    return memoryKeypair;
  }
}

export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
  // Friendbot answers 400 when the account is already funded; that is fine.
  if (!res.ok && res.status !== 400) {
    throw new Error("Friendbot could not fund the test wallet. Try again shortly.");
  }
}

/** Reuse the stored test wallet or create and fund a new one. */
export async function connectTestWallet(): Promise<WalletState> {
  let kp = loadTestKeypair();
  if (!kp) {
    kp = Keypair.random();
    await fundWithFriendbot(kp.publicKey());
    if (!save(TEST_SECRET_KEY, kp.secret())) memoryKeypair = kp;
  }
  save(KIND_KEY, "test");
  return { connected: true, publicKey: kp.publicKey(), kind: "test" };
}

/** Discard the stored test wallet so the next connect creates a fresh one. */
export function forgetTestWallet(): void {
  memoryKeypair = null;
  try {
    storage()?.removeItem(TEST_SECRET_KEY);
  } catch {
    // Nothing stored.
  }
}

// ─── Shared ─────────────────────────────────────────────────────────────────

/** Silently restore the last wallet without prompting. */
export async function restoreWallet(): Promise<WalletState> {
  const kind = read(KIND_KEY) as WalletKind | null;
  if (kind === "test") {
    const kp = loadTestKeypair();
    return kp ? { connected: true, publicKey: kp.publicKey(), kind: "test" } : DISCONNECTED;
  }
  if (kind === "freighter") {
    try {
      if (!(await isFreighterInstalled())) return DISCONNECTED;
      const { isAllowed: allowed } = await isAllowed();
      if (!allowed) return DISCONNECTED;
      const { address, error } = await getAddress();
      if (error || !address) return DISCONNECTED;
      return { connected: true, publicKey: address, kind: "freighter" };
    } catch {
      return DISCONNECTED;
    }
  }
  return DISCONNECTED;
}

export function clearWallet(): void {
  try {
    storage()?.removeItem(KIND_KEY);
  } catch {
    // Nothing stored.
  }
}

export function signerFor(wallet: WalletState): Signer {
  if (!wallet.connected || !wallet.publicKey) {
    return async () => {
      throw new Error("Connect a wallet first.");
    };
  }
  if (wallet.kind === "test") {
    return async (txXdr: string) => {
      const kp = loadTestKeypair();
      if (!kp || kp.publicKey() !== wallet.publicKey) {
        throw new Error("Test wallet not found in this browser. Reconnect it.");
      }
      const tx = TransactionBuilder.fromXDR(txXdr, NETWORK_PASSPHRASE);
      tx.sign(kp);
      return tx.toXDR();
    };
  }
  const address = wallet.publicKey;
  return async (txXdr: string) => {
    const res = await signTransaction(txXdr, { networkPassphrase: NETWORK_PASSPHRASE, address });
    if (res.error) throw new Error(freighterError(res.error, "Signing was rejected."));
    return res.signedTxXdr;
  };
}
