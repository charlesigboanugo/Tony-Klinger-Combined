"use server";

import { headers } from "next/headers";

import { addToList } from "@/lib/email/contacts";
import { callerFingerprint, checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import {
  NEWSLETTER_CONSENT_TEXT,
  newsletterSchema,
  type NewsletterFormState,
} from "@/lib/validation/newsletter";

/**
 * Newsletter opt-in — UK GDPR, PECR reg 22.
 *
 * EXPLICIT OPT-IN, not soft opt-in: there is no sale here, so no exemption
 * applies. The tickbox is unticked in the markup and required by the schema,
 * because a pre-ticked box is not consent.
 *
 * No Turnstile. A newsletter box is low-value to abuse and high-friction to
 * gate, and adding a challenge to a one-field form costs real signups. The
 * honeypot and the rate limiter carry it instead.
 *
 * THE CONSENT RECORD IS WRITTEN BEFORE BREVO IS TOLD ANYTHING. Our database is
 * the evidence; the list is only a sending audience. If Brevo is unreachable,
 * the consent still stands and the reconciliation job adds them later.
 */
export async function subscribeAction(
  _prev: NewsletterFormState,
  formData: FormData,
): Promise<NewsletterFormState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    consent: formData.get("consent")?.toString() ?? "",
    website: formData.get("website")?.toString() ?? "",
  });

  if (!parsed.success) {
    // A filled honeypot is a bot. Same answer a person gets, so the script
    // records a delivery and stops adapting.
    if (formData.get("website")?.toString()) {
      return { success: "Thank you — please check your inbox." };
    }
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const fingerprint = await callerFingerprint();
  if (!(await checkRateLimit("newsletter", fingerprint, 5, 3600))) {
    return { error: "Too many attempts. Please try again later." };
  }

  const user = await getCurrentUser();
  const headerList = await headers();
  const admin = createAdminClient();

  const { error } = await admin.rpc("record_marketing_consent", {
    p_email: parsed.data.email,
    p_source: "newsletter_form",
    p_consent_text: NEWSLETTER_CONSENT_TEXT,
    p_consent_url: headerList.get("referer") ?? null,
    p_user_id: user?.id ?? null,
  });

  if (error) {
    console.error("consent record failed", { message: error.message });
    return { error: "We could not sign you up just now. Please try again shortly." };
  }

  // Best effort, and deliberately not awaited into the result: a Brevo outage
  // must not tell somebody their signup failed when their consent is recorded.
  const sync = await addToList("newsletter", parsed.data.email);
  if (!sync.ok) {
    console.error("newsletter list sync failed", { error: sync.error });
  }

  return {
    success:
      "Thank you — you are on the list. Every email has an unsubscribe link, and you can leave at any time.",
  };
}
