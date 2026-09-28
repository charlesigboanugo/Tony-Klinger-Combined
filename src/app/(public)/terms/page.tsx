import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/content/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when you use tonyklinger.com or buy through it.",
};

/**
 * Legal page — note 03 §8.2. Flat at the top level rather than under /legal:
 * these URLs get linked from outside the application, so they stay short and
 * conventional.
 *
 * Every rule stated here is one the platform enforces: cumulative tiers (note
 * 07), access vs booking (note 01 §11), the 24-hour credit return in
 * `cancel_booking` (migration 0003), recurring vs lump-sum membership (note 07
 * §31.1), free-event registration (migration 0017). Checkout does not yet
 * ask buyers to give up the 14-day cancellation right for digital content, so
 * that right is stated in full; add the acknowledgement at checkout before
 * narrowing it here. Memberships are cancelled by the customer from Account →
 * Billing (Stripe Customer Portal, at period end — migration 0021); private
 * coaching's 48-hour rule is `cancel_booking` (migration 0020). Still needs a
 * legal read before launch.
 */
export default function Page() {
  return (
    <LegalDocument
      current="/terms"
      title="Terms of service"
      intro="The terms that apply when you use tonyklinger.com or buy anything through it, in plain words."
      lastReviewed="September 2026"
      summary={[
        "Every product page says what is included, what it costs and how it is delivered, before you pay.",
        "Your account and what you buy are for you alone.",
        "Cancel a booked session at least 24 hours ahead and any credit it used comes back.",
        "The courses and recordings are for your own learning, not for sharing or resale.",
      ]}
      sections={[
        {
          id: "account",
          title: "Your account",
          body: (
            <p>
              You need an account to reach anything you have bought or booked.
              Keep your sign-in details to yourself: access is personal to you
              and is not to be shared. Tell us straight away if you think
              someone else has used your account.
            </p>
          ),
        },
        {
          id: "buying",
          title: "What you are buying",
          body: (
            <>
              <p>
                Each product page states what is included, what it costs and how
                it is delivered. Membership tiers are cumulative: a higher tier
                includes everything in the tiers below it.
              </p>
              <p>
                Membership gives you access to what your tier covers. It does not
                make every service free: where a service is covered you are not
                charged again for it; where it is not, it is bought separately.
              </p>
            </>
          ),
        },
        {
          id: "access-and-booking",
          title: "Access and booking are not the same",
          body: (
            <p>
              Access to a group coaching series lets you attend its sessions,
              but a place in a particular session is reserved by booking it,
              because sessions have limited places. The same goes for events:
              a free event still needs a registered place.
            </p>
          ),
        },
        {
          id: "payment",
          title: "Payment and renewal",
          body: (
            <>
              <p>
                Prices are in pounds sterling and include VAT where it applies.
                Payments are taken securely by Stripe.
              </p>
              <dl>
                <div><dt>Monthly or yearly</dt><dd>Renews automatically until you cancel. You keep access until the end of the period already paid for.</dd></div>
                <div><dt>One payment</dt><dd>Covers a fixed term, does not renew, and ends on its expiry date.</dd></div>
              </dl>
              <p>
                Cancel a renewing membership yourself at any time from{" "}
                <Link href="/account/billing">Account → Billing</Link>. It stops
                at the end of the period already paid for, you keep access until
                then, and nothing more is charged. You can change your mind and
                keep it at any point before that date.
              </p>
            </>
          ),
        },
        {
          id: "cancellation",
          title: "Cancellations and refunds",
          body: (
            <>
              <p>
                <strong>Your 14 days.</strong> You have the legal right to
                cancel an online purchase within 14 days of buying it and get
                your money back. <Link href="/contact">Get in touch</Link> to
                cancel, and we will refund you within 14 days of hearing from
                you.
              </p>
              <p>
                <strong>Booked sessions.</strong> Cancel from your bookings at
                least 24 hours before a group session starts and any credit it
                used is returned. Later than that, the place counts as used.
                Private coaching needs 48 hours: cancel at least 48 hours ahead
                and the session is returned to your account to rebook.
              </p>
              <p>
                <strong>If we cancel.</strong> If we have to cancel a session or
                event, we will offer another date or return your credit or
                payment.
              </p>
            </>
          ),
        },
        {
          id: "content",
          title: "Content and copyright",
          body: (
            <p>
              Courses, recordings, worksheets and resources belong to us or to
              the people who license them to us. You may use them for your own
              learning. You may not copy, share, resell or republish them.
            </p>
          ),
        },
        {
          id: "conduct",
          title: "Conduct",
          body: (
            <p>
              Group sessions, cohorts and events depend on people being decent
              to one another. We may remove access, without refund, for
              behaviour that makes a session unsafe or unusable for others.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Availability",
          body: (
            <p>
              We aim to keep the site available at all times but cannot
              promise uninterrupted access. A scheduled session or event may
              occasionally have to move; we will tell you as early as we can.
            </p>
          ),
        },
        {
          id: "law",
          title: "The law that applies",
          body: (
            <p>
              These terms are governed by the law of England and Wales. Nothing
              in them affects your statutory rights as a consumer.
            </p>
          ),
        },
      ]}
    />
  );
}
