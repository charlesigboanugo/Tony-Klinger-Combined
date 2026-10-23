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

- **Production setup** (database, live Stripe, email, environment variables, scheduled
  jobs, contact form): one ordered checklist in `docs/deployment.md` →
  "Production launch checklist". Everything technical for launch is there, not here.
- **Private coaching times:** add Tony's real available times under Admin → Coaching
  times, with the call link on each (or added later). Five sample times exist locally.
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

---

## 3. Coaching offer — decisions and material still needed from Tony

**Status:** the offer is built and working locally (2026-10-09; content file 12). These are the things only Tony can supply. Each is a small change once known.

| Needed | Where it goes | Until then |
|---|---|---|
| Virtual Retreat date | Admin → Retreats → "Starts" on each level | Levels show "date to be announced" and cannot be bought |
| Videos for the four playlists | Admin → Playlist videos | Playlists are empty; members see "No videos here yet" |
| Q&A dates and joining links | Admin → Q&A sessions | Gold and Platinum see "not scheduled yet" |
| Prices for the two video courses | Admin → Prices | They carry £199.50 / £399.50, which were the retreat levels' prices on the old site |
| Grace period after a failed renewal | `membership_grace_days()` (a one-line migration) | 7 days |
| Does Tony agree to "Coaching Pass" in place of "Membership"? His own site says membership | Decision | Renamed 2026-10-09 (owner); the old addresses redirect |
| Confirm the Coaching Pass prices for the year: Silver £160, Gold £280, Platinum £560 | Admin → Prices | These are the old site's yearly figures. Membership is one payment for twelve months and does not renew (owner, 2026-10-09); the monthly plan is off sale |
| A reminder email before a Coaching Pass ends | Built 2026-10-16: emailed a month and a week before the end (not to anyone who has already bought the next year). Change the timing if Tony prefers other points | — |
| How far ahead pass holders can register for a series | Admin → Series runs → Edit runs → "Pass holders can register from" | Seven days before registration opens to everyone |
| Each cohort's intake: its name, dates, when registration opens, places, and its eight workshops | Admin → Cohort intakes, then Admin → Workshops (set each workshop's intake) | A cohort with no intake shows "dates to be announced" and cannot be joined |
| Each series' run dates: first session, day and time, and when registration opens | Admin → Series runs → Create a run | A series with no run open for registration cannot be bought (£25 or £130), and members have nothing to register for |
| For each run, when registration for the full series closes and single sessions open | Admin → Series runs → Edit runs → "Series registration closes" | Left empty: when the series starts |
| Confirm the members' numbers: Silver 1, Gold 2, Platinum 4 series a year, counted from the day the membership began | Admin → Memberships → series allowance | Built that way (owner, 2026-10-09) |
| Platinum 25% renewal discount (old site, "for 2022") | Decision | Not offered |
| Does the Q&A have a limit on numbers; do members appear on screen? | Decision | One joining link for every Gold and Platinum member |
| Cover photos for the three retreat levels | Admin → Retreats → Cover image | Generated colour covers |
| The Deluxe bundles | Admin → Products → status "active" | Paused, so they cannot be bought. (Level Three and the two generic Group Coaching products were removed 2026-10-09; Level Three returns as a new course in Admin when it has a curriculum) |
| How the two brands are told apart on the site (Tony Klinger Coaching vs Online Coaching) | Design decision | Not separated |

**On the deployed test site**, after pushing the code:

1. `supabase db push` — applies any migrations the test database does not have yet
   (currently up to `0017`).
2. `pnpm content:setup --env <env file> --only 12_coaching_offer.sql` — loads the offer.
3. Run the `sync-stripe` job, so every product and price (retreats, Group Coaching single
   sessions and series, one-to-one packs, the yearly Coaching Pass prices) exists in Stripe.
   Until it runs, a price with no Stripe Price says "not available to buy just now" at
   checkout.
