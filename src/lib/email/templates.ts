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
  | "contact_enquiry"
  | "event_ticket"
  | "event_place_available"
  | "event_reminder"
  | "event_starting"
  | "private_coaching_rebook"
  | "security_key_removed";

type Rendered = { subject: string; html: string; text: string };

const wrap = (title: string, body: string) => `
<!doctype html>
<html><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1E1B2E;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
${body}
<hr style="border:none;border-top:1px solid #DCD8E6;margin:32px 0 16px">
<p style="font-size:12px;color:#56506B;margin:0">Tony Klinger · <a href="${absoluteUrl("/")}" style="color:#56506B">tonyklinger.com</a></p>
</body></html>`.trim();

/** Event times are always UK time, whatever zone the server runs in. */
const ukWhen = (iso: unknown) =>
  iso
    ? new Date(String(iso)).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
      }) + " (UK time)"
    : "a date to be confirmed";

/** Event names are staff-entered, but still never trusted into HTML. */
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${label}</a></p>`;

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
            // UK time on every server (the events and sessions are UK-based).
            timeZone: "Europe/London",
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

    case "event_ticket": {
      const ticketUrl = absoluteUrl(`/account/tickets/${payload.bookingId}`);
      const online = payload.format === "online";
      return {
        subject: `Your ticket — ${payload.title ?? "event"}`,
        text: `Your place is confirmed.\n\n${payload.title}\n${ukWhen(payload.startsAt)}\n${payload.location ?? ""}\n\nTicket reference: ${payload.reference}\n\nYour ticket${online ? " and joining link" : ""}: ${ticketUrl}`,
        html: wrap(
          "Your place is confirmed",
          `<p><strong>${esc(payload.title)}</strong><br>${ukWhen(payload.startsAt)}${payload.location ? `<br>${esc(payload.location)}` : ""}</p>
           <p>Ticket reference<br><strong style="font-size:22px;letter-spacing:2px;font-family:ui-monospace,monospace">${esc(payload.reference)}</strong></p>
           <p>${online ? "Your joining link is on your ticket, and we will email it again before the start." : "Show the QR code on your ticket, or this reference, at the door."}</p>
           ${button(ticketUrl, "View your ticket")}`,
        ),
      };
    }

    case "event_place_available": {
      const eventUrl = absoluteUrl(`/events/${payload.slug}#register`);
      return {
        subject: `A place has opened — ${payload.title ?? "event"}`,
        text: `Good news: a place has opened for ${payload.title} on ${ukWhen(payload.startsAt)}.\n\nPlaces go to whoever takes them first: ${eventUrl}`,
        html: wrap(
          "A place has opened",
          `<p>You are on the waiting list for <strong>${esc(payload.title)}</strong>, ${ukWhen(payload.startsAt)}, and a place has just come free.</p>
           <p>It is not held for you: places go to whoever takes them first.</p>
           ${button(eventUrl, payload.isFree ? "Register now" : "Get your ticket")}`,
        ),
      };
    }

    case "event_reminder":
    case "event_starting": {
      const ticketUrl = absoluteUrl(`/account/tickets/${payload.bookingId}`);
      const soon = template === "event_starting";
      const join = payload.joinUrl ? String(payload.joinUrl) : null;
      const where = join
        ? `Join here: ${join}`
        : payload.venueAddress
          ? `Venue: ${payload.venueAddress}`
          : payload.location
            ? `Where: ${payload.location}`
            : "";
      return {
        subject: `${soon ? "Starting soon" : "Coming up"} — ${payload.title ?? "your event"}`,
        text: `${payload.title}\n${ukWhen(payload.startsAt)}\n${where}\n\nTicket reference: ${payload.reference}\n${ticketUrl}`,
        html: wrap(
          soon ? "Starting soon" : "See you soon",
          `<p><strong>${esc(payload.title)}</strong><br>${ukWhen(payload.startsAt)}</p>
           ${join ? button(join, "Join the event") : payload.venueAddress ? `<p>${esc(payload.venueAddress)}</p>` : payload.location ? `<p>${esc(payload.location)}</p>` : ""}
           ${payload.joiningNotes ? `<p>${esc(payload.joiningNotes)}</p>` : ""}
           <p>Ticket reference: <strong style="font-family:ui-monospace,monospace">${esc(payload.reference)}</strong> · <a href="${ticketUrl}">your ticket</a></p>`,
        ),
      };
    }

    case "booking_cancelled": {
      // `byUs`: staff cancelled the time (a private coaching slot), so the
      // session always comes back and the wording owns the change.
      const returned = payload.byUs
        ? "We're sorry — we've had to cancel this session. It has been returned to your account so you can choose another time."
        : payload.creditReturned
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

    case "security_key_removed": {
      // Migration 0022. Sent to the account's own address whenever a key is
      // removed, so a removal the owner did not make is noticed at once.
      const url = absoluteUrl("/account/security/mfa");
      const name = esc(payload.name ?? "A security key");
      const when = ukWhen(payload.at);
      return {
        subject: "A security key was removed from your account",
        text: `The security key "${payload.name ?? "unnamed"}" was removed from your Tony Klinger account on ${when}.\n\nIf this was you, there's nothing to do. If it wasn't, sign in, sign out your other devices and check your keys: ${url}`,
        html: wrap(
          "A security key was removed",
          `<p>The security key <strong>${name}</strong> was removed from your account on ${when}.</p>
           <p>If this was you, there's nothing to do.</p>
           <p>If it wasn't, sign in now, sign out your other devices and check your keys.</p>
           ${button(url, "Review your security keys")}`,
        ),
      };
    }

    case "private_coaching_rebook": {
      // Paid, but the held time went to someone else while checkout was open
      // (migration 0020). The payment is kept as a session to book again.
      const url = absoluteUrl("/academy/coaching");
      return {
        subject: `Choose a new time — ${payload.title ?? "private coaching"}`,
        text: `Thank you for your payment. The time you chose was taken by someone else before your payment completed, so your session is waiting in your account instead. Choose another time here: ${url}`,
        html: wrap(
          "Please choose a new time",
          `<p>Thank you for your payment for <strong>${payload.title ?? "private coaching"}</strong>.</p>
           <p>The time you chose was taken before your payment completed, so your session is waiting in your account. You won't be charged again.</p>
           <p><a href="${url}">Choose another time</a></p>`,
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
  event_ticket: "BREVO_TEMPLATE_EVENT_TICKET",
  event_place_available: "BREVO_TEMPLATE_EVENT_PLACE_AVAILABLE",
  event_reminder: "BREVO_TEMPLATE_EVENT_REMINDER",
  event_starting: "BREVO_TEMPLATE_EVENT_STARTING",
  private_coaching_rebook: "BREVO_TEMPLATE_PRIVATE_COACHING_REBOOK",
  security_key_removed: "BREVO_TEMPLATE_SECURITY_KEY_REMOVED",
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
        by_us: Boolean(payload.byUs),
        bookings_url: absoluteUrl("/account/bookings"),
      };

    case "private_coaching_rebook":
      return {
        title: String(payload.title ?? "Private coaching"),
        rebook_url: absoluteUrl("/academy/coaching"),
      };

    case "event_ticket":
    case "event_place_available":
    case "event_reminder":
    case "event_starting":
      return {
        title: String(payload.title ?? ""),
        starts_at: ukWhen(payload.startsAt),
        reference: String(payload.reference ?? ""),
        ticket_url: absoluteUrl(`/account/tickets/${payload.bookingId ?? ""}`),
        event_url: absoluteUrl(`/events/${payload.slug ?? ""}`),
        join_url: String(payload.joinUrl ?? ""),
        location: String(payload.venueAddress ?? payload.location ?? ""),
      };

    case "security_key_removed":
      return {
        key_name: String(payload.name ?? ""),
        removed_at: ukWhen(payload.at),
        security_url: absoluteUrl("/account/security/mfa"),
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
