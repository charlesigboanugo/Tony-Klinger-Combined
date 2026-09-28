import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Small pieces shared by the auth screens. Hook-free, so both the server pages
 * and the client forms can use them.
 */

/**
 * The "or" rule between Google and the email methods. aria-hidden because it is
 * a visual separator: announcing "or" between two labelled regions adds
 * nothing for a screen reader.
 */
export function OrRule({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[0.6875rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * A finished step — "check your inbox" and the like.
 *
 * Replaces a one-line green alert. After sign-up or a reset request, this IS
 * the page: the one thing left to do happens in another app, so it gets a
 * mark, a plain headline and room to say what comes next. `role="status"`
 * announces it politely; it is good news, not an interruption.
 */
export function AuthNotice({
  icon = "mail",
  title,
  children,
}: {
  icon?: "mail" | "check";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card animate-[fade-up_0.6s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:p-7"
    >
      <span className="grid size-12 place-items-center rounded-full bg-surface-muted text-primary">
        {icon === "mail" ? <MailIcon /> : <CheckIcon />}
      </span>
      <p className="mt-5 font-display text-2xl leading-tight font-semibold tracking-[-0.015em]">
        {title}
      </p>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/*
  Icons: one hand-drawn set, 24px grid, 1.6 stroke, round caps — the same
  weight as the site's other inline marks (note 10 §41). Inline so a failed
  request can never leave a control unlabelled.
*/
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("size-6", className)} {...stroke}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("size-6", className)} {...stroke}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function KeyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("size-6", className)} {...stroke}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16.5 6.5l2.5 2.5M14 9l2 2" />
    </svg>
  );
}
