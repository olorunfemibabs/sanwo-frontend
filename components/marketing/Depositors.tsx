"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    title: "Yield from invoices that are already owed",
    body: "Fund the pool in USDC and earn from the fees businesses pay on each advance, backed by invoices their clients have accepted. Nothing is minted to make the numbers work.",
    art: "/art/pool.png",
    alt: "Line illustration of a shallow basin holding stacks of coins.",
  },
  {
    title: "Idle capital still earns",
    body: "Liquidity that is not out in advances is routed to Blend for a baseline return, so the pool is never sitting dead.",
    art: "/art/advance.png",
    alt: "Line illustration of a neat stack of coins.",
  },
  {
    title: "Three layers before your deposit",
    body: "Losses fall in a fixed order: the haircut on every advance, then the business's recourse, then a first-loss reserve. Only after that is depositor capital touched.",
    art: "/art/layers.png",
    alt: "Three frosted glass layers stacked above a fourth, depositor capital.",
    dark: true,
  },
];

/**
 * Neutral accordion section: a heading, one open item at a time, and a tall illustration
 * beside it that cross-fades with the selection.
 */
export function Depositors() {
  const [open, setOpen] = useState(0);

  return (
    <section id="depositors" data-theme="neutral" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className="reveal">
          <p className="text-[14px] text-page-muted">For depositors</p>
          <h2 className="display mt-4 text-[30px] leading-[1.15] sm:text-[38px]">
            Earn from receivables.
            <br />
            Watch every advance <span className="whitespace-nowrap">on-chain.</span>
          </h2>

          <ul className="mt-10">
            {ITEMS.map((item, i) => {
              const on = i === open;
              return (
                <li key={item.title} className="border-t border-page-line last:border-b">
                  <button
                    onClick={() => setOpen(i)}
                    aria-expanded={on}
                    className={cn(
                      "w-full py-5 text-left text-[18px] transition-colors duration-300",
                      on ? "text-page-fg" : "text-page-muted hover:text-page-fg",
                    )}
                  >
                    {item.title}
                  </button>
                  {on && (
                    <div key={open} className="tab-in -mt-2 pb-6">
                      <p className="max-w-[460px] text-[16px] leading-[1.55] text-page-muted">{item.body}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-6 max-w-[460px] text-[13px] leading-relaxed text-page-subtle">
            v1 targets about 10% a year to depositors after the reserve and protocol share. A target,
            not a promise: returns depend on how much of the pool is deployed.<sup className="ml-0.5">3</sup>
          </p>
          <Link
            href="/app/pool"
            className="mt-6 inline-block text-[16px] underline decoration-page-subtle underline-offset-[6px] transition-colors hover:decoration-page-fg"
          >
            Deposit on testnet
          </Link>
        </div>

        <div className="reveal relative aspect-[4/5] overflow-hidden rounded-2xl bg-page-card" style={{ ["--reveal-delay" as string]: "120ms" }}>
          {ITEMS.map((item, i) => (
            <div
              key={item.art}
              aria-hidden={i !== open}
              className={cn(
                "absolute inset-0 transition-[opacity,filter] duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
                i === open ? "opacity-100 blur-0" : "opacity-0 blur-[4px]",
                item.dark ? "bg-[linear-gradient(to_bottom,#33465b,#314459)]" : "bg-page-card",
              )}
            >
              <Image
                src={item.art}
                alt={i === open ? item.alt : ""}
                fill
                sizes="(min-width: 1024px) 540px, 100vw"
                className={cn(item.dark ? "object-cover" : "object-contain p-[3%] mix-blend-multiply")}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
