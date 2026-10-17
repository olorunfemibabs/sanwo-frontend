"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { CONTRACTS_REPO_URL, POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID, TOKEN_SYMBOL } from "@/lib/config";
import { getActivity, getPoolStats, type ActivityEvent, type PoolStats } from "@/lib/contracts";
import { explorer, formatAmount, fromUnits, timeAgo, truncateMiddle } from "@/lib/utils";

type Data = { stats: PoolStats; events: ActivityEvent[] };

/**
 * Dark stats row, then three cards holding the contracts and their
 * source. Every figure is read from Stellar as the page loads.
 */
export function Proof() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([getPoolStats(), getActivity()])
        .then(([stats, events]) => active && setData({ stats, events }))
        .catch(() => active && setFailed(true));
    load();
    const id = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const latest = data?.events.slice(0, 3) ?? [];
  const amt = (v: bigint) => formatAmount(fromUnits(v));

  const stats = [
    { value: data ? amt(data.stats.poolBalance) : null, unit: TOKEN_SYMBOL, label: "In the pool right now" },
    { value: data ? amt(data.stats.totalDisbursed) : null, unit: TOKEN_SYMBOL, label: "Advanced since deployment" },
    // Running totals kept by the contract, so they hold beyond the RPC's event window.
    { value: data ? amt(data.stats.totalRepaid) : null, unit: TOKEN_SYMBOL, label: "Repaid to the pool" },
    { value: data ? amt(data.stats.totalDeposited) : null, unit: TOKEN_SYMBOL, label: "Deposited since deployment" },
  ];

  const cards = [
    {
      kicker: "Capital Pool",
      title: "Takes deposits and pays every advance",
      href: explorer.contract(POOL_CONTRACT_ID),
      meta: truncateMiddle(POOL_CONTRACT_ID, 6, 6),
      cta: "View on explorer",
    },
    {
      kicker: "Receivables",
      title: "Registers each invoice once and rejects repeats",
      href: explorer.contract(RECEIVABLES_CONTRACT_ID),
      meta: truncateMiddle(RECEIVABLES_CONTRACT_ID, 6, 6),
      cta: "View on explorer",
    },
    {
      kicker: "Source",
      title: "Both contracts are open source, with 58 tests",
      href: CONTRACTS_REPO_URL,
      meta: CONTRACTS_REPO_URL.replace(/^https?:\/\/(www\.)?github\.com\//, ""),
      cta: "View on GitHub",
    },
  ];

  return (
    <section id="proof" data-theme="dark" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <h2 className="reveal display max-w-[700px] text-[30px] leading-[1.15] sm:text-[38px]">
          Small numbers, for now.
          <br />
          Every one of them on Stellar.
        </h2>

        <dl className="mt-14 grid grid-cols-2 gap-y-10 border-t border-page-line pt-10 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="reveal pr-6" style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="nums text-[34px] leading-none tracking-[-0.02em] sm:text-[44px]">
                {s.value ?? (failed ? "—" : <span className="inline-block h-9 w-28 animate-pulse rounded bg-page-card" />)}
                {s.value && s.unit && <span className="ml-1.5 text-[15px] tracking-normal text-page-muted">{s.unit}</span>}
              </dd>
              <p className="mt-3 text-[15px] text-page-muted">{s.label}</p>
            </div>
          ))}
        </dl>

        {latest.length > 0 && (
          <ul className="mt-12 divide-y divide-page-line border-y border-page-line text-[14px]">
            {latest.map((e) => (
              <li key={e.id}>
                <a
                  href={explorer.tx(e.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 py-3.5 text-page-muted transition-colors hover:text-page-fg"
                >
                  <span className="w-36 shrink-0 text-page-fg">
                    {e.kind === "financed"
                      ? "Invoice financed"
                      : e.kind === "settled"
                        ? "Advance repaid"
                        : e.kind === "withdrawn"
                          ? "Withdrawal"
                          : "Deposit"}
                  </span>
                  <span className="nums w-32 shrink-0">
                    {amt(e.amount)} {TOKEN_SYMBOL}
                  </span>
                  <span className="hidden flex-1 font-mono text-[12px] sm:block">tx {truncateMiddle(e.txHash, 8, 8)}</span>
                  <span className="ml-auto shrink-0">{timeAgo(e.at)}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {cards.map((c, i) => (
            <article
              key={c.kicker}
              className="reveal flex min-h-[260px] flex-col rounded-2xl bg-page-card p-7"
              style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
            >
              <p className="text-[14px] text-page-muted">{c.kicker}</p>
              <h3 className="display mt-3 text-[24px] leading-[1.2]">{c.title}</h3>
              <div className="mt-auto flex items-center justify-between gap-3 pt-10">
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[15px] underline decoration-page-subtle underline-offset-[6px] transition-colors hover:decoration-page-fg"
                >
                  {c.cta}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <span className="truncate font-mono text-[11px] text-page-subtle">{c.meta}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
