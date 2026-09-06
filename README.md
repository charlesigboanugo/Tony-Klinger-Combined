# Tony Klinger

Production web application for `tonyklinger.com` — public site, coaching storefront,
authenticated Academy, customer account, and admin, in one Next.js application.

## Architecture

The canonical architecture is in [`docs/architecture/`](docs/architecture/). Read
[the index](docs/architecture/README.md) before non-trivial work. Code follows the
architecture; when they diverge, one of them is wrong and it gets resolved explicitly.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.3 (App Router, `src/`, Turbopack) |
| UI | React 19.2, Tailwind CSS 4 |
| Language | TypeScript |
| Database / Auth / Storage | Supabase (PostgreSQL, RLS) |
| Payments | Stripe |
| Email | Brevo |
| Hosting / Scheduling | Vercel, Vercel Cron |

Integration boundary (note 09 §40): Stripe webhooks and payment/business logic run in the
Next.js server layer. Supabase is the database, identity and storage layer. Vercel Cron is
the only scheduler. No workflow is implemented in both.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in real values
pnpm dev
```

This project uses **pnpm** (pinned via `packageManager`). pnpm blocks dependency build
scripts by default; approved ones are listed in `pnpm-workspace.yaml` under `allowBuilds`.

`.env.local` currently holds placeholders so the project builds before Supabase and Stripe
are provisioned. The app will not authenticate or take payments until they are replaced.

## Database

Schema lives in version-controlled migrations — never made by hand in the dashboard
(note 08 §3).

```bash
supabase init          # generates config.toml, not yet committed
supabase link --project-ref <ref>
supabase db push       # applies supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed.sql   # roles, permissions, tiers
```

| Migration | Contents |
|---|---|
| `0001_core_identity_and_authz` | Profiles, roles, permissions, audit log, auth helpers |
| `0002_products_content_and_delivery` | Products, prices, courses, masterclasses, coaching, cohorts, retreats, events, blog, catalogue |
| `0003_commerce_entitlements_and_bookings` | Orders, payments, subscriptions, entitlements, bookings |
| `0004_row_level_security` | RLS policies for every table |
| `0005_reference_data` | Permissions, roles, role grants, membership tiers, coaching series |

Verified 2026-08-28 against PostgreSQL 17: all four migrations and the seed apply cleanly,
34 tables with RLS enabled on every one, 55 policies. Constraint and isolation behaviour
was exercised, not just parsed — see the repo history for the checks run.

To re-run that check locally (Docker required; in this WSL distro prefix with `sg docker -c`):
stub the Supabase-provided `auth` schema, `auth.uid()` and the `anon`/`authenticated` roles,
then apply the migrations in order with `psql -v ON_ERROR_STOP=1`.

## Local development and testing

```bash
pnpm db:start     # start the local Supabase stack
pnpm db:reset     # replay migrations, re-apply the local seed
pnpm test:db      # pgTAP tests (26 assertions)
pnpm db:types     # regenerate src/types/database.ts from the live schema
pnpm dev
```

`supabase start` and `supabase db reset` target the **local** database only.
`supabase db push` ships migrations to a real project and does not carry the seed.

| File | Contents | Reaches production? |
|---|---|---|
| `supabase/migrations/*.sql` | Schema **and** reference data (permissions, roles, membership tiers) | Yes, via `db push` |
| `supabase/seed.sql` | Test accounts and sample content | No — local only |
| `supabase/tests/*.test.sql` | pgTAP assertions | No |

Reference data lives in migration `0005` rather than the seed because the
application cannot authorize anyone without it, and only migrations reach a
deployed project.

Six local accounts, all with password `password123`: `owner@`, `admin@`,
`support@`, `gold@` (entitled), `nobody@` (bought nothing), `expired@` (lapsed)
— all `@test.local`. The last three exist because "signed in" and "entitled" are
different things, and a UI only ever tested with a fully-entitled account gets
that wrong.

## Layout

```text
src/
├── app/            routes, layouts, route handlers
├── components/     ui/ layout/ navigation/ forms/ content/ + feature groups
├── hooks/          client-side React behaviour
├── lib/            env/ supabase/ navigation/ permissions/ validation/ utils/
├── types/          shared TypeScript types
└── proxy.ts        session refresh + coarse route gate
```

`proxy.ts` is Next 16's renamed `middleware`. It is a request-level gate, **not** the
security model — every route still authorizes server-side, and RLS enforces ownership
underneath (note 02 §21.1).

## Scripts

```bash
pnpm dev     # development server
pnpm build   # production build
pnpm lint    # eslint
```
