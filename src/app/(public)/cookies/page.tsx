import type { Metadata } from "next";

import { LegalDocument } from "@/components/content/LegalDocument";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Cookies",
  description: "The cookies tonyklinger.com uses, and what each is for.",
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
        <PageHeader title="Cookies" />
        <LegalDocument lastReviewed="September 2026">
          <p>
            Cookies are small files stored by your browser. We use as few as the
            site can work with, and we do not use them to build a profile of you.
          </p>

          <h2>What we use them for</h2>
          <dl>
            <dt>Signing in</dt>
            <dd>
              Keeps you signed in as you move between pages. Without it you
              would have to sign in again on every page, so it cannot be turned
              off while you are using an account.
            </dd>
            <dt>Your basket</dt>
            <dd>Remembers what you have added before you check out.</dd>
            <dt>Security</dt>
            <dd>
              Cloudflare Turnstile sets a cookie on the contact form to tell a
              person from an automated script.
            </dd>
            <dt>Payments</dt>
            <dd>
              Stripe sets cookies on its own payment pages to process your
              payment and detect fraud.
            </dd>
          </dl>

          <h2>Managing cookies</h2>
          <p>
            Your browser can block or delete cookies. Blocking them will stop you
            signing in or completing a purchase, because those depend on the
            cookies above.
          </p>
        </LegalDocument>
      </Container>
    </Section>
  );
}
