import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The grid for a coaching listing, shaped by how many offers there are
 * (owner, 2026-09-26: cards must own the page, not float in it).
 *
 * A fixed three-column grid left two courses hugging the left edge and one
 * private-coaching card alone in a third of the row. So: one offer is a
 * feature card across the row (pass `feature` to its `OfferCard`), two share
 * the row, four sit two by two, and three or more than four run in threes
 * from `lg`. Never a column count that leaves an empty slot on the first row.
 */
export function offerGridColumns(count: number) {
  if (count <= 1) return "";
  if (count === 2 || count === 4) return "md:grid-cols-2";
  return "md:grid-cols-2 lg:grid-cols-3";
}

export function OfferGrid({
  count,
  children,
  className,
}: {
  count: number;
  children: ReactNode;
  className?: string;
}) {
  return <ul className={cn("grid gap-6 lg:gap-8", offerGridColumns(count), className)}>{children}</ul>;
}
