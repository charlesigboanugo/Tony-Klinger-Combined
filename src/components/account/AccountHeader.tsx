import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Account page heading — note 04 §32.2.
 *
 * Not `PageHeader`: that one pushes its title down to the shared hero height
 * so public pages line up with the home title card, which here would drop the
 * heading well below the first navigation item beside it. The heading is a
 * bare `<h1>`, so it takes the site's standard page size.
 */
export function AccountHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="font-display text-balance">{title}</h1>
        {description ? (
          <div className="measure text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

/**
 * A section inside an account page, with an optional link at the right.
 *
 * The h2 is set smaller than a public section's `--text-h2`, as every account
 * page already did: a 48px heading over a three-line list reads as a poster,
 * not a dashboard.
 */
export function AccountSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-lg sm:text-xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
