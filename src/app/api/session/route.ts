import { NextResponse } from "next/server";

import { readCart } from "@/lib/commerce/cart";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Whether this session has done its second step — a claim in the token just
  // validated by getUser(), read locally. SessionSync compares it, so a tab
  // rendered for a confirmed session notices a sign-in elsewhere that hasn't.
  const { data: level } = user ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel() : { data: null };

  // Already getting the letters, so the newsletter popup neither opens by
  // itself nor offers the form again (owner, 2026-10-25). Keyed on email with
  // the service role, as Account → Notifications reads it: a buyer's or
  // newsletter row may carry no user id.
  const { data: consents } = user?.email
    ? await createAdminClient()
        .from("marketing_consents")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .is("withdrawn_at", null)
        .limit(1)
    : { data: null };

  return NextResponse.json(
    {
      email: user?.email ?? null,
      subscribed: (consents ?? []).length > 0,
      admin,
      verified: level?.currentLevel === "aal2",
      cartCount: cart.reduce((sum, line) => sum + line.qty, 0),
      // Which products are in the cart, so a product page can say "in your
      // cart" instead of offering to add the same thing again.
      cartSlugs: cart.map((line) => line.slug),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
