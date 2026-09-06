import Link from "next/link";

import { Container } from "@/components/layout/Container";

/** Booking — task-focused layout (note 04 §20, note 03 §31). */
export default function BookingsLayout({ children }: LayoutProps<"/bookings">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <Container>
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Tony Klinger
            </Link>
            <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
              Academy
            </Link>
          </div>
        </Container>
      </header>
      <main id="main" className="flex-1 py-10">
        <Container width="narrow">{children}</Container>
      </main>
    </div>
  );
}
