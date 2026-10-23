import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Admin form layout — note 10 §32.1.
 *
 * Every form on an admin inner page is built from these, so they all look
 * like one thing: a card on the page ground, fields on a two-column grid that
 * uses the width the page has, and the action in a footer bar at the card's
 * foot with any small print beside it.
 *
 * They replaced forms that were a bare stack of inputs in a narrow column at
 * the left edge, each styled where it was written (owner, 2026-10-13).
 */

const TONES = {
  default: "border-border",
  warning: "border-warning/50",
  danger: "border-error/40",
} as const;

/** The surface a form (or a block of facts) sits on. */
export function AdminCard({
  title,
  description,
  children,
  footer,
  tone = "default",
  className,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  /** A bar at the foot, normally a `FormFooter`. */
  footer?: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-(--radius-lg) border bg-surface shadow-card", TONES[tone], className)}>
      <div className="p-5 sm:p-6">
        {title ? (
          <div className="mb-5">
            <h3 className="text-base font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
      {footer}
    </div>
  );
}

/** Two columns from `sm`; a field takes one, or both with `wide`. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-6 gap-y-5 sm:grid-cols-2", className)}>{children}</div>;
}

/** A grid cell that spans both columns: long text, a picker, a message. */
export function Wide({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sm:col-span-2", className)}>{children}</div>;
}

/** The card's foot: small print on the left, the action on the right. */
export function FormFooter({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-x-6 gap-y-3 border-t border-border bg-surface-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      {/* Stacked on phones: beside the button the note was squeezed to a
          two-word column. */}
      <p className="max-w-prose min-w-0 text-xs leading-relaxed text-muted-foreground sm:flex-1">{note}</p>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}

/**
 * A choice between a few options, as one segmented control. Real radio
 * inputs, so it submits with the form and works from the keyboard; the
 * selected segment is filled.
 */
export function Segmented({
  legend,
  name,
  options,
  defaultValue,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<readonly [value: string, label: string]>;
  defaultValue: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-medium">{legend}</legend>
      <div className="grid h-11 auto-cols-fr grid-flow-col gap-1 rounded-(--radius) border border-input-border bg-background p-1">
        {options.map(([value, label]) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-[calc(var(--radius)-3px)] px-3 text-sm transition-colors",
              "text-muted-foreground hover:text-foreground",
              "has-checked:bg-foreground has-checked:font-medium has-checked:text-background",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input type="radio" name={name} value={value} defaultChecked={value === defaultValue} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * An on/off setting: its name, what it means, and a switch — note 10 §32.1.
 *
 * Replaced a small tick box beside a line of grey text (owner, 2026-10-14:
 * "not that clear or beautiful"). The whole row is the control, the name
 * says what the setting is and the line under it what "on" does, and the
 * switch shows its state with a word beside it, so it reads at a glance.
 *
 * Still a real checkbox (`role="switch"`), so it submits with the form, takes
 * the keyboard, and works before the page's scripts load.
 */
export function Toggle({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-4 rounded-(--radius) border border-border bg-background px-4 py-3 transition-colors",
        "hover:border-foreground/40 has-checked:border-accent/50 has-checked:bg-accent/5",
        "has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span className="w-6 text-right text-xs font-medium text-muted-foreground group-has-checked:text-accent">
          <span className="group-has-checked:hidden">Off</span>
          <span className="hidden group-has-checked:inline">On</span>
        </span>
        <input
          {...props}
          type="checkbox"
          role="switch"
          className={cn(
            "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-foreground/20 transition-colors checked:bg-accent",
            "before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform before:content-['']",
            "checked:before:translate-x-5 motion-reduce:before:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
          )}
        />
      </span>
    </label>
  );
}
