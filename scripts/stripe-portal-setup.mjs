/**
 * Create the Stripe Customer Portal configuration this site uses — migration
 * 0021, note 09 §17.
 *
 * The portal is Stripe's hosted page for changing a card, downloading
 * invoices, updating billing details and cancelling a membership. Its
 * behaviour is set here, in code, rather than by clicking through the
 * dashboard, so test and live mode match and the settings are reviewable:
 *
 *   card changes          on
 *   invoice history       on
 *   billing details       name, address, phone, tax id — NOT email: the email
 *                         is the sign-in identity (see /account/profile)
 *   cancel                at the END of the paid period, with a reason asked;
 *                         access runs to the date already paid for (note 09 §16.1)
 *   plan switching        OFF — moving between tiers changes entitlements,
 *                         which the membership rules own, not Stripe
 *
 * Run once per mode (test keys locally, live keys for production), then put
 * the printed id in STRIPE_PORTAL_CONFIGURATION_ID:
 *
 *   node scripts/stripe-portal-setup.mjs            # reads .env.local
 *   STRIPE_SECRET_KEY=sk_live_… NEXT_PUBLIC_SITE_URL=https://tonyklinger.com \
 *     node scripts/stripe-portal-setup.mjs
 *
 * Re-running creates a new configuration; pass --update <bpc_…> to change an
 * existing one in place instead.
 */
import { existsSync, readFileSync } from "node:fs";

import Stripe from "stripe";

const fileEnv = existsSync(new URL("../.env.local", import.meta.url))
  ? Object.fromEntries(
      readFileSync(new URL("../.env.local", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const env = (k) => process.env[k] ?? fileEnv[k];

const key = env("STRIPE_SECRET_KEY");
const site = (env("NEXT_PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");
if (!key || !site) {
  console.error("STRIPE_SECRET_KEY and NEXT_PUBLIC_SITE_URL are required.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });

// Stripe requires https policy links; localhost pages cannot be linked from the
// portal, so a local run points at the production pages.
const policyBase = site.startsWith("https://") ? site : "https://tonyklinger.com";

const params = {
  business_profile: {
    headline: "Tony Klinger — manage your membership and payments",
    privacy_policy_url: `${policyBase}/privacy`,
    terms_of_service_url: `${policyBase}/terms`,
  },
  default_return_url: `${site}/account/billing`,
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["name", "address", "phone", "tax_id"] },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "unused", "missing_features", "switched_service", "other"],
      },
    },
    subscription_update: { enabled: false },
  },
};

const updateIndex = process.argv.indexOf("--update");
const existing = updateIndex > -1 ? process.argv[updateIndex + 1] : null;

const config = existing
  ? await stripe.billingPortal.configurations.update(existing, params)
  : await stripe.billingPortal.configurations.create(params);

console.log(`${existing ? "Updated" : "Created"} portal configuration (${key.startsWith("sk_live") ? "LIVE" : "test"} mode):`);
console.log(`STRIPE_PORTAL_CONFIGURATION_ID=${config.id}`);
