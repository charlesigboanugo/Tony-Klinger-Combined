-- 0005 — Storage buckets and their rules, contact enquiries and rate limiting, marketing consent.
--
-- Consolidated 2026-09-23 from migrations 0019, 0020, 0021, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- storage buckets  (was migration 0019)
-- ===========================================================================

-- Storage buckets and their access rules — note 02 §37, note 08 §26.
--
-- WHAT BELONGS HERE, AND WHAT DOES NOT
--
--   Next.js public/     Static design assets — logo, icons, decorative art.
--                       Shipped with the build, changed only by a deploy.
--   Supabase Storage    Dynamic, admin-uploaded assets — anything an
--                       administrator adds or replaces without a deploy.
--   Livid               All video. Streaming needs transcoding and adaptive
--                       bitrate, which object storage does not do.
--
-- BUCKETS ARE SPLIT BY WHO MAY READ THEM, NOT BY FILE TYPE.
--
-- `public` is a per-BUCKET flag, not a per-object one: there is no such thing as
-- a bucket that is private "where required". A file's access rule is therefore
-- decided by which bucket it goes in, and that is the one property that cannot
-- be refactored later without moving every object and rewriting every stored
-- path. File type can be reorganised with a path change; access cannot.
--
--   avatars        public    profile photos
--   site-media     public    all marketing imagery — books, films, blog, events,
--                            retreats, coaching, team, testimonials, AND course
--                            thumbnails
--   course-assets  private   material attached to Academy content, gated by
--                            entitlement to that content
--   documents      private   standalone gated documents, not tied to a course
--
-- Course thumbnails are in the PUBLIC bucket deliberately. They are marketing:
-- they appear on the storefront to people deciding whether to buy. Behind a
-- signed URL every thumbnail costs a server round trip, defeats CDN caching and
-- expires — for an image whose whole purpose is to be seen by strangers.
--
-- PATHS USE IDS, NOT SLUGS: `books/{book_id}/cover.jpg`.
-- Storage has no rename. A slug edited for SEO would strand every object
-- beneath it, and fixing that means copy-then-delete on each one. Ids never
-- change. The slug belongs in the URL, not in the storage key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',       'avatars',       true,   5 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp','image/avif']),
  ('site-media',    'site-media',    true,  15 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('course-assets', 'course-assets', false, 50 * 1024 * 1024,
     array['application/pdf','image/jpeg','image/png','image/webp',
           'application/zip','audio/mpeg','audio/mp4',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('documents',     'documents',     false, 50 * 1024 * 1024,
     array['application/pdf','application/zip',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- MIME types and size limits are enforced by Storage itself, so a bad upload is
-- refused at the edge rather than after the bytes have been paid for. They are
-- not a substitute for validating in the upload handler — a caller controls the
-- Content-Type header it sends — but they are the backstop that holds when the
-- handler is wrong.

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
--
-- Creating a bucket grants nothing and denies nothing. Without policies,
-- `storage.objects` has RLS enabled and no policy, so every non-service call
-- fails — which looks like a broken feature, not a security setting.
--
-- Reads of a PUBLIC bucket do not consult these policies at all: the
-- /object/public/ endpoint serves them anonymously by design. The policies
-- below therefore govern WRITES to public buckets, and everything about
-- private ones.
-- ---------------------------------------------------------------------------

-- --- avatars ---------------------------------------------------------------
-- Scoped by path: the first folder is the owner's user id, which is what makes
-- "your own avatar" expressible as a policy at all. A flat bucket could not
-- distinguish one person's file from another's.

create policy "avatars are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "a user writes only their own avatar folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user replaces only their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user deletes only their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --- site-media ------------------------------------------------------------
-- Readable by the world, writable only by staff who manage content.

create policy "site media is readable by anyone"
  on storage.objects for select
  using (bucket_id = 'site-media');

create policy "content managers write site media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (public.has_permission('products.update') or public.has_permission('blog.update'))
  );

create policy "content managers replace site media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-media'
    and (public.has_permission('products.update') or public.has_permission('blog.update'))
  );

create policy "content managers delete site media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-media'
    and public.has_permission('products.delete')
  );

-- --- course-assets and documents -------------------------------------------
-- No read policy for anon or authenticated, deliberately.
--
-- Gated files are reached through a SHORT-LIVED SIGNED URL minted server-side,
-- after the application has checked the entitlement using the same
-- has_active_entitlement() the Academy pages use — one authorization source,
-- not two that can drift apart. Signing happens with the service role, which
-- does not consult these policies.
--
-- So the absence of a read policy here is the backstop: if a signed URL is ever
-- issued without the check, or a session token is stolen, the object is still
-- unreachable through the ordinary API. A customer cannot list the bucket, and
-- cannot fetch a path they happen to guess.

create policy "course asset uploads are staff only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-assets'
    and (public.has_permission('courses.update') or public.has_permission('masterclasses.update'))
  );

create policy "course asset replacement is staff only"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'course-assets'
    and (public.has_permission('courses.update') or public.has_permission('masterclasses.update'))
  );

create policy "course asset deletion is staff only"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-assets'
    and public.has_permission('courses.update')
  );

create policy "document uploads are staff only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_permission('products.update')
  );

create policy "document replacement is staff only"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('products.update')
  );

create policy "document deletion is staff only"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('products.delete')
  );

-- Staff reads of the private buckets, so the admin interface can list and
-- preview what it manages without minting a signed URL for its own upload form.
create policy "staff read private buckets"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('course-assets', 'documents')
    and public.is_staff()
  );


-- ===========================================================================
-- contact and rate limiting  (was migration 0020)
-- ===========================================================================

-- Contact enquiries and a rate limiter — note 09 §42.
--
-- The contact form is the only endpoint on this site that is PUBLIC,
-- UNAUTHENTICATED and SENDS EMAIL. Everything else is protected by something:
-- Stripe by signature, cron by shared secret, auth by Supabase's own per-IP
-- limits, the rest by a session. This one has none of that, so the protection
-- has to be built.
--
-- WHY THE LIMITER LIVES IN POSTGRES. Vercel runs each request in a potentially
-- fresh instance, so an in-memory counter resets constantly and enforces
-- nothing. The database is the only state every invocation shares.

create table public.contact_messages (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  subject       text,
  message       text not null,
  -- Kept for abuse investigation, not for identification.
  ip_hash       text,
  user_agent    text,
  -- Set when a signed-in visitor submits, so support has the account to hand.
  user_id       uuid references auth.users (id) on delete set null,
  status        text not null default 'new'
                  check (status in ('new', 'read', 'replied', 'spam')),
  created_at    timestamptz not null default now()
);

create index contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- No insert policy for anon or authenticated, deliberately.
--
-- Submissions go through a Server Action that verifies Turnstile and checks the
-- rate limit FIRST, then writes with the service role. If the table accepted
-- direct inserts, both of those could be skipped entirely by posting to the
-- REST endpoint with the anon key, which is public by design.
create policy "contact messages are read by support staff"
  on public.contact_messages for select to authenticated
  using (public.has_permission('users.read'));

create policy "contact messages are updated by support staff"
  on public.contact_messages for update to authenticated
  using (public.has_permission('users.update'));

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  -- Composite of action and subject, e.g. 'contact:9f2c…'.
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- Deny-all: service role only. A client that could edit this could lift its own
-- limit.

/**
 * Consume one unit against a fixed window. Returns true when ALLOWED.
 *
 * Fixed window rather than sliding: it is one row and one upsert, where a
 * sliding window needs every hit stored and counted. The known trade-off is
 * that a burst can straddle a boundary and briefly allow up to 2x the limit —
 * acceptable for a contact form, where the goal is stopping automated floods
 * rather than precise fairness.
 *
 * The INSERT ... ON CONFLICT DO UPDATE is atomic, so two simultaneous
 * submissions cannot both read the same count and both be allowed.
 */
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  -- Truncate now() to the start of its window, so every caller in the same
  -- period targets the same row.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from anon, authenticated;

/** Housekeeping — old windows are never read again. */
create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_rate_limits() from anon, authenticated;


-- ===========================================================================
-- marketing consent  (was migration 0021)
-- ===========================================================================

-- Marketing consent — UK GDPR lawful basis, PECR reg 22.
--
-- TWO DIFFERENT LEGAL BASES, and the difference is why this table exists
-- instead of a single boolean:
--
--   Newsletter   EXPLICIT OPT-IN. No sale involved, so no exemption applies.
--                Someone actively ticked a box, and we must be able to show
--                when, from where, and what they were shown.
--
--   Customers    SOFT OPT-IN. Details obtained in the course of a sale, for our
--                own similar products, with a refusal offered at the time and in
--                every message since. Not "no consent" — consent is presumed
--                only because the refusal was offered and declined.
--
-- Evidence is the whole point. A regulator asking "prove they agreed" is not
-- answered by a row that says `true`, so the wording shown and the page it was
-- shown on are recorded alongside the timestamp.
--
-- TRANSACTIONAL EMAIL IS NOT MARKETING and is deliberately NOT governed by this
-- table: receipts, membership activation, booking confirmations and guest-claim
-- links must keep sending to somebody who has unsubscribed from everything.

create type public.consent_source as enum (
  'newsletter_form',   -- explicit opt-in
  'checkout',          -- soft opt-in, offered at the point of sale
  'account_settings',  -- changed by the customer themselves
  'import'             -- pre-existing, basis recorded in `notes`
);

create table public.marketing_consents (
  id             uuid primary key default gen_random_uuid(),
  -- Keyed on email, not user_id: most newsletter subscribers never create an
  -- account, and a customer who later signs up must not become a second record.
  email          text not null,
  user_id        uuid references auth.users (id) on delete set null,

  source         public.consent_source not null,
  -- The exact wording shown. Consent to wording we cannot reproduce is not
  -- evidence of anything.
  consent_text   text,
  consent_url    text,

  granted_at     timestamptz not null default now(),
  -- Set when the person opts out HERE. An unsubscribe made in Brevo is
  -- authoritative regardless of this column — see the sync notes in
  -- src/lib/email/contacts.ts.
  withdrawn_at   timestamptz,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- One live record per address per source. A second newsletter signup updates
  -- the existing row rather than stacking duplicates.
  unique (email, source)
);

create index marketing_consents_email_idx on public.marketing_consents (lower(email));
create index marketing_consents_user_id_idx on public.marketing_consents (user_id);

create trigger marketing_consents_set_updated_at
  before update on public.marketing_consents
  for each row execute function public.set_updated_at();

alter table public.marketing_consents enable row level security;

-- No client insert or update policy. Consent is recorded by a Server Action
-- that has already verified the submission; an insert policy would let anyone
-- forge a consent record for somebody else's address.
create policy "a person sees their own consent record"
  on public.marketing_consents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff read consent records"
  on public.marketing_consents for select to authenticated
  using (public.has_permission('users.read'));

/**
 * Record an opt-in, or revive one previously withdrawn.
 *
 * Idempotent: submitting the newsletter form twice updates the existing row and
 * refreshes the evidence rather than creating a duplicate.
 */
create or replace function public.record_marketing_consent(
  p_email text,
  p_source public.consent_source,
  p_consent_text text default null,
  p_consent_url text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.marketing_consents
    (email, user_id, source, consent_text, consent_url, granted_at, withdrawn_at)
  values
    (lower(trim(p_email)), p_user_id, p_source, p_consent_text, p_consent_url, now(), null)
  on conflict (email, source) do update
    set granted_at   = now(),
        -- Re-consenting clears a previous withdrawal; this is a fresh opt-in.
        withdrawn_at = null,
        consent_text = coalesce(excluded.consent_text, public.marketing_consents.consent_text),
        consent_url  = coalesce(excluded.consent_url, public.marketing_consents.consent_url),
        user_id      = coalesce(excluded.user_id, public.marketing_consents.user_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_marketing_consent(text, public.consent_source, text, text, uuid)
  from anon, authenticated;

/** Withdraw consent for one address, across every source. */
create or replace function public.withdraw_marketing_consent(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.marketing_consents
     set withdrawn_at = now()
   where email = lower(trim(p_email))
     and withdrawn_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.withdraw_marketing_consent(text) from anon, authenticated;

/**
 * Who currently belongs on the Members list.
 *
 * A VIEW, not a stored list, because membership is dynamic: someone who lapses
 * must drop off, or they receive "your Gold benefits" months after leaving.
 *
 * Customers is deliberately NOT modelled this way. Soft opt-in rests on having
 * BOUGHT, not on currently holding a subscription, so a lapsed member remains a
 * customer and stays on that list.
 */
create or replace view public.active_member_emails as
  select distinct
         u.email,
         s.membership_tier
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
   where s.status = 'active'
     and u.email is not null;

-- SERVICE ROLE ONLY. The view runs with its owner's rights, so it reads past
-- the RLS on `subscriptions` and `auth.users`; with Supabase's default grants
-- the public anon key could list every member's email. Access is therefore
-- controlled by the GRANT, not by security_invoker: invoker rights would also
-- deny the audience sync (service_role has no SELECT on auth.users), and
-- widening that to compensate would open a far more sensitive surface.
revoke all on public.active_member_emails from anon, authenticated;

comment on view public.active_member_emails is
  'Members list source for the Brevo audience sync. SERVICE ROLE ONLY: it exposes '
  'email addresses across all users and must never be granted to a client role.';
