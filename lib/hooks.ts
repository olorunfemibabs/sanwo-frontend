"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getActivity,
  getDeposit,
  getLoan,
  getPoolStats,
  type ActivityEvent,
  type LoanRecord,
  type PoolStats,
} from "@/lib/contracts";
import {
  advancesKey,
  depositsKey,
  onStoreChange,
  parseAdvances,
  parseDeposits,
  readRaw,
  type AdvanceRecord,
  type DepositRecord,
} from "@/lib/store";
import { fromUnits } from "@/lib/utils";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The URL fragment without "#", kept in sync with navigation. */
export function useHash(): string {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
}

/** Replace the URL fragment without adding history, and tell `useHash` readers. */
export function setHash(next: string | null): void {
  history.replaceState(history.state, "", next ? `#${next}` : window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

type Async<T> = {
  data: T | null;
  error: boolean;
  loading: boolean;
  reload: () => Promise<void>;
};

// Reads are shared across components: one request in flight per reader, and
// the last result renders at once when another page mounts the same reader.
const inflight = new Map<unknown, Promise<unknown>>();
const lastResult = new Map<unknown, unknown>();

function shared<T>(key: unknown, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const next = fetcher()
    .then((value) => {
      lastResult.set(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, next);
  return next;
}

function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, key: unknown = fetcher): Async<T> {
  // State is tagged with the key it was read for, so switching keys (a wallet
  // connecting, say) never shows the previous key's value.
  const [entry, setEntry] = useState<{ key: unknown; data: T | null; error: boolean; loaded: boolean }>(() => ({
    key,
    data: (lastResult.get(key) as T | undefined) ?? null,
    error: false,
    loaded: lastResult.has(key),
  }));
  const current =
    entry.key === key
      ? entry
      : { key, data: (lastResult.get(key) as T | undefined) ?? null, error: false, loaded: lastResult.has(key) };

  const reload = useCallback(async () => {
    try {
      const data = await shared(key, fetcher);
      setEntry({ key, data, error: false, loaded: true });
    } catch {
      setEntry((prev) => ({ ...(prev.key === key ? prev : { data: null }), key, error: true, loaded: true }));
    }
  }, [fetcher, key]);

  useEffect(() => {
    let active = true;
    const tick = () =>
      shared(key, fetcher)
        .then((data) => active && setEntry({ key, data, error: false, loaded: true }))
        .catch(
          () =>
            active &&
            setEntry((prev) => ({ ...(prev.key === key ? prev : { data: null }), key, error: true, loaded: true })),
        );
    tick();
    const id = intervalMs ? setInterval(tick, intervalMs) : null;
    window.addEventListener(REFRESH_EVENT, tick);
    return () => {
      active = false;
      if (id) clearInterval(id);
      window.removeEventListener(REFRESH_EVENT, tick);
    };
  }, [fetcher, intervalMs, key]);

  return { data: current.data, error: current.error, loading: !current.loaded, reload };
}

export function usePoolStats(intervalMs = 20_000): Async<PoolStats> {
  return usePolling(getPoolStats, intervalMs);
}

export function useActivity(intervalMs = 30_000): Async<ActivityEvent[]> {
  return usePolling(getActivity, intervalMs);
}

/** Fired after a write so every live read on the page (sidebar included) re-reads. */
const REFRESH_EVENT = "sanwo:refresh";

/** A wallet's principal in the pool, read from the contract. Null without a wallet. */
export function useDeposit(owner: string | null, intervalMs = 20_000): Async<bigint> {
  const fetcher = useCallback(async () => (owner ? getDeposit(owner) : BigInt(0)), [owner]);
  return usePolling(fetcher, intervalMs, `deposit:${owner ?? ""}`);
}

/**
 * Re-read chain state after a write. RPC reads can lag the ledger that
 * confirmed the transaction by a few seconds, so read now and twice more.
 */
export function refreshSoon(...fns: Array<() => unknown>): void {
  const run = () => {
    fns.forEach((fn) => void fn());
    window.dispatchEvent(new Event(REFRESH_EVENT));
  };
  run();
  setTimeout(run, 2500);
  setTimeout(run, 6000);
}

/** Read one localStorage key reactively. Returns the raw string for stable snapshots. */
function useStoredRaw(key: string | null): string | null {
  return useSyncExternalStore(
    onStoreChange,
    () => (key ? readRaw(key) : null),
    () => null,
  );
}

/** Local advance records for a wallet, kept in sync with store writes. */
export function useAdvanceRecords(owner: string | null): AdvanceRecord[] {
  const raw = useStoredRaw(owner ? advancesKey(owner) : null);
  return useMemo(() => parseAdvances(raw), [raw]);
}

export function useDepositRecords(owner: string | null): DepositRecord[] {
  const raw = useStoredRaw(owner ? depositsKey(owner) : null);
  return useMemo(() => parseDeposits(raw), [raw]);
}

/** An advance as the app shows it: this browser's record, or one recovered from chain events. */
export type MyAdvance = AdvanceRecord & { imported?: boolean };

/**
 * Every advance this wallet took: the records saved in this browser, plus
 * any it financed elsewhere, recovered from the contract's events with the
 * details only the chain knows. Home, Advances and search all read this.
 */
export function useMyAdvances(owner: string | null, events: ActivityEvent[] | null): MyAdvance[] {
  const records = useAdvanceRecords(owner);
  return useMemo(() => {
    const known = new Set(records.map((r) => r.invoiceHash));
    const recovered: MyAdvance[] = (events ?? [])
      .filter((ev) => ev.kind === "financed" && ev.actor === owner && ev.invoiceHash && !known.has(ev.invoiceHash))
      .map((ev) => ({
        invoiceHash: ev.invoiceHash!,
        invoiceNumber: "On-chain receivable",
        clientName: "Details not in this browser",
        clientAddress: "",
        invoiceAmount: ev.invoiceAmount ? fromUnits(ev.invoiceAmount) : 0,
        advanceAmount: fromUnits(ev.amount),
        issueDate: ev.at.slice(0, 10),
        dueDate: "",
        disburseTx: ev.txHash,
        createdAt: ev.at,
        imported: true,
      }));
    return [...records, ...recovered];
  }, [records, events, owner]);
}

/** On-chain status for a set of invoice fingerprints. */
export function useLoans(hashes: string[]): {
  loans: Record<string, LoanRecord | null>;
  reload: () => Promise<void>;
} {
  const [loans, setLoans] = useState<Record<string, LoanRecord | null>>({});
  const key = hashes.join(",");

  const fetchAll = useCallback(async () => {
    const list = key ? key.split(",") : [];
    const results = await Promise.all(
      list.map(async (h) => {
        try {
          return [h, await getLoan(h)] as const;
        } catch {
          return [h, undefined] as const;
        }
      }),
    );
    return results;
  }, [key]);

  const merge = useCallback(
    (results: Awaited<ReturnType<typeof fetchAll>>) =>
      setLoans((prev) => {
        const next = { ...prev };
        for (const [h, loan] of results) if (loan !== undefined) next[h] = loan;
        return next;
      }),
    [],
  );

  const reload = useCallback(async () => merge(await fetchAll()), [fetchAll, merge]);

  useEffect(() => {
    let active = true;
    fetchAll().then((results) => active && merge(results));
    return () => {
      active = false;
    };
  }, [fetchAll, merge]);

  return { loans, reload };
}

// ─── Clock ──────────────────────────────────────────────────────────────────

let clock = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockSubs = new Set<() => void>();

function subscribeClock(cb: () => void) {
  clockSubs.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clock = Date.now();
      clockSubs.forEach((fn) => fn());
    }, 30_000);
  }
  return () => {
    clockSubs.delete(cb);
    if (clockSubs.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** The current time, refreshed every 30 seconds. 0 during server render. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => (clock ||= Date.now()),
    () => 0,
  );
}
