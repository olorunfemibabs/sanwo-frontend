import Link from "next/link";
import { HeroVideo } from "@/components/marketing/HeroVideo";

/**
 * Hero: a full-bleed cinematic scene that scrubs with scroll,
 * one line of white display type and a frosted-glass action group.
 */
export function Hero() {
  return (
    <section data-theme="dark" className="relative h-[100svh] min-h-[640px] overflow-hidden bg-[#171721]">
      <HeroVideo
        src="/hero/sanwo-hero.mp4"
        largeSrc="/hero/sanwo-hero-4k.mp4"
        mobileSrc="/hero/sanwo-hero-720.mp4"
        poster="/hero/poster.jpg"
        still="/hero/still.jpg"
      />

      {/* Shade the sky behind the type, and fade the foot into the next section. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 42% at 50% 34%, rgba(14,14,22,0.42), rgba(14,14,22,0) 72%), linear-gradient(to bottom, rgba(14,14,22,0.5) 0%, rgba(14,14,22,0.22) 40%, rgba(14,14,22,0) 60%), linear-gradient(to top, #171721 0%, rgba(23,23,33,0) 22%)",
        }}
      />

      <div className="relative mx-auto flex max-w-[1100px] flex-col items-center px-5 pt-[132px] text-center text-white [text-shadow:0_1px_18px_rgba(10,10,18,0.45)] sm:pt-[168px]">
        <h1 className="display text-[38px] leading-[1.08] sm:text-[52px] lg:text-[60px]">
          Get paid before your client pays.
        </h1>
        <p className="mt-5 max-w-[660px] text-[17px] leading-[1.5] text-white/85 sm:text-[19px]">
          Businesses that invoice clients in US dollars wait 30 to 90 days to be paid. Sanwo
          advances up to 85% of a verified, client-accepted invoice in USDC within minutes.
          <sup className="ml-0.5 text-[0.6em]">1</sup>
        </p>

        <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <div className="glass flex w-full items-center justify-between gap-4 rounded-full p-1.5 max-sm:!bg-[rgba(14,14,22,0.35)] sm:w-auto sm:pl-6">
            <span className="hidden text-[15px] text-white/80 sm:inline">Run the full loop on testnet</span>
            <Link
              href="/app"
              className="btn-glow inline-flex h-11 flex-1 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-[15px] font-[420] text-white transition-colors duration-300 ease-out hover:bg-brand-strong sm:flex-none"
            >
              Open testnet app
            </Link>
          </div>
          <a
            href="#how-it-works"
            className="glass inline-flex h-[58px] w-full items-center justify-center rounded-full px-6 text-[15px] font-[420] text-white max-sm:!bg-[rgba(14,14,22,0.55)] sm:w-auto"
          >
            See how it works
          </a>
        </div>
      </div>

    </section>
  );
}
