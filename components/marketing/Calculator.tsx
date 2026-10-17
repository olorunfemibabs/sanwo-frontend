"use client";

import { useState } from "react";
import { ADVANCE_RATE, MAX_ADVANCE_RATE } from "@/lib/config";
import { cn, formatPercent } from "@/lib/utils";

const MIN = 1_000;
const MAX = 25_000;
const STEP = 500;
const TERMS = [30, 60, 90];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Ramp's "Give your company a raise" pattern: a small dot label, a short
 * headline, one enormous number, a comparison line, and a single slider.
 */
export function Calculator() {
  const [amount, setAmount] = useState(10_000);
  const [terms, setTerms] = useState(60);
  const advance = amount * ADVANCE_RATE;
  const fill = ((amount - MIN) / (MAX - MIN)) * 100;

  return (
    <section id="businesses" data-theme="neutral" className="scroll-mt-16 py-24 sm:py-32">
      <div className="reveal mx-auto max-w-[1080px] px-5 text-center sm:px-8">
        <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-brand" />
        <p className="mt-4 text-[14px] text-page-muted">For businesses</p>
        <h2 className="display mx-auto mt-5 max-w-[640px] text-[30px] leading-[1.15] sm:text-[38px]">
          What your invoice is worth today
        </h2>
        <p className="mx-auto mt-4 max-w-[540px] text-[17px] leading-[1.6] text-page-muted">
          A client on Net 60 means two months of payroll and the next job&apos;s costs out of
          your own pocket. Move the slider to see what Sanwo would pay you now.
        </p>

        <p
          className="nums mt-12 flex items-end justify-center gap-2 text-[72px] leading-none tracking-[-0.04em] text-brand sm:text-[132px] lg:text-[168px]"
          aria-live="polite"
        >
          {usd(advance)}
          <span className="mb-3 text-[15px] tracking-normal sm:mb-5">/today</span>
        </p>

        <p className="mt-8 text-[15px] text-page-muted">
          vs. waiting {terms} days for your client ={" "}
          <span className="text-page-fg underline decoration-page-line underline-offset-4">$0 today</span>
          <sup className="ml-0.5 text-[0.65em]">1</sup>
        </p>

        <div className="mx-auto mt-20 max-w-[420px]">
          <div className="relative">
            <span
              className="nums absolute -top-11 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[14px] text-white"
              style={{ left: `calc(${fill}% + ${9 - fill * 0.18}px)` }}
            >
              {usd(amount)}
            </span>
            <input
              type="range"
              className="range w-full"
              min={MIN}
              max={MAX}
              step={STEP}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ ["--fill" as string]: `${fill}%` }}
              aria-label="Invoice amount"
            />
          </div>
          <p className="mt-3 text-[13px] text-page-muted">Invoice amount</p>

          <div className="mt-8 inline-flex rounded-full bg-page-card p-1">
            {TERMS.map((t) => (
              <button
                key={t}
                onClick={() => setTerms(t)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] transition-colors",
                  terms === t ? "bg-white text-[#1e1e2a] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-page-muted hover:text-page-fg",
                )}
              >
                Net {t}
              </button>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-14 w-fit max-w-full rounded-full bg-page-card px-4 py-2 text-[12px] leading-relaxed text-page-muted">
          Illustrative. The testnet contracts advance a fixed {formatPercent(ADVANCE_RATE)}. v1 prices
          each invoice, up to {formatPercent(MAX_ADVANCE_RATE)}.
        </p>
      </div>
    </section>
  );
}
