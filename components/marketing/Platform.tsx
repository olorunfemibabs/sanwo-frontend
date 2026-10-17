import { ArrowUpRight, Check, Fingerprint, Wallet } from "lucide-react";

/**
 * Beige feature grid: large panels of real-looking product UI that bleed off
 * the edge, with a depth-of-field blur on the lower rows, then a short
 * title and description.
 */
export function Platform() {
  return (
    <section id="features" data-theme="beige" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="reveal border-t border-page-line pt-10">
          <h2 className="display max-w-[640px] text-[30px] leading-[1.15] sm:text-[38px]">
            Waiting on clients used to be part of the job. Now it&apos;s optional.
          </h2>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-14 md:grid-cols-2">
          {CARDS.map((c, i) => (
            <article key={c.title} className="reveal" style={{ ["--reveal-delay" as string]: `${(i % 2) * 90}ms` }}>
              <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-page-card-2">
                <span aria-hidden className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-[#c9c3f0]/50 blur-[60px]" />
                {c.visual}
                {/* Depth of field: the lowest rows fall out of focus. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[34%] backdrop-blur-[3px]"
                  style={{ maskImage: "linear-gradient(to bottom, transparent, black 70%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 70%)" }}
                />
              </div>
              <h3 className="mt-6 text-[18px] font-[500]">
                {c.title}
                {c.note && <sup className="ml-0.5 text-[0.6em] font-normal">{c.note}</sup>}
              </h3>
              <p className="mt-1 max-w-[520px] text-[17px] leading-[1.55] text-page-muted">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Product fragments ──────────────────────────────────────────────────────

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`absolute left-[9%] top-[12%] w-[115%] rounded-xl border border-black/5 bg-white text-[#1e1e2a] shadow-[0_20px_50px_-20px_rgba(40,30,80,0.25)] ${className}`}
  >
    {children}
  </div>
);

const Tick = () => (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#0f6e56]">
    <Check className="h-4 w-4" strokeWidth={2.5} />
  </span>
);

const ChecksVisual = (
  <Panel>
    <div className="px-6 pt-5">
      <p className="text-[12px] text-[#8b8c93]">Step 2 of 4</p>
      <p className="text-[19px]">Verification</p>
    </div>
    <ul className="mt-4 space-y-3.5 px-6 pb-8 text-[13px]">
      {[
        ["Invoice is in a supported currency", "Invoice"],
        ["Payment terms are within range", "Invoice"],
        ["Client is independent of the borrower", "Entity check"],
        ["Client has a live Stellar account", "Stellar Horizon"],
        ["Invoice has never been financed", "Receivables contract"],
        ["Pool can fund this advance", "Capital pool contract"],
      ].map(([label, source]) => (
        <li key={label} className="flex items-center gap-3">
          <Tick />
          <span className="flex-1">{label}</span>
          <span className="mr-[14%] text-[11px] text-[#8b8c93]">{source}</span>
        </li>
      ))}
    </ul>
  </Panel>
);

const PaidVisual = (
  <Panel className="top-[16%]">
    <div className="px-6 pt-5">
      <div className="flex items-center gap-3">
        <p className="text-[12px] text-[#5d5e66]">Advance to ••SYRE</p>
        <span className="rounded-md bg-[#efede8] px-2 py-0.5 text-[11px] text-[#5d5e66]">Due 12 Dec 2026</span>
      </div>
      <p className="mt-2 text-[34px] leading-none tracking-[-0.01em]">
        360<sup className="text-[0.5em]">.00</sup>
        <span className="ml-1.5 text-[14px] text-[#8b8c93]">XLM</span>
      </p>
      <p className="mt-2 text-[13px]">Settles when Halden Studio AS pays</p>
    </div>
    <div className="mt-5 space-y-3 border-t border-black/5 px-6 py-4 pb-10 text-[12px]">
      <p className="flex items-center gap-6">
        <span className="w-20 text-[#8b8c93]">Transaction</span>
        <span className="flex items-center gap-1 font-mono text-[#0f6e56]">
          2eb8c96e…2b696aa5 <ArrowUpRight className="h-3 w-3" />
        </span>
      </p>
      <p className="flex items-center gap-6">
        <span className="w-20 text-[#8b8c93]">Fingerprint</span>
        <span className="font-mono">2c718ae7…9bd6ef66</span>
      </p>
      <p className="flex items-center gap-6">
        <span className="w-20 text-[#8b8c93]">Paid to</span>
        <span className="font-mono">GA72TL3I…MCCVSYRE</span>
      </p>
    </div>
  </Panel>
);

const CollectVisual = (
  <Panel>
    <div className="px-6 pt-5">
      <p className="text-[19px]">Payment details</p>
      <p className="mt-1 text-[12px] text-[#8b8c93]">Shown to Halden Studio AS on the invoice</p>
    </div>
    <div className="mt-5 space-y-3 px-6 pb-10">
      <div className="flex items-center gap-3 rounded-lg border border-black/5 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e1f0ea] text-[13px] text-[#0f6e56]">$</span>
        <span>
          <span className="block text-[11px] text-[#8b8c93]">Pay in</span>
          <span className="text-[13px]">USDC on Stellar</span>
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-black/5 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e1f0ea]">
          <Wallet className="h-4 w-4 text-[#0f6e56]" />
        </span>
        <span>
          <span className="block text-[11px] text-[#8b8c93]">Pay to the invoice&apos;s controlled address</span>
          <span className="font-mono text-[13px]">GCOL…7Q2X</span>
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-black/5 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e1f0ea]">
          <Fingerprint className="h-4 w-4 text-[#0f6e56]" />
        </span>
        <span>
          <span className="block text-[11px] text-[#8b8c93]">Reference</span>
          <span className="font-mono text-[13px]">INV-2047</span>
        </span>
      </div>
    </div>
  </Panel>
);

const SettleVisual = (
  <Panel>
    <div className="px-6 pt-5">
      <p className="text-[12px] text-[#8b8c93]">Halden Studio AS</p>
      <p className="text-[19px]">INV-2047</p>
    </div>
    <ol className="relative mt-5 space-y-4 px-6 pb-10 text-[13px]">
      <span aria-hidden className="absolute bottom-12 left-[33px] top-2 w-px bg-black/10" />
      {[
        { t: "Verified and registered", m: "Medium confidence", done: true },
        { t: "Assigned to Sanwo", m: "Client bound to this receivable", done: true },
        { t: "360.00 XLM paid to your wallet", m: "Disbursement 2eb8c96e…", done: true },
        { t: "Client payment due 12 Dec 2026", m: "57 days to go", done: false },
        { t: "Settlement recorded on-chain", m: "Waiting for the client's payment", done: false },
      ].map((s) => (
        <li key={s.t} className="relative flex gap-3">
          <span
            className={`relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
              s.done ? "bg-[#0f6e56] text-white" : "border border-black/20 bg-white"
            }`}
          >
            {s.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          <span>
            <span className="block">{s.t}</span>
            <span className="block text-[11px] text-[#8b8c93]">{s.m}</span>
          </span>
        </li>
      ))}
    </ol>
  </Panel>
);

const CARDS: { title: string; note?: string; body: string; visual: React.ReactNode }[] = [
  {
    title: "Checked before anything moves",
    body: "Six checks run on live data before every advance: the client is real, the terms hold, and the invoice was never financed before.",
    visual: ChecksVisual,
  },
  {
    title: "Paid in the same transaction",
    body: "The receivable is registered and most of the invoice reaches your wallet in one Stellar transaction. No queue, no approval wait.",
    visual: PaidVisual,
  },
  {
    title: "Collected at a controlled address",
    note: "2",
    body: "Your client pays an address set up for that invoice, so repayment never depends on chasing anyone.",
    visual: CollectVisual,
  },
  {
    title: "Settled where anyone can look",
    body: "When your client pays, the advance closes on-chain, and every step links to the public explorer.",
    visual: SettleVisual,
  },
];
