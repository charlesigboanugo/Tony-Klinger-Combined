import Link from "next/link";
import type { ReactNode } from "react";

import { workHref, type CatalogueItem } from "@/lib/content/catalogue";

/**
 * Wraps a work's tile in a link to wherever the work lives — or in a plain
 * block when it has no page and no external home (see `workHref`). Callers keep
 * their own markup; this only decides whether it is clickable.
 *
 * Hover styling belongs on `linkClassName`, so a tile that goes nowhere does not
 * lift or recolour as though it did.
 */
export function WorkLink({
  item,
  className,
  linkClassName,
  children,
}: {
  item: Pick<CatalogueItem, "category" | "slug" | "body" | "is_external" | "external_url">;
  className?: string;
  linkClassName?: string;
  children: ReactNode;
}) {
  const link = workHref(item);
  if (!link) return <div className={className}>{children}</div>;

  return (
    <Link
      href={link.href}
      className={[className, linkClassName].filter(Boolean).join(" ")}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
