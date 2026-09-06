"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminNavigation, isActive, isCurrentPage, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Admin workspace navigation — note 04 §14, §15, §24.
 *
 * Receives pre-filtered groups: the server decides what this operator may see.
 * Hiding an item is a usability decision; the route still enforces the
 * permission itself (note 06 §24).
 */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrentPage(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-(--radius) px-3 py-2 text-sm transition-colors",
                    isActive(pathname, item.href)
                      ? "bg-surface-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export { adminNavigation };
