"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { accountNavigation, isActive, isCurrentPage } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Account workspace navigation — note 04 §13, §32.2.
 *
 * Mirrors `AcademyNav` exactly: the active item carries the workspace's own
 * identity colour (here, `--primary` — Account's oxblood/red already IS the
 * site's primary colour, unlike Academy's teal which needed a separate
 * token) instead of the neutral grey every item previously used regardless
 * of which page was open.
 *
 * Exactly ONE item lights up, resolved by longest matching href rather than
 * checking each item against `isActive` independently. "/account" is a
 * URL-prefix of every other item here purely as a side effect of routing,
 * not because Overview is their parent — checked independently, Overview
 * would be flagged active on every single Account page.
 */
export function AccountNav() {
  const pathname = usePathname();

  const activeHref = accountNavigation
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Account">
      <ul className="space-y-0.5">
        {accountNavigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
              className={cn(
                "block rounded-(--radius) border-l-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                item.href === activeHref
                  ? "border-primary bg-primary/10 font-medium text-primary"
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
