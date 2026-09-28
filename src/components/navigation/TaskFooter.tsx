import Link from "next/link";

import { Container } from "@/components/layout/Container";

/**
 * The footer of a task area — booking and checkout (note 04 §18, §20, §33).
 *
 * Not the public footer: somebody mid-task needs the terms they are agreeing
 * to and a way to get help, not the whole site map.
 */
export function TaskFooter() {
  return (
    <footer className="border-t border-border">
      <Container>
        <nav
          aria-label="Help and legal"
          className="flex flex-wrap gap-x-5 gap-y-2 py-6 text-sm text-muted-foreground"
        >
          <Link href="/contact" className="transition-colors hover:text-accent">Need help?</Link>
          <Link href="/terms" className="transition-colors hover:text-accent">Terms</Link>
          <Link href="/privacy" className="transition-colors hover:text-accent">Privacy</Link>
        </nav>
      </Container>
    </footer>
  );
}
