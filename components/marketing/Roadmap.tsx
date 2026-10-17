import Link from "next/link";
import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

const STAGES = [
  {
    suffix: "Testnet",
    when: "Live now",
    blurb: "The full advance loop, running against deployed contracts on Stellar testnet.",
    cta: { href: "/app", label: "Open testnet app" },
    heading: "What runs today:",
    items: [
      "Capital Pool contract: deposits and advances",
      "Receivables contract: fingerprinted, one-time invoices",
      "Advance registered and paid in one transaction",
      "Repayments returned to the pool on-chain",
      "Withdrawals, up to each depositor's principal",
      "Automated checks before every advance",
      "Live pool data and activity feed",
      "Open-source contracts, with tests",
    ],
    note: "Testnet XLM stands in for USDC, and the advance rate is fixed at 75%.",
  },
  {
    suffix: "v1",
    when: "Mainnet",
    blurb: "Real businesses, real invoices, and complete financing loops closed on Stellar.",
    status: "In development",
    heading: "Everything in Testnet, plus:",
    items: [
      "USDC pool with share tokens for pro-rata yield",
      "Collection to a controlled address per invoice",
      "Business verification and signed credit scores",
      "Per-invoice pricing, up to 85% advanced",
      "First-loss reserve and Blend routing",
    ],
  },
  {
    suffix: "Next",
    when: "After v1",
    blurb: "Open the engine so wallets and fintechs can offer receivables financing without building the lending stack.",
    status: "Planned",
    heading: "Everything in v1, plus:",
    items: [
      "Independent contract audit",
      "Fiat collection through a licensed partner",
      "Public API, SDK and sandbox for integrators",
      "Managed wallets, so businesses never see a key",
    ],
    note: "Timing depends on the audit and on licensing partners.",
  },
];

/** Three bordered columns, one per phase, colour on the suffix. */
export function Roadmap() {
  return (
    <section id="roadmap" data-theme="neutral" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1080px] px-5 sm:px-8">
        <div className="reveal text-center">
          <h2 className="display mx-auto max-w-[720px] text-[34px] leading-[1.1] sm:text-[48px]">
            What works today,
            <br />
            and what comes next
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.5] text-page-muted sm:text-[19px]">
            The whole loop already runs on Stellar testnet. v1 adds what real money needs.
          </p>
        </div>

        <div className="reveal mt-14 overflow-hidden rounded-2xl border border-page-line bg-white text-[#1e1e2a] shadow-[0_2px_12px_-4px_rgba(20,30,25,0.08)] sm:mt-20">
          <div className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-8">
            <p className="label-caps text-text-2">Compare stages</p>
            <p className="text-[14px] text-text-2">Running on Stellar testnet</p>
          </div>

          <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {STAGES.map((s) => (
              <div key={s.suffix} className="flex flex-col px-6 py-8 sm:px-8">
                <p className="text-[26px] leading-tight tracking-[-0.01em]">
                  Sanwo <span className="text-brand">{s.suffix}</span>
                </p>
                <p className="text-[26px] leading-tight tracking-[-0.01em] text-muted">{s.when}</p>
                <p className="mt-3 min-h-[48px] text-[15px] leading-[1.55] text-text-2">{s.blurb}</p>

                {s.cta ? (
                  <Link href={s.cta.href} className={buttonClass("primary", "lg", "mt-7 w-full")}>
                    {s.cta.label}
                  </Link>
                ) : (
                  <span className="mt-7 flex h-11 w-full items-center justify-center rounded-full bg-tint-2 text-[15px] text-text-2">
                    {s.status}
                  </span>
                )}

                <p className="mt-8 text-[16px] text-ink">{s.heading}</p>
                <ul className="mt-3 space-y-2.5">
                  {s.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] leading-[1.45] text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={1.5} />
                      {item}
                    </li>
                  ))}
                </ul>
                {s.note && <p className="mt-auto pt-8 text-[13px] leading-relaxed text-muted">{s.note}</p>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
