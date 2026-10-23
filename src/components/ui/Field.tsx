import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Accessible form field — note 10 §25, §34.
 *
 * Errors are wired to the input through `aria-describedby` and announced with
 * `role="alert"`, so a screen-reader user hears them. State is never signalled
 * by colour alone (note 10 §21).
 */
export function Field({
  label,
  name,
  errors,
  hint,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${name}-error`} role="alert" className="text-sm text-error">
          {errors.join(". ")}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  name,
  errors,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & {
  name: string;
  errors?: string[];
  hint?: string;
}) {
  // An explicit id wins, so two forms on one page (the sign-in tabs) can share
  // a field name; the label and messages follow whichever id is used.
  const id = props.id ?? name;
  const describedBy =
    [errors?.length ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <input
      {...props}
      id={id}
      name={name}
      aria-invalid={errors?.length ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        "h-11 w-full rounded-(--radius) border bg-background px-3 text-base",
        "placeholder:text-muted-foreground",
        errors?.length ? "border-error" : "border-input-border aria-invalid:border-error",
        className,
      )}
    />
  );
}

/**
 * A select that matches `Input`: same height, border and focus. The chevron
 * and the hover border come from the global `select` rule in `globals.css`,
 * so this adds no arrow of its own.
 */
export function Select({
  name,
  hint,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { name: string; hint?: string }) {
  return (
    <select
      {...props}
      id={props.id ?? name}
      name={name}
      aria-describedby={hint ? `${name}-hint` : props["aria-describedby"]}
      className={cn(
        "h-11 w-full rounded-(--radius) border border-input-border bg-background pl-3 text-base disabled:opacity-60",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Form-level message, not tied to a single field. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-(--radius) border px-3 py-2 text-sm",
        tone === "error"
          ? "border-error bg-error/10 text-error"
          : "border-success bg-success/10 text-success",
      )}
    >
      {children}
    </p>
  );
}
