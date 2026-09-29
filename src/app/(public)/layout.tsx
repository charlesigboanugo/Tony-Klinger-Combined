import { NewsletterPopup } from "@/components/content/NewsletterPopup";
import { PublicFooter } from "@/components/navigation/PublicFooter";
import { PublicHeader } from "@/components/navigation/PublicHeader";

/**
 * Public layout — note 04 §29.
 *
 * `(public)` is a route group: it contributes nothing to any URL (note 02 §5).
 * `/cart` lives inside it so it inherits this header and footer (note 03 §27).
 *
 * It reads nothing about the visitor, deliberately. A cookie read here would
 * make every public page render per request; instead the header fetches the
 * account and cart count after load, and the pages can be pre-built
 * (note 10 §47.1).
 */
/** Public pages are rebuilt at most hourly; admin edits rebuild them at once. */
export const revalidate = 3600;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicHeader />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
      <NewsletterPopup />
    </>
  );
}
