"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Map as MapIcon,
  Plus,
  ReceiptText,
  Search,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { ConnectOptions } from "@/components/app/ConnectOptions";
import { useWallet } from "@/context/WalletContext";
import { useActivity, useAdvanceRecords, useDepositRecords } from "@/lib/hooks";
import { cn } from "@/lib/utils";

// ─── Open/closed preference ─────────────────────────────────────────────────
// Per-viewer, so it lives in this browser. Unset means "decide for me": open
// on desktop while the loop is unfinished.

const KEY = "sanwo.guide";
const EVENT = "sanwo:guide";
let memory: string | null = null;

function readPref(): "open" | "closed" | null {
  let v: string | null;
  try {
    v = localStorage.getItem(KEY);
  } catch {
    v = memory;
  }
  return v === "open" || v === "closed" ? v : null;
}

function writePref(v: "open" | "closed") {
  memory = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Storage blocked: the in-memory value applies for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribePref(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

const DESKTOP = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

// ─── Guide ──────────────────────────────────────────────────────────────────

type Step = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  href: string | null;
  done: boolean;
};

/**
 * A round launcher in the bottom right that opens a floating card of next
 * steps: the five steps of the testnet loop, each ticked off from the
 * wallet's own transactions.
 */
export function SetupGuide({ onSearch }: { onSearch: () => void }) {
  const { wallet, ready } = useWallet();
  const records = useAdvanceRecords(wallet.publicKey);
  const deposits = useDepositRecords(wallet.publicKey);
  const activity = useActivity();
  const pref = useSyncExternalStore(subscribePref, readPref, () => "closed" as const);
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mine = (kind: string) =>
    !!wallet.publicKey && (activity.data ?? []).some((e) => e.kind === kind && e.actor === wallet.publicKey);

  const steps: Step[] = [
    {
      id: "connect",
      title: "Connect a wallet",
      body: "A test wallet is created in this browser and funded for you. Freighter works too.",
      icon: Wallet,
      href: null,
      done: wallet.connected,
    },
    {
      id: "finance",
      title: "Finance a sample invoice",
      body: "Checks run against live data, then the pool pays most of the invoice to your wallet in one transaction.",
      icon: FilePlus2,
      href: "/app/advance",
      done: records.length > 0 || mine("financed"),
    },
    {
      id: "repay",
      title: "Repay the advance",
      body: "On testnet you repay from your wallet, and the funds go straight back into the pool.",
      icon: ReceiptText,
      href: "/app/advances",
      done: records.some((r) => r.settleTx) || mine("settled"),
    },
    {
      id: "deposit",
      title: "Deposit into the pool",
      body: "The other side of the market: fund the pool that pays advances.",
      icon: Plus,
      href: "/app/pool#deposit",
      done: deposits.length > 0 || mine("deposited"),
    },
    {
      id: "withdraw",
      title: "Withdraw from the pool",
      body: "Take out up to what you deposited, from funds not out in advances.",
      icon: ArrowDownLeft,
      href: "/app/pool#withdraw",
      done: mine("withdrawn"),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  const decided = ready && !activity.loading;
  const open = pref ? pref === "open" : decided && desktop && current !== -1;
  const setOpen = (v: boolean) => writePref(v ? "open" : "closed");

  return (
    <>
      {open && (
        <div className="pop-in fixed bottom-[76px] right-4 z-40 w-[calc(100vw-32px)] max-w-[440px] rounded-2xl bg-surface p-5 shadow-[0_0_2px_rgba(175,178,206,0.56),0_12px_32px_-8px_rgba(4,4,52,0.18)] sm:right-7 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[17px] text-ink">{current === -1 ? "Loop complete" : "Run the full loop"}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {doneCount} of {steps.length} done · each step is a real testnet transaction
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Collapse guide"
              className="-mr-1.5 -mt-1 rounded-full p-1.5 text-text-2 transition-colors hover:bg-[rgba(112,115,147,0.08)] hover:text-ink"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <ol className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {steps.map((s, i) => {
              const isCurrent = i === current;
              const showConnect = s.id === "connect" && !s.done && (isCurrent || expanded === s.id);
              const row = (
                <>
                  {s.done ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <s.icon className="h-5 w-5 shrink-0 text-text-2" strokeWidth={1.6} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[15px]", s.done ? "text-muted" : "text-ink")}>{s.title}</span>
                    {isCurrent && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{s.body}</span>}
                  </span>
                  {!s.done && s.href && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(112,115,147,0.1)] text-ink">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </>
              );
              const cls = "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors";
              return (
                <li key={s.id}>
                  {s.href && !s.done ? (
                    <Link href={s.href} className={cn(cls, "hover:bg-[rgba(112,115,147,0.05)]")}>
                      {row}
                    </Link>
                  ) : s.id === "connect" && !s.done ? (
                    <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className={cls}>
                      {row}
                    </button>
                  ) : (
                    <div className={cls}>{row}</div>
                  )}
                  {showConnect && (
                    <div className="px-4 pb-4">
                      <ConnectOptions compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-line px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-text-2" strokeWidth={1.6} />
            <span className="flex-1 text-[15px] text-ink">Find any invoice or transaction</span>
            <button
              onClick={onSearch}
              className="flex h-8 items-center gap-1.5 rounded-full bg-[rgba(112,115,147,0.1)] px-3.5 text-[14px] text-ink transition-colors hover:bg-[rgba(112,115,147,0.16)]"
            >
              Search
              <kbd className="text-[12px] text-muted">⌘K</kbd>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close guide" : "Open guide"}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand shadow-[0_0_2px_rgba(175,178,206,0.56),0_1px_4px_rgba(4,4,52,0.1)] transition-shadow hover:shadow-[0_0_2px_rgba(175,178,206,0.56),0_4px_12px_rgba(4,4,52,0.14)] sm:bottom-5 sm:right-7"
      >
        {open ? <X className="h-5 w-5" /> : <MapIcon className="h-5 w-5" strokeWidth={1.8} />}
        {!open && current !== -1 && decided && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] text-white">
            {steps.length - doneCount}
          </span>
        )}
      </button>
    </>
  );
}
