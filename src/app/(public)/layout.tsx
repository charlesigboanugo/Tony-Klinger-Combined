import { PublicFooter } from "@/components/navigation/PublicFooter";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Public layout — note 04 §29.
 *
 * `(public)` is a route group: it contributes nothing to any URL (note 02 §5).
 * `/cart` lives inside it so it inherits this header and footer (note 03 §27).
 *
 * The user is resolved here, on the server, via getUser() — which revalidates
 * against the Auth server rather than trusting the cookie (note 05 §12).
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <>
      <PublicHeader userEmail={user?.email ?? null} />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
    </>
  );
}
