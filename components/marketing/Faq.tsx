import Link from "next/link";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What is Sanwo?",
    a: "Sanwo helps businesses unlock money they have already earned but not yet been paid. It advances up to 85% of a verified, client-accepted invoice in USDC within minutes, from an open liquidity pool on Stellar, then settles automatically when the client pays an account Sanwo controls.",
  },
  {
    q: "Is this a loan?",
    a: "It is early access to money you have already earned. The advance is backed by an invoice your client has accepted, and it is repaid from that client's payment rather than on a fixed schedule.",
  },
  {
    q: "Which invoices qualify?",
    a: "In v1, invoices owed in US dollars by independent clients, typically $3,000 to $25,000 on 30 to 90 day terms. The client must have accepted the invoice, and it must not be in dispute.",
  },
  {
    q: "What if my client pays me directly?",
    a: "Advances carry recourse. You agree to forward any payment that reaches you to the invoice's controlled address within five business days. If it is not forwarded, the advance moves to default and recovery.",
  },
  {
    q: "Where does depositor yield come from?",
    a: "From the fees businesses pay on each advance, plus a baseline on idle capital routed to Blend. We publish targets, not promises, because returns depend on how much of the pool is deployed.",
  },
  {
    q: "What is live today, and what is not?",
    a: "On Stellar testnet you can deposit into the pool, finance an invoice, repay it so the funds go back into the pool, and withdraw your deposit, all against deployed contracts. Share tokens, collection from the client's controlled address, and USDC itself arrive with the v1 contracts.",
  },
  {
    q: "Is Sanwo a lender?",
    a: "No. In production, Sanwo works through licensed partners who act as lender of record. Lending in a country stays switched off until the lending, anti-money-laundering and data protection arrangements there are in place.",
  },
];

/** FAQ: centred heading, one soft pill, a narrow divided list. */
export function Faq() {
  return (
    <section id="faq" data-theme="neutral" className="scroll-mt-16 py-24 sm:py-32">
      <div className="reveal mx-auto max-w-[640px] px-5 sm:px-8">
        <h2 className="display text-center text-[30px] leading-[1.15] sm:text-[38px]">
          Frequently asked questions
        </h2>
        <div className="mt-6 flex justify-center">
          <Link href="/app" className="inline-flex h-9 items-center rounded-full bg-page-card-2 px-4 text-[14px] transition-colors hover:bg-page-line">
            Try the testnet app
          </Link>
        </div>

        <div className="mt-14 border-t border-page-line">
          {FAQS.map((item) => (
            <details key={item.q} className="group border-b border-page-line">
              <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-left text-[17px]">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="-mt-1 pb-6 text-[16px] leading-[1.6] text-page-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
