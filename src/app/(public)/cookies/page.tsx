import type { Metadata } from "next";

import { LegalDocument } from "@/components/content/LegalDocument";

export const metadata: Metadata = {
  title: "Cookies",
  description: "The cookies tonyklinger.com uses, and what each is for.",
};

/**
 * Legal page — note 03 §8.2. Flat at the top level rather than under /legal:
 * these URLs get linked from outside the application, so they stay short and
 * conventional.
 *
 * WHY THERE IS NO CONSENT BANNER (2026-09-26, owner asked). UK PECR needs
 * consent only for storage that is not strictly necessary for a service the
 * visitor asked for. Everything this site stores is: the Supabase sign-in
 * cookies, the `tk_cart` basket cookie (30 days, lib/commerce/cart.ts), the
 * Turnstile check on the contact form, and the `tk-newsletter` browser-storage
 * note that stops the newsletter prompt reappearing (a choice the visitor
 * made). There are no analytics or advertising tags, and video players load
 * only when pressed, from privacy modes (youtube-nocookie, Vimeo with dnt=1;
 * lib/academy/video.ts). ADDING ANALYTICS, ADS OR A NON-PRIVACY EMBED CHANGES
 * THIS: a consent banner would then be required before it loads.
 */
export default function Page() {
  return (
    <LegalDocument
      current="/cookies"
      title="Cookies"
      intro="The few small files this site stores in your browser, and what each one does."
      lastReviewed="September 2026"
      summary={[
        "We only store what the site needs to work: keeping you signed in, your basket, and spam protection.",
        "No advertising cookies, no analytics, and nothing that follows you around the web.",
      ]}
      sections={[
        {
          id: "what-we-store",
          title: "What we store",
          body: (
            <dl>
              <div>
                <dt>Signing in</dt>
                <dd>
                  Keeps you signed in as you move between pages, until you sign
                  out. Without it you would be asked to sign in on every page.
                </dd>
              </div>
              <div>
                <dt>Your basket</dt>
                <dd>Remembers what you have added before you check out, for up to 30 days.</dd>
              </div>
              <div>
                <dt>Spam protection</dt>
                <dd>Cloudflare Turnstile checks that a person, not a script, is using the contact form.</dd>
              </div>
              <div>
                <dt>Newsletter prompt</dt>
                <dd>
                  A note in your browser&apos;s storage, so the invitation to
                  join the newsletter does not keep reappearing once you have
                  closed it or signed up.
                </dd>
              </div>
            </dl>
          ),
        },
        {
          id: "others",
          title: "Other people's cookies",
          body: (
            <>
              <p>
                <strong>Payments.</strong> When you pay, you are on
                Stripe&apos;s own payment page, and Stripe sets the cookies it
                needs to process the payment and prevent fraud.
              </p>
              <p>
                <strong>Videos.</strong> Films and lessons load their player
                only when you press play, and use a privacy-enhanced mode
                where the provider offers one (such as YouTube&apos;s
                no-cookie player).
              </p>
              <p>
                <strong>Signing in with Google.</strong> If you choose it, you
                sign in on Google&apos;s own page, under Google&apos;s cookie
                policy.
              </p>
            </>
          ),
        },
        {
          id: "managing",
          title: "Managing cookies",
          body: (
            <p>
              Your browser can block or delete cookies at any time. Blocking
              them will stop you signing in or completing a purchase, because
              those depend on the cookies above.
            </p>
          ),
        },
      ]}
    />
  );
}
