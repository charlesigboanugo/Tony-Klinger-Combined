"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Container } from "@/components/layout/Container";
import { MobileNav } from "@/components/navigation/MobileNav";
import { NavDropdown } from "@/components/navigation/NavDropdown";
import { SignedOutActions, UserMenu } from "@/components/navigation/UserMenu";
import { ButtonLink } from "@/components/ui/Button";
import { isActive, isCurrentPage, publicNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/** Top-level link underline — a thin bar that grows from the centre rather
 * than a colour swap, so a hover/active state reads as motion, not a flicker.
 * `scale-x` on a compositor-only transform, never `width`. */
const navLinkUnderline =
  "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-(--dur-base) after:ease-expo hover:after:scale-x-100";

/**
 * Public site header — note 04 §7, §26, §27.
 *
 * Desktop navigation must fit without clipping; below `lg` it collapses into
 * the mobile sheet rather than shrinking until unusable (note 04 §26).
 *
 * Items with children render as dropdowns (note 04 §5, §38, note 11). Before
 * this, `children` was read only by the mobile menu, so the Coaching and
 * Catalogue submenus simply did not exist on desktop.
 */
export function PublicHeader({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Scroll state — the header gains a visible edge and a firmer blur once the
  // page has actually moved, instead of carrying a border at the very top
  // where there is nothing yet to separate from. Passive listener, one
  // boolean flip per threshold crossing rather than per pixel.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on navigation — otherwise the sheet stays open over the page just
  // opened, still holding the scroll lock.
  //
  // Adjusted DURING RENDER rather than in an effect. React re-runs the
  // component immediately with the new state and never paints the stale open
  // sheet; an effect would paint it over the new page first and then close it,
  // which shows as a flash. This is React's documented pattern for deriving
  // state from a changed prop.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    if (open) setOpen(false);
  }

  return (
    /* MobileNav is a SIBLING of <header>, not a child, and that placement is
       load-bearing.
    
       The header carries `backdrop-blur`. A `backdrop-filter` makes an element
       a CONTAINING BLOCK for its position:fixed descendants — exactly as
       `transform` and `filter` do. Nested inside, the sheet's
       `fixed inset-x-0 top-16 bottom-0` resolved against the header's own 64px
       box instead of the viewport: top:64px with bottom:0 inside a 64px-tall
       block collapses it to zero height, so pressing the hamburger opened a
       menu that was there in the DOM, focus-trapped and scroll-locked, but
       invisible. */
    <>
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-background/95 backdrop-blur transition-[border-color,box-shadow] duration-(--dur-base) ease-expo",
        scrolled ? "border-border shadow-card" : "border-transparent",
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight transition-transform duration-(--dur-fast) ease-expo hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Tony Klinger
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {publicNavigation.map((item) =>
                item.children?.length ? (
                  <NavDropdown key={item.href} item={item} pathname={pathname} />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                      className={cn(
                        "relative block rounded-(--radius) px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        navLinkUnderline,
                        isActive(pathname, item.href)
                          ? "font-medium text-foreground after:scale-x-100"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {userEmail ? (
              <>
                <ButtonLink href="/cart" variant="ghost" size="sm">
                  Cart
                </ButtonLink>
                <UserMenu email={userEmail} />
              </>
            ) : (
              <SignedOutActions />
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-(--radius) border border-border lg:hidden",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              open && "bg-surface-muted",
            )}
          >
            {/* Two bars that cross into an X — the state change is visible
                rather than requiring the label to be read. */}
            <span aria-hidden="true" className="relative block h-4 w-5">
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 bg-current transition-all duration-200",
                  open ? "top-1.5 rotate-45" : "top-0.5",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 bg-current transition-all duration-200",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </Container>
    </header>

    <MobileNav
      open={open}
      onClose={() => setOpen(false)}
      userEmail={userEmail}
      pathname={pathname}
    />
    </>
  );
}
