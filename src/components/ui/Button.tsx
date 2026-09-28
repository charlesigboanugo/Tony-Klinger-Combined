import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Buttons — note 10 §18, §20, §21, §26.
 *
 * Knows nothing about memberships, entitlements or any other business concept
 * (note 02 §12). Higher-level feature components compose it.
 *
 * NOT A PLAIN RECTANGLE. Each variant is built from three things a flat filled
 * box does not have:
 *
 *   - a hairline highlight along the top edge (`before:`), which is what makes
 *     a solid shape read as lit from above rather than printed on;
 *   - a sheen that sweeps across on hover (`after:`), clipped to the button, so
 *     the control acknowledges the pointer rather than just changing tint;
 *   - real elevation that lifts on hover and compresses on `:active`.
 *
 * All three are pure CSS on pseudo-elements — no extra DOM, no library, and
 * they animate on the compositor, so the cost is a repaint of one element.
 *
 * THE DISABLED STATE IS STILL READABLE. It used to be `opacity-50`, which took
 * the contact form's submit button to 2.88:1 while it waited for the captcha —
 * a label nobody could read on the one control they were waiting for. WCAG
 * exempts disabled controls from contrast, but "exempt" is not "good": a
 * disabled button must still say what it is. It now recolours to muted rather
 * than fading out.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "onBlock"
  | "onBlockOutline";
export type ButtonSize = "sm" | "md" | "lg";

const base = [
  "group/btn relative isolate inline-flex cursor-pointer items-center justify-center gap-2",
  // Fully rounded. A pill reads as a control at a glance, where a
  // small-radius rectangle reads as a panel with a label in it — and the
  // surfaces around it already use a sharp radius, so the contrast between
  // "surface" and "thing you press" does real work.
  "overflow-hidden rounded-full font-semibold tracking-[0.01em] whitespace-nowrap",
  "transition-[transform,box-shadow,background-color,border-color,color] duration-(--dur-fast) ease-expo",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "active:translate-y-px",
  // Sheen. Skewed and parked off the left edge, swept across on hover.
  "after:pointer-events-none after:absolute after:inset-y-0 after:-left-full after:-z-10 after:w-1/2",
  "after:skew-x-[-20deg] after:bg-white/18 after:transition-[left] after:duration-500 after:ease-expo",
  "hover:after:left-[150%]",
  // Legible when disabled, rather than faded to nothing.
  "disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none",
  "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:after:hidden",
  "motion-reduce:transform-none motion-reduce:transition-none motion-reduce:after:hidden",
].join(" ");

/** Top-edge highlight — only on filled variants, where it reads as light. */
const lit =
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25";

const variants: Record<ButtonVariant, string> = {
  primary: `bg-button text-button-foreground shadow-card hover:-translate-y-0.5 hover:shadow-lift ${lit}`,
  secondary: `bg-secondary text-secondary-foreground shadow-card hover:-translate-y-0.5 hover:shadow-lift ${lit}`,
  destructive: `bg-error text-error-foreground shadow-card hover:-translate-y-0.5 hover:shadow-lift ${lit}`,
  // Outline fills from the bottom on hover rather than merely tinting.
  outline:
    "border border-input-border bg-transparent text-foreground hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-card",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
  onBlock: `bg-block-foreground text-secondary shadow-card hover:-translate-y-0.5 hover:shadow-lift ${lit}`,
  onBlockOutline:
    "border border-block-foreground/55 bg-transparent text-block-foreground hover:-translate-y-0.5 hover:border-block-foreground hover:bg-block-foreground/12",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.9375rem]",
  lg: "h-13 px-8 text-base",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: BaseProps & ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(base, variants[variant], sizes[size], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(base, variants[variant], sizes[size], className)}
    />
  );
}

/**
 * Trailing arrow that slides on hover.
 *
 * Separate from the button because it belongs on links that lead somewhere and
 * not on actions that commit something — "Save changes" should not suggest
 * navigation.
 */
export function ButtonArrow() {
  return (
    <span
      aria-hidden="true"
      className="transition-transform duration-(--dur-base) ease-expo group-hover/btn:translate-x-1 motion-reduce:transform-none"
    >
      &rarr;
    </span>
  );
}
