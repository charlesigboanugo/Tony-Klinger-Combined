import { headers } from "next/headers";
import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { AccountNav } from "@/components/account/AccountNav";
import { Container } from "@/components/layout/Container";
import { requireSession, requireUser } from "@/lib/permissions";

/**
 * Account layout — note 04 §13, §31, §32.2.
 *
 * Compact by design: the account area manages a relationship, it is not a
 * second workspace (note 01 §6). It still gets the same workspace chrome
 * Academy and Admin do — a colour strip, a sticky header whose brand column
 * anchors the sidebar's sticky offset, and a sidebar that scrolls
 * independently of the page beside it — because "compact" describes its
 * content, not a licence to skip the alignment rules every other workspace
 * follows.
 */
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  /*
    ONE PATH IS EXEMPT from the second-factor gate: the key management page.

    A staff account with no keys is sent there to enrol, and enrolling is the
    only way it can ever reach `aal2` — gating it would be a closed loop with no
    door. Everything else under /account asks for the factor, so a customer who
    registered a key is challenged rather than quietly let past it.

    The path comes from the proxy's own header (note 04 §32.1); a layout cannot
    otherwise see which page it is rendering.
  */
  const pathname = (await headers()).get("x-pathname") ?? "";
  const enrolling = pathname.startsWith("/account/security/mfa");

  const context = enrolling
    ? await requireSession("/account/security/mfa")
    : await requireUser("/account");

  return (
    <div className="flex min-h-svh flex-col">
      {/* A thin colour strip identifies the workspace — note 04 §32.2. Oxblood
          is Account's own identity colour, and it happens to be the site's
          `--primary` too (see AccountNav), unlike Academy's teal which
          needed a separate token from the site's red brand colour. */}
      <div aria-hidden="true" className="h-[3px] w-full bg-block-oxblood" />
      {/* Sticky, matching Academy's and Admin's headers (note 04 §16, §32.2)
          — the sidebar below sticks to a `top` offset measured from this
          header's height, which only stays correct if the header itself
          never scrolls out of view. */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <Container>
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-semibold tracking-tight">
                Tony Klinger
              </Link>
              <span className="rounded-full bg-block-oxblood px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-widest text-block-foreground uppercase">
                Account
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
                Academy
              </Link>
              {context.isStaff ? (
                <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
                  Admin
                </Link>
              ) : null}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-(--radius) border border-border px-3 py-1.5 text-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </Container>
      </header>

      <Container>
        {/*
          Sidebar and content scroll INDEPENDENTLY, same as Academy and Admin
          (note 04 §32.2/§32.3) — no drawn border pretending to be a
          separation. `lg:sticky` plus its own `overflow-y-auto` and a height
          capped to the viewport means the nav pins under the header and
          scrolls on its own only if it ever grows taller than the viewport.
        */}
        <div className="flex flex-col gap-8 py-8 lg:flex-row lg:items-start">
          <div className="lg:sticky lg:top-16.75 lg:h-[calc(100svh-4rem-3px)] lg:w-56 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain">
            <AccountNav />
          </div>
          <main id="main" className="min-w-0 flex-1">{children}</main>
        </div>
      </Container>
    </div>
  );
}
