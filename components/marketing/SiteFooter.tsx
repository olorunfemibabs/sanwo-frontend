import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CONTRACTS_REPO_URL, POOL_CONTRACT_ID, RECEIVABLES_CONTRACT_ID } from "@/lib/config";
import { explorer } from "@/lib/utils";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Testnet app", href: "/app" },
      { label: "Finance an invoice", href: "/app/advance" },
      { label: "Your advances", href: "/app/advances" },
      { label: "Deposit to the pool", href: "/app/pool" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "For businesses", href: "#businesses" },
      { label: "For depositors", href: "#depositors" },
      { label: "Protection", href: "#protection" },
      { label: "Roadmap", href: "#roadmap" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "On-chain",
    links: [
      { label: "Capital Pool contract", href: explorer.contract(POOL_CONTRACT_ID), external: true },
      { label: "Receivables contract", href: explorer.contract(RECEIVABLES_CONTRACT_ID), external: true },
      { label: "Contract source", href: CONTRACTS_REPO_URL, external: true },
      { label: "Stellar testnet", href: "https://stellar.expert/explorer/testnet", external: true },
    ],
  },
];

const FOOTNOTES = [
  "Testnet proof of concept. The deployed contracts advance a fixed 75% of the invoice value and pay out testnet XLM as a stand-in for USDC. Per-invoice pricing up to 85% and USDC settlement are planned for v1.",
  "Collection to a controlled address per invoice, share tokens and the first-loss reserve are planned for v1 and are not live on testnet. On testnet, repayments return the advance to the pool and withdrawals return principal only.",
  "Depositor yield figures are v1 targets, not forecasts or promises. Returns depend on pool utilization and on how financed invoices perform.",
  "Sanwo is not a bank or a lender. In production, credit is extended through licensed partners acting as lender of record. Nothing on this site is an offer of credit or of an investment.",
];

const AUDIENCES = [
  {
    title: "Sanwo for businesses",
    body: "Get up to 85% of a US dollar invoice within minutes, and settle when your client pays. Try the full flow with a sample invoice.",
    href: "/app/advance",
    cta: "Finance an invoice",
  },
  {
    title: "Sanwo for depositors",
    body: "Fund the pool in USDC, earn from real receivables financing, and verify every advance and repayment on Stellar.",
    href: "/app/pool",
    cta: "Deposit on testnet",
  },
];

/**
 * Dark close: a centred statement with two pills, two audience
 * cards, then the footer columns and numbered disclaimers.
 */
export function SiteFooter() {
  return (
    <section data-theme="dark" className="pt-24 sm:pt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="reveal text-center">
          <h2 className="display mx-auto max-w-[760px] text-[34px] leading-[1.1] sm:text-[48px]">
            Receivables financing, rebuilt on an open ledger.
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-[1.55] text-page-muted">
            Sanwo first, then the engine itself: wallets and fintechs will be able to offer
            receivables financing without building the lending stack.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="btn-glow inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-[15px] font-[420] text-white transition-colors duration-300 ease-out hover:bg-brand-strong"
            >
              Open testnet app
            </Link>
            <a
              href={CONTRACTS_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-page-line px-6 text-[15px] font-[420] transition-colors duration-300 hover:bg-page-card"
            >
              Read the contracts
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-2">
          {AUDIENCES.map((a, i) => (
            <Link
              key={a.title}
              href={a.href}
              className="reveal group flex min-h-[220px] flex-col rounded-2xl bg-page-card p-8 transition-colors duration-300 hover:bg-page-card-2"
              style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
            >
              <h3 className="display text-[24px]">{a.title}</h3>
              <p className="mt-3 max-w-[420px] text-[16px] leading-[1.55] text-page-muted">{a.body}</p>
              <span className="mt-auto pt-8 text-[15px] underline decoration-page-subtle underline-offset-[6px] transition-colors group-hover:decoration-page-fg">
                {a.cta}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <footer className="mt-24 border-t border-page-line">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
            <Link href="/" aria-label="Sanwo home" className="self-start">
              <Logo tone="inherit" />
            </Link>
            <div className="grid gap-10 sm:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="text-[14px] text-page-fg">{col.title}</p>
                  <ul className="mt-4 space-y-2.5">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <a
                          href={l.href}
                          {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                          className="text-[15px] text-page-muted transition-colors hover:text-page-fg"
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 grid gap-6 border-t border-page-line pt-8 lg:grid-cols-[1.3fr_2fr]">
            <h2 className="text-[13px] text-page-muted">Disclaimers and footnotes</h2>
            <ol className="space-y-3 text-[12px] leading-relaxed text-page-muted">
              {FOOTNOTES.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-3 shrink-0 text-page-fg">{i + 1}.</span>
                  <span>{f}</span>
                </li>
              ))}
              <li className="pt-3 text-page-subtle">© {new Date().getFullYear()} Sanwo</li>
            </ol>
          </div>
        </div>
      </footer>
    </section>
  );
}
