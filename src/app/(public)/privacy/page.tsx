import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/content/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How tonyklinger.com collects, uses and protects your information, and what you can ask us to do about it.",
};

/**
 * Legal page — note 03 §8.2. Flat at the top level rather than under /legal:
 * these URLs get linked from outside the application, so they stay short and
 * conventional.
 *
 * Every statement describes what this platform actually does: Stripe for
 * payment, Supabase for data, Brevo for email, Vercel for hosting, Turnstile
 * on the contact form, Google only when someone chooses "Continue with
 * Google", and the two consent routes in migration 0005 (newsletter opt-in,
 * customer soft opt-in). It still needs a legal read before launch — in
 * particular the data controller's legal name and address, which are not
 * recorded anywhere in this codebase and must not be guessed.
 */
export default function Page() {
  return (
    <LegalDocument
      current="/privacy"
      title="Privacy policy"
      intro="What we collect when you use tonyklinger.com, why, who helps us, and what you can ask us to do about it."
      lastReviewed="September 2026"
      summary={[
        "We collect what we need to run your account, your purchases and your bookings, and nothing to sell.",
        "Your card details go to Stripe and never reach this site.",
        "Receipts and booking emails always arrive; news and offers only if you want them, and you can stop them any time.",
        "You can ask to see, correct or delete what we hold about you.",
      ]}
      sections={[
        {
          id: "who-we-are",
          title: "Who we are",
          body: (
            <p>
              tonyklinger.com is run by Tony Klinger. When this policy says
              &ldquo;we&rdquo; or &ldquo;us&rdquo;, it means the team behind
              the site, which decides how your information is used. To reach us
              about anything in this policy, use the{" "}
              <Link href="/contact">contact page</Link>.
            </p>
          ),
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <p>
                <strong>What you give us.</strong> Your name and email address;
                the details you enter when you create an account, buy something,
                book a session, register for an event or send an enquiry; and
                anything you choose to add to your profile.
              </p>
              <p>
                <strong>What your purchases create.</strong> Orders, receipts,
                memberships, what you have access to, your bookings and event
                tickets (including when you checked in at an event), any
                waiting list you join, and your progress through courses, so
                the site can give you what you paid for.
              </p>
              <p>
                <strong>What is collected automatically.</strong> Your IP
                address, browser and device, and the pages you ask for, as part
                of serving the site and keeping it secure. We do not run
                advertising trackers or build a profile of you.
              </p>
            </>
          ),
        },
        {
          id: "why",
          title: "Why we use it",
          body: (
            <>
              <p>Each use has a lawful basis under UK data protection law:</p>
              <dl>
                <div><dt>Your account and purchases</dt><dd>To provide the service you signed up for or bought (contract).</dd></div>
                <div><dt>Service emails</dt><dd>Receipts, booking confirmations, membership changes and security notices (contract).</dd></div>
                <div><dt>Security</dt><dd>To keep accounts safe and the site free of abuse and spam (legitimate interests).</dd></div>
                <div><dt>Records</dt><dd>To keep the financial records the law requires (legal obligation).</dd></div>
                <div><dt>News and offers</dt><dd>Only where you have agreed, or, as a customer, about our own similar offers with a way to refuse in every message (consent, or soft opt-in).</dd></div>
              </dl>
            </>
          ),
        },
        {
          id: "email",
          title: "Service email and marketing are different",
          body: (
            <p>
              Receipts, booking confirmations and account notices are part of
              the service and keep arriving whether or not you take marketing.
              News and offers are separate: turn them off at any time in your
              account&apos;s notification settings, or through the unsubscribe
              link in every such email. We keep a record of when and how you
              agreed, so we can show it if asked.
            </p>
          ),
        },
        {
          id: "who-else",
          title: "Who else is involved",
          body: (
            <>
              <p>A few trusted services do part of the work for us, under contract and only on our instructions:</p>
              <dl>
                <div><dt>Stripe</dt><dd>Takes payments. Card details go to Stripe, not to us.</dd></div>
                <div><dt>Supabase</dt><dd>Stores your account and the content you have access to.</dd></div>
                <div><dt>Brevo</dt><dd>Sends our email.</dd></div>
                <div><dt>Vercel</dt><dd>Hosts the site.</dd></div>
                <div><dt>Cloudflare</dt><dd>Runs the security check on our contact form.</dd></div>
                <div><dt>Google</dt><dd>Only if you choose &ldquo;Continue with Google&rdquo; to sign in.</dd></div>
                <div><dt>Video players</dt><dd>Lesson and film videos are played by their hosts (Livid, Vimeo or YouTube, the last in its privacy-enhanced mode) once you press play.</dd></div>
              </dl>
              <p>
                Some of these providers may process data outside the UK. Where
                they do, they rely on the safeguards UK law requires, such as
                adequacy regulations or standard contractual clauses.
              </p>
              <p>
                <strong>We do not sell your information</strong>, and we do not
                share it for anyone else&apos;s marketing.
              </p>
            </>
          ),
        },
        {
          id: "how-long",
          title: "How long we keep it",
          body: (
            <p>
              Account, order and booking records are kept while your account is
              open, and afterwards for as long as we are required to keep
              financial records. Enquiries are kept while they are useful for
              helping you. Marketing consent records are kept for as long as we
              might need to show that you agreed.
            </p>
          ),
        },
        {
          id: "security",
          title: "Keeping it safe",
          body: (
            <p>
              Passwords are never stored in readable form, the site is served
              only over encrypted connections, and each account can reach only
              its own information. You can add a second sign-in step from your
              account&apos;s security page.
            </p>
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: (
            <>
              <p>You can ask us to:</p>
              <ul>
                <li>give you a copy of what we hold about you</li>
                <li>correct anything that is wrong</li>
                <li>delete your information, where we are not required to keep it</li>
                <li>stop or limit a use you object to, including all marketing</li>
                <li>hand your information to you in a portable format</li>
              </ul>
              <p>
                Write to us through the <Link href="/contact">contact page</Link>{" "}
                and we will reply within one month. If you are not happy with
                our answer, you can complain to the Information
                Commissioner&apos;s Office at <a href="https://ico.org.uk" rel="noopener noreferrer" target="_blank">ico.org.uk</a>.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              We may update this policy as the site changes. The date at the top
              shows when it was last reviewed.
            </p>
          ),
        },
      ]}
    />
  );
}
