import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Buttons ────────────────────────────────────────────────────────────────
// Pills: regular weight, fully rounded, no heavy shadows.

type ButtonVariant = "primary" | "soft" | "outline" | "chip" | "ghost" | "dark";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  soft: "bg-[rgba(112,115,147,0.1)] text-ink hover:bg-[rgba(112,115,147,0.16)]",
  outline: "border border-line-strong bg-surface/70 text-ink hover:bg-surface",
  chip: "bg-[rgba(112,115,147,0.1)] text-ink hover:bg-[rgba(112,115,147,0.16)]",
  ghost: "text-muted hover:bg-paper-2 hover:text-ink",
  dark: "bg-ink text-white hover:bg-ink-3",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3.5 text-[13px]",
  /** Action chips: 32px, icon left, 15px text. */
  pill: "h-8 pl-3 pr-4 text-[15px]",
  /** Flow footer buttons ("Go back" / "Next"): 40px. */
  flow: "h-10 px-5 text-[15px]",
  md: "h-9 px-4 text-[14px]",
  lg: "h-11 px-5 text-[15px]",
  xl: "h-12 px-6 text-[16px]",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof BUTTON_SIZES = "md",
  className?: string,
) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="spin h-4 w-4" />}
      {children}
    </button>
  );
}

/** Round icon button for "+" and "⋮" card actions. */
export function IconButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-ink transition-colors hover:bg-line",
        className,
      )}
      {...props}
    />
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[rgba(112,115,147,0.14)] bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Card footer row with a divider: a short summary on the left, an action on the right. */
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-4 border-t border-line px-5 py-3.5 text-[13px]", className)}
      {...props}
    />
  );
}

// ─── Money ──────────────────────────────────────────────────────────────────

export { Amount, Money } from "@/components/ui/money";

// ─── Badges ─────────────────────────────────────────────────────────────────

type BadgeTone = "green" | "amber" | "red" | "blue" | "neutral" | "dark";

const BADGE_TONES: Record<BadgeTone, string> = {
  green: "bg-mint text-brand-strong",
  amber: "bg-amber-bg text-amber",
  red: "bg-red-bg text-red",
  blue: "bg-blue-bg text-blue",
  neutral: "bg-paper-2 text-muted",
  dark: "bg-ink text-white",
};

/** Small square-ish status tag, such as "Settled" or "Overdue". */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] leading-4",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Forms ──────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[13px] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <span className="mt-1.5 block text-xs text-red">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-subtle outline-none transition-colors focus:border-brand focus:bg-surface disabled:text-muted";

export function Notice({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: "neutral" | "amber" | "red" | "green" | "blue";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-paper text-text-2",
    amber: "bg-amber-bg text-amber",
    red: "bg-red-bg text-red",
    green: "bg-mint text-brand-strong",
    blue: "bg-blue-bg text-blue",
  };
  return (
    <div className={cn("flex gap-2.5 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed", tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
