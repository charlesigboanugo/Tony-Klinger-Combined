import Link from "next/link";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/navigation/UserMenu";
import { Wordmark } from "@/components/navigation/Wordmark";
import { WorkspaceDrawer } from "@/components/navigation/WorkspaceDrawer";
import { Container } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
import { cn } from "@/lib/utils/cn";

/**
 * The header of a workspace or task area — Academy, Account, Booking and
 * Checkout (note 04 §10, §13, §18, §20, §33).
 *
 * Focused, not the public masthead: no main menu. It carries the site's own
 * mark (the TK monogram and name, exactly as the masthead sets it), a hairline,
 * and the workspace's name in the tracked small capitals the site uses for
 * labels. That replaces a plain-text name beside a filled pill badge, which
 * read as a placeholder rather than the brand.
 *
 * Same ground as the page (`bg-background`), so the header reads as part of
 * the site, not a white toolbar laid over it. The 3px identity strip above it
 * scrolls away; the header itself is sticky, and the sidebars below stick to
 * its 4rem height.
 *
 * Below sm the mark collapses to the TK disc so the workspace name and the
 * account menu fit on a 320px screen.
 *
 * With a `menu` (the workspace's own navigation), a hamburger at the far left
 * opens it below lg as a sheet from the left edge (note 04 §32.4); from lg the
 * same navigation is the sidebar, so the hamburger hides.
 *
 * Signed in, the right side is the account menu alone: "Back to site", Admin
 * and the other destinations are its items (owner, 2026-10-15), not buttons
 * beside it. Without an `email` (checkout, which guests use) there is no
 * account menu, so "Back to site" and the `links` take its place and stay
 * visible at every width — the header must never leave a phone with only the
 * monogram as a way out (note 04 §21).
 */
export function WorkspaceHeader({
  label,
  home,
  strip,
  email,
  admin = false,
  links = [],
  menu,
}: {
  label: string;
  home: string;
  /** The workspace's identity colour, for the 3px strip. */
  strip: string;
  /** The signed-in address, for the account menu. Omit for a guest-capable task area. */
  email?: string;
  /** The account holds a staff role, so its menu offers Admin. */
  admin?: boolean;
  /** Extra header links, shown only without an `email` (no account menu). */
  links?: Array<{ href: string; label: string }>;
  /** The workspace navigation, for the phone menu. */
  menu?: ReactNode;
}) {
  return (
    <>
      <div aria-hidden="true" className={cn("h-0.75 w-full", strip)} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/97 lg:bg-background/90 lg:backdrop-blur-md">
        <Container>
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 tiny:gap-2 sm:gap-4">
              {menu ? (
                <WorkspaceDrawer label={label} strip={strip}>
                  {menu}
                </WorkspaceDrawer>
              ) : null}
              <Wordmark compact monogramOnPhone />
              <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border tiny:h-5" />
              <Link
                href={home}
                className="rounded-sm text-[0.75rem] font-semibold tracking-[0.24em] whitespace-nowrap uppercase transition-colors tiny:text-[0.625rem] tiny:tracking-[0.16em] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {label}
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Signed in, the way back and the other workspaces are in the
                  account menu (owner, 2026-10-15). A guest has no menu, so
                  the links stay on the header at every width (note 04 §21). */}
              {email ? (
                <UserMenu email={email} admin={admin} backToSite iconOnPhones />
              ) : (
                <>
                  <BackLink href="/" inline>
                    Back to site
                  </BackLink>
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
        </Container>
      </header>
    </>
  );
}
