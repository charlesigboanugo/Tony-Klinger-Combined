"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { academyNavigation, isActive, isCurrentPage } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Academy workspace navigation — note 04 §9, §11, §16.1.
 *
 * The active state carries the workspace's own colour (teal, matching the 3px
 * strip above the header) rather than the same neutral grey every other
 * workspace's active nav item uses. Before this, Academy's, Account's and
 * Admin's sidebars were visually interchangeable but for a 3px line most
 * people never look at — this is the difference that is actually visible
 * while using the thing, not just in a screenshot of the header.
 *
 * Exactly ONE item lights up, resolved by longest matching href rather than
 * checking each item against `isActive` independently. `isActive` does prefix
 * matching so a section stays highlighted on its nested pages (the right
 * behaviour in `NavDropdown`, where items genuinely nest) — but these are flat
 * siblings, and "/academy" is a URL-prefix of every other item here purely as
 * a side effect of routing, not because Dashboard is their parent. Checked
 * independently, Dashboard was flagged active on every single Academy page.
 */
export function AcademyNav() {
  const pathname = usePathname();

  const activeHref = academyNavigation
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Academy">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {academyNavigation.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
              className={cn(
                "block rounded-(--radius) border-l-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                item.href === activeHref
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
