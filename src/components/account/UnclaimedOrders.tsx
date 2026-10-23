import { claimMyOrdersAction } from "@/app/account/claim/actions";
import { formatDate } from "@/lib/account/format";
import { formatPrice } from "@/lib/commerce/pricing";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Purchases made with this account's email that are not in it yet — owner,
 * 2026-10-15; note 05 §29.3.
 *
 * Somebody who checked out without signing in, and never used the emailed
 * link (or let it expire), sees them here with one button to add them.
 * Nothing is added until they press it. Renders nothing when there are none.
 */
export async function UnclaimedOrders() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_unclaimed_orders");
  const orders = (data ?? []) as Array<{
    order_id: string;
    paid_at: string | null;
    total: number;
    currency: string;
    items: string | null;
  }>;
  if (orders.length === 0) return null;

  return (
    <section
      aria-labelledby="unclaimed"
      className="mb-10 rounded-(--radius-lg) border border-accent bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 id="unclaimed" className="font-sans text-base font-semibold">
        {orders.length > 1
          ? "Purchases made with your email aren't in your account yet"
          : "A purchase made with your email isn't in your account yet"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You bought {orders.length > 1 ? "these" : "this"} without signing in. Add{" "}
        {orders.length > 1 ? "them" : "it"} to use what you paid for.
      </p>
      <ul className="mt-4 divide-y divide-border text-sm">
        {orders.map((order) => (
          <li key={order.order_id} className="flex justify-between gap-4 py-2">
            <span>
              {order.items ?? "Order"}
              {order.paid_at ? (
                <span className="block text-xs text-muted-foreground">{formatDate(order.paid_at)}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatPrice(order.total, order.currency)}</span>
          </li>
        ))}
      </ul>
      <form action={claimMyOrdersAction} className="mt-4">
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add to my account
        </SubmitButton>
      </form>
    </section>
  );
}
