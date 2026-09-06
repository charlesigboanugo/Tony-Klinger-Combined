import "server-only";

import Stripe from "stripe";

import { requireServerEnv } from "@/lib/env/server";

/**
 * Stripe client — note 09 §12, §13.
 *
 * Server-only. The secret key never reaches the browser (note 09 §49), which
 * is why this module imports `server-only`: pulling it into a Client Component
 * becomes a build error rather than a leak.
 *
 * The API version is pinned deliberately. Left unpinned, Stripe would upgrade
 * the account's default version underneath a running deployment and change
 * payload shapes without a code change.
 */
let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;

  cached = new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
    appInfo: { name: "Tony Klinger Platform" },
  });

  return cached;
}
