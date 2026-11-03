"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

/**
 * A link that, for a place on the same page ("#buy"), scrolls there on EVERY
 * click (owner, 2026-11-03: the phone buy bar must always take you to "What
 * it costs", even if tapped before). A link to the address already in the bar
 * does nothing in the browser, so the second tap went nowhere. Any other link
 * (straight to checkout) is an ordinary link.
 */
export function JumpLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  if (!href.startsWith("#")) return <Link href={href} onClick={onClick} {...rest} />;

  const jump = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const target = document.getElementById(href.slice(1));
    if (event.defaultPrevented || !target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The target's own scroll-margin keeps it clear of the sticky header.
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}${href}`);
  };

  return <a href={href} onClick={jump} {...(rest as ComponentProps<"a">)} />;
}
