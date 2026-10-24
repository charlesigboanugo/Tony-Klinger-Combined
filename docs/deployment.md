# Deployment

Operational checklist for `tonyklinger.com`. This is not architecture — the
canonical design lives in [architecture/](architecture/). This is what has to be
true before and after a deploy.

## Production launch checklist

Everything still to do before tonyklinger.com goes live, in order. The sections further down
hold the detail for each step. Things only Tony can supply (dates, prices, videos, decisions)
are in `TO-CONNECT.md` §3; this list is the technical setup.

### How the one-off setup is run (agreed 2026-10-16)

The setup splits three ways:

| Who / where | What |
|---|---|
| **The owner, in each dashboard** | Vercel environment variables, Supabase Auth settings, Stripe webhook and branding, Brevo sender, Cloudflare Turnstile, the domain. Keys are typed into the dashboards directly, never pasted into a chat. |
| **Claude, from this repository, once, using a temporary file** | Migrations, content, images, the first owner, the Stripe customer portal, and the first Stripe catalogue sync (so there is no wait for the hourly run). |
| **The live site, by itself** | Every scheduled job from then on, including the hourly `sync-stripe`. |

**The temporary file** is `.env.production.local` at the repository root. Git ignores every
`.env*` file, so it cannot be committed. The owner creates it and fills it in; Claude runs
the scripts against it and never opens, prints or searches it. It holds only:

```
SUPABASE_DB_URL=                  # production database connection string (Supabase → Connect), with the password
NEXT_PUBLIC_SUPABASE_URL=         # production project URL
SUPABASE_SERVICE_ROLE_KEY=        # production service key
STRIPE_SECRET_KEY=                # LIVE secret key, for the customer portal script only
NEXT_PUBLIC_SITE_URL=https://tonyklinger.com
CRON_SECRET=                      # the same value as on Vercel, to start the first Stripe sync
```

What runs against it, in order:

```bash
# 1. Migrations, 0001 to 0017
set -a; . ./.env.production.local; set +a; supabase db push --db-url "$SUPABASE_DB_URL"
# 2. Content (all twelve files) and 3. images
pnpm content:setup --env .env.production.local
pnpm images:import --env .env.production.local
# 4. Stripe customer portal: prints the id for STRIPE_PORTAL_CONFIGURATION_ID on Vercel
set -a; . ./.env.production.local; set +a; node scripts/stripe-portal-setup.mjs
# After the first deploy:
# 5. First Stripe catalogue sync, run BY THE LIVE SITE with its own Stripe key
set -a; . ./.env.production.local; set +a; curl -s -H "Authorization: Bearer $CRON_SECRET" https://tonyklinger.com/api/cron/sync-stripe
# 6. First owner, once Tony has signed up (SQL in step 2 below)
set -a; . ./.env.production.local; set +a; psql "$SUPABASE_DB_URL" -c "<the SQL>"
```

Then **delete the file the same day**. Optionally reset the database password and issue a
new service key in Supabase afterwards (and update Vercel), so nothing that existed in the
file still works. The Supabase CLI is never linked to the production project.

### 1. Accounts

- [ ] **Production Supabase project**, London (`eu-west-2`). The current hosted project
      (`TKOC-COMBINED-FREE`) is the TEST database and stays that way.
- [ ] **Vercel Pro.** The jobs that run every 5 and 15 minutes need it. Keep one Vercel
      project: Production environment → production Supabase, live Stripe, tonyklinger.com;
      Preview environment → the test Supabase.
- [ ] **Domain**: tonyklinger.com pointed at Vercel.

### 2. Database (production Supabase)

- [ ] Apply every migration, `0001` to `0017`, with `supabase db push --db-url` from the
      temporary file ([above](#how-the-one-off-setup-is-run-agreed-2026-10-16)). **Never
      link the production project to a local terminal**: a stray `db reset --linked` would
      destroy real data.
- [ ] Auth → URL Configuration: site URL and redirect allowlist ([below](#supabase-hosted-project)).
- [ ] Auth → Providers → Google.
- [ ] Auth → Rate limits: raise the email limit.
- [ ] Auth → Multi-factor → **App Authenticator (TOTP): enabled** (on by default). This is how
      staff do the second step on a hosted project: hosted Supabase refuses WebAuthn MFA, so
      leave `SECURITY_KEYS` unset on Vercel and the site offers authenticator apps only.
- [ ] Load the content: `pnpm content:setup --env <file>` (all twelve files, including
      `12_coaching_offer.sql`), then `pnpm images:import --env <file>`, both with
      `--env .env.production.local`.
- [ ] **First owner.** Tony signs up on the live site; then, once, through the temporary
      file's database connection or the production project's SQL editor (only an owner can
      grant the owner role in Admin, so the first one cannot be granted there):

      ```sql
      insert into public.user_roles (user_id, role_id)
      select u.id, r.id from auth.users u, public.roles r
      where u.email = '<tony''s email>' and r.name = 'owner';
      ```

      He then sets up his security keys, and grants staff roles in Admin from there.

### 3. Stripe (live mode)

- [ ] Webhook endpoint and its nine events ([below](#stripe)); secret into Vercel.
- [ ] Customer portal: `node scripts/stripe-portal-setup.mjs` with the temporary file loaded
      (live secret key, `NEXT_PUBLIC_SITE_URL=https://tonyklinger.com`); the printed id goes
      into `STRIPE_PORTAL_CONFIGURATION_ID` on Vercel.
- [ ] Dashboard → Settings: public business name (test mode shows "PACONETT"), logo, brand
      colour, support email and phone; Customer emails → turn on successful and failed
      payment emails.
- [ ] Straight after the first deploy, start `sync-stripe` once from here (the `curl` above,
      with the production `CRON_SECRET`) instead of waiting for the hourly run. The live site
      does the sync with the Stripe key held in Vercel and replies with what it created;
      check it reports no errors before taking orders.

### 4. Email (Brevo)

- [ ] Verify the sender address in Brevo.
- [ ] `EMAIL_TRANSPORT=brevo` on Production only. **Without it nothing is emailed**, on
      purpose ([below](#email-transport--read-before-the-first-production-deploy)).

### 5. Vercel environment variables (Production)

- [ ] Every variable in [Environment variables](#environment-variables), with production
      values. The site refuses to start, or the feature fails closed, when one is missing.

### 6. Scheduled jobs

- [ ] Rename `vercel.json.test` to `vercel.json` (it keeps the London region), so the ten
      jobs run. Until then no email is sent, no reminder goes and nothing is reconciled.

### 7. Contact form

- [ ] Cloudflare Turnstile widget with `tonyklinger.com` allowed; its two keys in Vercel.
      Without the secret the form refuses every message in production.

### 8. Not yet built — decide whether launch needs them

- [ ] Zoom personal join links (`TO-CONNECT.md` §1; needs Zoom Pro and its keys).
- [ ] Staff "Cancel ticket" for paid event tickets (now: in the database only).
- [ ] Collapsible admin menu on phones (if door staff check people in on phones).
- [ ] Checkout acknowledgement waiving the 14-day right, if courses should be
      non-refundable once started (now: the full right applies).
- [ ] Livid video for lessons: no video field on lessons and no protection on video links.
- [ ] Legal pages completed from Tony's details, then a legal read (`TO-CONNECT.md` §2).

### 9. After the deploy

- [ ] Work through [Post-deploy verification](#post-deploy-verification).
- [ ] **Delete `.env.production.local`.** Optionally reset the database password and service
      key in Supabase and update Vercel.

## Platform

| Concern | Where |
|---|---|
| Hosting, build, edge cache | Vercel |
| Database, Auth, RLS, Storage | Supabase (hosted project) |
| Payments | Stripe |
| Transactional email | Brevo |
| Video | Livid (domain-restricted embeds) |
| Scheduler | Vercel Cron → `/api/cron/[job]` |

**Function region: London (`lhr1`), set in `vercel.json`.** It must stay in the same region
as the Supabase project (`eu-west-2`, London). Vercel's default is Washington (`iad1`),
which made every per-request page cross the Atlantic for each database call. `vercel.json`
currently holds only the region; the cron schedules are in `vercel.json.test` (which also
carries the region) until crons are switched on — when renaming it, keep `regions`.

## Environment variables

Every one of these must exist on the Vercel project before the first deploy.
Anything missing fails closed rather than silently degrading — see
`src/lib/env/server.ts`.

### Public — sent to the browser, never secret

| Variable | Value in production |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tonyklinger.com` — no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | hosted project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | live publishable key (`pk_live_…`) |

`NEXT_PUBLIC_SUPABASE_URL` also drives `next/image`'s remote allowlist in
`next.config.ts`, so Storage images break if it is wrong.

### Secret — server only

| Variable | Notes |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | bypasses RLS; never expose to the client |
| `STRIPE_SECRET_KEY` | live key, not test |
| `STRIPE_WEBHOOK_SECRET` | from the **live** endpoint, not the CLI listener |
| `STRIPE_PORTAL_CONFIGURATION_ID` | from `scripts/stripe-portal-setup.mjs` run with the live key; without it the billing portal uses Stripe's default settings |
| `BREVO_API_KEY` | |
| `BREVO_SENDER_EMAIL` | must be a **verified sender** in Brevo |
| `BREVO_SENDER_NAME` | optional; defaults to "Tony Klinger" |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` |
| `EMAIL_TRANSPORT` | `brevo` in production |
| `SECURITY_KEYS` | leave **unset** (security keys off; staff use authenticator apps). `on` only once hosted Supabase allows WebAuthn MFA. Local `.env.local` has `on`. |

### Brevo template ids

Optional. Absent means the message renders from version-controlled HTML instead
(`src/lib/email/templates.ts`), which is a valid production configuration.

All 21 exist in the shared Brevo account (`pnpm brevo:templates`, 2026-10-24), so test and
production use the same ids: `WELCOME=21`, `ORDER_RECEIPT=22`, `MEMBERSHIP_ACTIVATED=23`,
`GUEST_CLAIM=24`, `BOOKING_CONFIRMED=25`, `BOOKING_CANCELLED=26`, `CONTACT_ENQUIRY=27`,
`EVENT_TICKET=29`, `EVENT_PLACE_AVAILABLE=30`, `EVENT_REMINDER=31`, `EVENT_STARTING=32`,
`SESSION_REMINDER=33`, `SESSION_STARTING=34`, `PASS_ENDING=35`,
`PRIVATE_COACHING_REBOOK=36`, `SECURITY_KEY_REMOVED=37`, `ACCOUNT_EXISTS=38`,
`RETREAT_APPLICATION_RECEIVED=39`, `RETREAT_APPLICATION_SENT=40`,
`RETREAT_APPLICATION_APPROVED=41`, `RETREAT_APPLICATION_CLOSED=42` (each prefixed
`BREVO_TEMPLATE_`). Lists: `BREVO_LIST_NEWSLETTER=9`, `BREVO_LIST_CUSTOMERS=10`,
`BREVO_LIST_MEMBERS=11`. Each template is the site's layout filled with the site's own
wording, so restyle it in Brevo but change words in `src/lib/email/templates.ts`. After
changing `src/lib/email/layout.mjs`, run `pnpm brevo:templates` again (same ids).

## Email transport — read before the first production deploy

The Brevo account is shared with a live client project, so `EMAIL_TRANSPORT`
fails closed: unset in production it resolves to `off` and sends nothing
(`src/lib/email/transport.ts`). **Email will silently not send until
`EMAIL_TRANSPORT=brevo` is set.** That is deliberate — the alternative is a
misconfigured preview deploy emailing real customers.

`EMAIL_ALLOWED_RECIPIENTS` only applies outside production. In production every
recipient is permitted.

## Supabase (hosted project)

1. Apply migrations: `supabase db push --linked`.
2. **Auth → URL Configuration**: site URL `https://tonyklinger.com`, and add
   `https://tonyklinger.com/auth/callback` to the redirect allowlist. A
   destination missing from that list does not error — Supabase falls back to
   the site URL, and the link lands on `/?code=…` looking like a broken email.
3. **Auth → Providers → Google**: same client id and secret; the authorised
   redirect URI at Google is the **Supabase** callback, not the app's.
4. **Auth → Rate limits**: raise the email limit. The default of 2/hour blocks
   magic-link sign-in after two attempts. `supabase/config.toml` covers local
   only; the hosted project is configured in the dashboard.
5. **Storage**: buckets are created by migrations (`0005`, `0015`), not by hand.
7. **Auth → Multi-factor → App Authenticator (TOTP)**: leave it enabled (the default). Staff
   use an authenticator app as the second step. Security keys can't be used on a hosted
   project: Supabase refuses WebAuthn MFA (`Enabling of MFA with WebAuthn not currently
   supported`, checked 2026-10-24). Keep `SECURITY_KEYS` unset on Vercel; set it to `on`
   only if Supabase starts allowing WebAuthn there.
6. **Auth → Email Templates → Invite user**: paste the body of
   `supabase/templates/invite.html`. `config.toml` sets it locally only. The hosted default
   links to GoTrue's own page, which puts the session where the callback cannot see it,
   so every invitation would look like a broken link.

## Stripe

1. Create the webhook endpoint at `https://tonyklinger.com/api/stripe/webhook`.
2. Subscribe to these nine events, the ones `src/app/api/stripe/webhook/route.ts` handles:
   `checkout.session.completed`, `checkout.session.expired` (frees a held private coaching
   time at once instead of after 35 minutes), `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`.
3. Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`. The CLI
   listener's secret is different and will reject every live event.

## Vercel Cron

`vercel.json.test` holds the schedules and becomes `vercel.json` for the production deploy;
the current `vercel.json` (test deploy) declares none. They are **not** available on the Hobby
plan at sub-daily frequency.

**On the test deploy (Hobby), GitHub Actions runs them instead:**
`.github/workflows/scheduled-jobs.yml` calls the same routes on the same schedules as the table
below. It is free only while the repository is public. It needs two repository secrets under
Settings → Secrets and variables → Actions: `SITE_URL` (the deploy's address) and
`CRON_SECRET` (the same value as on Vercel). It only runs from `main` once pushed; start
it by hand from the Actions tab ("Run workflow") to check it. GitHub can start a run a few minutes late. **Delete the workflow when renaming
`vercel.json.test`**, so the jobs are not run by both.

| Path | Schedule |
|---|---|
| `/api/cron/send-emails` | every 5 min |
| `/api/cron/reconcile-stripe` | every 15 min |
| `/api/cron/expire-entitlements` | hourly at :10 |
| `/api/cron/cleanup-tokens` | daily at 03:30 |
| `/api/cron/cleanup-uploads` | daily at 03:45 |
| `/api/cron/sync-audiences` | daily at 04:45 |
| `/api/cron/sync-stripe` | hourly at :20 |
| `/api/cron/event-reminders` | every 15 min |
| `/api/cron/session-reminders` | every 15 min, at :05/:20/:35/:50 |
| `/api/cron/pass-reminders` | daily at 09:00 |

Cron invocations arrive as **GET** and are **not retried**; delivery is best
effort. Every job is therefore idempotent and reconciliation-based.

## Post-deploy verification

- [ ] `/` renders; `/sitemap.xml` and `/robots.txt` return 200
- [ ] Response carries `X-Content-Type-Options`, `X-Frame-Options`,
      `Referrer-Policy`, `Strict-Transport-Security`
- [ ] Sign in with password, magic link and Google
- [ ] A staff account is challenged for its second factor
- [ ] A test purchase reaches `fulfil_order` and grants an entitlement
- [ ] Stripe dashboard shows the webhook returning 200
- [ ] One cron path returns 200 with a correct `Authorization` header, 401 without
- [ ] An email appears in Brevo's transactional log

## Brevo contact lists

| Variable | Value |
|---|---|
| `BREVO_LIST_NEWSLETTER` | 9 |
| `BREVO_LIST_CUSTOMERS` | 10 |
| `BREVO_LIST_MEMBERS` | 11 |

Contact syncing is gated on `EMAIL_TRANSPORT=brevo`, like sending, so no
non-production environment can write to the shared account.

**An unsubscribe in Brevo is final.** `src/lib/email/contacts.ts` reads a
contact's state before adding and skips anyone blacklisted; it never sends
`emailBlacklisted`. Do not add a code path that bypasses it — re-adding someone
who unsubscribed is a PECR breach, and the reconciler runs daily.

The consent RECORD lives in `public.marketing_consents`, not in Brevo. That is
what evidences what a person agreed to and when.

## Cloudflare Turnstile

The contact form needs both keys on Vercel:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public; identifies the widget |
| `TURNSTILE_SECRET_KEY` | secret; only this can verify a token |
| `CONTACT_NOTIFICATION_EMAIL` | where enquiries are announced |

Add `tonyklinger.com` to the widget's allowed hostnames in the Cloudflare
dashboard. **Verification fails closed in production**: without
`TURNSTILE_SECRET_KEY` every submission is refused, deliberately, so the form is
never live without its protection. In development a missing secret passes, so
the form stays testable.

## Images

**Stored images are WebP, not AVIF** (note 10 §47.3): Next's and Vercel's optimizers never
resize an AVIF source, so AVIF went to phones at full size. `pnpm images:import` converts
AVIF to WebP on upload. The local old-site archive (`current-website/`, not in git) was
itself converted to WebP on 2026-09-30, as were the committed `supabase/content/images`; each
converted file's original AVIF hash is kept in an `_origin-hashes.json` beside it
(`site-files/` in the archive, the images folder in the repo), which the import uses so
storage paths stay the same.
To convert images already in a project's storage:

```
node scripts/convert-stored-avif.mjs --env <env file>
```

`supabase db reset` wipes `storage.objects` AND the `resources` table, so images
cannot live in `seed.sql` — a seed cannot upload files. Restore them with:

```
pnpm images:import
```

It also relinks the five team photos, which `seed.sql` cannot: the team is seeded
before any resource rows exist, so their `photo_resource_id` starts null.

Idempotent: it dedupes by content hash before upload and upserts on
`storage_path`, so running it twice changes nothing.

**Covers are not assigned automatically, deliberately.** The source filenames
are meaningless (Facebook export ids, numbered PNGs) and the page-usage data
yields incidental images — inspection matched a radio presenter's portrait to a
novel and a stock photo to a film. Each `resources.title` records the original
filename and, for 97 of them, the page it appeared on; assignment is a human
act in `/admin/media`.

One file (`fab.png`, 15.5 MB) exceeds the `site-media` 15 MB limit and is
reported rather than skipped silently.

## Clearing a Stripe sandbox

`pnpm stripe:archive` archives every active product and price in a Stripe **test** sandbox and
clears the matching database's Stripe links, so the next sync builds a fresh catalogue, as for
a new project (owner, 2026-10-23). Local and the test deployment have separate sandboxes:

```
pnpm stripe:archive                           # local: key in .env.local, local database
pnpm stripe:archive --env .env.remote.local   # test deployment: its own sandbox key, test database
pnpm stripe:archive --unlinked                # only products no site product owns
```

It refuses any key that is not `sk_test_…` and any database but local or the test project
(`scripts/lib/targets.mjs`), and asks for a typed "yes". Stripe keeps paid-for products, so
archiving is the clean slate. Then `pnpm stripe:sync` locally, or the test site's hourly sync.

## Samples on the test deployment

`pnpm samples:test` puts the same sample dates and test accounts as `pnpm dev:samples` on the
**test** Supabase project, for Tony's team to test with (owner, 2026-10-23). Samples only add
dates to the real products (cohort intakes, retreat batches, series runs, coaching slots) plus
sample playlist videos, Q&A dates, one running event and the `@test.local` accounts.

It reads `.env.remote.local`, which needs one more line, typed in by the owner:

```
SAMPLE_ACCOUNT_PASSWORD=    # 8+ characters, not password123; give it only to the testers
```

The test database's address is built from the linked CLI's pooler address
(`supabase/.temp/pooler-url`) and `SUPABASE_DB_PASSWORD` in `.env.local`; a
`SUPABASE_DB_URL` line overrides it. `pnpm samples:test --check` connects and reports the
state without changing anything.

Safeguards: the script refuses any database that is not the test project (so it can never
reach production), refuses `password123` (the test site is public), and leaves the email queue
and staff-made sessions alone there. Run `supabase db push --linked` first so the schema is
current. Dates are relative to the moment it runs, so run it again before a testing round to
move them forward; `pnpm samples:test --remove` takes everything away.

Production never gets samples.

## Local development note

There is no cron on a dev machine, so **queued email stays `pending` until you
dispatch it**. A contact form submission that "does not arrive" in Mailpit is
almost always this, not a failure — check `public.email_messages` before
debugging anything else.

```
pnpm email:send
```

## Known outstanding

- **R25** — Give-Get-Go Documentaries has no catalogue category.
- **Livid video** — no video column on `lessons`, and the entitlement gate for
  video URLs is not built.
