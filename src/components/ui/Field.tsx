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
  const describedBy =
    [errors?.length ? `${name}-error` : null, hint ? `${name}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <input
      {...props}
      id={name}
      name={name}
      aria-invalid={errors?.length ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        "h-11 w-full rounded-(--radius) border bg-background px-3 text-base",
        "placeholder:text-muted-foreground",
        errors?.length ? "border-error" : "border-input-border",
        className,
      )}
    />
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
