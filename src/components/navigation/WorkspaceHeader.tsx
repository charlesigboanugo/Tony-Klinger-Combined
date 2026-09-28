import Link from "next/link";

import { UserMenu } from "@/components/navigation/UserMenu";
import { Wordmark } from "@/components/navigation/Wordmark";
import { Container } from "@/components/layout/Container";
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
 * Without an `email` (checkout, which guests use) there is no account menu,
 * so the links take its place and stay visible at every width — the header
 * must never leave a phone with only the monogram as a way out (note 04 §21).
 */
export function WorkspaceHeader({
  label,
  home,
  strip,
  email,
  links = [],
}: {
  label: string;
  home: string;
  /** The workspace's identity colour, for the 3px strip. */
  strip: string;
  /** The signed-in address, for the account menu. Omit for a guest-capable task area. */
  email?: string;
  links?: Array<{ href: string; label: string }>;
}) {
  return (
    <>
      <div aria-hidden="true" className={cn("h-0.75 w-full", strip)} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <Container>
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Wordmark compact monogramOnPhone />
              <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
              <Link
                href={home}
                className="rounded-sm text-[0.75rem] font-semibold tracking-[0.24em] whitespace-nowrap uppercase transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {label}
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {[{ href: "/", label: "Back to site", back: true }, ...links].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "items-center gap-1.5 rounded-full px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    email ? "hidden md:inline-flex" : "inline-flex",
                  )}
                >
                  {"back" in link ? <span aria-hidden="true">&larr;</span> : null}
                  {link.label}
                </Link>
              ))}
              {email ? <UserMenu email={email} /> : null}
            </div>
          </div>
        </Container>
      </header>
    </>
  );
}
