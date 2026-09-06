"use client";

import { useState } from "react";

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
 */
type Method = "password" | "magic";

export function SignInMethods({ next }: { next?: string }) {
  const [method, setMethod] = useState<Method>("password");

  return (
    <div className="space-y-6">
      <GoogleButton next={next} />

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        role="tablist"
        aria-label="Email sign-in method"
        className="grid grid-cols-2 gap-1 rounded-(--radius) bg-surface-muted p-1"
      >
        {(
          [
            ["password", "Password"],
            ["magic", "Email link"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={method === value}
            aria-controls={`panel-${value}`}
            onClick={() => setMethod(value)}
            className={cn(
              "rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm transition-colors",
              method === value
                ? "bg-background font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${method}`}
        aria-labelledby={`tab-${method}`}
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
