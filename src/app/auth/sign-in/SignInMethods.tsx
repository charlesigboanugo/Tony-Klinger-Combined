"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { OrRule } from "@/app/auth/AuthParts";
import { GoogleButton } from "@/app/auth/GoogleButton";
import { MagicLinkForm } from "@/app/auth/sign-in/MagicLinkForm";
import { SignInForm } from "@/app/auth/sign-in/SignInForm";
import { cn } from "@/lib/utils/cn";

/**
 * The three supported sign-in methods — note 05 §7.1.
 *
 * Google sits above the divider because it is one click; the email methods are
 * tabbed rather than stacked so the page does not present three competing forms
 * at once.
 *
 * The tabs follow the WAI-ARIA tabs pattern: one tab stop, arrow keys (and
 * Home/End) move between methods. The selected state is a thumb that SLIDES
 * under the label rather than a background that blinks on, so the eye follows
 * the change; transform only, so it costs nothing.
 */
const METHODS = [
  ["password", "Password"],
  ["magic", "Email link"],
] as const;

type Method = (typeof METHODS)[number][0];

export function SignInMethods({ next }: { next?: string }) {
  const [method, setMethod] = useState<Method>("password");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

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
    <div className="space-y-6">
      <GoogleButton next={next} />

      <OrRule>or with email</OrRule>

      <div
        role="tablist"
        aria-label="Email sign-in method"
        onKeyDown={onKeyDown}
        className="relative grid grid-cols-2 rounded-full bg-surface-muted p-1"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-card",
            "transition-transform duration-(--dur-base) ease-expo motion-reduce:transition-none",
            method === "magic" && "translate-x-full",
          )}
        />
        {METHODS.map(([value, label], i) => (
          <button
            key={value}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={method === value}
            aria-controls="signin-panel"
            tabIndex={method === value ? 0 : -1}
            onClick={() => setMethod(value)}
            className={cn(
              "relative rounded-full px-3 py-2 text-sm font-medium transition-colors duration-(--dur-fast)",
              method === value
                ? "text-foreground"
                : "text-muted-foreground hover:text-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        key={method}
        role="tabpanel"
        id="signin-panel"
        aria-labelledby={`tab-${method}`}
        className="animate-[fade-up_0.45s_var(--ease-out-expo)_both] motion-reduce:animate-none"
      >
        {method === "password" ? (
          <SignInForm next={next} />
        ) : (
          <MagicLinkForm next={next} />
        )}
      </div>
    </div>
  );
}
