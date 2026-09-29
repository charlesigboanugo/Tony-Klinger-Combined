# Deployment

Operational checklist for `tonyklinger.com`. This is not architecture — the
canonical design lives in [architecture/](architecture/). This is what has to be
true before and after a deploy.

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

`NEXT_PUBLIC_SUPABASE_URL` also drives `next/image`'s remote allowlist in
`next.config.ts`, so Storage images break if it is wrong.

### Secret — server only

| Variable | Notes |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | bypasses RLS; never expose to the client |
| `STRIPE_SECRET_KEY` | live key, not test |
| `STRIPE_WEBHOOK_SECRET` | from the **live** endpoint, not the CLI listener |
| `BREVO_API_KEY` | |
| `BREVO_SENDER_EMAIL` | must be a **verified sender** in Brevo |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` |
| `EMAIL_TRANSPORT` | `brevo` in production |

### Brevo template ids

Optional. Absent means the message renders from version-controlled HTML instead
(`src/lib/email/templates.ts`), which is a valid production configuration.

`BREVO_TEMPLATE_WELCOME=21`, `ORDER_RECEIPT=22`, `MEMBERSHIP_ACTIVATED=23`,
`GUEST_CLAIM=24`, `BOOKING_CONFIRMED=25`, `BOOKING_CANCELLED=26`.

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
5. **Storage**: buckets are created by migration `0019`, not by hand.

## Stripe

1. Create the webhook endpoint at `https://tonyklinger.com/api/stripe/webhook`.
2. Subscribe to `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
3. Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`. The CLI
   listener's secret is different and will reject every live event.

## Vercel Cron

`vercel.json` declares four schedules. They are **not** available on the Hobby
plan at sub-daily frequency.

| Path | Schedule |
|---|---|
| `/api/cron/send-emails` | every 5 min |
| `/api/cron/reconcile-stripe` | every 15 min |
| `/api/cron/expire-entitlements` | hourly at :10 |
| `/api/cron/cleanup-tokens` | daily at 03:30 |
| `/api/cron/sync-audiences` | daily at 04:45 |

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
