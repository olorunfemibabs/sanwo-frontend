"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/*
 * The Sanwo mark: a complete S, with two outer lines tracing it. One wraps
 * the top bowl and the other the bottom bowl, and each stops on the centre
 * line: money going out, and coming back.
 *
 * Geometry comes from scripts/logo-geometry.mjs (64-unit grid). Regenerate
 * there rather than editing these paths by hand.
 */
const STROKE = 3.8;
const INNER = "M42.4 22.6A10.4 10.4 0 0 0 21.6 22.6C21.6 30.8 42.4 33.2 42.4 41.4A10.4 10.4 0 0 1 21.6 41.4";
const OUTER_TOP = "M50 22.6A18 18 0 0 0 14 22.6C14 37.574 34.8 39.974 34.8 41.4";
const OUTER_BOTTOM = "M14 41.4A18 18 0 0 0 50 41.4C50 26.426 29.2 24.026 29.2 22.6";
const CLIP_TOP = "0,0 64,0 64,23.6 32,23.6 32,64 0,64";
const CLIP_BOTTOM = "64,64 0,64 0,40.4 32,40.4 32,0 64,0";

/**
 * The mark alone. Below about 24px the outer lines blur together, so use
 * `simple` there: the inner S only, at a heavier weight.
 */
export function LogoMark({
  className,
  size = 30,
  simple = false,
}: {
  className?: string;
  /** Rendered size in px. */
  size?: number;
  simple?: boolean;
}) {
  const id = useId();
  if (simple) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
        <path
          d={INNER}
          fill="none"
          stroke="currentColor"
          strokeWidth={7}
          transform="translate(32 32) scale(1.35) translate(-32 -32)"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <clipPath id={`${id}t`}>
          <polygon points={CLIP_TOP} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <polygon points={CLIP_BOTTOM} />
        </clipPath>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth={STROKE}>
        <path d={INNER} />
        <path d={OUTER_TOP} clipPath={`url(#${id}t)`} />
        <path d={OUTER_BOTTOM} clipPath={`url(#${id}b)`} />
      </g>
    </svg>
  );
}

/**
 * The app icon: the full mark in white on a brand tile, with the same
 * proportions as app/icon.png. Used as the workspace avatar in the app.
 */
export function LogoTile({ className, size = 32 }: { className?: string; size?: number }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <clipPath id={`${id}t`}>
          <polygon points={CLIP_TOP} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <polygon points={CLIP_BOTTOM} />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="14" fill="var(--brand)" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth={4.4}
        transform="translate(32 32) scale(0.8) translate(-32 -32)"
      >
        <path d={INNER} />
        <path d={OUTER_TOP} clipPath={`url(#${id}t)`} />
        <path d={OUTER_BOTTOM} clipPath={`url(#${id}b)`} />
      </g>
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" | "inherit" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "light" && "text-white",
        tone === "dark" && "text-ink",
        className,
      )}
    >
      <LogoMark />
      <span className="text-[15px] font-medium tracking-[0.28em]">SANWO</span>
    </span>
  );
}
