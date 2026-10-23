import { headers } from "next/headers";
import Link from "next/link";

import { AdminNav } from "@/components/admin/AdminNav";
import { SpareKeyBanner } from "@/components/admin/SpareKeyBanner";
import { SessionSync } from "@/components/navigation/SessionSync";
import { UserMenu } from "@/components/navigation/UserMenu";
import { Wordmark } from "@/components/navigation/Wordmark";
import { WorkspaceDrawer } from "@/components/navigation/WorkspaceDrawer";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { adminNavigation } from "@/lib/navigation";
import {
  AccessDeniedError,
  can,
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
  let pathname: string | null = null;
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
    pathname = (await headers()).get("x-pathname");
    const returnTo =
      pathname && pathname.startsWith("/admin") ? pathname : "/admin";

    context = await requireStaff(returnTo);
  } catch (error) {
    if (error instanceof AccessDeniedError) return <AccessDenied />;
    throw error;
  }

  /*
    A STAFF MEMBER ON A PAGE THEIR ROLE DOESN'T COVER (owner, 2026-10-23) is
    told so here, inside the Admin frame. The page's own `requirePermission`
    still refuses (the security boundary), but its refusal surfaced as the
    generic "Something went wrong" — a finance manager typing /admin/users saw
    a broken page instead of note 06 §38's plain answer. The permission is the
    one the menu entry for this address already names (longest match).
  */
  const required = adminNavigation
    .flatMap((group) => group.items)
    .filter((item) => item.permission && pathname && (pathname === item.href || pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.permission;
  const denied = Boolean(required && !can(context, required));

  const groups = adminNavigation
    .map((group) => ({ ...group, items: visibleTo(context, group.items) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-svh flex-col">
      <SessionSync email={context.email} />
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

        The column is 15rem, down from 19rem (owner, 2026-10-13): admin pages
        are tables and forms and need the width more than the menu does. At
        that width the brand is the TK disc alone beside "ADMIN".

        The brand is the site's own mark and the workspace name in tracked
        small capitals — the same treatment as `WorkspaceHeader` for Account
        and the Academy — replacing plain "Tony Klinger" beside a filled pill,
        which read as a placeholder. The account menu (with Sign out) replaces
        a bare email and button.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/97 lg:bg-background/90 lg:backdrop-blur-md">
        <div className="flex h-16 items-center">
          <div className="flex h-full min-w-0 items-center gap-3 px-4 tiny:gap-2 tiny:px-3 sm:gap-4 sm:px-6 lg:w-60 lg:shrink-0 lg:gap-3.5 lg:px-5 lg:border-r lg:border-border">
            <WorkspaceDrawer label="Admin" strip="bg-block-indigo">
              <AdminNav groups={groups} variant="drawer" />
            </WorkspaceDrawer>
            <Wordmark compact monogramOnly />
            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border tiny:h-5" />
            <Link
              href="/admin"
              className="rounded-sm text-[0.75rem] font-semibold tracking-[0.24em] whitespace-nowrap uppercase transition-colors tiny:text-[0.625rem] tiny:tracking-[0.16em] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Admin
            </Link>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 px-4 tiny:px-3 sm:gap-2 sm:px-6">
            {context.needsSpareKey ? (
              <SpareKeyBanner
                verifiedFactors={context.verifiedFactors}
                isOwner={context.roles.includes("owner")}
              />
            ) : null}
            {/* "Back to site" is in the account menu (owner, 2026-10-15). */}
            <UserMenu email={context.email ?? ""} admin backToSite iconOnPhones />
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

          Below lg there is no sidebar: the hamburger in the header opens the
          same finder and tree from the left (note 04 §32.4).
        */}
        <aside
          className={
            "z-30 hidden shrink-0 lg:block lg:p-3 " +
            "lg:sticky lg:top-16.25 lg:h-[calc(100svh-4.0625rem)] " +
            "lg:w-60 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-border"
          }
        >
          <AdminNav groups={groups} />
        </aside>

        {/* `min-w-0` so a wide table scrolls inside the pane instead of
            stretching the whole layout and dragging the sidebar off-screen.

            `[overflow-wrap:anywhere]` so text with no spaces in it (a file
            name as a page title, a storage path, a long id, an email) breaks
            onto the next line instead of running out of its box. It is
            inherited, so it covers every admin page, list or inner; tables
            opt back out, because they scroll instead (note 10 §33.0). */}
        <main id="main" className="workspace min-w-0 flex-1 px-4 pt-6 pb-20 [overflow-wrap:anywhere] sm:px-6 lg:px-8 lg:pt-8">
          {denied ? <AccessDenied /> : children}
        </main>
      </div>
    </div>
  );
}
