import { headers } from "next/headers";
import Link from "next/link";

import { AdminNav } from "@/components/admin/AdminNav";
import { SpareKeyBanner } from "@/components/admin/SpareKeyBanner";
import { signOutAction } from "@/app/auth/actions";
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
      <div aria-hidden="true" className="h-[3px] w-full bg-block-indigo" />

      {/*
        The header is split into a brand column that is EXACTLY the sidebar's
        width and carries the same right border, so the two line up into one
        vertical rule down the page. Previously the header was a single padded
        row and its left edge landed wherever the padding fell, cutting across
        the sidebar at an arbitrary offset.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-16 items-center">
          <div className="flex h-full shrink-0 items-center gap-3 px-4 sm:px-6 lg:w-64 lg:border-r lg:border-border">
            <Link href="/" className="font-semibold tracking-tight">
              Tony Klinger
            </Link>
            <span
              className="rounded-full bg-block-indigo px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-block-foreground uppercase"
              aria-label="Administrative workspace"
            >
              Admin
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 px-4 sm:px-6">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {context.email}
            </span>
            <Link
              href="/account"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Account
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-input-border px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
              >
                Sign out
              </button>
            </form>
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
            "shrink-0 border-b border-border p-4 " +
            "lg:sticky lg:top-[calc(4rem+3px)] lg:h-[calc(100svh-4rem-3px)] " +
            "lg:w-64 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-b-0"
          }
        >
          <AdminNav groups={groups} />
        </aside>

        {/* `min-w-0` so a wide table scrolls inside the pane instead of
            stretching the whole layout and dragging the sidebar off-screen. */}
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
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
