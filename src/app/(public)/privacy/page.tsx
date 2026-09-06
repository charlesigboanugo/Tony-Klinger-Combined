import type { Metadata } from "next";

import { LegalDocument } from "@/components/content/LegalDocument";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How tonyklinger.com collects, uses and protects your information.",
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
        <PageHeader title="Privacy policy" />
        <LegalDocument lastReviewed="September 2026">
          <p>
            This notice explains what we collect when you use tonyklinger.com,
            why we collect it, and what you can ask us to do about it.
          </p>

          <h2>What we collect</h2>
          <p>
            Information you give us directly: your name, email address, and the
            details you enter when you create an account, buy something, book a
            session or send an enquiry. Payment card details are entered on
            Stripe&apos;s own payment pages and never reach this site.
          </p>
          <p>
            Information collected automatically: your IP address, browser and
            device information, the pages you visit, and how long you spend on
            them. We use this to keep the service working and to understand
            which parts of it are useful.
          </p>

          <h2>Why we use it</h2>
          <ul>
            <li>To operate the service and give you what you have paid for</li>
            <li>To provide support and answer your enquiries</li>
            <li>To send service messages — receipts, booking confirmations, membership changes and security notices</li>
            <li>To send news and offers, where you have agreed to receive them</li>
            <li>To meet our legal obligations</li>
          </ul>

          <h2>Service email and marketing are different</h2>
          <p>
            Receipts, booking confirmations and account notices are part of the
            service you bought and continue whether or not you take marketing.
            News and offers are separate: you can turn them off at any time in
            your notification settings, or through the unsubscribe link in every
            such email.
          </p>

          <h2>Who else is involved</h2>
          <dl>
            <dt>Stripe</dt>
            <dd>Takes payments. Card details go to Stripe, not to us.</dd>
            <dt>Supabase</dt>
            <dd>Stores your account and the content you have access to.</dd>
            <dt>Brevo</dt>
            <dd>Sends our email.</dd>
            <dt>Vercel</dt>
            <dd>Hosts the site.</dd>
            <dt>Cloudflare</dt>
            <dd>Provides the security check on our contact form.</dd>
          </dl>
          <p>We do not sell your information, and we do not share it for anyone else&apos;s marketing.</p>

          <h2>How long we keep it</h2>
          <p>
            Account and order records are kept while your account is open and
            afterwards for as long as we are required to keep financial records.
            Contact enquiries are kept while they are useful for supporting you.
          </p>

          <h2>Your rights</h2>
          <p>
            You can ask for a copy of what we hold, ask us to correct it, ask us
            to delete it, or object to how we use it. Write to us using the
            contact page and we will respond within a month. If you are not
            satisfied you can complain to the Information Commissioner&apos;s
            Office.
          </p>

          <h2>Changes</h2>
          <p>
            We may update this notice. The date at the top tells you when it was
            last reviewed.
          </p>
        </LegalDocument>
      </Container>
    </Section>
  );
}
