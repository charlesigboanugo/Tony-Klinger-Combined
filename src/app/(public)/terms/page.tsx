import type { Metadata } from "next";

import { LegalDocument } from "@/components/content/LegalDocument";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when you use tonyklinger.com or buy through it.",
};

/**
 * Legal page — note 03 §8.2. Flat at the top level rather than under /legal:
 * these URLs get linked from outside the application, so they stay short and
 * conventional.
 *
 * The wording is drawn from the previous sites' own policies and adapted to
 * what this platform actually does — Stripe for payment, Supabase for data,
 * Brevo for email, Turnstile on the contact form. It still needs a legal read
 * before launch; it is no longer a placeholder saying so.
 */
export default function Page() {
  return (
    <Section>
      <Container width="narrow">
        <PageHeader title="Terms of service" />
        <LegalDocument lastReviewed="September 2026">
          <p>
            These terms apply when you use tonyklinger.com or buy anything
            through it.
          </p>

          <h2>Your account</h2>
          <p>
            You need an account to reach anything you have bought. Keep your
            sign-in details to yourself — access is personal to you and is not
            to be shared.
          </p>

          <h2>What you are buying</h2>
          <p>
            Each product page states what is included, what it costs and how it
            is delivered. Membership tiers are cumulative: a higher tier includes
            everything in the tiers below it.
          </p>
          <p>
            Membership gives you access to what your tier covers. It does not
            make every premium service free — where a service is covered you will
            not be charged again for it; where it is not, it is bought
            separately.
          </p>

          <h2>Access and booking are not the same</h2>
          <p>
            Buying access to a group coaching series entitles you to attend its
            sessions, but a place in a specific session is reserved separately by
            booking it. Sessions have limited capacity.
          </p>

          <h2>Payment</h2>
          <p>
            Prices are shown in pounds sterling and include VAT where it applies.
            Payments are taken by Stripe. Subscriptions renew automatically until
            cancelled, and you can cancel at any time from your account.
          </p>

          <h2>Cancellation and refunds</h2>
          <p>
            You have the statutory right to cancel a purchase of digital content
            within 14 days, unless you have started using it and agreed to waive
            that right. Live sessions cancelled at short notice may not return
            your session credit; the cancellation policy is shown when you book.
          </p>

          <h2>Content and copyright</h2>
          <p>
            Courses, recordings, worksheets and resources remain our property or
            our licensors&apos;. You may use them for your own learning. You may
            not copy, share, resell or republish them.
          </p>

          <h2>Conduct</h2>
          <p>
            Group sessions and cohorts depend on people being decent to one
            another. We may remove access, without refund, for behaviour that
            makes a session unsafe or unusable for others.
          </p>

          <h2>Availability</h2>
          <p>
            We aim to keep the service available but do not guarantee
            uninterrupted access. Scheduled sessions may occasionally be moved;
            we will tell you as early as we can.
          </p>

          <h2>Law</h2>
          <p>
            These terms are governed by the law of England and Wales.
          </p>
        </LegalDocument>
      </Container>
    </Section>
  );
}
