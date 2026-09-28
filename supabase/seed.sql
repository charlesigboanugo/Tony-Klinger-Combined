-- LOCAL DEVELOPMENT FIXTURES ONLY.
--
-- Supabase applies this file on `supabase start` and `supabase db reset`, both
-- of which target the local database. It is never shipped by `supabase db push`.
--
-- Three kinds of data exist, and each has one home:
--
--   reference data   roles, permissions, tiers — migration 0002_security_and_reference_data, because
--                    migrations are what reach a deployed project;
--   real content     products, curriculum, works, writing, team —
--                    supabase/content/*.sql, loaded into production by
--                    `pnpm content:setup` and locally BEFORE this file;
--   fixtures         this file: test accounts, their roles and entitlements,
--                    placeholder rows, and rows the RLS tests need.
--
-- Nothing in this file should ever be true of production.
-- Every account below uses the password: password123

begin;

-- ---------------------------------------------------------------------------
-- Test accounts
--
-- Inserted straight into auth.users. Supabase Auth stores a bcrypt hash in
-- encrypted_password, so crypt()/gen_salt('bf') produces a credential the real
-- login flow accepts — this exercises the actual sign-in path, not a stub.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- The token columns below are nullable in Postgres but GoTrue scans them into
-- non-nullable Go strings. Leaving them NULL makes every sign-in fail with
-- "Database error querying schema" — so they are seeded as empty strings.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'owner@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Test Owner"}', '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'admin@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Test Admin"}', '', '', '', '', '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'support@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Test Support"}', '', '', '', '', '', '', '', ''),

  -- A paying customer: Gold membership, live entitlements.
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000010',
   'authenticated', 'authenticated', 'gold@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Gold Member"}', '', '', '', '', '', '', '', ''),

  -- A signed-in customer who has bought nothing. Exercises the empty states
  -- and the "signed in but not entitled" path (note 03 §18).
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000011',
   'authenticated', 'authenticated', 'nobody@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"No Purchases"}', '', '', '', '', '', '', '', ''),

  -- A customer whose access has lapsed. Exercises the expired state.
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000012',
   'authenticated', 'authenticated', 'expired@test.local',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Expired Member"}', '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- Identities, so Supabase Auth treats these as ordinary email accounts.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  json_build_object('sub', u.id::text, 'email', u.email)::jsonb,
  'email', now(), now(), now()
from auth.users u
where u.email like '%@test.local'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Staff role assignments
-- ---------------------------------------------------------------------------

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000001', id from public.roles where name = 'owner'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000002', id from public.roles where name = 'admin'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-a000-000000000003', id from public.roles where name = 'support_manager'
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

-- Gold member: a live recurring subscription, course access plus 16
-- consumable session credits (2 already used) — both entitlements sourced
-- FROM that membership, dated against its current paid period.
--
-- Note 09 §16.1: access is read from the entitlement, never the subscription
-- directly, so both rows below carry their own `expires_at` rather than
-- leaving it null. The subscription exists only to drive renewal — without
-- it, `/academy`, `/account/membership` and `/account/billing` had nothing to
-- show for a user named "Gold Member", which is exactly the kind of gap this
-- rule exists to prevent: a display name promising something the data never
-- backed up.
insert into public.subscriptions
  (user_id, product_id, price_id, membership_tier, provider, provider_subscription_id,
   status, current_period_start, current_period_end)
select
  '00000000-0000-4000-a000-000000000010', p.id, pr.id, 'gold', 'stripe', 'sub_test_gold_member',
  'active', now() - interval '10 days', now() + interval '20 days'
from public.products p
join public.prices pr on pr.product_id = p.id and pr.billing_type = 'recurring'
where p.slug = 'membership-gold'
on conflict (provider, provider_subscription_id) do nothing;

insert into public.entitlements
  (user_id, resource_type, resource_id, source_type, status, starts_at, expires_at, quantity, quantity_used)
values
  ('00000000-0000-4000-a000-000000000010', 'course',
   (select id from public.courses where slug = 'level-one'), 'membership', 'active',
   now() - interval '10 days', now() + interval '355 days', null, 0),
  ('00000000-0000-4000-a000-000000000010', 'group_coaching_session',
   null, 'membership', 'active', now() - interval '10 days', now() + interval '355 days', 16, 2)
on conflict do nothing;

-- Gold member also holds a cohort place, exercising the Cohorts area the
-- same way their course and session-credit entitlements already exercise
-- Courses and Coaching. Masterclass and standalone-resource content was
-- seeded here too on 2026-09-05 and removed the same day, along with both
-- Academy areas — masterclasses fold into Courses conceptually, and
-- resources are delivered inside whichever course, cohort or coaching
-- session they belong to, never a standalone entitlement (note 07 §22).
insert into public.entitlements
  (user_id, resource_type, resource_id, source_type, status, starts_at, expires_at)
values
  ('00000000-0000-4000-a000-000000000010', 'cohort',
   (select id from public.cohorts where slug = 'cohort-gold'), 'purchase', 'active',
   now() - interval '10 days', now() + interval '355 days')
on conflict do nothing;

-- Expired customer: same course, lapsed. Should NOT be able to read lessons.
insert into public.entitlements
  (user_id, resource_type, resource_id, source_type, status, starts_at, expires_at)
values
  ('00000000-0000-4000-a000-000000000012', 'course',
   (select id from public.courses where slug = 'level-one'), 'purchase', 'expired',
   now() - interval '400 days', now() - interval '35 days')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Placeholder catalogue rows
-- ---------------------------------------------------------------------------
--
-- Not a real work: the draft proves a draft stays unreadable to the public.
-- (The Tony Klinger Podcast placeholder that stood here is now real content,
-- supabase/content/06_interviews_and_podcasts.sql.)
insert into public.catalogue_items (category, title, slug, description, status, published_at, is_external, external_url) values
  ('books', 'An unpublished book', 'an-unpublished-book',
   'Must never be publicly readable.', 'draft', null, false, null)
on conflict (category, slug) do nothing;

-- One scheduled session, so the booking flow and the session-visibility RLS
-- rule (migration 0003_commerce_and_bookings) can be exercised locally. A real schedule is set in
-- /admin; this is a local fixture, not content.
insert into public.group_coaching_sessions (series_id, title, starts_at, ends_at, capacity, status)
select s.id, 'Who are You Competing With?',
       now() + interval '7 days', now() + interval '7 days 1 hour', 8, 'scheduled'
from public.group_coaching_series s
where s.slug = 'filmmaking'
on conflict do nothing;


-- Two resource rows so the storage-path RLS invariants are testable from the
-- seed alone.
--
-- `pnpm images:import` normally fills this table, but it runs OUTSIDE the seed:
-- a fresh `db reset && supabase test db` left `resources` empty, so "anon can
-- read paths in a public bucket" failed for want of data rather than for a
-- broken policy — a red test with no real defect behind it. The private row
-- matters just as much: with the table empty, "anon cannot read paths in a
-- private bucket" passed trivially against nothing, which is not a test.
insert into public.resources (title, resource_type, storage_path)
values
  ('Seed fixture — public path', 'image', 'site-media/seed/fixture-public.png'),
  ('Seed fixture — gated path',  'image', 'course-assets/seed/fixture-gated.png')
on conflict (storage_path) do nothing;

commit;
