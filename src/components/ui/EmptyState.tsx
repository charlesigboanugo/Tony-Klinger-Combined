import type { ReactNode } from "react";

/**
 * Explicit empty state — note 10 §23.
 *
 * Empty states say what the customer can do next rather than showing nothing.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-(--radius) border border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
