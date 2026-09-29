import { NextResponse } from "next/server";

import { readCartCount } from "@/lib/commerce/cart";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Who is looking, for the public masthead — note 04 §29, note 10 §47.1.
 *
 * Public pages are pre-built, so they cannot know the visitor; the header asks
 * here after it loads. Display only: nothing is authorized on this answer.
 */
export async function GET() {
  const [user, cartCount] = await Promise.all([getCurrentUser(), readCartCount()]);
  return NextResponse.json(
    { email: user?.email ?? null, cartCount },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
