"use client";

import { useEffect } from "react";
import { ChevronRight, FlaskConical, Loader2, Puzzle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { Badge, Notice } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** The two ways in: a one-click funded test wallet, or the user's Freighter. */
export function ConnectOptions({
  onConnected,
  compact = false,
}: {
  onConnected?: () => void;
  compact?: boolean;
}) {
  const { wallet, connect, connecting, error } = useWallet();

  useEffect(() => {
    if (wallet.connected) onConnected?.();
  }, [wallet.connected, onConnected]);

  return (
    <div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        <Option
          title="Use a test wallet"
          badge="Fastest for reviewers"
          body="Created in this browser and funded by Friendbot. No extension needed."
          icon={<FlaskConical className="h-4 w-4" />}
          busy={connecting === "test"}
          disabled={connecting !== null}
          onClick={() => connect("test")}
          compact={compact}
        />
        <Option
          title="Connect Freighter"
          body="Sign with your own wallet. Switch it to Testnet first."
          icon={<Puzzle className="h-4 w-4" />}
          busy={connecting === "freighter"}
          disabled={connecting !== null}
          onClick={() => connect("freighter")}
          compact={compact}
        />
      </div>
      {error && (
        <Notice tone="red" className="mt-3">
          {error}
        </Notice>
      )}
    </div>
  );
}

function Option({
  title,
  badge,
  body,
  icon,
  busy,
  disabled,
  onClick,
  compact,
}: {
  title: string;
  badge?: string;
  body: string;
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  compact: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-3.5 bg-surface text-left transition-colors hover:bg-paper disabled:opacity-60",
        compact ? "px-3.5 py-3" : "px-4 py-4",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink">
        {busy ? <Loader2 className="spin h-4 w-4 text-brand" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-ink">{title}</span>
          {badge && <Badge tone="green">{badge}</Badge>}
        </span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{body}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
