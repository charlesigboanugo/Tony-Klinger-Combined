import "server-only";

import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sync the catalogue to Stripe — note 09 §12.
 *
 * Each product gets ONE Stripe Product, and each active price ONE Stripe Price,
 * created once and recorded back against our row.
 *
 * The alternative — inline `price_data` at checkout — works, but Stripe then
 * creates a fresh Product for every purchase: the dashboard fills with
 * duplicates, per-product revenue reporting becomes impossible, and recurring
 * memberships have no stable Price to bill against.
 *
 * The application stays the source of truth for its own catalogue; Stripe holds
 * a mirror (note 09 §12).
 *
 * Idempotent: anything already carrying an id is skipped, so this can be re-run
 * after adding a product without touching existing ones.
 */
export type SyncResult = {
  productsCreated: number;
  pricesCreated: number;
  /** Prices whose amount diverged from Stripe and were replaced. */
  pricesReplaced: number;
  skipped: number;
  errors: string[];
};

/**
 * Sync ONE product and its active prices.
 *
 * Called immediately after an administrator saves a product or price, which is
 * what closes the window this used to leave open: between a product being
 * created and the nightly sync running, `stripe_price_id` was null and every
 * purchase in between took the throwaway-product fallback. On a daily schedule
 * that window was up to 24 hours.
 *
 * Never throws. A Stripe outage must not stop an administrator saving their
 * work — the scheduled sync is the safety net that catches whatever failed.
 */
export async function syncProductToStripe(productId: string): Promise<void> {
  try {
    await syncCatalogueToStripe({ productId });
  } catch (error) {
    console.error("immediate stripe sync failed", {
      productId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function syncCatalogueToStripe(
  options?: { productId?: string },
): Promise<SyncResult> {
  const admin = createAdminClient();
  const result: SyncResult = {
    productsCreated: 0,
    pricesCreated: 0,
    pricesReplaced: 0,
    skipped: 0,
    errors: [],
  };

  let query = admin
    .from("products")
    .select("id,name,slug,description,status,stripe_product_id")
    .in("status", ["active", "paused"]);

  // Narrowed to one product when called from an admin save; the scheduled run
  // passes nothing and sweeps the whole catalogue.
  if (options?.productId) query = query.eq("id", options.productId);

  const { data: products } = await query;

  for (const product of (products ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    stripe_product_id: string | null;
  }>) {
    let stripeProductId = product.stripe_product_id;

    try {
      if (!stripeProductId) {
        const created = await stripe().products.create({
          name: product.name,
          description: product.description ?? undefined,
          // Our id travels with it, so a Stripe object can always be traced
          // back to the row that owns it.
          metadata: { product_id: product.id, slug: product.slug },
        });
        stripeProductId = created.id;

        await admin
          .from("products")
          .update({ stripe_product_id: stripeProductId })
          .eq("id", product.id);

        result.productsCreated += 1;
      } else {
        result.skipped += 1;
      }

      const { data: prices } = await admin
        .from("prices")
        .select("id,amount,currency,billing_type,interval,active,stripe_price_id")
        .eq("product_id", product.id)
        .eq("active", true);

      for (const price of (prices ?? []) as Array<{
        id: string;
        amount: number;
        currency: string;
        billing_type: string;
        interval: string | null;
        stripe_price_id: string | null;
      }>) {
        // A Stripe Price is IMMUTABLE. An amount edited in /admin cannot be
        // pushed to the existing Price — the only correct move is to create a
        // replacement and stop using the old one.
        //
        // This block previously just skipped anything already synced, which
        // meant editing £35 to £50 left Stripe still holding £35: the site
        // advertised one amount and charged another. The divergence is checked
        // against Stripe itself rather than a local snapshot, so a change made
        // in the Stripe dashboard is caught too.
        if (price.stripe_price_id) {
          const existing = await stripe().prices.retrieve(price.stripe_price_id);

          const wantsRecurring =
            price.billing_type === "recurring" && Boolean(price.interval);
          const matches =
            existing.unit_amount === price.amount &&
            existing.currency === price.currency.toLowerCase() &&
            Boolean(existing.recurring) === wantsRecurring &&
            (!wantsRecurring || existing.recurring?.interval === price.interval);

          if (matches) {
            result.skipped += 1;
            continue;
          }

          // Archived, not deleted: Stripe does not allow deleting a Price, and
          // existing subscriptions billing against it must keep working. It
          // simply stops being offered.
          if (existing.active) {
            await stripe().prices.update(price.stripe_price_id, { active: false });
          }
          result.pricesReplaced += 1;
          // Falls through to create the replacement below.
        }

        const created = await stripe().prices.create({
          product: stripeProductId,
          currency: price.currency.toLowerCase(),
          unit_amount: price.amount,
          ...(price.billing_type === "recurring" && price.interval
            ? { recurring: { interval: price.interval as "month" | "year" } }
            : {}),
          metadata: { price_id: price.id },
        });

        await admin
          .from("prices")
          .update({ stripe_price_id: created.id })
          .eq("id", price.id);

        result.pricesCreated += 1;
      }
    } catch (error) {
      result.errors.push(
        `${product.slug}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return result;
}
