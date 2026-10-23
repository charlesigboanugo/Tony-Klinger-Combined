import Link from "next/link";

import { AdminCard } from "@/components/admin/AdminForm";
import { StatusPill } from "@/components/admin/AdminTable";
import { ButtonLink } from "@/components/ui/Button";
import type { LinkedProducts } from "@/lib/admin/product-links";

/**
 * The product(s) a tier, course, series, cohort, retreat, event or one-to-one
 * service is sold by, on its own admin page (owner, 2026-10-15). The thing
 * comes first; its product is created from here, already pointing at it.
 */
export function ProductLinkPanel({
  linked,
  rowId,
  noun,
  mayCreate,
}: {
  linked: LinkedProducts;
  rowId: string;
  /** What this page is, e.g. "retreat", for the button. */
  noun: string;
  /** Holds the permission to create products. */
  mayCreate: boolean;
}) {
  const href = `/admin/products/new?type=${encodeURIComponent(linked.type)}&for=${encodeURIComponent(rowId)}`;

  return (
    <AdminCard
      className="mt-8 max-w-4xl"
      title={linked.products.length > 1 ? "Products" : "Product"}
      description={linked.canAdd ? `What this ${noun} is sold by. Add its price under Prices once it exists.` : linked.reason}
    >
      {linked.products.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet. Without one it cannot be bought.</p>
      ) : (
        <ul className="divide-y divide-border rounded-(--radius) border border-border">
          {linked.products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href={`/admin/products/${product.id}`} className="font-medium hover:underline">
                {product.name}
              </Link>
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                {product.note}
                <StatusPill value={product.status} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {linked.canAdd && mayCreate ? (
        <div className="mt-5">
          <ButtonLink href={href} size="sm">
            Create a product for this {noun}
          </ButtonLink>
        </div>
      ) : null}
    </AdminCard>
  );
}
