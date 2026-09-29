"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Container } from "@/components/layout/Container";
import { MobileNav } from "@/components/navigation/MobileNav";
import { NavDropdown } from "@/components/navigation/NavDropdown";
import { navLinkType, navLinkUnderline } from "@/components/navigation/navStyles";
import { useVisitor } from "@/components/navigation/useVisitor";
import { UserMenu } from "@/components/navigation/UserMenu";
import { Wordmark } from "@/components/navigation/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { isActive, isCurrentPage, publicNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Public site header — the masthead. Note 04 §7, §26, §27; note 10 §42.2.
 *
 * THREE WIDTHS, THREE ARRANGEMENTS:
 *   phone     mark + Menu
 *   tablet    mark + Sign in (or the account menu) + Menu
 *   desktop   mark · navigation in tracked capitals · cart · Sign in
 *
 * The cart icon carries a count badge when the cart is non-empty, and below
 * `lg` it appears ONLY then: an empty cart is reachable from the menu, but a
 * full one should be visible without opening anything.
 *
 * Below `lg` the navigation collapses into the full-screen menu rather than
 * shrinking until unusable (note 04 §26). It aligns to the WIDE grid, the same
 * edges as the catalogue's screening-room pages, so the mark sits directly
 * over the hero's title rather than a column's width inside it.
 *
 * Items with children render as dropdown panels (note 04 §5, §38, note 11).
 *
 * The account and cart are fetched after load (`useVisitor`), not passed in:
 * public pages are pre-built and cannot know the visitor (note 10 §47.1).
 */
export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const visitor = useVisitor(pathname);

  /*
    Prefetch every page in the menu once the browser is idle (note 10 §47.2).
    Next prefetches links as they scroll into view, which covers the desktop
    bar — but on a phone the links live in the closed menu, so nothing was
    fetched until it opened and the tap then waited on the network. Skipped
    under data-saver or 2G. The pages are pre-built, so each is a few KB.
  */
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;

    const hrefs = new Set(
      publicNavigation
        .flatMap((item) => [item, ...(item.children ?? [])])
        .filter((item) => !item.external && item.href.startsWith("/"))
        .map((item) => item.href.split("#")[0]),
    );
    const run = () => hrefs.forEach((href) => router.prefetch(href));

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(run, 2000);
    return () => globalThis.clearTimeout(id);
  }, [router]);
  const userEmail = visitor?.email ?? null;
  const cartCount = visitor?.cartCount ?? 0;
  const [open, setOpen] = useState(false);

  // Hairline and shadow only once the page has scrolled, so the header reads
  // as part of the page at rest and as a floating bar in motion.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation. Adjusting state during render when a value
  // changes is React's recommended alternative to a setState-in-effect.
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
       `fixed inset-x-0 top-16 bottom-0` resolved against the header's own
       box instead of the viewport, collapsing it to zero height: a menu that
       was there in the DOM, focus-trapped and scroll-locked, but invisible. */
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-background/97 lg:bg-background/90 lg:backdrop-blur-md transition-[border-color,box-shadow] duration-(--dur-base) ease-expo",
          scrolled || open ? "border-border shadow-card" : "border-transparent",
        )}
      >
        <Container width="wide">
          <div className="flex h-16 items-center justify-between gap-4 lg:h-18 xl:gap-6">
            <Wordmark />

            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-center">
                {publicNavigation.map((item) =>
                  item.children?.length ? (
                    <NavDropdown key={item.href} item={item} pathname={pathname} />
                  ) : (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                        className={cn(
                          "relative block rounded-sm px-2 py-3 transition-colors xl:px-3",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          navLinkType,
                          navLinkUnderline,
                          isActive(pathname, item.href)
                            ? "text-foreground after:scale-x-100"
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

            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/cart"
                aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"}
                className={cn(
                  "relative h-10 w-10 place-items-center rounded-full transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:grid",
                  cartCount > 0 ? "grid text-foreground" : "hidden text-muted-foreground",
                )}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.15rem] w-[1.15rem]">
                  <path
                    d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {cartCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-button px-1 text-[0.6875rem] leading-none font-semibold text-button-foreground tabular-nums ring-2 ring-background"
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                ) : null}
              </Link>

              {/* The one filled action in the masthead is the account: Sign in
                  when signed out, the account menu when signed in. Hidden on a
                  WRAPPER, not on the button: `cn()` is a plain join, so `hidden`
                  beside ButtonLink's own `inline-flex` would lose and show it on
                  phones, pushing the Menu toggle off-screen. */}
              {visitor === null ? (
                <span aria-hidden="true" className="hidden h-9 w-21 sm:block" />
              ) : userEmail ? (
                <div className="hidden sm:block">
                  <UserMenu email={userEmail} />
                </div>
              ) : (
                <span className="hidden sm:block">
                  <ButtonLink href="/auth/sign-in" size="sm">
                    Sign in
                  </ButtonLink>
                </span>
              )}

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-navigation"
                aria-label={open ? "Close menu" : "Open menu"}
                className={cn(
                  "ml-1 flex h-10 items-center gap-2.5 rounded-full border border-border pr-4 pl-3.5 lg:hidden",
                  "transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  navLinkType,
                  open && "border-foreground bg-foreground text-background",
                )}
              >
                {/* Two bars that cross into an X — the state change is visible
                    rather than requiring the label to be read. */}
                <span aria-hidden="true" className="relative block h-3 w-4">
                  <span
                    className={cn(
                      "absolute left-0 block h-px w-4 bg-current transition-all duration-200",
                      open ? "top-1.5 rotate-45" : "top-0.5",
                    )}
                  />
                  <span
                    className={cn(
                      "absolute left-0 block h-px w-4 bg-current transition-all duration-200",
                      open ? "top-1.5 -rotate-45" : "top-2.5",
                    )}
                  />
                </span>
                <span aria-hidden="true">{open ? "Close" : "Menu"}</span>
              </button>
            </div>
          </div>
        </Container>
      </header>

      <MobileNav
        open={open}
        onClose={() => setOpen(false)}
        userEmail={userEmail}
        cartCount={cartCount}
        pathname={pathname}
      />
    </>
  );
}
