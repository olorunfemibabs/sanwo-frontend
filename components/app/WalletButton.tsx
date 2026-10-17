"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Droplets, ExternalLink, LogOut } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { Badge, Button, Money } from "@/components/ui/primitives";
import { TOKEN_SYMBOL } from "@/lib/config";
import { explorer, fromUnits } from "@/lib/utils";
import { ConnectOptions } from "@/components/app/ConnectOptions";

/** Top-right avatar: initials in a tinted circle, with a menu. */
export function WalletButton() {
  const { wallet, balance, ready, disconnect, fund } = useWallet();
  const [open, setOpen] = useState(false);
  const [funding, setFunding] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return <span className="h-9 w-9 animate-pulse rounded-full bg-paper-2" />;

  return (
    <div ref={ref} className="relative">
      {wallet.connected && wallet.publicKey ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Wallet menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-2 text-[12px] font-medium text-brand-strong ring-offset-2 transition hover:ring-2 hover:ring-mint-2"
        >
          {wallet.publicKey.slice(-2)}
        </button>
      ) : (
        <Button size="md" onClick={() => setOpen((v) => !v)}>
          Connect wallet
        </Button>
      )}

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(340px,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-2 shadow-[0_16px_40px_-16px_rgba(20,30,25,0.3)]">
          {wallet.connected && wallet.publicKey ? (
            <div>
              <div className="px-3 pb-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-muted">
                    {wallet.kind === "test" ? "Test wallet" : "Freighter"} ••{wallet.publicKey.slice(-4)}
                  </p>
                  <Badge tone="amber">Testnet</Badge>
                </div>
                <p className="mt-2 text-[26px] leading-none text-ink">
                  {balance !== null ? <Money value={fromUnits(balance)} unit={TOKEN_SYMBOL} /> : "—"}
                </p>
                <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-subtle">{wallet.publicKey}</p>
              </div>
              <div className="border-t border-line pt-1">
                <MenuItem
                  icon={<Copy className="h-4 w-4" />}
                  onClick={async () => {
                    await navigator.clipboard.writeText(wallet.publicKey!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied" : "Copy address"}
                </MenuItem>
                <MenuItem icon={<ExternalLink className="h-4 w-4" />} href={explorer.account(wallet.publicKey)}>
                  View on explorer
                </MenuItem>
                <MenuItem
                  icon={<Droplets className="h-4 w-4" />}
                  onClick={async () => {
                    setFunding(true);
                    try {
                      await fund();
                    } finally {
                      setFunding(false);
                    }
                  }}
                >
                  {funding ? "Requesting testnet funds…" : "Get testnet funds"}
                </MenuItem>
                <MenuItem
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                >
                  Disconnect
                </MenuItem>
              </div>
            </div>
          ) : (
            <div className="p-2">
              <p className="px-1 pb-3 text-[15px] text-ink">Connect a wallet</p>
              <ConnectOptions onConnected={() => setOpen(false)} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] text-ink hover:bg-paper";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <span className="text-muted">{icon}</span>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}
