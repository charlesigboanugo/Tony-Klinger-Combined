import "server-only";

import { requireServerEnv } from "@/lib/env/server";

/**
 * Email transport — note 09 §41, §41.1.
 *
 * THE BREVO ACCOUNT IS SHARED WITH A LIVE CLIENT PROJECT.
 *
 * That is a hard constraint, so it is enforced here in code rather than left to
 * whoever is running the app to remember:
 *
 *   1. Brevo is opt-in. Without EMAIL_TRANSPORT=brevo nothing reaches it, so a
 *      stray `pnpm dev` cannot email a real contact.
 *   2. Only the TRANSACTIONAL send endpoint is ever called. No contact, list,
 *      folder or template write API is reachable from this module — the
 *      client's lists and templates cannot be modified because the code has no
 *      path to them.
 *   3. Outside production, recipients must match EMAIL_ALLOWED_RECIPIENTS. An
 *      address that does not match is refused, not silently dropped.
 *
 * Local development uses Mailpit, which captures everything and sends nothing.
 */
export type EmailTransport = "mailpit" | "brevo" | "off";

export type OutboundEmail = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  /** Brevo template id, when sending a dashboard-managed template instead. */
  templateId?: number;
  params?: Record<string, unknown>;
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export function currentTransport(): EmailTransport {
  const value = process.env.EMAIL_TRANSPORT?.toLowerCase();
  if (value === "brevo" || value === "mailpit" || value === "off") return value;
  // Default is deliberately NOT brevo: an unconfigured environment must never
  // be able to email a real person.
  return process.env.NODE_ENV === "production" ? "off" : "mailpit";
}

/**
 * Recipients permitted outside production.
 *
 * Comma-separated addresses or @domain suffixes, e.g.
 *   EMAIL_ALLOWED_RECIPIENTS=@test.local,me@example.com
 */
function allowedRecipients(): string[] {
  return (process.env.EMAIL_ALLOWED_RECIPIENTS ?? "@test.local")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function recipientPermitted(to: string): boolean {
  if (process.env.NODE_ENV === "production") return true;

  const address = to.toLowerCase();
  return allowedRecipients().some((rule) =>
    rule.startsWith("@") ? address.endsWith(rule) : address === rule,
  );
}

/** Mailpit, via its HTTP send API. Captures locally; delivers nothing. */
async function sendViaMailpit(email: OutboundEmail): Promise<SendResult> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

  try {
    const response = await fetch(`${base}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: "no-reply@tonyklinger.local", Name: "Tony Klinger" },
        To: [{ Email: email.to, Name: email.toName ?? "" }],
        Subject: email.subject,
        HTML: email.html,
        Text: email.text,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `mailpit ${response.status}` };
    }

    const body = (await response.json().catch(() => ({}))) as { ID?: string };
    return { ok: true, providerMessageId: body.ID ?? "mailpit" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "mailpit failed" };
  }
}

/**
 * Brevo transactional send.
 *
 * ONLY /v3/smtp/email is called. Nothing in this module can create, modify or
 * delete a contact, list or template, so the shared production account's data
 * is untouchable from here.
 */
async function sendViaBrevo(email: OutboundEmail): Promise<SendResult> {
  // No default sender. Brevo only accepts a VERIFIED sender address, so an
  // invented fallback would be rejected for every message — a silent, per-send
  // failure that looks like an outage rather than a missing setting.
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    return {
      ok: false,
      error:
        "BREVO_SENDER_EMAIL is not set — it must be an address verified as a sender in the Brevo account",
    };
  }

  const sender = {
    email: senderEmail,
    name: process.env.BREVO_SENDER_NAME ?? "Tony Klinger",
  };

  const body: Record<string, unknown> = {
    sender,
    to: [{ email: email.to, ...(email.toName ? { name: email.toName } : {}) }],
  };

  if (email.templateId) {
    // Uses an existing dashboard template by id. Read-only: sending with a
    // template does not modify it.
    body.templateId = email.templateId;
    body.params = email.params ?? {};
  } else {
    body.subject = email.subject;
    body.htmlContent = email.html;
    body.textContent = email.text;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": requireServerEnv("BREVO_API_KEY"),
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Never log the API key or the full request body (note 09 §48).
      return { ok: false, error: `brevo ${response.status}: ${detail.slice(0, 200)}` };
    }

    const result = (await response.json()) as { messageId?: string };
    return { ok: true, providerMessageId: result.messageId ?? "brevo" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "brevo failed" };
  }
}

export async function deliver(email: OutboundEmail): Promise<SendResult> {
  const transport = currentTransport();

  if (transport === "off") {
    return { ok: false, error: "email transport disabled" };
  }

  if (!recipientPermitted(email.to)) {
    // Refused loudly rather than dropped quietly: a silent no-op here would
    // look like a delivery bug later.
    return {
      ok: false,
      error: `recipient ${email.to} not in EMAIL_ALLOWED_RECIPIENTS (non-production safety guard)`,
    };
  }

  return transport === "brevo" ? sendViaBrevo(email) : sendViaMailpit(email);
}
