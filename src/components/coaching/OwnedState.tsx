import { ButtonLink } from "@/components/ui/Button";
import type { EntitlementState } from "@/lib/commerce/entitlements";

/**
 * Purchase call-to-action, aware of what the visitor already holds — note 03 §5.
 *
 * A public product page is public, but not identical for everyone:
 *
 *   guest / no entitlement  -> price and buy
 *   already entitled        -> route to delivery, never a second charge
 *   expired                 -> renew
 *
 * Charging again for access a customer already holds is exactly what note 01
 * §11 forbids.
 */
export function OwnedState({
  entitlement,
  buyHref,
  buyLabel,
  deliveryHref,
  priceLabel,
}: {
  entitlement: EntitlementState;
  /**
   * Where to buy. OPTIONAL, because an entity is not always attached to an
   * active product — the Virtual Retreat has none, and a course whose product
   * was archived has none either. When it is missing no button is rendered:
   * a purchase link that lands on an empty checkout is worse than none.
   */
  buyHref?: string;
  buyLabel: string;
  deliveryHref: string;
  priceLabel?: string;
}) {
  if (entitlement.state === "active") {
    return (
      <div className="rounded-(--radius) border border-success bg-success/10 p-5">
        <p className="font-medium text-success">You already have access</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entitlement.remaining != null
            ? `${entitlement.remaining} session${entitlement.remaining === 1 ? "" : "s"} remaining.`
            : entitlement.expiresAt
              ? `Access runs until ${new Date(entitlement.expiresAt).toLocaleDateString("en-GB")}.`
              : "Included in your membership."}
        </p>
        <div className="mt-4">
          <ButtonLink href={deliveryHref}>Go to it</ButtonLink>
        </div>
      </div>
    );
  }

  if (entitlement.state === "expired") {
    return (
      <div className="rounded-(--radius) border border-warning bg-warning/10 p-5">
        <p className="font-medium text-warning">Your access has ended</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entitlement.expiredAt
            ? `It ended on ${new Date(entitlement.expiredAt).toLocaleDateString("en-GB")}.`
            : "Renew to pick up where you left off."}
        </p>
        {buyHref ? (
          <div className="mt-4">
            <ButtonLink href={buyHref}>Renew access</ButtonLink>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
      {priceLabel ? (
        <p className="font-display text-3xl font-semibold tabular-nums">
          {priceLabel}
        </p>
      ) : null}
      {buyHref ? (
        <div className="mt-4">
          <ButtonLink href={buyHref} className="w-full">
            {buyLabel}
          </ButtonLink>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Not available to buy at the moment.
        </p>
      )}
    </div>
  );
}
