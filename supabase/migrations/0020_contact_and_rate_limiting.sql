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
