"use client";

import { maskAmount, usePrivateMode } from "@/lib/privacy";
import { cn, formatAmount } from "@/lib/utils";

/** Amount with raised decimals, as in "1,992.⁰⁴". Hidden in private mode. */
export function Money({
  value,
  unit,
  className,
  decimalsClassName,
}: {
  value: number;
  unit?: string;
  className?: string;
  decimalsClassName?: string;
}) {
  const hidden = usePrivateMode();
  const [whole, decimals] = formatAmount(value).split(".");
  return (
    <span className={cn("nums whitespace-nowrap", className)}>
      {hidden ? maskAmount(whole) : whole}
      <sup className={cn("ml-px text-[0.55em] font-normal", decimalsClassName)}>
        .{hidden ? "••" : (decimals ?? "00")}
      </sup>
      {unit && <span className="ml-1.5 text-[0.5em] font-normal text-muted">{unit}</span>}
    </span>
  );
}

/** A plain "1,234.50" for running text and tables, hidden in private mode. */
export function Amount({ value, className }: { value: number; className?: string }) {
  const hidden = usePrivateMode();
  const text = formatAmount(value);
  return <span className={cn("nums", className)}>{hidden ? maskAmount(text) : text}</span>;
}
