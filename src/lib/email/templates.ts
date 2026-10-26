import "server-only";

import { formatPrice } from "@/lib/commerce/pricing";
import { button, details, layout, mono, note, quote } from "@/lib/email/layout.mjs";
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

/**
 * `title` and `body` are the parts the layout is filled with, kept so the same
 * wording can be handed to a Brevo template (`brevoParams`).
 */
type Rendered = { subject: string; html: string; text: string; title: string; body: string };

/** The layout (src/lib/email/layout.mjs) filled in, with its parts kept. */
const page = (title: string, body: string) => ({ title, body, html: layout(title, body, absoluteUrl("/")) });

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

/* The pieces every email is built from live in layout.mjs, shared with the
   Supabase sign-in emails (scripts/auth-email-templates.mjs). */

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
        ...page(
          "Your account is ready",
          `<p>Hello ${esc(name)},</p>
           <p>Everything you buy is delivered in one place — courses, coaching sessions, cohort workshops and resources.</p>
           ${button(absoluteUrl("/academy"), "Go to the Academy")}
           ${note("Nothing is unlocked yet — access appears here as soon as you have it.")}`,
        ),
      };
    }

    case "retreat_application_received": {
      // To the site owner, like an enquiry: a new application to read and
      // answer under Admin → Retreat applications.
      return {
        subject: `Retreat application — ${String(payload.retreat ?? "")} (${String(payload.batch ?? "")})`,
        text: `${String(payload.name ?? "Someone")} <${String(payload.email ?? "")}> applied for ${String(payload.retreat ?? "")}, ${String(payload.batch ?? "")}.\n\n${String(payload.message ?? "")}\n\nRead and answer it: ${absoluteUrl("/admin/retreat-applications")}`,
        ...page(
          "New retreat application",
          `${details([
            ["From", `${esc(payload.name ?? "Someone")}<br><span style="font-weight:400">${esc(payload.email)}</span>`],
            ["Retreat", esc(payload.retreat)],
            ["Dates", esc(payload.batch)],
          ])}
           ${payload.message ? quote(esc(payload.message)) : ""}
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
        ...page(
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
        ...page(
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
        ...page(
          "Your retreat application",
          `<p>Thank you for applying for <strong>${esc(payload.retreat)}</strong> (${esc(payload.batch)}). Your application for these dates won't be going ahead.</p>
           ${note ? quote(esc(note)) : ""}
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
        ...page(
          "New enquiry",
          // Everything here was typed by a visitor, so all of it is escaped.
          `${details([
            ["From", `${esc(name)}<br><span style="font-weight:400">${esc(from)}</span>`],
            ["Subject", esc(subject)],
          ])}
           ${quote(esc(message))}
           ${button(absoluteUrl("/admin/enquiries"), "Open the enquiries")}`,
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
        ...page(
          `Your ${tier} is active`,
          `<p>Your <strong>${tier}</strong> is now active.${renews ? ` It renews on ${renews}.` : ""}</p>
           <p>Everything it includes is in your Academy.</p>
           ${button(absoluteUrl("/academy"), "Open the Academy")}
           ${note("Register for a Group Coaching series in your Academy and your seat is kept in all eight sessions.")}`,
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
        ...page(
          "Your order is confirmed",
          `<p style="margin-top:0">Thank you. Your payment has been received and your access is ready.</p>
           ${details([["Amount paid", total]])}
           ${button(absoluteUrl("/account/orders"), "View your order")}`,
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
          ...page(
            "You've been given a gift",
            `<p>Someone has bought you ${items ? `<strong>${items}</strong>` : "a gift"} from Tony Klinger.</p>
             <p>Set up your account and receive it with this one-time link:</p>
             ${button(url, "Add my gift")}
             ${note(later)}`,
          ),
        };
      }
      return {
        subject: "Add your purchase to an account",
        text: `You bought as a guest. Use this one-time link to add the purchase to an account:\n\n${url}\n\nThe link expires in 72 hours and can only be used once. ${later}`,
        ...page(
          "Add your purchase to an account",
          `<p>You checked out as a guest. Use this one-time link to add the purchase to an account:</p>
           ${button(url, "Claim your purchase")}
           ${note(`The link expires in 72 hours and can be used once. ${later}`)}`,
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
        ...page(
          "Your place is booked",
          `${details([
            ["Session", esc(payload.title ?? "Your session")],
            ["When", `${when} (UK time)`],
          ])}
           ${button(absoluteUrl("/account/bookings"), "Manage your bookings")}`,
        ),
      };
    }

    case "event_ticket": {
      const ticketUrl = absoluteUrl(`/account/tickets/${payload.bookingId}`);
      const online = payload.format === "online";
      return {
        subject: `Your ticket — ${payload.title ?? "event"}`,
        text: `Your place is confirmed.\n\n${payload.title}\n${ukWhen(payload.startsAt)}\n${payload.location ?? ""}\n\nTicket reference: ${payload.reference}\n\nYour ticket${online ? " and joining link" : ""}: ${ticketUrl}`,
        ...page(
          "Your place is confirmed",
          `${details([
            ["Event", esc(payload.title)],
            ["When", ukWhen(payload.startsAt)],
            payload.location ? ["Where", esc(payload.location)] : null,
            ["Ticket reference", `<span style="font-size:20px">${mono(esc(payload.reference))}</span>`],
          ])}
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
        ...page(
          "A place has opened",
          `<p style="margin-top:0">You are on the waiting list, and a place has just come free.</p>
           ${details([
            ["Event", esc(payload.title)],
            ["When", ukWhen(payload.startsAt)],
          ])}
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
        ...page(
          soon ? "Starting soon" : "See you soon",
          `${details([
            ["Event", esc(payload.title)],
            ["When", ukWhen(payload.startsAt)],
            !join && payload.venueAddress ? ["Venue", esc(payload.venueAddress)] : !join && payload.location ? ["Where", esc(payload.location)] : null,
            ["Ticket reference", mono(esc(payload.reference))],
          ])}
           ${payload.joiningNotes ? `<p>${esc(payload.joiningNotes)}</p>` : ""}
           ${join ? button(join, "Join the event") : button(ticketUrl, "View your ticket")}
           ${join ? note(`Your ticket is <a href="${ticketUrl}">here</a>.`) : ""}`,
        ),
      };
    }

    case "session_reminder":
    case "session_starting": {
      // Coaching sessions of every kind (migration 0017). Each opens from its
      // own page in the Academy, which is also where the link always is.
      const soon = template === "session_starting";
      const sessionUrl = absoluteUrl(sessionPage(payload));
      const join = payload.joinUrl ? String(payload.joinUrl) : null;
      const what = sessionKindLabel(payload);
      const title = String(payload.title ?? "your session");
      return {
        subject: `${soon ? "Starting soon" : "Coming up"} — ${title}`,
        text: `${what}: ${title}\n${ukWhen(payload.startsAt)}\n${join ? `Join here: ${join}\n` : ""}\nIn your Academy: ${sessionUrl}`,
        ...page(
          soon ? "Starting soon" : "See you soon",
          `${details([
            [esc(what), esc(title)],
            ["When", ukWhen(payload.startsAt)],
          ])}
           ${payload.notes ? quote(esc(payload.notes)) : ""}
           ${join ? button(join, "Join the session") : `<p>The joining link will be in your Academy before the start.</p>${button(sessionUrl, "Open it in your Academy")}`}
           ${join ? note(`It's also in <a href="${sessionUrl}">your Academy</a>.`) : ""}`,
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
        ...page(
          "Your pass ends soon",
          `${details([
            ["Your pass", esc(tier)],
            ["Ends on", ends],
          ])}
           <p>After that, its Group Coaching, playlists and other benefits close.</p>
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
        ...page(
          "Booking cancelled",
          `<p>Your booking has been cancelled. ${returned}</p>
           ${button(absoluteUrl("/account/bookings"), "Your bookings")}`,
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
        ...page(
          `A${what === "authenticator app" ? "n" : ""} ${what} was removed`,
          `${details([
            ["Removed", `${name}<br><span style="font-weight:400">${what === "authenticator app" ? "Authenticator app" : "Security key"}</span>`],
            ["When", when],
          ])}
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
        ...page(
          "You already have an account",
          `<p>Someone, probably you, just tried to create an account with this email address. You already have one, so nothing new was created.</p>
           ${button(signIn, "Sign in")}
           <p>Forgotten your password? <a href="${reset}">Reset it here</a>. You can also sign in with an email link, or with Google if it uses this address.</p>
           ${note("If this wasn't you, you can ignore this email. Your account has not changed.")}`,
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
        ...page(
          "Please choose a new time",
          `<p>Thank you for your payment for <strong>${esc(payload.title ?? "private coaching")}</strong>.</p>
           <p>The time you chose was taken before your payment completed, so your session is waiting in your account. You won't be charged again.</p>
           ${button(url, "Choose another time")}`,
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
 * What a Brevo template is filled with — the same wording the site would send
 * itself (owner, 2026-10-24).
 *
 * Every Brevo template is the shared layout with these four slots
 * (`BREVO_TEMPLATE`, created by `pnpm brevo:templates`), so the dashboard holds
 * the look and the site holds the words: a template can be restyled in Brevo
 * without the copy there going stale. This replaced per-template variables,
 * which had to be kept in step with the copy here by hand and had drifted.
 */
export function brevoParams(content: Rendered): Record<string, string> {
  return {
    subject: content.subject,
    title: content.title,
    body: content.body,
    site_url: absoluteUrl("/"),
  };
}
