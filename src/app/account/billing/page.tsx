import type { Metadata } from "next";
import Link from "next/link";

import { openBillingPortalAction, resumeMembershipAction } from "@/app/account/billing/actions";
import { CancelMembership } from "@/app/account/billing/CancelMembership";
import { AccountCard } from "@/components/account/AccountCard";
import { AccountHeader } from "@/components/account/AccountHeader";
import { StatusPill, SUBSCRIPTION_STATUS, statusOf, type PillTone } from "@/components/account/StatusPill";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { myCard, myMemberships, myPaymentHistory, type HistoryEntry } from "@/lib/account/billing";
import { formatDate } from "@/lib/account/format";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";
import { storedCustomerId } from "@/lib/stripe/customer";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };

/**
 * Billing — note 03 §24, note 09 §16.1, §17, migration 0021.
 *
 * Three questions, one card each, in the order people ask them:
 *
 *   Membership       what renews, when, and how to cancel or keep it
 *   Payment method   which card is charged, and changing it
 *   Billing history  every payment, with Stripe's receipt or invoice
 *
 * Cancelling and keeping a membership happen right here; changing the card
 * opens the Stripe Customer Portal at exactly that step, and "Manage in
 * Stripe" opens its home (where cancelling is also offered) — actions.ts. A membership bought as a lump sum has no
 * subscription, and the page says in words that nothing renews (note 09 §16.1).
 */

const NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  updated: { tone: "success", text: "Your billing details are updated. Changes can take a moment to appear here." },
  resumed: { tone: "success", text: "Your membership will carry on renewing as before." },
  cancelled: {
    tone: "success",
    text: "Your membership is cancelled. You keep full access until the date below, and nothing more will be charged.",
  },
  cancel: { tone: "error", text: "We couldn't cancel your membership just now. Please try again, or get in touch." },
  portal: { tone: "error", text: "We couldn't open billing management just now. Please try again in a moment." },
  resume: { tone: "error", text: "We couldn't restart your membership. Please try again, or get in touch." },
  subscription: { tone: "error", text: "That membership couldn't be found on your account." },
};

const HISTORY_STATUS: Record<HistoryEntry["status"], { label: string; tone: PillTone }> = {
  paid: { label: "Paid", tone: "good" },
  open: { label: "Due", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
  void: { label: "Void", tone: "neutral" },
};

const BRAND: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

const linkClass = "text-sm font-semibold text-primary underline-offset-4 hover:underline";

/** A form whose only job is one portal step, styled as a link or a button. */
function PortalButton({
  flow,
  children,
  variant = "link",
}: {
  flow: "home" | "payment_method";
  children: React.ReactNode;
  variant?: "link" | "outline" | "primary";
}) {
  return (
    <form action={openBillingPortalAction}>
      <input type="hidden" name="flow" value={flow} />
      {variant === "link" ? (
        <button type="submit" className={`${linkClass} cursor-pointer`}>
          {children} &rarr;
        </button>
      ) : (
        <SubmitButton size="sm" variant={variant} pendingLabel="Opening…">
          {children}
        </SubmitButton>
      )}
    </form>
  );
}

export default async function BillingPage({ searchParams }: PageProps<"/account/billing">) {
  const context = await requireUser("/account/billing");
  const params = await searchParams;

  const [memberships, card, history, customerId] = await Promise.all([
    myMemberships(),
    myCard(),
    myPaymentHistory(),
    storedCustomerId(context.userId),
  ]);

  const noticeKey = ["updated", "resumed", "cancelled"].find((k) => params[k] === "1") ?? (typeof params.error === "string" ? params.error : null);
  const notice = noticeKey ? NOTICES[noticeKey] : null;

  const live = memberships.filter((m) => ["active", "trialing", "past_due", "incomplete"].includes(m.status));
  const ended = memberships.filter((m) => !live.includes(m));

  return (
    <>
      <AccountHeader
        title="Billing"
        description="What renews, the card it's charged to, and every payment with its receipt."
        actions={customerId ? <PortalButton flow="home" variant="outline">Manage in Stripe</PortalButton> : null}
      />

      {notice ? (
        <div className="mb-6" role={notice.tone === "error" ? "alert" : "status"}>
          <FormMessage tone={notice.tone === "success" ? "success" : undefined}>{notice.text}</FormMessage>
        </div>
      ) : null}

      <div className="space-y-5">
        <AccountCard icon="star" id="membership" title="Membership" description="Recurring payments on your account.">
          {live.length === 0 ? (
            <div className="text-sm">
              <p className="font-medium">Nothing renews automatically</p>
              <p className="mt-1 text-muted-foreground">
                {ended.length > 0
                  ? "Your membership has ended and nothing more will be charged. "
                  : "You have no subscription. A membership bought as a single payment runs for its term and then simply ends — nothing is charged again. "}
                <Link href="/account/entitlements" className="font-medium text-primary underline-offset-4 hover:underline">
                  See when your access ends
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="space-y-6">
              {live.map((m) => {
                const tier = m.tier ? `${m.tier[0].toUpperCase()}${m.tier.slice(1)}` : "Membership";
                const status = m.cancelling
                  ? { label: "Cancelling", tone: "warn" as const }
                  : statusOf(SUBSCRIPTION_STATUS, m.status);
                const endsOn = m.cancelAt ?? m.periodEnd;
                return (
                  <li key={m.id} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-semibold">{tier} membership</p>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </div>

                    {m.status === "past_due" ? (
                      <p className="rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                        Your last payment didn&apos;t go through. Your access continues for now — update your card
                        and Stripe will try again.
                      </p>
                    ) : null}

                    <p className="text-sm text-muted-foreground">
                      {m.cancelling ? (
                        <>
                          Cancelled. You keep full access until{" "}
                          <span className="font-medium text-foreground">{endsOn ? formatDate(endsOn) : "the end of the period"}</span>
                          , and nothing more will be charged.
                        </>
                      ) : m.periodEnd ? (
                        <>
                          Renews on <span className="font-medium text-foreground">{formatDate(m.periodEnd)}</span>. Cancel
                          any time — you keep access until then.
                        </>
                      ) : (
                        "Renews automatically."
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      {m.cancelling ? (
                        <form action={resumeMembershipAction}>
                          <input type="hidden" name="subscription" value={m.id} />
                          <SubmitButton size="sm" pendingLabel="Restarting…">
                            Keep my membership
                          </SubmitButton>
                        </form>
                      ) : (
                        <>
                          {m.status === "past_due" ? (
                            <PortalButton flow="payment_method" variant="primary">
                              Update card
                            </PortalButton>
                          ) : null}
                          <CancelMembership
                            subscriptionId={m.id}
                            tierName={tier}
                            accessUntil={m.periodEnd ? formatDate(m.periodEnd) : null}
                          />
                        </>
                      )}
                      <Link href="/account/memberships" className={linkClass}>
                        What&apos;s included &rarr;
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AccountCard>

        <AccountCard icon="card" id="card" title="Payment method" description="The card your renewals are charged to.">
          {card === "unavailable" ? (
            <p className="text-sm text-muted-foreground">Card details can&apos;t be loaded just now. Please try again shortly.</p>
          ) : card ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-surface-muted text-[0.65rem] font-bold tracking-wider uppercase"
                >
                  {card.brand === "amex" ? "Amex" : (BRAND[card.brand] ?? card.brand).slice(0, 10)}
                </span>
                <div>
                  <p className="font-medium">
                    {BRAND[card.brand] ?? "Card"} ending {card.last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                  </p>
                </div>
              </div>
              <PortalButton flow="payment_method" variant="outline">
                Update card
              </PortalButton>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No card saved. You enter your card securely at checkout, and a card used for a membership appears here.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Card details are held by Stripe and never reach this site.
          </p>
        </AccountCard>

        <AccountCard icon="history" id="history" title="Billing history" description="Every payment, newest first, with its receipt.">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing paid yet. Receipts appear here as soon as a payment goes through.
            </p>
          ) : (
            <ul className="-my-3 divide-y divide-border">
              {history.map((h) => {
                const status = HISTORY_STATUS[h.status];
                return (
                  <li key={h.id} className="py-3 sm:flex sm:items-center sm:gap-6">
                    <div className="flex items-start justify-between gap-4 sm:flex-1 sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(h.date)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums">{formatPrice(h.amount, h.currency)}</span>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 whitespace-nowrap sm:mt-0 sm:w-36 sm:justify-end">
                      {h.receiptUrl ? (
                        <a href={h.receiptUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                          {h.status === "open" ? "Pay now" : "Receipt"}
                          <span className="sr-only"> (opens Stripe in a new tab)</span> &#8599;
                        </a>
                      ) : h.orderId ? (
                        <Link href={`/account/orders/${h.orderId}`} className={linkClass}>
                          Order &rarr;
                        </Link>
                      ) : null}
                      {h.pdfUrl ? (
                        <a href={h.pdfUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                          PDF<span className="sr-only"> invoice</span>
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {customerId ? (
            <div className="mt-5 border-t border-border pt-4">
              <PortalButton flow="home">Billing address and all invoices</PortalButton>
            </div>
          ) : null}
        </AccountCard>
      </div>
    </>
  );
}
