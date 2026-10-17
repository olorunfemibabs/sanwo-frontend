"use client";

import { useEffect, useRef, useState } from "react";

export type SectionTheme = "dark" | "beige" | "neutral";

/**
 * Theme switcher: each section carries data-theme, and whichever
 * section crosses the line under the nav sets the page theme. The wrapper
 * transitions its colour variables, so the whole page cross-fades.
 *
 * Also drives scroll reveals (.reveal) and the cursor glow on .btn-glow.
 */
export function ThemedPage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<SectionTheme>("dark");

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // A 1px band 80px below the top of the viewport, just under the nav. The
    // margins are in pixels, so the band stays a real line at any height; it
    // is rebuilt when the viewport resizes.
    const sections = root.querySelectorAll<HTMLElement>("[data-theme]");
    let themeObserver: IntersectionObserver | null = null;
    const watchThemes = () => {
      themeObserver?.disconnect();
      const below = Math.max(window.innerHeight - 81, 0);
      themeObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const next = (entry.target as HTMLElement).dataset.theme as SectionTheme | undefined;
            if (next) setTheme(next);
          }
        },
        { rootMargin: `-80px 0px -${below}px 0px` },
      );
      sections.forEach((s) => themeObserver!.observe(s));
    };
    watchThemes();
    window.addEventListener("resize", watchThemes);

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "";
          revealObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    root.querySelectorAll<HTMLElement>(".reveal").forEach((el) => revealObserver.observe(el));

    const onPointer = (e: PointerEvent) => {
      const button = (e.target as HTMLElement | null)?.closest<HTMLElement>(".btn-glow");
      if (!button) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      button.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    root.addEventListener("pointermove", onPointer);

    return () => {
      themeObserver?.disconnect();
      window.removeEventListener("resize", watchThemes);
      revealObserver.disconnect();
      root.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div ref={ref} data-page-theme={theme} className={`page-themed theme-${theme} min-h-screen overflow-x-clip`}>
      {children}
    </div>
  );
}
