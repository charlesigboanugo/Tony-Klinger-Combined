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
  | "session_reminder"
  | "session_starting"
  | "pass_ending"
  | "private_coaching_rebook"
  | "security_key_removed"
  | "account_exists"
  | "retreat_application_received"
  | "retreat_application_sent"
  | "retreat_application_approved"
  | "retreat_application_closed";

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

/** A day, UK date, no time — for end dates. */
const ukDate = (iso: unknown) =>
  iso
    ? new Date(String(iso)).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
      })
    : "a date to be confirmed";

/** Where a coaching session opens in the Academy, by kind. */
const sessionPage = (payload: Record<string, unknown>) =>
  payload.kind === "workshop" && payload.groupSlug
    ? `/academy/cohorts/${payload.groupSlug}`
    : payload.kind === "qa"
      ? "/academy/pass"
      : "/academy/coaching";

/** The line above a session's title: what kind of session it is. */
const sessionKindLabel = (payload: Record<string, unknown>) => {
  const group = payload.groupName ? String(payload.groupName) : null;
  switch (payload.kind) {
    case "group":
      return group ? `Group Coaching · ${group}` : "Group Coaching";
    case "workshop":
      return group ? `Workshop · ${group}` : "Cohort workshop";
    case "qa":
      return "Live Q&A with Tony";
    case "retreat":
      return "Virtual Retreat";
    default:
      return "Private coaching";
  }
};

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

    case "retreat_application_received": {
      // To the site owner, like an enquiry: a new application to read and
      // answer under Admin → Retreat applications.
      return {
        subject: `Retreat application — ${String(payload.retreat ?? "")} (${String(payload.batch ?? "")})`,
        text: `${String(payload.name ?? "Someone")} <${String(payload.email ?? "")}> applied for ${String(payload.retreat ?? "")}, ${String(payload.batch ?? "")}.\n\n${String(payload.message ?? "")}\n\nRead and answer it: ${absoluteUrl("/admin/retreat-applications")}`,
        html: wrap(
          "New retreat application",
          `<p><strong>${esc(payload.name ?? "Someone")}</strong><br>${esc(payload.email)}</p>
           <p>For <strong>${esc(payload.retreat)}</strong>, ${esc(payload.batch)}.</p>
           <p style="white-space:pre-wrap">${esc(payload.message)}</p>
           ${button(absoluteUrl("/admin/retreat-applications"), "Open the applications")}`,
        ),
      };
    }

    case "retreat_application_sent": {
      // To the applicant (owner, 2026-10-23): until now they heard nothing
      // until a decision was made, and could not tell the application had gone.
      const url = absoluteUrl(`/coaching/retreats/${String(payload.slug ?? "")}`);
      return {
        subject: `We have your application for ${String(payload.retreat ?? "the retreat")}`,
        text: `Thank you for applying for ${String(payload.retreat ?? "")} (${String(payload.batch ?? "")}). Tony's team will read it and be in touch about a short interview. Once you are accepted you can book your place here: ${url}`,
        html: wrap(
          "We have your application",
          `<p>Thank you for applying for <strong>${esc(payload.retreat)}</strong>, ${esc(payload.batch)}.</p>
           <p>Tony's team will read it and be in touch about a short interview. Once you are accepted, you can book your place on the retreat's page.</p>
           ${button(url, "See the retreat")}`,
        ),
      };
    }

    case "retreat_application_approved": {
      const url = absoluteUrl(`/coaching/retreats/${String(payload.slug ?? "")}`);
      return {
        subject: `You are accepted for ${String(payload.retreat ?? "the retreat")}`,
        text: `Good news: your application for ${String(payload.retreat ?? "")} (${String(payload.batch ?? "")}) has been accepted. You can now book your place: ${url}`,
        html: wrap(
          "You are accepted",
          `<p>Good news: your application for <strong>${esc(payload.retreat)}</strong> (${esc(payload.batch)}) has been accepted.</p>
           <p>You can now book your place. Places are limited, so do not leave it long.</p>
           ${button(url, "Book your place")}`,
        ),
      };
    }

    case "retreat_application_closed": {
      // Declined and withdrawn alike: worded for either, since the next step
      // is the same — they can apply again. The staff note, when there is one,
      // is set apart so it reads as a personal line, not part of the form text.
      const url = absoluteUrl(`/coaching/retreats/${String(payload.slug ?? "")}`);
      const note = String(payload.note ?? "").trim();
      return {
        subject: `Your application for ${String(payload.retreat ?? "the retreat")}`,
        text: `Thank you for applying for ${String(payload.retreat ?? "")} (${String(payload.batch ?? "")}). Your application for these dates won't be going ahead.${note ? `\n\n${note}` : ""}\n\nYou're welcome to apply again for other dates, or get in touch if you'd like to talk it over: ${url}`,
        html: wrap(
          "Your retreat application",
          `<p>Thank you for applying for <strong>${esc(payload.retreat)}</strong> (${esc(payload.batch)}). Your application for these dates won't be going ahead.</p>
           ${note ? `<p style="white-space:pre-wrap;border-left:3px solid #a3162f;padding-left:12px">${esc(note)}</p>` : ""}
           <p>You're welcome to apply again for other dates, or <a href="${absoluteUrl("/contact")}">get in touch</a> if you'd like to talk it over.</p>
           ${button(url, "See the retreat")}`,
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
      const tier = String(payload.tier_name ?? "Coaching Pass");
      const renews = payload.renews_at
        ? new Date(String(payload.renews_at)).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })
        : null;
      return {
        subject: `Your ${tier} is active`,
        text: `Your ${tier} is now active.${renews ? ` It renews on ${renews}.` : ""}\n\nEverything it includes is in your Academy.\n\n${absoluteUrl("/academy")}`,
        html: wrap(
          `Your ${tier} is active`,
          `<p>Your <strong>${tier}</strong> is now active.${renews ? ` It renews on ${renews}.` : ""}</p>
           <p>Everything it includes is in your Academy.</p>
           <p><a href="${absoluteUrl("/academy")}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open the Academy</a></p>
           <p style="font-size:13px;color:#56506B">Register for a Group Coaching series in your Academy and your seat is kept in all eight sessions.</p>`,
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
      const items = payload.items ? esc(payload.items) : null;
      // After the link expires, signing in with this email still offers the
      // purchase (migration 0016), so the email says so rather than "contact us".
      const later =
        "If the link has expired, sign in or create an account with this email address and the purchase will be waiting for you to add.";
      if (payload.gift) {
        return {
          subject: "You've been given a gift",
          text: `Someone has bought you ${payload.items ? String(payload.items) : "a gift"} from Tony Klinger. Use this one-time link to set up your account and receive it:\n\n${url}\n\n${later}`,
          html: wrap(
            "You've been given a gift",
            `<p>Someone has bought you ${items ? `<strong>${items}</strong>` : "a gift"} from Tony Klinger.</p>
             <p>Set up your account and receive it with this one-time link:</p>
             <p><a href="${url}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Add my gift</a></p>
             <p style="font-size:13px;color:#56506B">${later}</p>`,
          ),
        };
      }
      return {
        subject: "Add your purchase to an account",
        text: `You bought as a guest. Use this one-time link to add the purchase to an account:\n\n${url}\n\nThe link expires in 72 hours and can only be used once. ${later}`,
        html: wrap(
          "Add your purchase to an account",
          `<p>You checked out as a guest. Use this one-time link to add the purchase to an account:</p>
           <p><a href="${url}" style="display:inline-block;background:#A8500A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Claim your purchase</a></p>
           <p style="font-size:13px;color:#56506B">The link expires in 72 hours and can be used once. ${later}</p>`,
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

    case "session_reminder":
    case "session_starting": {
      // Coaching sessions of every kind (migration 0017). Each opens from its
      // own page in the Academy, which is also where the link always is.
      const soon = template === "session_starting";
      const page = absoluteUrl(sessionPage(payload));
      const join = payload.joinUrl ? String(payload.joinUrl) : null;
      const what = sessionKindLabel(payload);
      const title = String(payload.title ?? "your session");
      return {
        subject: `${soon ? "Starting soon" : "Coming up"} — ${title}`,
        text: `${what}: ${title}\n${ukWhen(payload.startsAt)}\n${join ? `Join here: ${join}\n` : ""}\nIn your Academy: ${page}`,
        html: wrap(
          soon ? "Starting soon" : "See you soon",
          `<p>${esc(what)}<br><strong>${esc(title)}</strong><br>${ukWhen(payload.startsAt)}</p>
           ${join ? button(join, "Join the session") : `<p>The joining link will be in your Academy before the start.</p>`}
           ${payload.notes ? `<p style="white-space:pre-wrap">${esc(payload.notes)}</p>` : ""}
           <p><a href="${page}">Open it in your Academy</a></p>`,
        ),
      };
    }

    case "pass_ending": {
      // One payment for twelve months, no renewal (owner, 2026-10-09): this is
      // the only notice the holder gets before access stops.
      const tier = String(payload.tierName ?? "Coaching Pass");
      const ends = ukDate(payload.expiresAt);
      const url = absoluteUrl("/coaching/passes");
      return {
        subject: `Your ${tier} ends on ${ends}`,
        text: `Your ${tier} ends on ${ends}. After that, its Group Coaching, playlists and other benefits close. You can buy your next year now, and it starts when this one ends: ${url}`,
        html: wrap(
          "Your pass ends soon",
          `<p>Your <strong>${esc(tier)}</strong> ends on <strong>${ends}</strong>. After that, its Group Coaching, playlists and other benefits close.</p>
           <p>You can buy your next year now, and it starts when this one ends.</p>
           ${button(url, "Buy your next year")}`,
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
      // Migrations 0022/0023. Sent to the account's own address whenever a key
      // or authenticator app is removed, so a removal the owner did not make is
      // noticed at once. `kind` is the factor type ('totp' for an app).
      const url = absoluteUrl("/account/security/mfa");
      const what = payload.kind === "totp" ? "authenticator app" : "security key";
      const name = esc(payload.name ?? `A ${what}`);
      const when = ukWhen(payload.at);
      return {
        subject: `A${what === "authenticator app" ? "n" : ""} ${what} was removed from your account`,
        text: `The ${what} "${payload.name ?? "unnamed"}" was removed from your Tony Klinger account on ${when}.\n\nIf this was you, there's nothing to do. If it wasn't, sign in, sign out your other devices and check how you sign in: ${url}`,
        html: wrap(
          `A${what === "authenticator app" ? "n" : ""} ${what} was removed`,
          `<p>The ${what} <strong>${name}</strong> was removed from your account on ${when}.</p>
           <p>If this was you, there's nothing to do.</p>
           <p>If it wasn't, sign in now, sign out your other devices and check how you sign in.</p>
           ${button(url, "Review how you sign in")}`,
        ),
      };
    }

    case "account_exists": {
      // Someone tried to create an account with this address, which already has
      // one (owner, 2026-10-23). Said by email, never on screen, so the sign-up
      // page cannot be used to learn who has an account.
      const signIn = absoluteUrl("/auth/sign-in");
      const reset = absoluteUrl("/auth/forgot-password");
      return {
        subject: "You already have an account with Tony Klinger",
        text: `Someone, probably you, just tried to create an account with this email address. You already have one, so nothing new was created.\n\nSign in here: ${signIn}\nForgotten your password? Reset it here: ${reset}\n\nYou can also sign in with an email link, or with Google if it uses this address.\n\nIf this wasn't you, you can ignore this email. Your account has not changed.`,
        html: wrap(
          "You already have an account",
          `<p>Someone, probably you, just tried to create an account with this email address. You already have one, so nothing new was created.</p>
           ${button(signIn, "Sign in")}
           <p>Forgotten your password? <a href="${reset}">Reset it here</a>. You can also sign in with an email link, or with Google if it uses this address.</p>
           <p style="color:#56506B">If this wasn't you, you can ignore this email. Your account has not changed.</p>`,
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
  session_reminder: "BREVO_TEMPLATE_SESSION_REMINDER",
  session_starting: "BREVO_TEMPLATE_SESSION_STARTING",
  pass_ending: "BREVO_TEMPLATE_PASS_ENDING",
  private_coaching_rebook: "BREVO_TEMPLATE_PRIVATE_COACHING_REBOOK",
  security_key_removed: "BREVO_TEMPLATE_SECURITY_KEY_REMOVED",
  account_exists: "BREVO_TEMPLATE_ACCOUNT_EXISTS",
  retreat_application_received: "BREVO_TEMPLATE_RETREAT_APPLICATION_RECEIVED",
  retreat_application_sent: "BREVO_TEMPLATE_RETREAT_APPLICATION_SENT",
  retreat_application_approved: "BREVO_TEMPLATE_RETREAT_APPLICATION_APPROVED",
  retreat_application_closed: "BREVO_TEMPLATE_RETREAT_APPLICATION_CLOSED",
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
        tier_name: String(payload.tier_name ?? "Coaching Pass"),
        renews_at: payload.renews_at
          ? new Date(String(payload.renews_at)).toLocaleDateString("en-GB")
          : "",
        academy_url: absoluteUrl("/academy"),
        benefits_url: absoluteUrl("/coaching/passes"),
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

    case "session_reminder":
    case "session_starting":
      return {
        kind: sessionKindLabel(payload),
        title: String(payload.title ?? ""),
        starts_at: ukWhen(payload.startsAt),
        join_url: String(payload.joinUrl ?? ""),
        notes: String(payload.notes ?? ""),
        academy_url: absoluteUrl(sessionPage(payload)),
      };

    case "pass_ending":
      return {
        tier_name: String(payload.tierName ?? "Coaching Pass"),
        expires_at: ukDate(payload.expiresAt),
        passes_url: absoluteUrl("/coaching/passes"),
      };

    case "security_key_removed":
      return {
        key_name: String(payload.name ?? ""),
        removed_at: ukWhen(payload.at),
        security_url: absoluteUrl("/account/security/mfa"),
      };

    case "account_exists":
      return {
        sign_in_url: absoluteUrl("/auth/sign-in"),
        reset_url: absoluteUrl("/auth/forgot-password"),
      };

    case "retreat_application_received":
    case "retreat_application_sent":
    case "retreat_application_approved":
    case "retreat_application_closed":
      return {
        name: String(payload.name ?? ""),
        email: String(payload.email ?? ""),
        retreat: String(payload.retreat ?? ""),
        batch: String(payload.batch ?? ""),
        message: String(payload.message ?? ""),
        booking_url: absoluteUrl(`/coaching/retreats/${String(payload.slug ?? "")}`),
        admin_url: absoluteUrl("/admin/retreat-applications"),
        note: String(payload.note ?? ""),
        contact_url: absoluteUrl("/contact"),
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
