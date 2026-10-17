"use client";

import { useEffect, useRef } from "react";

/** Share of the clip the load-in sweep plays before scroll takes over. */
const INTRO_END = 0.38;
const INTRO_MS = 1100;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The video never plays on its own. On load it
 * sweeps to a resting frame, then scrolling through the hero scrubs it
 * forward and scrolling back rewinds it. Seeks are eased toward the target
 * so fast scrolling still looks like a camera move, not a jump.
 */
export function HeroVideo({
  src,
  largeSrc,
  mobileSrc,
  poster,
  still,
}: {
  src: string;
  largeSrc: string;
  mobileSrc: string;
  /** First frame, shown while the video loads. */
  poster: string;
  /** Resting frame, shown instead of the video when motion is reduced. */
  still: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let current = 0;
    let target = 0;
    let introDone = false;
    let duration = 0;

    const scrollTarget = () => {
      const progress = Math.min(Math.max(window.scrollY / window.innerHeight, 0), 1);
      const start = duration * INTRO_END;
      return start + progress * (duration - 0.05 - start);
    };

    const tick = () => {
      const diff = target - current;
      if (Math.abs(diff) > 0.004) {
        current += diff * 0.14;
        video.currentTime = current;
      }
      frame = requestAnimationFrame(tick);
    };

    const intro = () => {
      duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const end = scrollTarget();
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - began) / INTRO_MS, 1);
        current = target = end * easeOutCubic(t);
        video.currentTime = current;
        if (t < 1) {
          frame = requestAnimationFrame(step);
        } else {
          introDone = true;
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(step);
    };

    const onScroll = () => {
      if (introDone) target = scrollTarget();
    };

    if (video.readyState >= 2) intro();
    else video.addEventListener("loadeddata", intro, { once: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("loadeddata", intro);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <video
        ref={ref}
        poster={poster}
        muted
        playsInline
        preload="auto"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
      >
        <source src={mobileSrc} type="video/mp4" media="(max-width: 900px)" />
        <source src={largeSrc} type="video/mp4" media="(min-width: 2200px)" />
        <source src={src} type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element -- static poster shown only for reduced motion */}
      <img src={still} alt="" aria-hidden className="absolute inset-0 hidden h-full w-full object-cover motion-reduce:block" />
    </>
  );
}
