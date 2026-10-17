"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_MS = 6500;

const STEPS = [
  {
    title: "Submit the invoice",
    body: "Enter the invoice and your client's Stellar address, or fill a sample to try it in seconds.",
    image: "/product/tour-invoice.png",
    alt: "The invoice form beside a live preview of the invoice.",
    cursor: { x: 40, y: 22 },
  },
  {
    title: "Checks run on live data",
    body: "Six automated checks run before any money moves: the client's account, the payment terms, and whether this invoice was ever financed before.",
    image: "/product/tour-verify.png",
    alt: "Six verification checks, all passed, with a confidence rating.",
    cursor: { x: 16, y: 67 },
  },
  {
    title: "Paid in one transaction",
    body: "The receivable is registered and 75% of the invoice reaches your wallet in the same Stellar transaction.",
    image: "/product/tour-paid.png",
    alt: "Confirmation that 750 XLM was paid, with the transaction link and the invoice stamped as assigned.",
    cursor: { x: 37, y: 52 },
  },
  {
    title: "Tracked to settlement",
    body: "Every advance has a timeline that links each step to the public explorer, through to repayment into the pool.",
    image: "/product/tour-track.png",
    alt: "The advances list with one advance open, showing its timeline and the repay button.",
    cursor: { x: 74, y: 53 },
  },
];

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Product tour: an accordion that
 * advances on a timer, beside the real product with a scripted cursor.
 * Panels swap with a 5px rise in and a 4px blur out.
 */
export function ProductTour() {
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduced;

  const go = (next: number) => {
    setPrevious(active);
    setActive(next);
  };

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => {
      setPrevious(active);
      setActive((active + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [active, paused]);

  const step = STEPS[active];

  return (
    <section id="how-it-works" data-theme="dark" className="scroll-mt-16 overflow-x-clip py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1320px] gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:items-center lg:gap-16">
        <div className="reveal">
          <h2 className="display text-[30px] leading-[1.15] sm:text-[38px]">
            From invoice to cash.
            <br />
            In a single transaction.
          </h2>

          <ol className="mt-12">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.title} className="relative">
                  {/* Divider; the active one fills as its timer runs. */}
                  <span className="absolute inset-x-0 top-0 h-px bg-page-line" aria-hidden />
                  {on && (
                    <span
                      key={`${active}-${paused}`}
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px origin-left bg-page-fg"
                      style={paused ? undefined : { animation: `progress-fill ${STEP_MS}ms linear both` }}
                    />
                  )}
                  <button
                    onClick={() => go(i)}
                    aria-expanded={on}
                    className={cn(
                      "flex w-full items-start gap-3 py-5 text-left text-[18px] transition-colors duration-300",
                      on ? "text-page-fg" : "text-page-muted hover:text-page-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#a9c8ff] transition-opacity",
                        on ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block">{s.title}</span>
                      {on && (
                        <span key={active} className="tab-in mt-1.5 block text-[16px] leading-[1.55] text-page-muted">
                          {s.body}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <Link
            href="/app"
            className="mt-6 inline-block text-[16px] underline decoration-page-subtle underline-offset-[6px] transition-colors hover:decoration-page-fg"
          >
            Open testnet app
          </Link>
        </div>

        <div className="reveal relative" style={{ ["--reveal-delay" as string]: "120ms" }}>
          {/* Soft glows bleeding from behind the product. */}
          <span aria-hidden className="absolute -right-10 top-[18%] h-40 w-40 rounded-full bg-[#5266eb]/40 blur-[70px]" />
          <span aria-hidden className="absolute -right-6 bottom-[16%] h-36 w-36 rounded-full bg-[#0f6e56]/50 blur-[70px]" />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1f1f2b] p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-white">
              {STEPS.map((s, i) => (
                <Image
                  key={s.image}
                  src={s.image}
                  alt={i === active ? s.alt : ""}
                  aria-hidden={i !== active}
                  width={2560}
                  height={1600}
                  sizes="(min-width: 1024px) 760px, 100vw"
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover object-left-top",
                    i === active && "tab-in z-10",
                    i === previous && i !== active && "blur-out z-0",
                    i !== active && i !== previous && "opacity-0",
                  )}
                />
              ))}

              {/* Scripted cursor gliding to the control that matters in each step. */}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="absolute z-20 h-6 w-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-[left,top] duration-[1200ms] ease-[cubic-bezier(0.65,0.05,0.36,1)] motion-reduce:hidden"
                style={{ left: `${step.cursor.x}%`, top: `${step.cursor.y}%` }}
              >
                <path d="M4 2.5 19 12l-6.6 1.3L9 20z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => setUserPaused(!paused)}
            aria-label={paused ? "Play the tour" : "Pause the tour"}
            className="absolute bottom-7 right-7 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#171721]/80 text-white backdrop-blur transition-colors hover:bg-[#171721]"
          >
            {paused ? <Play className="h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </button>
        </div>
      </div>
    </section>
  );
}
