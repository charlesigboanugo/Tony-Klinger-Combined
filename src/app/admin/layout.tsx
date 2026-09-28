import { headers } from "next/headers";
import Link from "next/link";

import { AdminNav } from "@/components/admin/AdminNav";
import { SpareKeyBanner } from "@/components/admin/SpareKeyBanner";
import { UserMenu } from "@/components/navigation/UserMenu";
import { Wordmark } from "@/components/navigation/Wordmark";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { adminNavigation } from "@/lib/navigation";
import {
  AccessDeniedError,
  requireStaff,
  visibleTo,
} from "@/lib/permissions";

/**
 * Admin layout — note 04 §16, §32; note 06 §25.
 *
 * The guard here is a convenience, not the security boundary: it stops an
 * unauthorized person seeing the shell. Every page, Server Action and Route
 * Handler beneath it authorizes itself, and RLS enforces the data (note 06 §2).
 *
 * Deliberately does not render the public navigation (note 06 §37).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  let context;
  try {
    /*
      Return the operator to the page they actually asked for.

      The layout gate runs before the page's own, so without the path stamped
      by the proxy every deep link into Admin collapsed to `/admin` the moment
      a second factor was needed. Read as a path and used only if it points
      back into this workspace — it is our own header, but a redirect target is
      not the place to relax about that (note 05 §36).
    */
    const pathname = (await headers()).get("x-pathname");
    const returnTo =
      pathname && pathname.startsWith("/admin") ? pathname : "/admin";

    context = await requireStaff(returnTo);
  } catch (error) {
    if (error instanceof AccessDeniedError) return <AccessDenied />;
    throw error;
  }

  const groups = adminNavigation
    .map((group) => ({ ...group, items: visibleTo(context, group.items) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-svh flex-col">
      {/* Admin must not look like the public site (note 04 §16). */}
      <div aria-hidden="true" className="h-0.75 w-full bg-block-indigo" />

      {/*
        The header is split into a brand column that is EXACTLY the sidebar's
        width and carries the same right border, so the two line up into one
        vertical rule down the page. Previously the header was a single padded
        row and its left edge landed wherever the padding fell, cutting across
        the sidebar at an arbitrary offset.
      */}
      {/*
        The header is split into a brand column that is EXACTLY the sidebar's
        width and carries the same right border, so the two line up into one
        vertical rule down the page (note 04 §32.2).

        The brand is the site's own mark and the workspace name in tracked
        small capitals — the same treatment as `WorkspaceHeader` for Account
        and the Academy — replacing plain "Tony Klinger" beside a filled pill,
        which read as a placeholder. The account menu (with Sign out) replaces
        a bare email and button.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center">
          <div className="flex h-full min-w-0 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:w-76 lg:shrink-0 lg:gap-3.5 lg:px-5 lg:border-r lg:border-border">
            <Wordmark compact monogramOnPhone />
            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
            <Link
              href="/admin"
              className="rounded-sm text-[0.75rem] font-semibold tracking-[0.24em] whitespace-nowrap uppercase transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Admin
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1 px-4 sm:gap-2 sm:px-6">
            {/* Your account is in the account menu beside it. */}
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              <span aria-hidden="true">&larr;</span>
              Back to site
            </Link>
            <UserMenu email={context.email ?? ""} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/*
          The sidebar scrolls INDEPENDENTLY of the content.

          It was in normal flow, so a long list of admin areas could only be
          reached by scrolling the whole page — dragging the content out of
          view to read the menu. Sticky under the header with its own overflow
          means the two panes move separately, which is what an operator
          expects from a workspace.
        */}
        <aside
          className={
            "z-30 shrink-0 border-b border-border px-4 py-3 sm:px-6 lg:p-4 " +
            "lg:sticky lg:top-16.25 lg:h-[calc(100svh-4.0625rem)] " +
            "lg:w-76 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-b-0"
          }
        >
          <AdminNav groups={groups} />
        </aside>

        {/* `min-w-0` so a wide table scrolls inside the pane instead of
            stretching the whole layout and dragging the sidebar off-screen. */}
        <main id="main" className="workspace min-w-0 flex-1 px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-8">
          {context.needsSpareKey ? (
            <SpareKeyBanner
              verifiedFactors={context.verifiedFactors}
              isOwner={context.roles.includes("owner")}
            />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
