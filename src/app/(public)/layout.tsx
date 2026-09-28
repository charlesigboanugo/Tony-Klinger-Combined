import { NewsletterPopup } from "@/components/content/NewsletterPopup";
import { PublicFooter } from "@/components/navigation/PublicFooter";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { readCartCount } from "@/lib/commerce/cart";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Public layout — note 04 §29.
 *
 * `(public)` is a route group: it contributes nothing to any URL (note 02 §5).
 * `/cart` lives inside it so it inherits this header and footer (note 03 §27).
 *
 * The user is resolved here, on the server, via getUser() — which revalidates
 * against the Auth server rather than trusting the cookie (note 05 §12).
 *
 * The cart count is read here too, so the masthead's cart icon can show that
 * something is waiting. Adding to the cart is a Server Action that sets the
 * cookie, and that re-renders this layout, so the badge updates immediately.
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const [user, cartCount] = await Promise.all([getCurrentUser(), readCartCount()]);

  return (
    <>
      <PublicHeader userEmail={user?.email ?? null} cartCount={cartCount} />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
      <NewsletterPopup />
    </>
  );
}
