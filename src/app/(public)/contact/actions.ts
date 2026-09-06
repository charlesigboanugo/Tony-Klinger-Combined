"use server";

import { headers } from "next/headers";

import { queueEmail } from "@/lib/email/send";
import { callerFingerprint, checkRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import { contactSchema, type ContactFormState } from "@/lib/validation/contact";

/**
 * Contact submission — note 03 §8, note 09 §42.
 *
 * THE ONLY PUBLIC, UNAUTHENTICATED ENDPOINT THAT SENDS EMAIL, so it carries its
 * own protection in a deliberate order — cheapest and most certain first, so an
 * abusive request is rejected before it costs anything:
 *
 *   1. Honeypot     free, no network call, catches naive bots
 *   2. Validation   free, rejects malformed input
 *   3. Rate limit   one indexed upsert; stops floods from one source
 *   4. Turnstile    an outbound HTTP call, so it goes last
 *
 * Verifying Turnstile first would mean a flood still costs one Cloudflare
 * round trip per request.
 */
export async function submitContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    subject: formData.get("subject")?.toString() ?? "",
    message: formData.get("message")?.toString() ?? "",
    website: formData.get("website")?.toString() ?? "",
  };

  // Echoed back on every failure path so a rejection never empties the form.
  const values = {
    name: raw.name,
    email: raw.email,
    subject: raw.subject,
    message: raw.message,
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    // The honeypot failing is a bot, not a person who mistyped. Answering with
    // the same success message a real submission gets means the script records
    // a delivery and moves on, rather than adapting.
    if (raw.website) {
      return { success: "Thank you — your message has been sent." };
    }
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const fingerprint = await callerFingerprint();

  // Two windows, because they stop different things. The burst limit blocks a
  // script hammering the form; the hourly limit blocks a slow drip that would
  // stay under it all day and still exhaust the email quota.
  const withinBurst = await checkRateLimit("contact", fingerprint, 3, 600);
  const withinHour = await checkRateLimit("contact", fingerprint, 10, 3600);

  if (!withinBurst || !withinHour) {
    return {
      error:
        "You have sent several messages already. Please wait a little while before sending another.",
      values,
    };
  }

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  const token = formData.get("cf-turnstile-response")?.toString() ?? null;
  const captcha = await verifyTurnstile(token, ip);

  // From here on the token is spent, whatever the outcome — Cloudflare accepts
  // each one only once. Every return below therefore reports it, so the widget
  // mints a replacement.
  if (!captcha.ok) {
    return {
      error:
        captcha.reason === "captcha_unreachable"
          ? "We could not complete the security check. Please try again in a moment."
          : captcha.reason === "captcha_missing"
            ? "The security check had not finished. Please wait a moment and try again."
            : "The security check did not pass. Please try again.",
      values,
      // A token that was never sent was never consumed, but the widget still
      // needs to produce one, so a reset is the right recovery either way.
      captchaSpent: true,
    };
  }

  const user = await getCurrentUser();

  // Service role: the table deliberately has no insert policy, so that a caller
  // cannot bypass the checks above by posting straight to the REST endpoint
  // with the anon key.
  const admin = createAdminClient();

  const { error } = await admin.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
    ip_hash: fingerprint,
    user_agent: headerList.get("user-agent")?.slice(0, 300) ?? null,
    user_id: user?.id ?? null,
  });

  if (error) {
    console.error("contact insert failed", { message: error.message });
    return {
      error: "We could not send your message. Please try again shortly.",
      values,
      captchaSpent: true,
    };
  }

  // THE ENQUIRY IS SAVED BEFORE ANY EMAIL IS QUEUED, and the email is queued
  // rather than sent. The database row is the record; email is a notification.
  // A Brevo outage must not lose an enquiry (note 09 §42).
  //
  // The notification goes to the SITE OWNER, never to the address typed into
  // the form — a form that emails arbitrary addresses is an open relay, and the
  // domain's sending reputation is what pays for it.
  const notify = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (notify) {
    await queueEmail({
      // One per submission. The row id makes a retry of this action idempotent.
      idempotencyKey: `contact:${fingerprint}:${Date.now()}`,
      template: "contact_enquiry",
      to: notify,
      payload: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || "(no subject)",
        message: parsed.data.message,
      },
    });
  }

  return {
    success:
      "Thank you — your message has been sent. We usually reply within a few working days.",
  };
}
