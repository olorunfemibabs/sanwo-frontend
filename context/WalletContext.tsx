"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTokenBalance } from "@/lib/contracts";
import type { Signer } from "@/lib/stellar";
import {
  DISCONNECTED,
  clearWallet,
  connectFreighter,
  connectTestWallet,
  fundWithFriendbot,
  restoreWallet,
  signerFor,
  type WalletKind,
  type WalletState,
} from "@/lib/wallet";

type WalletContextValue = {
  wallet: WalletState;
  /** Token balance in on-chain units; null while unknown or unfunded. */
  balance: bigint | null;
  ready: boolean;
  connecting: WalletKind | null;
  error: string | null;
  connect: (kind: WalletKind) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  /** Top up the connected wallet from Friendbot (testnet only). */
  fund: () => Promise<void>;
  sign: Signer;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(DISCONNECTED);
  // Balance is stored with the address it belongs to, so a wallet switch never
  // shows the previous wallet's balance.
  const [balanceState, setBalanceState] = useState<{ owner: string; value: bigint | null } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState<WalletKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance =
    balanceState && balanceState.owner === wallet.publicKey ? balanceState.value : null;

  const refreshBalance = useCallback(async () => {
    const owner = wallet.publicKey;
    if (!owner) return;
    try {
      setBalanceState({ owner, value: await getTokenBalance(owner) });
    } catch {
      setBalanceState({ owner, value: null });
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    let active = true;
    restoreWallet().then((state) => {
      if (!active) return;
      setWallet(state);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const owner = wallet.publicKey;
    if (!owner) return;
    let active = true;
    getTokenBalance(owner)
      .then((value) => active && setBalanceState({ owner, value }))
      .catch(() => active && setBalanceState({ owner, value: null }));
    return () => {
      active = false;
    };
  }, [wallet.publicKey]);

  const connect = useCallback(async (kind: WalletKind) => {
    setConnecting(kind);
    setError(null);
    try {
      const state = kind === "test" ? await connectTestWallet() : await connectFreighter();
      setWallet(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the wallet.");
    } finally {
      setConnecting(null);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearWallet();
    setWallet(DISCONNECTED);
    setBalanceState(null);
  }, []);

  const fund = useCallback(async () => {
    if (!wallet.publicKey) return;
    await fundWithFriendbot(wallet.publicKey);
    await refreshBalance();
  }, [wallet.publicKey, refreshBalance]);

  const sign = useMemo(() => signerFor(wallet), [wallet]);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      balance,
      ready,
      connecting,
      error,
      connect,
      disconnect,
      refreshBalance,
      fund,
      sign,
    }),
    [wallet, balance, ready, connecting, error, connect, disconnect, refreshBalance, fund, sign],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
