import { NextResponse } from "next/server";

import { readCart } from "@/lib/commerce/cart";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is looking, for the public masthead — note 04 §29, note 10 §47.1.
 *
 * Public pages are pre-built, so they cannot know the visitor; the header asks
 * here after it loads. Display only: nothing is authorized on this answer.
 */
export async function GET() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    cart,
  ] = await Promise.all([supabase.auth.getUser(), readCart()]);

  // A staff role, the same test the admin layout's `isStaff` uses, so the
  // account menu can offer Admin. Asked only for a signed-in visitor. Not
  // "any role": an Academy viewer's is not staff (migration 0019).
  const { data: staff } = user ? await supabase.rpc("is_staff") : { data: null };
  const admin = staff === true;

  return NextResponse.json(
    {
      email: user?.email ?? null,
      admin,
      cartCount: cart.reduce((sum, line) => sum + line.qty, 0),
      // Which products are in the cart, so a product page can say "in your
      // cart" instead of offering to add the same thing again.
      cartSlugs: cart.map((line) => line.slug),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
