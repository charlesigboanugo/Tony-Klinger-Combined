import type { Metadata } from "next";

import { updateMarketingPreference } from "@/app/account/notifications/actions";
import { AccountHeader } from "@/components/account/AccountHeader";
import { IconTile } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { unsubscribedInBrevo } from "@/lib/email/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function Page() {
  const context = await requireUser("/account/notifications");

  // Read with the service role: the consent row may predate the account, having
  // been created from a newsletter signup before they registered, so it is
  // keyed on email rather than user_id and the customer's own policy would not
  // yet match it.
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_consents")
    .select("source,granted_at,withdrawn_at")
    .eq("email", (context.email ?? "").toLowerCase());

  const rows = data ?? [];
  let optedIn = rows.some((r) => !r.withdrawn_at);

  // Unsubscribed with the link in one of our emails: Brevo knows, our record
  // did not. Recorded here so the page tells the truth and the daily sync
  // stops trying to add them (owner, 2026-10-25).
  const unsubscribedByLink = optedIn && (await unsubscribedInBrevo(context.email ?? "")) === true;
  if (unsubscribedByLink) {
    await admin.rpc("withdraw_marketing_consent", { p_email: context.email ?? "" });
    optedIn = false;
  }

  return (
    <>
      <AccountHeader title="Notifications"
        description="What we send you, and when."
      />

      <div className="space-y-6">
        {/*
          The distinction is legal, not cosmetic. Service email is sent on the
          basis of the contract; marketing is not, and only the latter can be
          switched off. Presenting them as one setting would either promise to
          stop receipts we must send, or imply marketing cannot be refused.
        */}
        <section className="flex flex-col items-start gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
          <IconTile name="receipt" tone="success" size="lg" />
          <div className="w-full min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg">Service emails</h2>
              <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                Always on
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Order receipts, changes to your Coaching Pass, booking confirmations and
              security notices. These are part of your account and cannot be
              turned off while it is open.
            </p>
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
          <IconTile name="megaphone" tone={optedIn ? "accent" : "neutral"} size="lg" />
          <div className="w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg">News and offers</h2>
            <span
              className={
                "rounded-full border px-3 py-1 text-xs font-medium " +
                (optedIn
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground")
              }
            >
              {optedIn ? "Subscribed" : "Not subscribed"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Occasional news about coaching, courses, books and films.
          </p>

          <form action={updateMarketingPreference} className="mt-4">
            <input type="hidden" name="optIn" value={optedIn ? "false" : "true"} />
            <SubmitButton variant={optedIn ? "outline" : "primary"}>
              {optedIn ? "Unsubscribe" : "Subscribe"}
              {/* The card is titled "News and offers"; on a phone the short
                  label is enough, and the long one ran off the screen. */}
              <span className="hidden sm:inline">{optedIn ? "from news and offers" : "to news and offers"}</span>
            </SubmitButton>
          </form>

          {rows.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {optedIn
                ? `Recorded ${new Date(
                    rows.find((r) => !r.withdrawn_at)!.granted_at,
                  ).toLocaleDateString("en-GB")}.`
                : unsubscribedByLink
                  ? "You unsubscribed using the link in one of our emails. You will still receive service emails about your account."
                  : "You will still receive service emails about your account."}
            </p>
          ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
