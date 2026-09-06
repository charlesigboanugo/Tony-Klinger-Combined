import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { NewsletterSignup } from "@/components/content/NewsletterSignup";
import { footerNavigation, publicNavigation } from "@/lib/navigation";

/** Public footer — note 04 §8. Carries the legal routes (note 03 §8.2). */
export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container>
        {/*
          The newsletter is the footer's one ACTION, so it gets a row of its
          own rather than a narrow column pinned to the left edge. Prompt on
          the left, form on the right — the conventional shape, and the one
          that stops the form looking like an afterthought.

          It appears here on EVERY page, which is why no page carries a second
          inline copy: asking twice on one screen reads as nagging.
        */}
        <div className="border-b border-border py-12">
          <NewsletterSignup variant="footer" />
        </div>

        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-base font-semibold">Tony Klinger</p>
            <p className="text-sm text-muted-foreground">
              Film producer, author and coach.
            </p>
          </div>

          <nav aria-label="Explore">
            <p className="mb-3 text-sm font-medium">Explore</p>
            <ul className="space-y-2">
              {publicNavigation.slice(1).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="More">
            <p className="mb-3 text-sm font-medium">More</p>
            <ul className="space-y-2">
              {footerNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="mb-3 text-sm font-medium">Account</p>
            <ul className="space-y-2">
              <li>
                <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
                  Academy
                </Link>
              </li>
              <li>
                <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">
                  Your account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border py-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Tony Klinger. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
