import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Buttons — note 10 §18, §20, §21, §26.
 *
 * Knows nothing about memberships, entitlements or any other business concept
 * (note 02 §12). Higher-level feature components compose it.
 *
 * STATES (owner, 2026-10-13: the sheen that swept across on hover and the
 * lift were disliked; a plain darken was then "too dull" — modern, and a
 * button must plainly say it is one under the pointer):
 *
 *   - hover     a filled button brightens and lights up: a soft halo of its
 *               own colour around it and a glow beneath. An outline button
 *               fills solid, its text inverting. Nothing travels or jumps.
 *   - pressed   the button presses in (shrinks a little) and the glow drops.
 *   - focus     the ring.
 *
 * Filled variants keep a hairline highlight along the top edge (`before:`),
 * which is what makes a solid shape read as lit rather than printed on.
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
  "overflow-hidden rounded-full font-semibold tracking-[0.01em]",
  // Never wider than its card or the screen (owner, 2026-10-26). `min-w-fit`
  // keeps the label on one line whenever there is room for it; only a label
  // longer than the space it is in wraps, centred, and the pill grows taller.
  "max-w-full min-w-fit text-center leading-tight text-balance",
  "transition-[transform,filter,box-shadow,background-color,border-color,color] duration-200 ease-out",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "active:scale-96",
  // Legible when disabled, rather than faded to nothing.
  "disabled:pointer-events-none disabled:scale-100 disabled:shadow-none disabled:brightness-100",
  "disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
  "motion-reduce:transform-none motion-reduce:transition-none",
].join(" ");

/**
 * A filled button's states: it brightens and takes a halo and glow of its own
 * colour, then settles when pressed. The glow colours are written out in full
 * (not built from a variable) so Tailwind can see each class.
 */
const filledBase = "shadow-card hover:brightness-110 active:brightness-95 active:shadow-card";
export const FILLED_STATES = `${filledBase} hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--button)_22%,transparent),0_12px_28px_-8px_color-mix(in_oklab,var(--button)_65%,transparent)]`;
const filledSecondary = `${filledBase} hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--secondary)_22%,transparent),0_12px_28px_-8px_color-mix(in_oklab,var(--secondary)_65%,transparent)]`;
const filledError = `${filledBase} hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--error)_22%,transparent),0_12px_28px_-8px_color-mix(in_oklab,var(--error)_65%,transparent)]`;
export const ON_BLOCK_FILLED_STATES = `${filledBase} hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--block-foreground)_25%,transparent),0_12px_28px_-8px_color-mix(in_oklab,var(--block-foreground)_45%,transparent)]`;
/** An outline button's states: it fills solid on hover, the text inverting. */
export const OUTLINE_STATES =
  "hover:border-foreground hover:bg-foreground hover:text-background hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--foreground)_14%,transparent)] active:shadow-none";

/** Top-edge highlight — only on filled variants, where it reads as light. */
const lit =
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25";

const variants: Record<ButtonVariant, string> = {
  primary: `bg-button text-button-foreground ${FILLED_STATES} ${lit}`,
  secondary: `bg-secondary text-secondary-foreground ${filledSecondary} ${lit}`,
  destructive: `bg-error text-error-foreground ${filledError} ${lit}`,
  outline: `border border-input-border bg-transparent text-foreground ${OUTLINE_STATES}`,
  ghost: "bg-transparent text-foreground hover:bg-foreground/8 active:bg-foreground/14",
  onBlock: `bg-block-foreground text-secondary ${ON_BLOCK_FILLED_STATES} ${lit}`,
  onBlockOutline:
    "border border-block-foreground/55 bg-transparent text-block-foreground hover:border-block-foreground hover:bg-block-foreground hover:text-secondary hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--block-foreground)_22%,transparent)] active:shadow-none",
};

/** Heights are minimums, so a wrapped label has room. Under 380px (the
 *  smallest phones) padding and type step down a little, so long labels fit
 *  on one line there too. */
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 py-1.5 text-sm max-[380px]:px-3 max-[380px]:text-[0.8125rem]",
  md: "min-h-11 px-6 py-2 text-[0.9375rem] max-[380px]:px-5 max-[380px]:text-sm",
  lg: "min-h-13 px-8 py-2.5 text-base max-[380px]:px-6 max-[380px]:text-[0.9375rem]",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

/**
 * A button that does NOT submit a form unless asked to.
 *
 * The browser's default `type` is "submit", so a Cancel, Close or Remove
 * button placed inside a form used to submit it: Cancel on "clear security
 * keys" would clear them if a reason had been typed. `SubmitButton` sets
 * `type="submit"` itself; everything else is an ordinary button.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: BaseProps & ComponentProps<"button">) {
  return (
    <button
      {...props}
      type={type}
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
