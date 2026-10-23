"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The two email methods, as tabs — note 05 §7.1.
 *
 * Shared by sign-in and create account (owner, 2026-10-23), so both pages offer
 * the same choice in the same place: tabbed rather than stacked, so the page
 * does not present competing forms at once. The email link is the first tab
 * and the one open on arrival (owner, 2026-10-13): it needs no password to
 * remember.
 *
 * The tabs follow the WAI-ARIA tabs pattern: one tab stop, arrow keys (and
 * Home/End) move between methods. The selected state is a thumb that SLIDES
 * under the label rather than a background that blinks on, so the eye follows
 * the change; transform only, so it costs nothing.
 */
const METHODS = [
  ["magic", "Email link"],
  ["password", "Password"],
] as const;

type Method = (typeof METHODS)[number][0];

export function EmailMethods({
  label,
  magic,
  password,
}: {
  /** What the tab list is, for a screen reader: "Email sign-in method". */
  label: string;
  magic: ReactNode;
  password: ReactNode;
}) {
  const [method, setMethod] = useState<Method>("magic");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = METHODS.findIndex(([value]) => value === method);
    const last = METHODS.length - 1;
    const target =
      event.key === "ArrowRight"
        ? (current + 1) % METHODS.length
        : event.key === "ArrowLeft"
          ? (current - 1 + METHODS.length) % METHODS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    setMethod(METHODS[target][0]);
    tabs.current[target]?.focus();
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative grid grid-cols-2 rounded-full bg-surface-muted p-1"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-card",
            "transition-transform duration-(--dur-base) ease-expo motion-reduce:transition-none",
            method === "password" && "translate-x-full",
          )}
        />
        {METHODS.map(([value, name], i) => (
          <button
            key={value}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${value}`}
            aria-selected={method === value}
            aria-controls={`${id}-panel`}
            tabIndex={method === value ? 0 : -1}
            onClick={() => setMethod(value)}
            className={cn(
              "relative rounded-full px-3 py-2 text-sm font-medium transition-colors duration-(--dur-fast)",
              method === value ? "text-foreground" : "text-muted-foreground hover:text-accent",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div
        key={method}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${method}`}
        className="animate-[fade-up_0.45s_var(--ease-out-expo)_both] motion-reduce:animate-none"
      >
        {method === "password" ? password : magic}
      </div>
    </>
  );
}
