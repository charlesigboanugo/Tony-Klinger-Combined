import type { Metadata } from "next";

import { ContactForm } from "@/app/(public)/contact/ContactForm";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Tony Klinger.",
};

export default function ContactPage() {
  return (
    <Section>
      <Container width="narrow">
        <PageHeader
          title="Contact"
          description="For coaching enquiries, press, or anything else."
        />
        <div className="rounded-(--radius) border border-border bg-surface p-6 sm:p-8">
          {/* The site key is public by design — it identifies the widget, and
              only the secret key can verify a token. Read on the server so the
              form degrades cleanly when Turnstile is not configured. */}
          <ContactForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </div>
      </Container>
    </Section>
  );
}
