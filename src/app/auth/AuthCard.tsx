import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell for every authentication page — note 04 §17, note 10 §25.
 *
 * THE TITLE IS NOT THE SITE h1 SIZE (owner, 2026-09-25). It uses
 * `--text-auth-title`: an auth title labels a short task in a narrow column
 * beside the stage, and at the title-card size it wrapped to three lines and
 * pushed the form off the first screen. It still rises out of a clipping mask
 * like the home title card.
 *
 * THE EYEBROW is a plain label for what the screen does ("Sign in", "Reset"),
 * led by a small clapperboard mark.
 *
 * The alternate action is a PANEL, not a line of small print. Sign-in and
 * sign-up are the two halves of one decision, and a visitor who landed on the
 * wrong one must be able to see the way across at a glance. The whole panel is
 * the link, so it is also the largest target on the screen after the submit.
 *
 * `escape` gives a third way out — back to the site — so no auth page is ever
 * a dead end (note 04 §21).
 */
export function AuthCard({
  title,
  description,
  eyebrow,
  children,
  altPrompt,
  altHref,
  altLabel,
  footer,
  escape = true,
}: {
  title: string;
  description?: string;
  /** e.g. "Sign in" */
  eyebrow?: string;
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
    <div>
      <header>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}

        <h1 className="mt-5 text-(length:--text-auth-title) leading-[1.04] tracking-[-0.025em]">
          {/* Padding and a matching negative margin keep descenders inside the
              clipping mask. */}
          <span className="mb-[-0.12em] block overflow-hidden pb-[0.12em]">
            <span className="block animate-[line-rise_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none">
              {title}
            </span>
          </span>
        </h1>

        {description ? (
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground animate-[fade-up_0.8s_var(--ease-out-expo)_both] [animation-delay:90ms] motion-reduce:animate-none">
            {description}
          </p>
        ) : null}
      </header>

      <div className="mt-8 animate-[fade-up_0.8s_var(--ease-out-expo)_both] [animation-delay:160ms] motion-reduce:animate-none">
        {children}
      </div>

      {altHref && altLabel ? (
        <Link
          href={altHref}
          className="group mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-(--radius-lg) border border-border px-5 py-4 transition-[border-color,background-color] duration-(--dur-fast) hover:border-accent hover:bg-surface-muted/60 animate-[fade-up_0.8s_var(--ease-out-expo)_both] [animation-delay:240ms] motion-reduce:animate-none"
        >
          <span className="text-sm text-muted-foreground">{altPrompt}</span>
          <span className="flex items-center gap-2 text-sm font-semibold text-primary">
            {altLabel}
            <span
              aria-hidden="true"
              className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
            >
              &rarr;
            </span>
          </span>
        </Link>
      ) : null}

      {footer ? (
        <div className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">{footer}</div>
      ) : null}

      {escape ? (
        <p className="mt-6 text-center">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent"
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-(--dur-base) ease-expo group-hover:-translate-x-1 motion-reduce:transform-none"
            >
              &larr;
            </span>
            Back to tonyklinger.com
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The clapperboard mark and the label. The striped bar is drawn with a
 * gradient in the foreground colour, so it flips with the theme.
 */
function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.2em] uppercase animate-[fade-up_0.7s_var(--ease-out-expo)_both] motion-reduce:animate-none">
      <span
        aria-hidden="true"
        className="h-3.5 w-8 shrink-0 rounded-[2px] border border-foreground bg-[repeating-linear-gradient(-55deg,var(--foreground)_0_4px,transparent_4px_8px)]"
      />
      <span className="text-foreground">{children}</span>
    </p>
  );
}
