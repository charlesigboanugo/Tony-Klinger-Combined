import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { publicNavigation } from "@/lib/navigation";

/**
 * Coaching storefront — note 03 §9, note 04 §4.
 *
 * A secondary nav for the commercial section, inside the public layout. This is
 * discovery and purchase only; delivery lives in /academy (note 01 §4).
 */
export default function CoachingLayout({ children }: LayoutProps<"/coaching">) {
  const items =
    publicNavigation.find((i) => i.href === "/coaching")?.children ?? [];

  return (
    <>
      <div className="border-b border-border bg-surface">
        <Container>
          <nav aria-label="Coaching" className="-mx-1 flex gap-1 overflow-x-auto py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-(--radius) px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
      {children}
    </>
  );
}
