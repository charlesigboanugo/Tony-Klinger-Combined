import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell for every authentication page — note 04 §17, note 10 §25.
 *
 * The alternate action is a PANEL, not a line of small print. Sign-in and
 * sign-up are the two halves of one decision, and a visitor who landed on the
 * wrong one must be able to see the way across at a glance. A 12px underlined
 * link under a form is the usual treatment and it is the usual reason people
 * get stuck.
 *
 * `escape` gives a third way out — back to the site — so no auth page is ever
 * a dead end (note 04 §21).
 */
export function AuthCard({
  title,
  description,
  children,
  altPrompt,
  altHref,
  altLabel,
  footer,
  escape = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** e.g. "New here?" */
  altPrompt?: string;
  /** e.g. "/auth/sign-up" */
  altHref?: string;
  /** e.g. "Create an account" */
  altLabel?: string;
  footer?: ReactNode;
  escape?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl leading-tight font-semibold text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card sm:p-7">
        {children}
      </div>

      {altHref && altLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-lg) border border-border bg-surface-muted px-5 py-4">
          <span className="text-sm text-muted-foreground">{altPrompt}</span>
          <Link
            href={altHref}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {altLabel} &rarr;
          </Link>
        </div>
      ) : null}

      {footer ? (
        <div className="text-center text-sm text-muted-foreground">{footer}</div>
      ) : null}

      {escape ? (
        <p className="text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            &larr; Back to tonyklinger.com
          </Link>
        </p>
      ) : null}
    </div>
  );
}
