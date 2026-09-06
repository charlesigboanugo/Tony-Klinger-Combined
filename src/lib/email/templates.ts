import "server-only";

import { formatPrice } from "@/lib/commerce/pricing";
import { absoluteUrl } from "@/lib/urls";

/**
 * Transactional email content — note 09 §42.
 *
 * Rendered here rather than pulled from Brevo templates, so the messages this
 * project sends are version-controlled and cannot be changed by editing a
 * dashboard shared with another project.
 *
 * A Brevo template takes precedence when one is configured — see
 * `templateIdFor` at the foot of this file. The HTML below is the fallback, and
 * is always supplied alongside the template id, so a template that is later
 * deleted degrades to HTML rather than sending an empty message.
 */
export type TemplateName =
  | "welcome"
  | "order_receipt"
  | "membership_activated"
  | "guest_claim"
  | "booking_confirmed"
  | "booking_cancelled"
  | "contact_enquiry";

type Rendered = { subject: string; html: string; text: string };

const wrap = (title: string, body: string) => `
<!doctype html>
<html><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1E1B2E;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
${body}
<hr style="border:none;border-top:1px solid #DCD8E6;margin:32px 0 16px">
<p style="font-size:12px;color:#56506B;margin:0">Tony Klinger · <a href="${absoluteUrl("/")}" style="color:#56506B">tonyklinger.com</a></p>
</body></html>`.trim();

export function render(
  template: TemplateName,
  payload: Record<string, unknown>,
): Rendered {
  switch (template) {
    case "welcome": {
      // Sent once, at first successful sign-in — not at sign-up. Google and
      // magic-link accounts never receive a confirmation email, so without
      // this they would get nothing at all on joining.
      const name = String(payload.name ?? "there");
      return {
        subject: "Welcome to Tony Klinger",
        text: `Hello ${name},\n\nYour account is ready. Everything you buy is delivered in the Academy: ${absoluteUrl("/academy")}\n\nBrowsing is open to everyone — an account is only needed for what you buy.`,
        html: wrap(
          "Your account is ready",
          `<p>Hello ${name},</p>
           <p>Everything you buy is delivered in one place — courses, coaching sessions, cohort workshops and resources.</p>
           <p><a href="${absoluteUrl("/academy")}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Go to the Academy</a></p>
           <p style="font-size:13px;color:#56506B">Nothing is unlocked yet — access appears here as soon as you have it.</p>`,
        ),
      };
    }

    case "contact_enquiry": {
      // Sent to the site owner, never to the enquirer. The reply-to is not set
      // from the submitted address either: that value is unverified, and a
      // forged one turns a reply into a message to a stranger.
      const name = String(payload.name ?? "Someone");
      const from = String(payload.email ?? "unknown");
      const subject = String(payload.subject ?? "(no subject)");
      const message = String(payload.message ?? "");
      return {
        subject: `Contact form — ${subject}`,
        text: `From: ${name} <${from}>\nSubject: ${subject}\n\n${message}`,
        html: wrap(
          "New enquiry",
          `<p><strong>${name}</strong><br>${from}</p>
           <p><strong>${subject}</strong></p>
           <p style="white-space:pre-wrap">${message}</p>`,
        ),
      };
    }

    case "membership_activated": {
      const tier = String(payload.tier_name ?? "Membership");
      const renews = payload.renews_at
        ? new Date(String(payload.renews_at)).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })
        : null;
      return {
        subject: `Your ${tier} is active`,
        text: `Your ${tier} is now active.${renews ? ` It renews on ${renews}.` : ""}\n\nMembership tiers are cumulative — yours includes everything in the tiers below it.\n\n${absoluteUrl("/academy")}`,
        html: wrap(
          `Your ${tier} is active`,
          `<p>Your <strong>${tier}</strong> is now active.${renews ? ` It renews on ${renews}.` : ""}</p>
           <p>Membership tiers are cumulative, so yours includes everything in the tiers below it — not just the additions.</p>
           <p><a href="${absoluteUrl("/academy")}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open the Academy</a></p>
           <p style="font-size:13px;color:#56506B">Group coaching sessions still need booking — your access covers them, but a place is reserved separately.</p>`,
        ),
      };
    }

    case "order_receipt": {
      const total = formatPrice(
        Number(payload.total ?? 0),
        String(payload.currency ?? "GBP"),
      );
      return {
        subject: `Your order is confirmed — ${total}`,
        text: `Thank you. Your payment of ${total} has been received and your access is ready.\n\nView your order: ${absoluteUrl("/account/orders")}`,
        html: wrap(
          "Your order is confirmed",
          `<p>Thank you. Your payment of <strong>${total}</strong> has been received and your access is ready.</p>
           <p><a href="${absoluteUrl("/account/orders")}">View your order</a></p>`,
        ),
      };
    }

    case "guest_claim": {
      // The link IS the credential, so it goes only to the address that paid,
      // and the copy says plainly that it is single-use (note 05 §29.3).
      const url = String(payload.claimUrl ?? absoluteUrl("/account/claim"));
      return {
        subject: "Add your purchase to an account",
        text: `You bought as a guest. Use this one-time link to add the purchase to an account:\n\n${url}\n\nThe link expires in 72 hours and can only be used once. Your purchase is safe either way — nothing expires with the link.`,
        html: wrap(
          "Add your purchase to an account",
          `<p>You checked out as a guest. Use this one-time link to add the purchase to an account:</p>
           <p><a href="${url}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Claim your purchase</a></p>
           <p style="font-size:13px;color:#56506B">The link expires in 72 hours and can be used once. Your purchase is safe regardless — nothing expires with the link.</p>`,
        ),
      };
    }

    case "booking_confirmed": {
      const when = payload.startsAt
        ? new Date(String(payload.startsAt)).toLocaleString("en-GB", {
            weekday: "long", day: "numeric", month: "long",
            hour: "2-digit", minute: "2-digit",
          })
        : "a time to be confirmed";
      return {
        subject: `Booking confirmed — ${payload.title ?? "your session"}`,
        text: `Your place is booked for ${when}.\n\nManage your bookings: ${absoluteUrl("/account/bookings")}`,
        html: wrap(
          "Your place is booked",
          `<p><strong>${payload.title ?? "Your session"}</strong><br>${when}</p>
           <p><a href="${absoluteUrl("/account/bookings")}">Manage your bookings</a></p>`,
        ),
      };
    }

    case "booking_cancelled": {
      const returned = payload.creditReturned
        ? "Your session credit has been returned."
        : "This was too close to the start time for the credit to be returned.";
      return {
        subject: "Booking cancelled",
        text: `Your booking has been cancelled. ${returned}\n\n${absoluteUrl("/account/bookings")}`,
        html: wrap(
          "Booking cancelled",
          `<p>Your booking has been cancelled. ${returned}</p>
           <p><a href="${absoluteUrl("/account/bookings")}">Your bookings</a></p>`,
        ),
      };
    }
  }
}

/**
 * The Brevo template id for a message type, when one is configured.
 *
 * TEMPLATE FIRST, HTML FALLBACK. If the environment variable is absent the
 * message is rendered from `render()` above and sent as HTML instead. Resolved
 * per template rather than all-or-nothing, so templates can be moved to the
 * dashboard one at a time.
 *
 * Note this has no effect locally: the Mailpit transport cannot render a Brevo
 * template and always uses the HTML, so development shows real content
 * regardless of what is configured here.
 */
const TEMPLATE_ENV: Record<TemplateName, string> = {
  welcome: "BREVO_TEMPLATE_WELCOME",
  membership_activated: "BREVO_TEMPLATE_MEMBERSHIP_ACTIVATED",
  order_receipt: "BREVO_TEMPLATE_ORDER_RECEIPT",
  guest_claim: "BREVO_TEMPLATE_GUEST_CLAIM",
  booking_confirmed: "BREVO_TEMPLATE_BOOKING_CONFIRMED",
  booking_cancelled: "BREVO_TEMPLATE_BOOKING_CANCELLED",
  contact_enquiry: "BREVO_TEMPLATE_CONTACT_ENQUIRY",
};

export function templateIdFor(template: TemplateName): number | undefined {
  const raw = process.env[TEMPLATE_ENV[template]];
  if (!raw) return undefined;

  const id = Number(raw);
  // A non-numeric value would reach Brevo as garbage and fail for every message
  // of this type. Falling back to HTML delivers the email instead of losing it.
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Values a Brevo template can render.
 *
 * The outbox stores raw data (`total: 19900`), because formatting belongs at
 * render time. A dashboard template cannot format, so amounts and dates are
 * converted here into finished strings.
 *
 * The KEYS must match the variable names inside the Brevo template. A name that
 * does not match renders as empty and Brevo reports no error — so a mismatch
 * appears as a receipt with a blank total, not as a failure. Verify with a test
 * send before trusting a newly configured template.
 */
export function brevoParams(
  template: TemplateName,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  switch (template) {
    case "welcome":
      return {
        name: String(payload.name ?? "there"),
        academy_url: absoluteUrl("/academy"),
      };

    case "membership_activated":
      return {
        tier_name: String(payload.tier_name ?? "Membership"),
        renews_at: payload.renews_at
          ? new Date(String(payload.renews_at)).toLocaleDateString("en-GB")
          : "",
        academy_url: absoluteUrl("/academy"),
        benefits_url: absoluteUrl("/coaching/memberships"),
      };

    case "order_receipt":
      return {
        total: formatPrice(
          Number(payload.total ?? 0),
          String(payload.currency ?? "GBP"),
        ),
        orders_url: absoluteUrl("/account/orders"),
      };

    case "guest_claim":
      return {
        claim_url: String(payload.claimUrl ?? absoluteUrl("/account/claim")),
        expires_at: payload.expiresAt
          ? new Date(String(payload.expiresAt)).toLocaleString("en-GB")
          : "",
      };

    case "booking_confirmed":
      return {
        title: String(payload.title ?? "Your session"),
        starts_at: payload.startsAt
          ? new Date(String(payload.startsAt)).toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        bookings_url: absoluteUrl("/account/bookings"),
      };

    case "booking_cancelled":
      return {
        credit_returned: Boolean(payload.creditReturned),
        bookings_url: absoluteUrl("/account/bookings"),
      };

    case "contact_enquiry":
      return {
        name: String(payload.name ?? ""),
        email: String(payload.email ?? ""),
        subject: String(payload.subject ?? ""),
        message: String(payload.message ?? ""),
      };
  }
}
