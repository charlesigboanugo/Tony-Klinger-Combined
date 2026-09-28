import type { ReactNode } from "react";

import { IconTile, type IconName } from "@/components/ui/Icon";

/**
 * Explicit empty state — note 10 §23.
 *
 * Empty states say what the customer can do next rather than showing nothing.
 * The icon names WHAT is empty (orders, bookings, keys) so the state reads at
 * a glance, before the words.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="rounded-(--radius-lg) border border-dashed border-border bg-surface px-6 py-12 text-center">
      {icon ? <IconTile name={icon} size="lg" className="mx-auto mb-4" /> : null}
      <h3 className="text-lg font-medium">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
