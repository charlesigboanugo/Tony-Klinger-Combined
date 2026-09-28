# To connect / to do

Things that are planned but waiting on the owner — an account, keys, a decision or
information. When one is ready, say "do the <name> item" and point at this file.

---

## 1. Zoom — a personal join link for every online-event ticket

**Status:** waiting on a Zoom account and keys. Nothing Zoom-specific is built yet.

**Why:** today an online event has ONE joining link (set on Admin → Check-in), shown to
every ticket holder. One person can forward it to many. With Zoom registration, each ticket
holder gets their own link into the same meeting, and a link cannot be used on two devices
at once.

### What you need to do first

1. **Zoom plan:** Zoom Workplace **Pro** or higher (registration is not available on the
   free plan). Pro: 100 people per meeting, meetings up to 30 hours,
   $16.99/month or $14.16/month billed yearly (US prices, checked 2026-09-26; the UK price
   shows on zoom.us/pricing from the UK, plus VAT). One licence covers daily sessions that
   do not overlap.
2. **Create a Server-to-Server OAuth app** in the Zoom App Marketplace, signed in as the
   Zoom account admin (free to create). Give it the scopes to create/update meetings and to
   add/remove meeting registrants.
3. **Send me its three keys:** Account ID, Client ID, Client Secret. They go into the
   server environment only (never the browser, never the repo).
4. In the Zoom account's meeting settings, confirm **"Allow registrants to join from
   multiple devices"** can be turned off (it is set per meeting; the site will set it, but
   the account must allow it).

### What I will build

- **Server-side Zoom client** using the Server-to-Server OAuth keys (token fetched and
  cached on the server).
- **Meeting created by the site:** saving an online or hybrid event in Admin → Events
  creates (or updates) its Zoom meeting with the right settings every time —
  registration on, "join from multiple devices" off, automatic approval, waiting room
  optional. The meeting ID is stored on the event. (Alternative if preferred: Tony creates
  the meeting in Zoom and pastes its ID.)
- **Personal link per ticket:** when a ticket is issued (free registration or paid
  checkout), the site registers that person with Zoom and stores the unique join link on
  their ticket. Their ticket page, reminder and "starting soon" emails show only their
  own link. The shared link field becomes a fallback for non-Zoom events.
- **Cancellation:** cancelling a ticket removes that person's registration in Zoom, so the
  link stops working.
- **Retries:** if Zoom is briefly unavailable, the registration is retried by a background
  job; the ticket still exists and the link appears once registered.
- **Capacity:** online events should have Places set to 100 or fewer on Zoom Pro (the
  101st person with a valid link would be refused by Zoom). The admin will warn about this.
- **Docs:** architecture notes 03, 08 and 09 and the README change log updated.

### Limits (even after this)

- Someone who has not joined yet could still pass their personal link to a friend; the
  Check-in attendee list vs. names in the Zoom meeting catches that.
- Nothing stops screen recording.

---

## 2. Other open items from 2026-09-26

- **Deploy the database updates:** migrations `0009_events_and_academy_delivery.sql` and
  `0010_coaching_billing_and_account_security.sql` are applied locally only.
- **Billing self-service (live Stripe):** done in code (migration 0021); to switch on in
  production:
  1. Deploy migration `0010_coaching_billing_and_account_security.sql`.
  2. Run `node scripts/stripe-portal-setup.mjs` with the LIVE secret key and
     `NEXT_PUBLIC_SITE_URL=https://tonyklinger.com`; put the printed id in the live
     `STRIPE_PORTAL_CONFIGURATION_ID`. (Test mode is already set up locally.)
  3. Subscribe the live webhook endpoint to `invoice.paid`, `invoice.payment_failed`,
     `invoice.finalized`, `invoice.voided`, `customer.subscription.created/updated/deleted`
     and `checkout.session.completed/expired`.
  4. In the Stripe dashboard: set the public business name (the portal and receipts show
     it — test mode currently says "PACONETT"), logo and brand colour, support email and
     phone, and turn on "Email customers about successful payments" and "failed payments"
     under Settings → Customer emails.
  5. Run the `sync-stripe` job once against live so every price has its Stripe Price.
- **Stripe webhook event (private coaching):** subscribe the live webhook endpoint to
  `checkout.session.expired` as well, so an abandoned payment frees its held time at once
  (otherwise it frees itself after 35 minutes). Local `stripe listen` already forwards it.
- **Private coaching times:** add Tony's real available times under Admin → Coaching
  times, with the call link on each (or added later). Five sample times exist locally.
- **Cron schedule:** the `event-reminders` job is listed in `vercel.json.test`; it runs
  only once that file is the live Vercel config.
- **Legal pages need the owner's details:** the business's legal name and structure,
  postal address, contact email, VAT number (if registered); whether sessions/events are
  recorded or photographed; refund position for coaching services already started; minimum
  age to buy; notice period before a membership price change. Then a legal read before
  launch.
- **14-day right for digital content:** checkout asks for no waiver, so the full right
  applies. Add a checkout acknowledgement first if courses should become non-refundable
  once started.
- **Staff "Cancel ticket" button** on the Check-in attendee list, for paid tickets
  (currently only possible directly in the database).
- **Admin menu on phones:** shown in full above the page; make it collapsible if door staff
  will use phones.
- **Local sample events:** still in the local database for review; remove when told.
