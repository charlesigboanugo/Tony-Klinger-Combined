import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * A switch between the ways one offer is sold — one session or eight, monthly
 * or one year, Level 1, 2 or 3.
 *
 * ONE CONTROL FOR EVERY STEP (owner, 2026-10-08: "easy to select or switch at
 * each stage"). The product page, the cart and checkout all show this same
 * segmented control, so changing your mind never means going back to find the
 * other product.
 *
 * Three ways to act on a choice, chosen by the caller and never mixed:
 *
 *   href        each option is a link (checkout, a retreat's other levels) —
 *               works with no JavaScript, and the choice is in the URL
 *   formAction  each option submits a server action (the cart)
 *   onSelect    each option sets state held by a client component (a product
 *               page's purchase panel)
 *
 * Deliberately not `"use client"`: it has no state of its own, so a server
 * page can render the first two forms without shipping any script for it.
 *
 * The active option paints its own background rather than sitting over a
 * sliding pill, for the reason `BillingToggle` gives: the label stays legible
 * whatever is or is not underneath it.
 */
export type SwitchOption = {
  value: string;
  label: string;
  /** A second, quieter line: the price, or "£16.25 a session". */
  note?: string | null;
  active: boolean;
  href?: string;
};

export function OptionSwitch({
  label,
  options,
  formAction,
  fieldName = "to",
  hidden,
  onSelect,
  size = "md",
  stretch = false,
  className,
}: {
  /** What is being chosen, for assistive tech: "Number of sessions". */
  label: string;
  options: SwitchOption[];
  formAction?: (formData: FormData) => void | Promise<void>;
  /** The form field an option submits its value as. */
  fieldName?: string;
  /** Extra hidden fields for the form — which cart line this is. */
  hidden?: Record<string, string>;
  onSelect?: (value: string) => void;
  size?: "sm" | "md";
  /** Fill the width, options sharing it equally. */
  stretch?: boolean;
  className?: string;
}) {
  if (options.length < 2) return null;

  const item = (active: boolean) =>
    cn(
      "flex min-w-0 flex-col items-center justify-center rounded-full text-center font-semibold whitespace-nowrap",
      "transition-[background-color,color,box-shadow] duration-(--dur-base) ease-expo",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      size === "sm" ? "min-h-8 px-3.5 py-1 text-xs" : "min-h-10 px-4 py-1.5 text-sm sm:px-5",
      stretch && "flex-1",
      active
        ? "bg-button text-button-foreground shadow-card"
        : "cursor-pointer text-muted-foreground hover:bg-surface-muted hover:text-foreground",
    );

  const body = (o: SwitchOption) => (
    <>
      <span>{o.label}</span>
      {o.note ? (
        <span className={cn("text-[0.6875rem] font-medium", o.active ? "opacity-90" : "opacity-80")}>{o.note}</span>
      ) : null}
    </>
  );

  const shell = cn(
    "inline-flex max-w-full gap-1 rounded-full border border-border bg-surface p-1",
    stretch && "flex w-full",
    className,
  );

  if (formAction) {
    return (
      <form action={formAction} role="group" aria-label={label} className={shell}>
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name={fieldName}
            value={o.value}
            aria-pressed={o.active}
            // The current choice is not a thing to submit again.
            disabled={o.active}
            className={item(o.active)}
          >
            {body(o)}
          </button>
        ))}
      </form>
    );
  }

  if (onSelect) {
    return (
      <div role="radiogroup" aria-label={label} className={shell}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.active}
            onClick={() => onSelect(o.value)}
            className={item(o.active)}
          >
            {body(o)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <nav aria-label={label} className={shell}>
      {options.map((o) =>
        o.href && !o.active ? (
          <Link key={o.value} href={o.href} scroll={false} className={item(false)}>
            {body(o)}
          </Link>
        ) : (
          <span key={o.value} aria-current={o.active ? "true" : undefined} className={item(o.active)}>
            {body(o)}
          </span>
        ),
      )}
    </nav>
  );
}
