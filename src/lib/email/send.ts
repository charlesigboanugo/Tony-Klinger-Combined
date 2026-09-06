import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { deliver } from "@/lib/email/transport";
import {
  brevoParams,
  render,
  templateIdFor,
  type TemplateName,
} from "@/lib/email/templates";

/**
 * Queue and delivery — note 09 §42, §47, §56.
 *
 * Business code calls `queueEmail` inside its own flow and moves on. Nothing
 * blocks on a provider, and a provider outage cannot fail a purchase: email is
 * not the source of truth for anything (note 09 §42).
 */
export async function queueEmail(params: {
  idempotencyKey: string;
  template: TemplateName;
  to: string;
  toName?: string | null;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("enqueue_email", {
    p_idempotency_key: params.idempotencyKey,
    p_template: params.template,
    p_to_email: params.to,
    p_payload: params.payload ?? {},
    p_to_name: params.toName ?? null,
  });

  if (error) {
    console.error("enqueue_email failed", { message: error.message });
    return false;
  }

  // null means this key was already queued — the correct outcome for a
  // redelivered webhook, not a failure.
  return data !== null;
}

export type DispatchResult = { claimed: number; sent: number; failed: number };

/**
 * Send whatever is due. Driven by Vercel Cron (note 09 §44).
 *
 * The batch is claimed with FOR UPDATE SKIP LOCKED, so two overlapping runs
 * split the work rather than sending the same message twice.
 */
export async function dispatchPendingEmails(limit = 20): Promise<DispatchResult> {
  const admin = createAdminClient();
  const result: DispatchResult = { claimed: 0, sent: 0, failed: 0 };

  const { data, error } = await admin.rpc("claim_email_batch", { p_limit: limit });
  if (error) throw new Error(`claim_email_batch failed: ${error.message}`);

  const batch = (data ?? []) as Array<{
    id: string;
    template: TemplateName;
    to_email: string;
    to_name: string | null;
    payload: Record<string, unknown>;
  }>;

  result.claimed = batch.length;

  for (const message of batch) {
    const payload = message.payload ?? {};
    const content = render(message.template, payload);

    // Template first, HTML fallback. The rendered HTML is ALWAYS supplied as
    // well, for two reasons: Mailpit cannot render a Brevo template, so local
    // development still shows real content; and a template later deleted in the
    // dashboard degrades to HTML rather than sending an empty message.
    const templateId = templateIdFor(message.template);

    const outcome = await deliver({
      to: message.to_email,
      toName: message.to_name,
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(templateId
        ? { templateId, params: brevoParams(message.template, payload) }
        : {}),
    });

    if (outcome.ok) {
      await admin.rpc("mark_email_sent", {
        p_id: message.id,
        p_provider_id: outcome.providerMessageId,
      });
      result.sent += 1;
    } else {
      // Retried with exponential backoff, abandoned after five attempts. The
      // row is kept either way, so a failure is visible rather than lost.
      await admin.rpc("mark_email_failed", { p_id: message.id, p_error: outcome.error });
      result.failed += 1;
    }
  }

  return result;
}
