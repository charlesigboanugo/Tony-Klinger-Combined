import type { Metadata } from "next";
import Link from "next/link";

import { AccessRow } from "@/components/account/AccessRow";
import { AccountGroup, AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { ButtonLink } from "@/components/ui/Button";
import { groupBy } from "@/lib/utils/group";
import { myAccess } from "@/lib/account/access";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Your access", robots: { index: false } };

/**
 * The customer-facing entitlement view — R23, note 03 §24.
 *
 * Read-only and strictly this customer's own. Unrelated to /admin/entitlements,
 * which grants and revokes across all customers (note 06 §23.1).
 *
 * Every card names the actual course, event or series and carries the action
 * that uses it (see `myAccess`). The closing panel says what does NOT appear
 * here and where it lives instead — a membership, private coaching, a guest
 * purchase — because "I bought it and it isn't here" is the question this
 * page most needs to answer before it is asked.
 */
export default async function EntitlementsPage() {
  await requireUser("/account/entitlements");
  const access = await myAccess();

  const live = access.filter((a) => a.state === "active");
  const ended = access.filter((a) => a.state === "ended");

  return (
    <>
      <AccountHeader
        title="Your access"
        description="Everything you can use, how you got it, and when it ends."
      />

      <div className="space-y-14 sm:space-y-16">
        {live.length === 0 ? (
          <div className="rounded-(--radius-lg) border border-border bg-surface px-6 py-12 text-center">
            <p className="text-lg font-medium">No access yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              When you buy a course, cohort, Group Coaching series or event ticket, it appears
              here straight away, ready to open.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/coaching">Explore coaching</ButtonLink>
              <ButtonLink href="/events" variant="outline">
                See events
              </ButtonLink>
            </div>
          </div>
        ) : (
          <AccountSection title="Ready to use">
            <div className="space-y-14 sm:space-y-16">
              {groupBy(live, (item) => item.kind).map((g) => (
                <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                  <ul className="space-y-4">
                    {g.items.map((item) => (
                      <li key={item.id}>
                        <AccessRow item={item} showKind={false} />
                      </li>
                    ))}
                  </ul>
                </AccountGroup>
              ))}
            </div>
          </AccountSection>
        )}

        {ended.length > 0 ? (
          <AccountSection title="Finished">
            <div className="space-y-14 sm:space-y-16">
              {groupBy(ended, (item) => item.kind).map((g) => (
                <AccountGroup key={g.key} title={g.key} count={g.items.length}>
                  <ul className="space-y-4">
                    {g.items.map((item) => (
                      <li key={item.id}>
                        <AccessRow item={item} showKind={false} />
                      </li>
                    ))}
                  </ul>
                </AccountGroup>
              ))}
            </div>
          </AccountSection>
        ) : null}

        <AccountSection title="Not seeing something?">
          <dl className="grid gap-px overflow-hidden rounded-(--radius-lg) border border-border bg-border sm:grid-cols-2">
            {[
              {
                q: "A Coaching Pass",
                a: (
                  <>
                    Your pass is shown under{" "}
                    <Link href="/account/pass" className="font-medium text-primary underline-offset-4 hover:underline">
                      Coaching Pass
                    </Link>
                    , with the date it ends.
                  </>
                ),
              },
              {
                q: "One-to-one coaching",
                a: (
                  <>
                    A session you have paid for shows here with &ldquo;Choose a time&rdquo; until you book it. Once
                    booked it is under{" "}
                    <Link href="/account/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
                      Bookings
                    </Link>
                    , where you can also cancel it.
                  </>
                ),
              },
              {
                q: "A Group Coaching series or session",
                a: (
                  <>
                    Neither is booked: your place is kept when you pay, or when you register with your pass. Both are
                    in your{" "}
                    <Link href="/academy/coaching" className="font-medium text-primary underline-offset-4 hover:underline">
                      Academy
                    </Link>
                    , with their dates and joining links.
                  </>
                ),
              },
              {
                q: "Something bought without signing in",
                a: "Open the link in your receipt email while signed in here. That attaches the purchase to this account.",
              },
              {
                q: "Anything else",
                a: (
                  <>
                    Check{" "}
                    <Link href="/account/orders" className="font-medium text-primary underline-offset-4 hover:underline">
                      Orders
                    </Link>{" "}
                    to confirm the payment went through, or{" "}
                    <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                      contact us
                    </Link>{" "}
                    and we&apos;ll sort it out.
                  </>
                ),
              },
            ].map(({ q, a }) => (
              // An odd one out at the end takes the whole row, not half of it
              // beside an empty cell.
              <div key={q} className="bg-surface p-5 sm:last:odd:col-span-2">
                <div>
                  <dt className="text-sm font-semibold">{q}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{a}</dd>
                </div>
              </div>
            ))}
          </dl>
        </AccountSection>
      </div>
    </>
  );
}
