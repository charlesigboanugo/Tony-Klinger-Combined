import type { ReactNode } from "react";

/**
 * Shared layout for the legal pages — note 03 §8.2, note 10 §9.
 *
 * These are long documents of headings and prose, and they need a reading
 * measure and a visible hierarchy or they become an unreadable wall. The three
 * pages share one component so they cannot drift apart in style.
 *
 * `lastReviewed` is shown deliberately: a policy with no date gives a reader no
 * way to tell whether it is current.
 */
export function LegalDocument({
  lastReviewed,
  children,
}: {
  lastReviewed: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 leading-relaxed">
      <p className="text-sm text-muted-foreground">
        Last reviewed {lastReviewed}.
      </p>
      <div
        className="space-y-6 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight
                   [&_h3]:mt-6 [&_h3]:font-medium
                   [&_p]:text-muted-foreground
                   [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:text-muted-foreground
                   [&_dl]:space-y-3 [&_dt]:font-medium [&_dd]:text-muted-foreground"
      >
        {children}
      </div>
    </div>
  );
}
