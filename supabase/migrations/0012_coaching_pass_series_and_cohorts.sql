-- =============================================================================
-- 0012 — Coaching Pass delivery, series, packs and cohort intakes
-- =============================================================================
--
-- Consolidated 2026-10-15 from migrations 0012, 0013, 0014, 0016, 0017, 0018, 0019, in their
-- original order (the site was not yet in production). Each section keeps
-- its former number, which older notes and comments still cite.
-- =============================================================================


-- ===========================================================================
-- 0012_membership_delivery_playlists_and_packs  (was migration 0012, before 2026-10-15)
-- ===========================================================================

-- 0012 — Membership delivery, playlists, the members' Q&A, session packs,
-- retreat levels, and capacities set in admin.
-- Architecture: note 07 §5–§17, §26–§31; note 08 §14–§21, §29–§34; note 09 §16.1, §28.
--
-- What was wrong before this migration:
--
--   1. A MEMBERSHIP GRANTED NOTHING. A paid subscription was recorded in
--      `subscriptions` and that was all: no entitlement existed, so a member
--      could not book a session, and a one-year lump-sum member had no record
--      of access at all (note 09 §16.1 says access is read from the
--      entitlement — there was none to read).
--   2. A £25 GROUP SESSION BOUGHT EVERY SERIES, FOR EVER. `group_coaching`
--      products were mapped to a series by `product_id`; no series has one, so
--      the entitlement was written with a null resource and no quantity —
--      unlimited access to all four series.
--   3. Playlists and the monthly Q&A were sold on the membership page and
--      existed nowhere in the database.
--
-- The model after it:
--
--   membership entitlement   one row per subscription (or per lump-sum order),
--                            naming the tier, expiring with what was paid for
--   derived entitlements     what that tier includes — series, playlists,
--                            retreats — written by `sync_membership_entitlements`
--                            with `source_type = 'membership'` and the membership
--                            row as `source_id`, so every existing access check
--                            (RLS, booking, the Academy) works unchanged
--   choices                  Silver takes one series and one playlist, Gold two
--                            series; the member chooses, the tier sets how many

-- ---------------------------------------------------------------------------
-- 1. Products: packs, and options a customer switches between
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists credits integer check (credits is null or credits > 0),
  add column if not exists valid_months integer check (valid_months is null or valid_months > 0),
  add column if not exists pack_of uuid references public.products (id) on delete set null,
  add column if not exists option_group text,
  add column if not exists option_label text,
  add column if not exists option_position integer not null default 0;

comment on column public.products.credits is
  'Sessions this product grants per unit bought: 1 for a single session, 8 for a pack. Null for products that are not counted.';
comment on column public.products.valid_months is
  'How long what this product grants stays usable, in months from purchase. Null for no expiry.';
comment on column public.products.pack_of is
  'For a pack: the single-session product it is a multiple of. A private coaching pack grants sessions of that product''s service.';
comment on column public.products.option_group is
  'Products sharing a group are alternatives of one offer (one session or eight; Level 1, 2 or 3). The storefront, cart and checkout offer a switch between them.';
comment on column public.products.option_label is
  'This product''s name on that switch: "1 session", "8 sessions", "Level 2".';

create index if not exists products_option_group_idx
  on public.products (option_group) where option_group is not null;

-- ---------------------------------------------------------------------------
-- 2. Group size is data (note 08 §31): a default on the series, set in admin
-- ---------------------------------------------------------------------------

alter table public.group_coaching_series
  add column if not exists capacity integer not null default 8 check (capacity > 0);

comment on column public.group_coaching_series.capacity is
  'Places in each session of this series. A session created without a capacity takes this one; the storefront states it.';

-- A session with no capacity given takes its series'. The column default has
-- to go, or an omitted value arrives here already filled with 8.
alter table public.group_coaching_sessions alter column capacity drop default;

create or replace function public.group_coaching_sessions_default_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.capacity is null then
    select s.capacity into new.capacity
    from public.group_coaching_series s
    where s.id = new.series_id;
  end if;
  return new;
end;
$$;

drop trigger if exists group_coaching_sessions_default_capacity on public.group_coaching_sessions;
create trigger group_coaching_sessions_default_capacity
  before insert on public.group_coaching_sessions
  for each row execute function public.group_coaching_sessions_default_capacity();

-- ---------------------------------------------------------------------------
-- 3. Retreat levels, and the private joining link
-- ---------------------------------------------------------------------------

alter table public.retreats
  add column if not exists level integer check (level is null or level > 0),
  add column if not exists benefits text[] not null default '{}',
  add column if not exists position integer not null default 0;

comment on column public.retreats.level is
  'Place on the retreat ladder (1, 2, 3). Null for a retreat that has no levels.';
comment on column public.retreats.benefits is
  'What this retreat (or level) includes, in order — shown on its page.';

-- The link to an online retreat is what a place buys, so it cannot sit on
-- `retreats`, which anyone can read. Same shape as `event_access` (0009).
create table if not exists public.retreat_access (
  -- Its own id, unlike event_access: this table is edited through the generic
  -- admin resource pages, which address every row by `id`.
  id            uuid primary key default gen_random_uuid(),
  retreat_id    uuid not null unique references public.retreats (id) on delete cascade,
  join_url      text,
  joining_notes text,
  updated_at    timestamptz not null default now()
);

alter table public.retreat_access enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Membership tiers: what each one includes, as data (note 08 §14)
-- ---------------------------------------------------------------------------

alter table public.membership_tiers
  add column if not exists series_allowance integer check (series_allowance is null or series_allowance >= 0),
  add column if not exists playlist_allowance integer check (playlist_allowance is null or playlist_allowance >= 0),
  add column if not exists includes_qa boolean not null default false,
  add column if not exists includes_retreats boolean not null default false,
  add column if not exists retreats_require_yearly boolean not null default true;

comment on column public.membership_tiers.series_allowance is
  'Group Coaching series a member of this tier holds. A number is how many they choose; null is every series, including ones added later.';
comment on column public.membership_tiers.playlist_allowance is
  'Video playlists a member of this tier holds. A number is how many they choose; null is every playlist their tier may see.';
comment on column public.membership_tiers.includes_qa is
  'Whether this tier attends the members'' live Q&A and sees its recordings.';
comment on column public.membership_tiers.includes_retreats is
  'Whether this tier attends retreats that are open without an application.';
comment on column public.membership_tiers.retreats_require_yearly is
  'Where a tier includes retreats: only for members paying by the year (owner, 2026-10-08). A month''s membership '
  'costs less than one retreat place, so without this a retreat could be attended for the price of a month.';
comment on column public.membership_tiers.benefits is
  'Everything this tier includes, in order, as the customer reads it. The FULL list for the tier, not what it adds: '
  'a higher tier supersedes lines below it (one playlist becomes every playlist) rather than adding to them, so a '
  'cumulative list contradicts itself.';

update public.membership_tiers set series_allowance = 1,    playlist_allowance = 1,    includes_qa = false, includes_retreats = false where tier = 'silver';
update public.membership_tiers set series_allowance = 2,    playlist_allowance = null, includes_qa = true,  includes_retreats = false where tier = 'gold';
update public.membership_tiers set series_allowance = null, playlist_allowance = null, includes_qa = true,  includes_retreats = true  where tier = 'platinum';
-- Ultimate was never sold and has no price (the coaching site's top tier is
-- Platinum, "the premium offer"). Kept as a row and an enum value; switched off
-- so it is not offered. Re-enable in Admin → Membership tiers once it has a
-- price and a decided offer.
update public.membership_tiers set series_allowance = null, playlist_allowance = null, includes_qa = true,  includes_retreats = true, active = false where tier = 'ultimate';

-- How often a subscription bills. Recorded by the webhook from Stripe's own
-- price, because what a tier includes can depend on it (retreats, above).
alter table public.subscriptions
  add column if not exists billing_interval public.billing_interval;

-- ---------------------------------------------------------------------------
-- 5. Playlists — the members' video library
-- ---------------------------------------------------------------------------

create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  -- The lowest tier that may hold this playlist. 'silver': any member (Silver
  -- by choosing it). 'gold': Gold and above only — the Miscellaneous playlist.
  min_tier    public.membership_tier not null default 'silver',
  position    integer not null default 0,
  status      public.content_status not null default 'draft',
  cover_resource_id uuid references public.resources (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

create table if not exists public.playlist_videos (
  id          uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  title       text not null,
  description text,
  -- Provider and id, never a URL: the address is built server-side after the
  -- access check, exactly as for lessons (0007, note 07 §R29).
  video_provider text,
  video_id       text,
  video_hash     text,
  video_duration_seconds integer check (video_duration_seconds is null or video_duration_seconds >= 0),
  position    integer not null default 0,
  status      public.content_status not null default 'draft',
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint playlist_videos_video_is_whole check (
    (video_provider is null and video_id is null)
    or (video_provider in ('vimeo', 'livid', 'youtube') and video_id is not null)
  )
);

create index if not exists playlist_videos_playlist_id_idx on public.playlist_videos (playlist_id);

create trigger playlist_videos_set_updated_at
  before update on public.playlist_videos
  for each row execute function public.set_updated_at();

-- A video gets its date the first time it is published, so "new this week" is
-- true without anybody remembering to fill a field in.
create or replace function public.playlist_videos_stamp_published()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists playlist_videos_stamp_published on public.playlist_videos;
create trigger playlist_videos_stamp_published
  before insert or update of status on public.playlist_videos
  for each row execute function public.playlist_videos_stamp_published();

-- ---------------------------------------------------------------------------
-- 6. The members' live Q&A
-- ---------------------------------------------------------------------------

create table if not exists public.member_qa_sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  meeting_url text,
  recording_resource_id uuid references public.resources (id) on delete set null,
  status      text not null default 'scheduled'
                check (status in ('scheduled', 'cancelled', 'completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint member_qa_sessions_ends_after_starts check (ends_at > starts_at)
);

create index if not exists member_qa_sessions_starts_at_idx on public.member_qa_sessions (starts_at);

create trigger member_qa_sessions_set_updated_at
  before update on public.member_qa_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. What a member chose
-- ---------------------------------------------------------------------------

create table if not exists public.membership_choices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('series', 'playlist')),
  -- A group_coaching_series or a playlist, by `kind`. Polymorphic, like
  -- `entitlements.resource_id`, so it carries no foreign key.
  resource_id uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, resource_id)
);

create index if not exists membership_choices_user_id_idx on public.membership_choices (user_id);

comment on table public.membership_choices is
  'The series and playlists a member picked, where their tier includes a number of them rather than all. '
  'Kept across renewals: a choice is made once. Staff remove a row to let a member choose again.';

-- ---------------------------------------------------------------------------
-- 8. Reading a membership
-- ---------------------------------------------------------------------------

/** Days a subscriber keeps access after a renewal date, while a failed payment is retried (note 09 §17). */
create or replace function public.membership_grace_days()
returns integer
language sql
immutable
as $$ select 7 $$;

/**
 * The membership a user holds now: their highest-ranked live one.
 * Internal — it takes a user id, so it is not callable from the browser.
 *
 * `yearly` is false only for a subscription billed by the month. A year paid
 * for at once, and a membership granted by staff, count as yearly.
 *
 * `includes_retreats` is the answer FOR THIS MEMBER, not the tier's setting:
 * where the tier keeps retreats for yearly members, a monthly one gets false.
 * Everything downstream — the derived entitlements, the RLS predicate, the
 * Academy — reads this one resolved value.
 */
create or replace function public.membership_of(p_user_id uuid)
returns table (
  entitlement_id     uuid,
  tier               public.membership_tier,
  tier_id            uuid,
  tier_name          text,
  rank               integer,
  source_type        public.entitlement_source,
  expires_at         timestamptz,
  series_allowance   integer,
  playlist_allowance integer,
  includes_qa        boolean,
  includes_retreats  boolean,
  yearly             boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, t.tier, t.id, t.name, t.rank, e.source_type, e.expires_at,
         t.series_allowance, t.playlist_allowance, t.includes_qa,
         t.includes_retreats and (not t.retreats_require_yearly or y.yearly),
         y.yearly
  from public.entitlements e
  join public.membership_tiers t on t.id = e.resource_id
  left join public.subscriptions s on e.source_type = 'membership' and s.id = e.source_id
  cross join lateral (
    select case
             when e.source_type <> 'membership' then true
             -- Stripe's interval where the webhook has recorded it; otherwise
             -- the length of the period paid for.
             else coalesce(
                    s.billing_interval = 'year',
                    s.current_period_end - s.current_period_start > interval '300 days',
                    false)
           end as yearly
  ) y
  where e.user_id = p_user_id
    and e.resource_type = 'membership'
    and e.status = 'active'
    and e.starts_at <= now()
    and (e.expires_at is null or e.expires_at > now())
  order by t.rank desc, e.expires_at desc nulls first
  limit 1;
$$;

revoke all on function public.membership_of(uuid) from public, anon, authenticated;

/** The caller's own membership, for the Academy and Account. */
create or replace function public.my_membership()
returns table (
  entitlement_id     uuid,
  tier               public.membership_tier,
  tier_id            uuid,
  tier_name          text,
  rank               integer,
  source_type        public.entitlement_source,
  expires_at         timestamptz,
  series_allowance   integer,
  playlist_allowance integer,
  includes_qa        boolean,
  includes_retreats  boolean,
  yearly             boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.membership_of(auth.uid());
$$;

revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

/** True when the caller's membership includes the named benefit: 'qa' or 'retreats'. */
create or replace function public.has_member_benefit(p_benefit text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_benefit
             when 'qa' then m.includes_qa
             when 'retreats' then m.includes_retreats
             else false
           end
    from public.membership_of(auth.uid()) m
  ), false);
$$;

-- Stays executable by anon: it is evaluated inside RLS policies, with the
-- privileges of whoever is querying. Revoking it does not hide anything (it
-- answers false without a session) — it makes every signed-out read of a table
-- whose policy calls it fail outright.
revoke all on function public.has_member_benefit(text) from public;
grant execute on function public.has_member_benefit(text) to anon, authenticated;

/**
 * True when the caller may watch this playlist: a live playlist entitlement
 * covers it AND their tier reaches the playlist's own. The second half is what
 * keeps a Gold member's "every playlist" from reaching one reserved for a
 * higher tier.
 */
create or replace function public.can_view_playlist(p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_entitlement('playlist', p_playlist_id)
     and exists (
       select 1
       from public.playlists p
       join public.membership_tiers pt on pt.tier = p.min_tier
       join public.membership_of(auth.uid()) m on m.rank >= pt.rank
       where p.id = p_playlist_id
         and p.status = 'published'
     );
$$;

-- Stays executable by anon: it is evaluated inside RLS policies, with the
-- privileges of whoever is querying. Revoking it does not hide anything (it
-- answers false without a session) — it makes every signed-out read of a table
-- whose policy calls it fail outright.
revoke all on function public.can_view_playlist(uuid) from public;
grant execute on function public.can_view_playlist(uuid) to anon, authenticated;

/**
 * True when the caller may attend this retreat: a place bought for it, or a
 * membership that includes retreats — which covers only retreats open without
 * an application. A level entered by interview is never given by membership.
 */
create or replace function public.has_retreat_access(p_retreat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    join public.retreats r on r.id = p_retreat_id
    where e.user_id = auth.uid()
      and e.resource_type = 'retreat'
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and (
        e.resource_id = p_retreat_id
        or (e.resource_id is null and not r.requires_application)
      )
  );
$$;

-- Stays executable by anon: it is evaluated inside RLS policies, with the
-- privileges of whoever is querying. Revoking it does not hide anything (it
-- answers false without a session) — it makes every signed-out read of a table
-- whose policy calls it fail outright.
revoke all on function public.has_retreat_access(uuid) from public;
grant execute on function public.has_retreat_access(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Membership → what it includes
-- ---------------------------------------------------------------------------

/**
 * Rewrite the entitlements a user's membership implies.
 *
 * Everything derived is retired first and whatever still applies is then
 * re-activated, so one function is correct for joining, renewing, upgrading,
 * choosing, lapsing and being revoked. Rows are never deleted: a booking made
 * against one keeps its `entitlement_id` (note 08 §55).
 *
 * Derived rows carry the membership's own `expires_at`, so they lapse with it
 * even if nothing calls this again.
 */
create or replace function public.sync_membership_entitlements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select * into m from public.membership_of(p_user_id);

  -- Only the rows this function writes: derived from a membership row
  -- (`source_id`), of the three kinds a tier includes. Anything else marked as
  -- membership-sourced is somebody else's to manage.
  update public.entitlements
     set status = 'expired'
   where user_id = p_user_id
     and source_type = 'membership'
     and source_id is not null
     and resource_type in ('group_coaching_series', 'playlist', 'retreat')
     and status = 'active';

  if m.entitlement_id is null then
    return;
  end if;

  insert into public.entitlements
    (user_id, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at)
  select p_user_id, d.resource_type, d.resource_id, 'membership', m.entitlement_id, 'active', now(), m.expires_at
  from (
    -- Group Coaching: every series, or the ones chosen.
    select 'group_coaching_series'::public.entitlement_resource as resource_type, null::uuid as resource_id
     where m.series_allowance is null
    union all
    select 'group_coaching_series'::public.entitlement_resource, c.resource_id
      from (
        select mc.resource_id
        from public.membership_choices mc
        where mc.user_id = p_user_id and mc.kind = 'series'
        order by mc.created_at, mc.id
        limit coalesce(m.series_allowance, 0)
      ) c
     where m.series_allowance is not null
    union all
    -- Playlists: every one, or the ones chosen.
    select 'playlist'::public.entitlement_resource, null::uuid
     where m.playlist_allowance is null
    union all
    select 'playlist'::public.entitlement_resource, c.resource_id
      from (
        select mc.resource_id
        from public.membership_choices mc
        where mc.user_id = p_user_id and mc.kind = 'playlist'
        order by mc.created_at, mc.id
        limit coalesce(m.playlist_allowance, 0)
      ) c
     where m.playlist_allowance is not null
    union all
    -- Retreats open without an application (see has_retreat_access).
    select 'retreat'::public.entitlement_resource, null::uuid
     where m.includes_retreats
  ) d
  on conflict (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
    where source_id is not null
  do update set status = 'active', expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.sync_membership_entitlements(uuid) from public, anon, authenticated;

/**
 * Any change to a membership row re-derives what it includes: a renewal moving
 * the date, the expiry job, an admin grant or revocation. Derived rows are a
 * different resource type, so the updates this causes do not come back here.
 */
create or replace function public.entitlements_sync_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_membership_entitlements(new.user_id);
  return null;
end;
$$;

-- So does a subscription changing how often it bills, since retreats can turn on that.
create or replace function public.subscriptions_sync_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_membership_entitlements(new.user_id);
  return null;
end;
$$;

drop trigger if exists subscriptions_sync_membership on public.subscriptions;
create trigger subscriptions_sync_membership
  after update of billing_interval, current_period_start, current_period_end on public.subscriptions
  for each row execute function public.subscriptions_sync_membership();

drop trigger if exists entitlements_sync_membership on public.entitlements;
create trigger entitlements_sync_membership
  after insert or update of status, expires_at, resource_id on public.entitlements
  for each row
  when (new.resource_type = 'membership')
  execute function public.entitlements_sync_membership();

/**
 * Bring a subscriber's membership entitlement into line with their Stripe
 * subscription. Called by the webhook after every subscription event.
 *
 *   active / trialing / past_due   access to the end of the paid period, plus
 *                                  the grace days a failed renewal is retried in
 *   anything else                  access ends now
 *
 * A cancelled subscription stays 'active' at Stripe until the period it paid
 * for ends, then arrives here as cancelled — so a member who cancels keeps what
 * they paid for and loses it on that date (note 09 §17).
 */
create or replace function public.apply_subscription_membership(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_tier_id uuid;
  v_expires timestamptz;
begin
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found or s.membership_tier is null then
    return;
  end if;

  select id into v_tier_id from public.membership_tiers where tier = s.membership_tier;
  if v_tier_id is null then
    return;
  end if;

  -- One subscription holds one tier at a time.
  update public.entitlements
     set status = 'expired'
   where resource_type = 'membership'
     and source_type = 'membership'
     and source_id = s.id
     and resource_id <> v_tier_id
     and status = 'active';

  if s.status in ('active', 'trialing', 'past_due') and s.current_period_end is not null then
    v_expires := s.current_period_end + make_interval(days => public.membership_grace_days());

    insert into public.entitlements
      (user_id, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at)
    values
      (s.user_id, 'membership', v_tier_id, 'membership', s.id, 'active',
       least(coalesce(s.current_period_start, now()), now()), v_expires)
    on conflict (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
      where source_id is not null
    do update set status = 'active', expires_at = excluded.expires_at;

    update public.subscriptions
       set grace_period_ends_at = v_expires
     where id = s.id and grace_period_ends_at is distinct from v_expires;
  else
    update public.entitlements
       set status = 'expired',
           expires_at = least(coalesce(expires_at, now()), now())
     where resource_type = 'membership'
       and source_type = 'membership'
       and source_id = s.id
       and status = 'active';
  end if;
end;
$$;

revoke all on function public.apply_subscription_membership(uuid) from public, anon, authenticated;

/**
 * A member chooses a series or a playlist their tier includes a number of.
 *
 * Returns a status rather than raising, so the page can explain:
 *   ok · already · included (the tier has all of them, nothing to choose)
 *   limit_reached · not_allowed (a playlist above their tier)
 *   no_membership · not_found · not_authenticated · invalid
 */
create or replace function public.choose_membership_item(p_kind text, p_resource_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  v_allowance integer;
  v_count integer;
  v_min_rank integer;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  if p_kind not in ('series', 'playlist') or p_resource_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into m from public.membership_of(v_user_id);
  if m.entitlement_id is null then
    return jsonb_build_object('status', 'no_membership');
  end if;

  v_allowance := case p_kind when 'series' then m.series_allowance else m.playlist_allowance end;
  if v_allowance is null then
    return jsonb_build_object('status', 'included');
  end if;

  if p_kind = 'series' then
    if not exists (
      select 1 from public.group_coaching_series where id = p_resource_id and status = 'published'
    ) then
      return jsonb_build_object('status', 'not_found');
    end if;
  else
    select t.rank into v_min_rank
    from public.playlists p
    join public.membership_tiers t on t.tier = p.min_tier
    where p.id = p_resource_id and p.status = 'published';

    if v_min_rank is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    if v_min_rank > m.rank then
      return jsonb_build_object('status', 'not_allowed');
    end if;
  end if;

  -- One member's choices are made one at a time, so two requests cannot both
  -- count "none yet" and both be accepted.
  perform pg_advisory_xact_lock(hashtext('membership_choice:' || v_user_id::text));

  if exists (
    select 1 from public.membership_choices
    where user_id = v_user_id and kind = p_kind and resource_id = p_resource_id
  ) then
    return jsonb_build_object('status', 'already');
  end if;

  select count(*) into v_count
  from public.membership_choices
  where user_id = v_user_id and kind = p_kind;

  if v_count >= v_allowance then
    return jsonb_build_object('status', 'limit_reached', 'allowance', v_allowance);
  end if;

  insert into public.membership_choices (user_id, kind, resource_id)
  values (v_user_id, p_kind, p_resource_id);

  perform public.sync_membership_entitlements(v_user_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.choose_membership_item(text, uuid) from public, anon;
grant execute on function public.choose_membership_item(text, uuid) to authenticated;

-- Staff removing a choice (so the member may choose again) takes the access
-- that choice gave with it.
create or replace function public.membership_choices_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_membership_entitlements(old.user_id);
  return null;
end;
$$;

drop trigger if exists membership_choices_after_delete on public.membership_choices;
create trigger membership_choices_after_delete
  after delete on public.membership_choices
  for each row execute function public.membership_choices_after_delete();

-- ---------------------------------------------------------------------------
-- 10. Payment → entitlement (replaces 0010's)
-- ---------------------------------------------------------------------------

/**
 * Grant the entitlements an order's items imply.
 *
 * Changed from 0010:
 *
 *   group coaching   a product with no series of its own grants SESSION CREDITS
 *                    (`products.credits`, one if unset) — never, as before, an
 *                    unlimited entitlement to every series
 *   private coaching a pack grants `credits` sessions of the service its
 *                    single-session product (`pack_of`) sells
 *   validity         `products.valid_months` sets when credits lapse
 *   membership       a ONE-TIME membership price is a year's membership, granted
 *                    here; a recurring one is granted from its subscription
 *                    (apply_subscription_membership), as it always was meant to be
 */
create or replace function public.grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted integer := 0;
  v_item record;
  v_resource_type public.entitlement_resource;
  v_resource_id uuid;
  v_quantity integer;
  v_expires timestamptz;
  v_units integer;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.product_type, p.credits, p.valid_months, p.pack_of,
           pr.billing_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    left join public.prices pr on pr.id = oi.price_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;
    v_quantity := null;
    v_units := greatest(coalesce(v_item.quantity, 1), 1);
    v_expires := case
                   when v_item.valid_months is not null
                     then now() + make_interval(months => v_item.valid_months)
                 end;

    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
      when 'group_coaching' then
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
        if v_resource_id is not null and v_item.credits is null then
          -- A product that sells one whole series.
          v_resource_type := 'group_coaching_series';
        else
          -- Seats, usable against any scheduled session (note 07 §14).
          v_resource_type := 'group_coaching_session';
          v_resource_id := null;
          v_quantity := coalesce(v_item.credits, 1) * v_units;
        end if;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;  -- never a place at every retreat
        end if;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      when 'private_coaching' then
        v_resource_type := 'private_coaching';
        select id into v_resource_id
        from public.private_coaching_services
        where product_id in (v_item.product_id, v_item.pack_of)
        order by (product_id = v_item.product_id) desc
        limit 1;
        if v_resource_id is null then
          continue;  -- a pack whose service is gone grants nothing bookable
        end if;
        v_quantity := coalesce(v_item.credits, 1) * v_units;
      when 'membership' then
        if v_item.billing_type is distinct from 'one_time' then
          continue;  -- a subscription: granted by apply_subscription_membership
        end if;
        v_resource_type := 'membership';
        select id into v_resource_id from public.membership_tiers where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;
        end if;
        -- A year from now — or from the end of the year already held, so
        -- paying early for the next one loses nothing.
        select greatest(coalesce(max(e.expires_at), now()), now()) + interval '1 year'
          into v_expires
        from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'membership'
          and e.resource_id = v_resource_id
          and e.status = 'active';
      else
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status, quantity, expires_at)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active', v_quantity, v_expires)
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Can this be bought right now?
-- ---------------------------------------------------------------------------

/**
 * Whether a product can be sold to the caller now.
 *
 *   ok           yes (also the answer for any product with no rule here)
 *   owned        they already hold it: a course is bought once and kept; a place
 *                in a cohort or at a retreat is one place
 *   unused       they still hold sessions of this kind to use. More can be bought
 *                once every session is used or has lapsed, whichever comes first
 *   full         every place is taken (capacity is set in admin; none = no limit)
 *   unscheduled  a cohort or retreat with no date yet — nothing is sold before there is a day to attend
 *   past         it has started
 *   application  a level entered by interview, and the caller has no approved application
 *   unavailable  not published
 *
 * Checked by checkout before any order is created, and by the storefront to
 * word its button. `owned` and `unused` need a session: a signed-out caller is
 * never told either, and is asked to sign in only where the sale itself needs it.
 */
create or replace function public.coaching_sale_status(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  r record;
  v_taken integer;
  v_user_id uuid := auth.uid();
  v_type public.product_type;
  v_pack_of uuid;
  v_id uuid;
begin
  select p.product_type, p.pack_of into v_type, v_pack_of
  from public.products p where p.id = p_product_id;

  if v_user_id is not null then
    if v_type = 'course' then
      select id into v_id from public.courses where product_id = p_product_id limit 1;
      if v_id is not null and public.has_active_entitlement('course', v_id) then
        return 'owned';
      end if;

    elsif v_type = 'group_coaching' then
      -- Session credits are good for any series, so any unspent one counts.
      if not exists (select 1 from public.group_coaching_series where product_id = p_product_id)
         and public.has_session_credits() then
        return 'unused';
      end if;

    elsif v_type = 'private_coaching' then
      select id into v_id
      from public.private_coaching_services
      where product_id in (p_product_id, v_pack_of)
      order by (product_id = p_product_id) desc
      limit 1;

      if v_id is not null and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'private_coaching'
          and e.resource_id = v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
    end if;
  end if;

  select * into c from public.cohorts where product_id = p_product_id limit 1;
  if found then
    if c.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_active_entitlement('cohort', c.id) then
      return 'owned';
    end if;
    -- Same rule as a retreat (owner, 2026-10-08): nobody joins a cohort
    -- before its dates are announced, or after it has begun — it is one
    -- group, start to finish.
    if c.starts_at is null then
      return 'unscheduled';
    end if;
    if c.starts_at <= now() then
      return 'past';
    end if;
    if c.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'cohort'
        and e.resource_id = c.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= c.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_retreat_access(r.id) then
      return 'owned';
    end if;
    if r.starts_at is null then
      return 'unscheduled';
    end if;
    if r.starts_at <= now() then
      return 'past';
    end if;
    if r.requires_application and not exists (
      select 1 from public.retreat_applications a
      where a.retreat_id = r.id and a.user_id = v_user_id and a.status = 'approved'
    ) then
      return 'application';
    end if;
    if r.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'retreat'
        and e.resource_id = r.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= r.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Row level security
-- ---------------------------------------------------------------------------

alter table public.playlists enable row level security;
create policy "playlists: public read published"
  on public.playlists for select using (status = 'published');
create policy "playlists: staff read"
  on public.playlists for select using (public.has_permission('memberships.read'));

alter table public.playlist_videos enable row level security;
create policy "playlist_videos: member read"
  on public.playlist_videos for select
  using (status = 'published' and public.can_view_playlist(playlist_id));
create policy "playlist_videos: staff read"
  on public.playlist_videos for select using (public.has_permission('memberships.read'));

alter table public.member_qa_sessions enable row level security;
create policy "member_qa_sessions: member read"
  on public.member_qa_sessions for select
  using (public.has_member_benefit('qa'));
create policy "member_qa_sessions: staff read"
  on public.member_qa_sessions for select using (public.has_permission('memberships.read'));

alter table public.membership_choices enable row level security;
create policy "membership_choices: read own"
  on public.membership_choices for select using (user_id = auth.uid());
create policy "membership_choices: staff read"
  on public.membership_choices for select using (public.has_permission('memberships.read'));

create policy "retreat_access: attendees read"
  on public.retreat_access for select
  using (public.has_retreat_access(retreat_id));
create policy "retreat_access: staff read"
  on public.retreat_access for select
  using (public.has_permission('retreats.read'));

-- A Q&A recording is reached through the session it records (note 07 §23).
drop policy if exists "resources: recording of a members' Q&A" on public.resources;
create policy "resources: recording of a members' Q&A"
  on public.resources for select
  using (
    exists (
      select 1 from public.member_qa_sessions q
      where q.recording_resource_id = resources.id
        and public.has_member_benefit('qa')
    )
  );

-- ---------------------------------------------------------------------------
-- 13. Members who already subscribed get what they paid for
-- ---------------------------------------------------------------------------

-- Subscriptions recorded before this migration have no entitlement. Idempotent,
-- and a no-op on a database with no subscribers.
do $$
declare
  s record;
begin
  for s in select id from public.subscriptions where membership_tier is not null loop
    perform public.apply_subscription_membership(s.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Spend the credit that lapses first
-- ---------------------------------------------------------------------------

/**
 * `book_group_session` (0003), with one change: among a customer's session
 * credits, the one that expires soonest is spent first.
 *
 * Until this migration no credit had an expiry, so the order did not matter. A
 * pack of eight now lapses after `valid_months`, and somebody holding a pack
 * and a single (undated) session would otherwise have the single spent while
 * the pack ran out unused.
 */
create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_taken integer;
  v_entitlement record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  -- FOR UPDATE serialises everything below against a concurrent booking of the
  -- same session. Without this lock two requests can both read capacity as
  -- available and both insert (note 08 §65).
  select * into v_session
  from public.group_coaching_sessions
  where id = p_session_id
  for update;

  if v_session is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status <> 'scheduled' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_session.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  -- Already booked? Idempotent: a double click must not consume two credits.
  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'group_coaching_session'
      and bookable_id = p_session_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  select count(*) into v_taken
  from public.bookings
  where bookable_type = 'group_coaching_session'
    and bookable_id = p_session_id
    and status in ('pending', 'confirmed');

  if v_taken >= v_session.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_session.capacity);
  end if;

  -- Entitlement, in order of preference:
  --   1. series access with no quantity  -> unlimited, consumes nothing
  --   2. consumable session credits      -> one is spent
  select * into v_entitlement
  from public.entitlements
  where user_id = v_user_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and (
      (resource_type = 'group_coaching_series'
        and (resource_id = v_session.series_id or resource_id is null)
        and quantity is null)
      or
      (resource_type = 'group_coaching_session'
        and quantity is not null
        and quantity_used < quantity)
    )
  order by (quantity is null) desc,  -- prefer unlimited access over spending a credit
           expires_at asc nulls last, -- then the credit that lapses soonest
           created_at
  limit 1
  for update;

  if v_entitlement is null then
    -- No covering entitlement. The caller is sent to buy — never charged here,
    -- because booking and payment are separate concerns (note 01 §11).
    return jsonb_build_object('status', 'not_entitled');
  end if;

  if v_entitlement.quantity is not null then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case
                      when quantity_used + 1 >= quantity then 'consumed'
                      else status
                    end
     where id = v_entitlement.id;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
  values
    (v_user_id, 'group_coaching_session', p_session_id, v_entitlement.id,
     'confirmed', v_session.starts_at, v_session.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'ok',
    'booking_id', v_booking_id,
    'consumed_credit', v_entitlement.quantity is not null
  );
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;


-- ===========================================================================
-- 0013_coaching_terms  (was migration 0013, before 2026-10-15)
-- ===========================================================================

-- 0013 — Coaching terms: the series run again, and members choose each term.
-- Architecture: note 07 §11–§12, §10.1; note 09 §31.
--
-- THE QUESTION THIS ANSWERS (owner, 2026-10-08): a series is eight sessions.
-- What happens when they are over, and what does a member whose tier includes
-- one series do for the rest of the year?
--
--   A TERM is about three months: eight weekly sessions of every series, then
--   a short break. Each series starts again from its first session every term,
--   so there are about four terms a year. This is the cadence the coaching
--   site already implied: "weekly" group sessions, a pack of eight "valid for
--   3 months" (one term), a membership of 365 days (four).
--
--   A member whose tier includes a number of series CHOOSES THEM EACH TERM —
--   repeat the same one, or take another. Silver has one series a term, Gold
--   two, Platinum every series every term.
--
-- What changes from 0012: a series choice there was permanent, written once
-- and turned into a standing series entitlement. It is now a choice FOR A
-- TERM, and it is read directly (member_holds_session) rather than through a
-- derived entitlement — a series entitlement cannot say "this term only".
-- Playlist choices are unchanged: one playlist, kept.

-- ---------------------------------------------------------------------------
-- 1. Terms
-- ---------------------------------------------------------------------------

create table if not exists public.coaching_terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  starts_at  timestamptz not null,
  -- The end of the whole term, break included: the next term starts no sooner.
  ends_at    timestamptz not null,
  status     public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaching_terms_ends_after_starts check (ends_at > starts_at)
);

create index if not exists coaching_terms_starts_at_idx on public.coaching_terms (starts_at);

create trigger coaching_terms_set_updated_at
  before update on public.coaching_terms
  for each row execute function public.set_updated_at();

comment on table public.coaching_terms is
  'A term of Group Coaching: about three months, in which every series runs its eight weekly sessions. '
  'A session belongs to the term its date falls in; published terms never overlap.';

/**
 * A term with no end given runs twelve weeks (eight of sessions, four of
 * break), and two published terms may not overlap — a session's term is found
 * from its date, so an overlap would give one session two terms.
 */
create or replace function public.coaching_terms_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ends_at is null then
    new.ends_at := new.starts_at + interval '12 weeks';
  end if;

  if new.status = 'published' and exists (
    select 1 from public.coaching_terms t
    where t.id <> new.id
      and t.status = 'published'
      and t.starts_at < new.ends_at
      and t.ends_at > new.starts_at
  ) then
    raise exception 'This term overlaps another published term. Terms follow one another; change the dates.'
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists coaching_terms_before_write on public.coaching_terms;
create trigger coaching_terms_before_write
  before insert or update on public.coaching_terms
  for each row execute function public.coaching_terms_before_write();

alter table public.coaching_terms enable row level security;
create policy "coaching_terms: public read published"
  on public.coaching_terms for select using (status = 'published');
create policy "coaching_terms: staff read"
  on public.coaching_terms for select using (public.has_permission('coaching.read'));

/** The published term a moment falls in, or null. */
create or replace function public.term_at(p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.coaching_terms t
  where t.status = 'published' and t.starts_at <= p_at and t.ends_at > p_at
  order by t.starts_at desc
  limit 1;
$$;

grant execute on function public.term_at(timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. A choice belongs to a term
-- ---------------------------------------------------------------------------

alter table public.membership_choices
  add column if not exists term_id uuid references public.coaching_terms (id) on delete cascade;

comment on column public.membership_choices.term_id is
  'The term a SERIES choice is for. Null for a playlist choice, which is kept for the membership.';

-- A series chosen before terms existed belongs to no term and gives nothing
-- now: its member chooses for the current term. Removed rather than left as a
-- row that looks like a choice and is not one.
delete from public.membership_choices where kind = 'series' and term_id is null;

alter table public.membership_choices
  drop constraint if exists membership_choices_user_id_kind_resource_id_key;

create unique index if not exists membership_choices_unique
  on public.membership_choices
     (user_id, kind, resource_id, coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.membership_choices
  drop constraint if exists membership_choices_series_has_term;
alter table public.membership_choices
  add constraint membership_choices_series_has_term
  check ((kind = 'series') = (term_id is not null));

comment on table public.membership_choices is
  'What a member picked, where their tier includes a number rather than all: a series FOR A TERM (chosen again '
  'each term), and a playlist (chosen once, kept). Staff remove a row to let a member choose again.';

-- ---------------------------------------------------------------------------
-- 3. Does this member hold this session?
-- ---------------------------------------------------------------------------

/**
 * True when the caller's membership covers a session through a term choice:
 * they are a member, and they chose the session's series for the term its
 * date falls in.
 *
 * The other routes to a session — every series (a tier that includes them all,
 * or a series bought outright) and session credits — are entitlements and are
 * checked where they always were. This is only the per-term route.
 *
 * Executable by anon because it is evaluated inside RLS policies (note 08
 * §61.1); it answers false without a session.
 */
create or replace function public.member_holds_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_coaching_sessions s
    join public.membership_choices mc
      on mc.user_id = auth.uid()
     and mc.kind = 'series'
     and mc.resource_id = s.series_id
     and mc.term_id = public.term_at(s.starts_at)
    where s.id = p_session_id
      and exists (select 1 from public.membership_of(auth.uid()))
  );
$$;

revoke all on function public.member_holds_session(uuid) from public;
grant execute on function public.member_holds_session(uuid) to anon, authenticated;

drop policy if exists "gc_sessions: member term read" on public.group_coaching_sessions;
create policy "gc_sessions: member term read"
  on public.group_coaching_sessions for select
  using (public.member_holds_session(id));

-- A replay goes to whoever may open its session: booked it, holds its series,
-- or chose that series for that term (0009, with the third added).
drop policy if exists "resources: recording of an accessible experience" on public.resources;
create policy "resources: recording of an accessible experience"
  on public.resources for select
  using (
    exists (
      select 1 from public.cohort_workshops w
      where w.recording_resource_id = resources.id
        and public.has_active_entitlement('cohort', w.cohort_id)
    )
    or exists (
      select 1 from public.group_coaching_sessions s
      where s.recording_resource_id = resources.id
        and (
          public.has_booking('group_coaching_session', s.id)
          or public.has_active_entitlement('group_coaching_series', s.series_id)
          or public.member_holds_session(s.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Choosing
-- ---------------------------------------------------------------------------

drop function if exists public.choose_membership_item(text, uuid);

/**
 * A member chooses a series for a term, or their playlist.
 *
 *   series    `p_term_id` names the term (the current one, or one already
 *             published to come). The tier sets how many per term. A choice
 *             stands for that term; the next term is chosen afresh.
 *   playlist  no term. Chosen once and kept.
 *
 * Returns a status rather than raising, so the page can explain:
 *   ok · already · included (the tier has all of them, nothing to choose)
 *   limit_reached · not_allowed (a playlist above their tier)
 *   term_closed (no such term, or it has ended)
 *   no_membership · not_found · not_authenticated · invalid
 */
create or replace function public.choose_membership_item(
  p_kind text,
  p_resource_id uuid,
  p_term_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  v_allowance integer;
  v_count integer;
  v_min_rank integer;
  v_term_id uuid := null;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  if p_kind not in ('series', 'playlist') or p_resource_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into m from public.membership_of(v_user_id);
  if m.entitlement_id is null then
    return jsonb_build_object('status', 'no_membership');
  end if;

  v_allowance := case p_kind when 'series' then m.series_allowance else m.playlist_allowance end;
  if v_allowance is null then
    return jsonb_build_object('status', 'included');
  end if;

  if p_kind = 'series' then
    if not exists (
      select 1 from public.group_coaching_series where id = p_resource_id and status = 'published'
    ) then
      return jsonb_build_object('status', 'not_found');
    end if;

    select t.id into v_term_id
    from public.coaching_terms t
    where t.id = p_term_id and t.status = 'published' and t.ends_at > now();
    if v_term_id is null then
      return jsonb_build_object('status', 'term_closed');
    end if;
  else
    select t.rank into v_min_rank
    from public.playlists p
    join public.membership_tiers t on t.tier = p.min_tier
    where p.id = p_resource_id and p.status = 'published';

    if v_min_rank is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    if v_min_rank > m.rank then
      return jsonb_build_object('status', 'not_allowed');
    end if;
  end if;

  -- One member's choices are made one at a time, so two requests cannot both
  -- count "none yet" and both be accepted.
  perform pg_advisory_xact_lock(hashtext('membership_choice:' || v_user_id::text));

  if exists (
    select 1 from public.membership_choices
    where user_id = v_user_id and kind = p_kind and resource_id = p_resource_id
      and term_id is not distinct from v_term_id
  ) then
    return jsonb_build_object('status', 'already');
  end if;

  select count(*) into v_count
  from public.membership_choices
  where user_id = v_user_id and kind = p_kind and term_id is not distinct from v_term_id;

  if v_count >= v_allowance then
    return jsonb_build_object('status', 'limit_reached', 'allowance', v_allowance);
  end if;

  insert into public.membership_choices (user_id, kind, resource_id, term_id)
  values (v_user_id, p_kind, p_resource_id, v_term_id);

  perform public.sync_membership_entitlements(v_user_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.choose_membership_item(text, uuid, uuid) from public, anon;
grant execute on function public.choose_membership_item(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Membership → what it includes (replaces 0012's)
-- ---------------------------------------------------------------------------

/**
 * `sync_membership_entitlements` (0012), with one change: a chosen series is
 * no longer written as a standing series entitlement. Running it retires any
 * that 0012 wrote.
 */
create or replace function public.sync_membership_entitlements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select * into m from public.membership_of(p_user_id);

  -- Only the rows this function writes: derived from a membership row
  -- (`source_id`), of the three kinds a tier includes. Anything else marked as
  -- membership-sourced is somebody else's to manage.
  update public.entitlements
     set status = 'expired'
   where user_id = p_user_id
     and source_type = 'membership'
     and source_id is not null
     and resource_type in ('group_coaching_series', 'playlist', 'retreat')
     and status = 'active';

  if m.entitlement_id is null then
    return;
  end if;

  insert into public.entitlements
    (user_id, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at)
  select p_user_id, d.resource_type, d.resource_id, 'membership', m.entitlement_id, 'active', now(), m.expires_at
  from (
    -- Group Coaching: every series, where the tier includes them all. A tier
    -- that includes a NUMBER of series is not derived here: its member chooses
    -- per term, and `member_holds_session` reads those choices directly.
    select 'group_coaching_series'::public.entitlement_resource as resource_type, null::uuid as resource_id
     where m.series_allowance is null
    union all
    -- Playlists: every one, or the ones chosen.
    select 'playlist'::public.entitlement_resource, null::uuid
     where m.playlist_allowance is null
    union all
    select 'playlist'::public.entitlement_resource, c.resource_id
      from (
        select mc.resource_id
        from public.membership_choices mc
        where mc.user_id = p_user_id and mc.kind = 'playlist'
        order by mc.created_at, mc.id
        limit coalesce(m.playlist_allowance, 0)
      ) c
     where m.playlist_allowance is not null
    union all
    -- Retreats open without an application (see has_retreat_access).
    select 'retreat'::public.entitlement_resource, null::uuid
     where m.includes_retreats
  ) d
  on conflict (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
    where source_id is not null
  do update set status = 'active', expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.sync_membership_entitlements(uuid) from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select distinct user_id from public.entitlements where resource_type = 'membership' and status = 'active' loop
    perform public.sync_membership_entitlements(r.user_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Booking (replaces 0012's)
-- ---------------------------------------------------------------------------

/**
 * `book_group_session`, with a member's term choice as a way to book: after
 * standing series access, before spending a credit. A member is never charged
 * a credit for a session their membership already covers.
 */
create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_taken integer;
  v_entitlement record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  -- FOR UPDATE serialises everything below against a concurrent booking of the
  -- same session. Without this lock two requests can both read capacity as
  -- available and both insert (note 08 §65).
  select * into v_session
  from public.group_coaching_sessions
  where id = p_session_id
  for update;

  if v_session is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status <> 'scheduled' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_session.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  -- Already booked? Idempotent: a double click must not consume two credits.
  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'group_coaching_session'
      and bookable_id = p_session_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  select count(*) into v_taken
  from public.bookings
  where bookable_type = 'group_coaching_session'
    and bookable_id = p_session_id
    and status in ('pending', 'confirmed');

  if v_taken >= v_session.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_session.capacity);
  end if;

  -- What covers this booking, in order of preference:
  --   1. series access with no quantity   unlimited, consumes nothing
  --   2. a member's choice for this term  consumes nothing (migration 0013)
  --   3. consumable session credits       one is spent, soonest to lapse first
  select * into v_entitlement
  from public.entitlements
  where user_id = v_user_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and resource_type = 'group_coaching_series'
    and (resource_id = v_session.series_id or resource_id is null)
    and quantity is null
  limit 1
  for update;

  if v_entitlement is null and public.member_holds_session(p_session_id) then
    -- Booked against the membership itself: nothing to count down.
    select e.* into v_entitlement
    from public.entitlements e
    where e.id = (select m.entitlement_id from public.membership_of(v_user_id) m);
  end if;

  if v_entitlement is null then
    select * into v_entitlement
    from public.entitlements
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
      and resource_type = 'group_coaching_session'
      and quantity is not null
      and quantity_used < quantity
    order by expires_at asc nulls last, created_at
    limit 1
    for update;
  end if;

  if v_entitlement is null then
    -- No covering entitlement. The caller is sent to buy — never charged here,
    -- because booking and payment are separate concerns (note 01 §11).
    return jsonb_build_object('status', 'not_entitled');
  end if;

  if v_entitlement.quantity is not null then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case
                      when quantity_used + 1 >= quantity then 'consumed'
                      else status
                    end
     where id = v_entitlement.id;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
  values
    (v_user_id, 'group_coaching_session', p_session_id, v_entitlement.id,
     'confirmed', v_session.starts_at, v_session.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'ok',
    'booking_id', v_booking_id,
    'consumed_credit', v_entitlement.quantity is not null
  );
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Scheduling a series for a term in one go
-- ---------------------------------------------------------------------------

/**
 * Create a run of weekly sessions for one series: session 1 at `p_first_start`,
 * then one a week, each titled with its topic from the series' syllabus.
 *
 * Service role only (the admin page checks `coaching.manage` first). Refuses
 * to add a session at a time the series already has one, so pressing the
 * button twice does not double the term.
 */
create or replace function public.schedule_series_sessions(
  p_series_id uuid,
  p_first_start timestamptz,
  p_count integer default null,
  p_minutes integer default 60,
  p_meeting_url text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series record;
  v_total integer;
  v_created integer := 0;
  v_start timestamptz;
  i integer;
begin
  select * into v_series from public.group_coaching_series where id = p_series_id;
  if not found then
    raise exception 'Unknown series';
  end if;

  v_total := coalesce(p_count, nullif(cardinality(v_series.syllabus), 0), 8);
  if v_total < 1 or v_total > 52 or p_minutes < 15 or p_minutes > 480 then
    raise exception 'Unreasonable number of sessions or length';
  end if;

  for i in 1..v_total loop
    v_start := p_first_start + make_interval(weeks => i - 1);
    if exists (
      select 1 from public.group_coaching_sessions s
      where s.series_id = p_series_id and s.starts_at = v_start
    ) then
      continue;
    end if;

    insert into public.group_coaching_sessions (series_id, title, starts_at, ends_at, meeting_url, status)
    values (
      p_series_id,
      coalesce(v_series.syllabus[i], v_series.name || ' — session ' || i),
      v_start,
      v_start + make_interval(mins => p_minutes),
      nullif(btrim(p_meeting_url), ''),
      'scheduled'
    );
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.schedule_series_sessions(uuid, timestamptz, integer, integer, text) from public, anon, authenticated;


-- ===========================================================================
-- 0014_series_packs  (was migration 0014, before 2026-10-15)
-- ===========================================================================

-- 0014 — Group Coaching sessions belong to the series they were bought for.
-- Architecture: note 07 §14; note 09 §28.1, §31.
--
-- THE RULE (owner, 2026-10-09):
--
--   £25   one session OF ONE SERIES — the series it was bought on. Used on one
--         session, it is spent.
--   £130  eight sessions OF ONE SERIES, to use within three months of purchase.
--         Each booking spends one.
--
-- Until now both were good for any series. Each series now has its own two
-- products, and a product says which series it is for (`products.series_id`).
-- What it grants carries that series: a `group_coaching_session` entitlement
-- whose `resource_id` is the series. A null `resource_id` still means "any
-- series" — sessions granted by staff, or bought before this rule.

alter table public.products
  add column if not exists series_id uuid references public.group_coaching_series (id) on delete set null;

comment on column public.products.series_id is
  'For a Group Coaching product: the series its sessions are for. They can be used on that series only. Null for any series.';

-- ---------------------------------------------------------------------------
-- 1. Which sessions a holder of sessions may see
-- ---------------------------------------------------------------------------

/**
 * True when the caller holds an unspent session usable on this series: one
 * bought for it, or one good for any series.
 *
 * `has_session_credits()` (0003) asks the wider question — any unspent session
 * at all — and stays for the callers that mean that.
 * Evaluated inside an RLS policy, so executable by anon (note 08 §61.1).
 */
create or replace function public.has_session_credits_for(p_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = auth.uid()
      and e.resource_type = 'group_coaching_session'
      and (e.resource_id is null or e.resource_id = p_series_id)
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and e.quantity is not null
      and e.quantity_used < e.quantity
  );
$$;

revoke all on function public.has_session_credits_for(uuid) from public;
grant execute on function public.has_session_credits_for(uuid) to anon, authenticated;

-- Sessions bought for Writing show Writing's sessions, not every series'.
drop policy if exists "gc_sessions: entitled read" on public.group_coaching_sessions;
create policy "gc_sessions: entitled read"
  on public.group_coaching_sessions for select
  using (
    public.has_active_entitlement('group_coaching_series', series_id)
    or public.has_session_credits_for(series_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Payment → entitlement (replaces 0012's)
-- ---------------------------------------------------------------------------

create or replace function public.grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted integer := 0;
  v_item record;
  v_resource_type public.entitlement_resource;
  v_resource_id uuid;
  v_quantity integer;
  v_expires timestamptz;
  v_units integer;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.product_type, p.credits, p.valid_months, p.pack_of,
           p.series_id, pr.billing_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    left join public.prices pr on pr.id = oi.price_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;
    v_quantity := null;
    v_units := greatest(coalesce(v_item.quantity, 1), 1);
    v_expires := case
                   when v_item.valid_months is not null
                     then now() + make_interval(months => v_item.valid_months)
                 end;

    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
      when 'group_coaching' then
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
        if v_resource_id is not null and v_item.credits is null then
          -- A product that sells one whole series, standing.
          v_resource_type := 'group_coaching_series';
        else
          -- Seats, FOR THE PRODUCT'S SERIES: `resource_id` is that series, and
          -- booking spends them on it alone. A product with no series grants
          -- seats good for any (`resource_id` null).
          v_resource_type := 'group_coaching_session';
          v_resource_id := v_item.series_id;
          v_quantity := coalesce(v_item.credits, 1) * v_units;
        end if;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;  -- never a place at every retreat
        end if;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      when 'private_coaching' then
        v_resource_type := 'private_coaching';
        select id into v_resource_id
        from public.private_coaching_services
        where product_id in (v_item.product_id, v_item.pack_of)
        order by (product_id = v_item.product_id) desc
        limit 1;
        if v_resource_id is null then
          continue;  -- a pack whose service is gone grants nothing bookable
        end if;
        v_quantity := coalesce(v_item.credits, 1) * v_units;
      when 'membership' then
        if v_item.billing_type is distinct from 'one_time' then
          continue;  -- a subscription: granted by apply_subscription_membership
        end if;
        v_resource_type := 'membership';
        select id into v_resource_id from public.membership_tiers where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;
        end if;
        -- A year from now — or from the end of the year already held, so
        -- paying early for the next one loses nothing.
        select greatest(coalesce(max(e.expires_at), now()), now()) + interval '1 year'
          into v_expires
        from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'membership'
          and e.resource_id = v_resource_id
          and e.status = 'active';
      else
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status, quantity, expires_at)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active', v_quantity, v_expires)
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Can it be bought (replaces 0012's): "unused" is asked per series
-- ---------------------------------------------------------------------------

create or replace function public.coaching_sale_status(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  r record;
  v_taken integer;
  v_user_id uuid := auth.uid();
  v_type public.product_type;
  v_pack_of uuid;
  v_id uuid;
begin
  select p.product_type, p.pack_of into v_type, v_pack_of
  from public.products p where p.id = p_product_id;

  if v_user_id is not null then
    if v_type = 'course' then
      select id into v_id from public.courses where product_id = p_product_id limit 1;
      if v_id is not null and public.has_active_entitlement('course', v_id) then
        return 'owned';
      end if;

    elsif v_type = 'group_coaching' then
      -- Sessions for the same series still to use (any-series ones, for a
      -- product that names no series).
      select p.series_id into v_id from public.products p where p.id = p_product_id;
      if exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'group_coaching_session'
          and e.resource_id is not distinct from v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;

    elsif v_type = 'private_coaching' then
      select id into v_id
      from public.private_coaching_services
      where product_id in (p_product_id, v_pack_of)
      order by (product_id = p_product_id) desc
      limit 1;

      if v_id is not null and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'private_coaching'
          and e.resource_id = v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
    end if;
  end if;

  select * into c from public.cohorts where product_id = p_product_id limit 1;
  if found then
    if c.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_active_entitlement('cohort', c.id) then
      return 'owned';
    end if;
    -- Same rule as a retreat (owner, 2026-10-08): nobody joins a cohort
    -- before its dates are announced, or after it has begun — it is one
    -- group, start to finish.
    if c.starts_at is null then
      return 'unscheduled';
    end if;
    if c.starts_at <= now() then
      return 'past';
    end if;
    if c.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'cohort'
        and e.resource_id = c.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= c.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_retreat_access(r.id) then
      return 'owned';
    end if;
    if r.starts_at is null then
      return 'unscheduled';
    end if;
    if r.starts_at <= now() then
      return 'past';
    end if;
    if r.requires_application and not exists (
      select 1 from public.retreat_applications a
      where a.retreat_id = r.id and a.user_id = v_user_id and a.status = 'approved'
    ) then
      return 'application';
    end if;
    if r.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'retreat'
        and e.resource_id = r.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= r.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Booking (replaces 0013's): sessions are spent only on their own series
-- ---------------------------------------------------------------------------

create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_taken integer;
  v_entitlement record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  -- FOR UPDATE serialises everything below against a concurrent booking of the
  -- same session. Without this lock two requests can both read capacity as
  -- available and both insert (note 08 §65).
  select * into v_session
  from public.group_coaching_sessions
  where id = p_session_id
  for update;

  if v_session is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status <> 'scheduled' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_session.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  -- Already booked? Idempotent: a double click must not consume two credits.
  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'group_coaching_session'
      and bookable_id = p_session_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  select count(*) into v_taken
  from public.bookings
  where bookable_type = 'group_coaching_session'
    and bookable_id = p_session_id
    and status in ('pending', 'confirmed');

  if v_taken >= v_session.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_session.capacity);
  end if;

  -- What covers this booking, in order of preference:
  --   1. series access with no quantity   unlimited, consumes nothing
  --   2. a member's choice for this term  consumes nothing (migration 0013)
  --   3. consumable session credits       one is spent, soonest to lapse first
  select * into v_entitlement
  from public.entitlements
  where user_id = v_user_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and resource_type = 'group_coaching_series'
    and (resource_id = v_session.series_id or resource_id is null)
    and quantity is null
  limit 1
  for update;

  if v_entitlement is null and public.member_holds_session(p_session_id) then
    -- Booked against the membership itself: nothing to count down.
    select e.* into v_entitlement
    from public.entitlements e
    where e.id = (select m.entitlement_id from public.membership_of(v_user_id) m);
  end if;

  if v_entitlement is null then
    select * into v_entitlement
    from public.entitlements
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
      and resource_type = 'group_coaching_session'
      -- Sessions bought for a series are spent only on that series (0014).
      and (resource_id is null or resource_id = v_session.series_id)
      and quantity is not null
      and quantity_used < quantity
    order by expires_at asc nulls last, (resource_id is null), created_at
    limit 1
    for update;
  end if;

  if v_entitlement is null then
    -- No covering entitlement. The caller is sent to buy — never charged here,
    -- because booking and payment are separate concerns (note 01 §11).
    return jsonb_build_object('status', 'not_entitled');
  end if;

  if v_entitlement.quantity is not null then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case
                      when quantity_used + 1 >= quantity then 'consumed'
                      else status
                    end
     where id = v_entitlement.id;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
  values
    (v_user_id, 'group_coaching_session', p_session_id, v_entitlement.id,
     'confirmed', v_session.starts_at, v_session.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'ok',
    'booking_id', v_booking_id,
    'consumed_credit', v_entitlement.quantity is not null
  );
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;


-- ===========================================================================
-- 0016_series_runs_and_registration  (was migration 0016, before 2026-10-15)
-- ===========================================================================

-- 0016 — Series runs: a series has dates, and a place on it is registered once.
-- Architecture: note 07 §12.1, §14.2; note 09 §28.1, §31.
--
-- THE DECISION (owner, 2026-10-09).
--
--   A RUN is one running of a series: eight weekly sessions with a start and
--   an end date, a registration period before it, and a number of places.
--
--     registration open   from `registration_opens_at` until the run starts.
--                         The only time anything can be bought for it.
--     in progress         shown, and closed: nobody joins a run under way.
--     ended               gone from the list. The next run has its own dates.
--
--   £130  a PLACE ON THE RUN: a seat in all eight sessions, with no booking.
--   £25   ONE SESSION of the run, which the customer then picks.
--
--   A full run closes. A second run of the same series can be opened, at
--   another day and time, and registration carries on there.
--
-- MEMBERS ARE UNCHANGED, deliberately (the owner left that open): a member
-- still chooses a series for the term and books each session (0013). Their
-- bookings take seats in a run's sessions like any single booking.
--
-- Until now (0014) £130 bought eight separate seats to book one at a time, at
-- any point in three months. It now buys the run.

-- ---------------------------------------------------------------------------
-- 1. Runs
-- ---------------------------------------------------------------------------

create table if not exists public.coaching_runs (
  id         uuid primary key default gen_random_uuid(),
  series_id  uuid not null references public.group_coaching_series (id) on delete cascade,
  -- How customers tell two runs of a series apart: "Tuesdays, 4pm".
  label      text not null,
  registration_opens_at timestamptz not null default now(),
  -- The first session. Registration closes here.
  starts_at  timestamptz not null,
  -- The end of the last session.
  ends_at    timestamptz not null,
  capacity   integer not null check (capacity > 0),
  status     public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaching_runs_ends_after_starts check (ends_at > starts_at),
  constraint coaching_runs_opens_before_start check (registration_opens_at < starts_at)
);

create index if not exists coaching_runs_series_id_idx on public.coaching_runs (series_id);
create index if not exists coaching_runs_starts_at_idx on public.coaching_runs (starts_at);

create trigger coaching_runs_set_updated_at
  before update on public.coaching_runs
  for each row execute function public.set_updated_at();

comment on table public.coaching_runs is
  'One running of a Group Coaching series: eight weekly sessions between starts_at and ends_at, registered for '
  'between registration_opens_at and starts_at, for at most `capacity` people.';

alter table public.coaching_runs enable row level security;
create policy "coaching_runs: public read published"
  on public.coaching_runs for select using (status = 'published');
create policy "coaching_runs: staff read"
  on public.coaching_runs for select using (public.has_permission('coaching.read'));

alter table public.group_coaching_sessions
  add column if not exists run_id uuid references public.coaching_runs (id) on delete set null;

create index if not exists gcs_run_id_idx on public.group_coaching_sessions (run_id);

comment on column public.group_coaching_sessions.run_id is
  'The run this session is part of. Null for a one-off session outside any run.';

-- ---------------------------------------------------------------------------
-- 2. Registrations
-- ---------------------------------------------------------------------------

create table if not exists public.coaching_registrations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  run_id         uuid not null references public.coaching_runs (id) on delete cascade,
  -- The paid place this registration spent. Null for one made by staff.
  entitlement_id uuid references public.entitlements (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, run_id)
);

create index if not exists coaching_registrations_run_id_idx on public.coaching_registrations (run_id);
create index if not exists coaching_registrations_user_id_idx on public.coaching_registrations (user_id);

comment on table public.coaching_registrations is
  'A place on a run: a seat in every one of its sessions. Staff delete a row to free the place.';

alter table public.coaching_registrations enable row level security;
create policy "coaching_registrations: read own"
  on public.coaching_registrations for select using (user_id = auth.uid());
create policy "coaching_registrations: staff read"
  on public.coaching_registrations for select using (public.has_permission('coaching.read'));

/**
 * Places taken on a run: the people registered, plus the most single bookings
 * any one of its coming sessions has — because a place needs a seat in ALL of
 * them. Internal; `run_places_left` is the public face.
 */
create or replace function public.run_seats_taken(p_run_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*)::int from public.coaching_registrations g where g.run_id = p_run_id)
       + coalesce((
           select max(n)::int from (
             select count(*) as n
             from public.group_coaching_sessions s
             join public.bookings b
               on b.bookable_type = 'group_coaching_session'
              and b.bookable_id = s.id
              and b.status in ('pending', 'confirmed')
             where s.run_id = p_run_id and s.starts_at > now()
             group by s.id
           ) per_session
         ), 0);
$$;

revoke all on function public.run_seats_taken(uuid) from public, anon, authenticated;

/** Places still free on a run — public, for the series page. */
create or replace function public.run_places_left(p_run_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(r.capacity - public.run_seats_taken(r.id), 0)
  from public.coaching_runs r
  where r.id = p_run_id and r.status = 'published';
$$;

grant execute on function public.run_places_left(uuid) to anon, authenticated;

/**
 * True when the caller is registered for the run this session belongs to.
 * Evaluated inside RLS policies, so executable by anon (note 08 §61.1).
 */
create or replace function public.holds_seat(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_coaching_sessions s
    join public.coaching_registrations g on g.run_id = s.run_id and g.user_id = auth.uid()
    where s.id = p_session_id
  );
$$;

revoke all on function public.holds_seat(uuid) from public;
grant execute on function public.holds_seat(uuid) to anon, authenticated;

drop policy if exists "gc_sessions: registered read" on public.group_coaching_sessions;
create policy "gc_sessions: registered read"
  on public.group_coaching_sessions for select
  using (public.holds_seat(id));

-- A replay goes to whoever may open its session (0009, 0013), now including
-- the people registered for its run.
drop policy if exists "resources: recording of an accessible experience" on public.resources;
create policy "resources: recording of an accessible experience"
  on public.resources for select
  using (
    exists (
      select 1 from public.cohort_workshops w
      where w.recording_resource_id = resources.id
        and public.has_active_entitlement('cohort', w.cohort_id)
    )
    or exists (
      select 1 from public.group_coaching_sessions s
      where s.recording_resource_id = resources.id
        and (
          public.has_booking('group_coaching_session', s.id)
          or public.has_active_entitlement('group_coaching_series', s.series_id)
          or public.member_holds_session(s.id)
          or public.holds_seat(s.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Registering
-- ---------------------------------------------------------------------------

/**
 * Put a user on a run, spending a paid place. Internal: it takes a user id.
 *
 *   ok · already
 *   series_taken   on another run of this series that has not finished
 *   not_open       registration has not opened yet
 *   closed         the run has started (or ended)
 *   full           no seat in every session
 *   no_pass        no paid place for this series
 *   not_found
 *
 * The run row is locked, so two people taking the last place are serialised.
 */
create or replace function public.register_user_for_run(p_user_id uuid, p_run_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_pass record;
begin
  select * into r from public.coaching_runs where id = p_run_id and status = 'published' for update;
  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.coaching_registrations where user_id = p_user_id and run_id = r.id) then
    return 'already';
  end if;
  if r.registration_opens_at > now() then
    return 'not_open';
  end if;
  if r.starts_at <= now() then
    return 'closed';
  end if;

  if exists (
    select 1
    from public.coaching_registrations g
    join public.coaching_runs o on o.id = g.run_id
    where g.user_id = p_user_id and o.series_id = r.series_id and o.ends_at > now()
  ) then
    return 'series_taken';
  end if;

  if public.run_seats_taken(r.id) >= r.capacity then
    return 'full';
  end if;

  select * into v_pass
  from public.entitlements
  where user_id = p_user_id
    and resource_type = 'series_pass'
    and (resource_id = r.series_id or resource_id is null)
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and quantity is not null
    and quantity_used < quantity
  order by expires_at asc nulls last, created_at
  limit 1
  for update;

  if not found then
    return 'no_pass';
  end if;

  update public.entitlements
     set quantity_used = quantity_used + 1,
         status = case when quantity_used + 1 >= quantity then 'consumed' else status end
   where id = v_pass.id;

  insert into public.coaching_registrations (user_id, run_id, entitlement_id)
  values (p_user_id, r.id, v_pass.id);

  return 'ok';
end;
$$;

revoke all on function public.register_user_for_run(uuid, uuid) from public, anon, authenticated;

/** The caller registers for a run with a place they have paid for. */
create or replace function public.register_for_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  return jsonb_build_object('status', public.register_user_for_run(auth.uid(), p_run_id));
end;
$$;

revoke all on function public.register_for_run(uuid) from public, anon;
grant execute on function public.register_for_run(uuid) to authenticated;

/**
 * Straight after paying: where the series has exactly ONE run open with a
 * place, the buyer is put on it — that is the whole of "no booking". With two
 * to choose between (a second run at another time) the choice is theirs, made
 * in the Academy; the place they paid for waits until then.
 */
create or replace function public.place_on_open_run(p_user_id uuid, p_series_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs uuid[];
begin
  select array_agg(r.id) into v_runs
  from public.coaching_runs r
  where r.series_id = p_series_id
    and r.status = 'published'
    and r.registration_opens_at <= now()
    and r.starts_at > now()
    and public.run_seats_taken(r.id) < r.capacity;

  if coalesce(cardinality(v_runs), 0) <> 1 then
    return 'choose';
  end if;
  return public.register_user_for_run(p_user_id, v_runs[1]);
end;
$$;

revoke all on function public.place_on_open_run(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Payment → entitlement (replaces 0014's)
-- ---------------------------------------------------------------------------

create or replace function public.grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted integer := 0;
  v_item record;
  v_resource_type public.entitlement_resource;
  v_resource_id uuid;
  v_quantity integer;
  v_expires timestamptz;
  v_units integer;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.product_type, p.credits, p.valid_months, p.pack_of,
           p.series_id, pr.billing_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    left join public.prices pr on pr.id = oi.price_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;
    v_quantity := null;
    v_units := greatest(coalesce(v_item.quantity, 1), 1);
    v_expires := case
                   when v_item.valid_months is not null
                     then now() + make_interval(months => v_item.valid_months)
                 end;

    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
      when 'group_coaching' then
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
        if v_resource_id is not null and v_item.credits is null then
          -- A product that sells one whole series, standing.
          v_resource_type := 'group_coaching_series';
        elsif v_item.series_id is not null and coalesce(v_item.credits, 1) > 1 then
          -- The series itself (the eight-session product): a place on ONE RUN
          -- of it — every session, no booking. Registered straight away below
          -- where there is one run to put them on.
          v_resource_type := 'series_pass';
          v_resource_id := v_item.series_id;
          v_quantity := v_units;
        else
          -- One seat, FOR THE PRODUCT'S SERIES: `resource_id` is that series,
          -- and booking spends it there alone. A product with no series grants
          -- a seat good for any (`resource_id` null).
          v_resource_type := 'group_coaching_session';
          v_resource_id := v_item.series_id;
          v_quantity := coalesce(v_item.credits, 1) * v_units;
        end if;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;  -- never a place at every retreat
        end if;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      when 'private_coaching' then
        v_resource_type := 'private_coaching';
        select id into v_resource_id
        from public.private_coaching_services
        where product_id in (v_item.product_id, v_item.pack_of)
        order by (product_id = v_item.product_id) desc
        limit 1;
        if v_resource_id is null then
          continue;  -- a pack whose service is gone grants nothing bookable
        end if;
        v_quantity := coalesce(v_item.credits, 1) * v_units;
      when 'membership' then
        if v_item.billing_type is distinct from 'one_time' then
          continue;  -- a subscription: granted by apply_subscription_membership
        end if;
        v_resource_type := 'membership';
        select id into v_resource_id from public.membership_tiers where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;
        end if;
        -- A year from now — or from the end of the year already held, so
        -- paying early for the next one loses nothing.
        select greatest(coalesce(max(e.expires_at), now()), now()) + interval '1 year'
          into v_expires
        from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'membership'
          and e.resource_id = v_resource_id
          and e.status = 'active';
      else
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status, quantity, expires_at)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active', v_quantity, v_expires)
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
        if v_resource_type = 'series_pass' then
          perform public.place_on_open_run(v_user_id, v_resource_id);
        end if;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Can it be bought (replaces 0014's)
-- ---------------------------------------------------------------------------

create or replace function public.coaching_sale_status(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  r record;
  v_taken integer;
  v_user_id uuid := auth.uid();
  v_type public.product_type;
  v_pack_of uuid;
  v_id uuid;
  v_is_series boolean;
  v_series_id uuid;
begin
  select p.product_type, p.pack_of into v_type, v_pack_of
  from public.products p where p.id = p_product_id;

  if v_user_id is not null then
    if v_type = 'course' then
      select id into v_id from public.courses where product_id = p_product_id limit 1;
      if v_id is not null and public.has_active_entitlement('course', v_id) then
        return 'owned';
      end if;

    elsif v_type = 'group_coaching' then
      -- Already paid for and not yet used, for the same series: a place not yet
      -- taken up (the eight-session product), or a single seat.
      select p.series_id, coalesce(p.credits, 1) > 1 into v_id, v_is_series from public.products p where p.id = p_product_id;
      if exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = (case when v_is_series then 'series_pass' else 'group_coaching_session' end)::public.entitlement_resource
          and e.resource_id is not distinct from v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
      -- Already on a run of it that has not finished.
      if v_is_series and exists (
        select 1 from public.coaching_registrations g
        join public.coaching_runs cr on cr.id = g.run_id
        where g.user_id = v_user_id and cr.series_id = v_id and cr.ends_at > now()
      ) then
        return 'owned';
      end if;

    elsif v_type = 'private_coaching' then
      select id into v_id
      from public.private_coaching_services
      where product_id in (p_product_id, v_pack_of)
      order by (product_id = p_product_id) desc
      limit 1;

      if v_id is not null and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'private_coaching'
          and e.resource_id = v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
    end if;
  end if;

  -- GROUP COACHING IS SOLD ONLY WHILE A RUN IS OPEN FOR REGISTRATION (owner,
  -- 2026-10-09): from the day registration opens until the series starts, and
  -- while it has a place. Asked for the signed-out too — it is about the run.
  if v_type = 'group_coaching' then
    select p.series_id into v_series_id from public.products p where p.id = p_product_id;
    if v_series_id is not null then
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.starts_at > now()
      ) then
        return 'closed';
      end if;
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.starts_at > now()
          and public.run_seats_taken(cr.id) < cr.capacity
      ) then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  select * into c from public.cohorts where product_id = p_product_id limit 1;
  if found then
    if c.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_active_entitlement('cohort', c.id) then
      return 'owned';
    end if;
    -- Same rule as a retreat (owner, 2026-10-08): nobody joins a cohort
    -- before its dates are announced, or after it has begun — it is one
    -- group, start to finish.
    if c.starts_at is null then
      return 'unscheduled';
    end if;
    if c.starts_at <= now() then
      return 'past';
    end if;
    if c.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'cohort'
        and e.resource_id = c.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= c.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_retreat_access(r.id) then
      return 'owned';
    end if;
    if r.starts_at is null then
      return 'unscheduled';
    end if;
    if r.starts_at <= now() then
      return 'past';
    end if;
    if r.requires_application and not exists (
      select 1 from public.retreat_applications a
      where a.retreat_id = r.id and a.user_id = v_user_id and a.status = 'approved'
    ) then
      return 'application';
    end if;
    if r.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'retreat'
        and e.resource_id = r.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= r.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Booking one session (replaces 0014's)
-- ---------------------------------------------------------------------------

create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_taken integer;
  v_entitlement record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  -- FOR UPDATE serialises everything below against a concurrent booking of the
  -- same session. Without this lock two requests can both read capacity as
  -- available and both insert (note 08 §65).
  select * into v_session
  from public.group_coaching_sessions
  where id = p_session_id
  for update;

  if v_session is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status <> 'scheduled' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_session.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  -- Registered for the run this session belongs to: they have their seat.
  if public.holds_seat(p_session_id) then
    return jsonb_build_object('status', 'enrolled');
  end if;

  -- Already booked? Idempotent: a double click must not consume two credits.
  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'group_coaching_session'
      and bookable_id = p_session_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  select count(*) into v_taken
  from public.bookings
  where bookable_type = 'group_coaching_session'
    and bookable_id = p_session_id
    and status in ('pending', 'confirmed');

  -- Everyone registered for the session's run has a seat in it too.
  if v_session.run_id is not null then
    v_taken := v_taken + (select count(*) from public.coaching_registrations g where g.run_id = v_session.run_id);
  end if;

  if v_taken >= v_session.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_session.capacity);
  end if;

  -- What covers this booking, in order of preference:
  --   1. series access with no quantity   unlimited, consumes nothing
  --   2. a member's choice for this term  consumes nothing (migration 0013)
  --   3. consumable session credits       one is spent, soonest to lapse first
  select * into v_entitlement
  from public.entitlements
  where user_id = v_user_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and resource_type = 'group_coaching_series'
    and (resource_id = v_session.series_id or resource_id is null)
    and quantity is null
  limit 1
  for update;

  if v_entitlement is null and public.member_holds_session(p_session_id) then
    -- Booked against the membership itself: nothing to count down.
    select e.* into v_entitlement
    from public.entitlements e
    where e.id = (select m.entitlement_id from public.membership_of(v_user_id) m);
  end if;

  if v_entitlement is null then
    select * into v_entitlement
    from public.entitlements
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
      and resource_type = 'group_coaching_session'
      -- Sessions bought for a series are spent only on that series (0014).
      and (resource_id is null or resource_id = v_session.series_id)
      and quantity is not null
      and quantity_used < quantity
    order by expires_at asc nulls last, (resource_id is null), created_at
    limit 1
    for update;
  end if;

  if v_entitlement is null then
    -- No covering entitlement. The caller is sent to buy — never charged here,
    -- because booking and payment are separate concerns (note 01 §11).
    return jsonb_build_object('status', 'not_entitled');
  end if;

  if v_entitlement.quantity is not null then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case
                      when quantity_used + 1 >= quantity then 'consumed'
                      else status
                    end
     where id = v_entitlement.id;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
  values
    (v_user_id, 'group_coaching_session', p_session_id, v_entitlement.id,
     'confirmed', v_session.starts_at, v_session.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'ok',
    'booking_id', v_booking_id,
    'consumed_credit', v_entitlement.quantity is not null
  );
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Creating a run (replaces 0013's schedule_series_sessions)
-- ---------------------------------------------------------------------------

drop function if exists public.schedule_series_sessions(uuid, timestamptz, integer, integer, text);

/**
 * Create a run of a series with its weekly sessions: session 1 at
 * `p_first_start`, then one a week, each titled with its topic.
 *
 * `p_label` is how customers tell two runs apart; left empty it is written
 * from the first session's day and time in UK time ("Tuesdays, 4pm").
 * Service role only (the admin page checks `coaching.manage` first).
 */
create or replace function public.schedule_series_run(
  p_series_id uuid,
  p_first_start timestamptz,
  p_registration_opens timestamptz default null,
  p_count integer default null,
  p_minutes integer default 60,
  p_meeting_url text default null,
  p_label text default null,
  p_capacity integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series record;
  v_total integer;
  v_run_id uuid;
  v_start timestamptz;
  v_capacity integer;
  v_opens timestamptz;
  i integer;
begin
  select * into v_series from public.group_coaching_series where id = p_series_id;
  if not found then
    raise exception 'Unknown series';
  end if;

  v_total := coalesce(p_count, nullif(cardinality(v_series.syllabus), 0), 8);
  if v_total < 1 or v_total > 52 or p_minutes < 15 or p_minutes > 480 then
    raise exception 'Unreasonable number of sessions or length';
  end if;

  v_capacity := coalesce(p_capacity, v_series.capacity);
  -- Open now unless a date is given; never later than the start.
  v_opens := least(coalesce(p_registration_opens, now()), p_first_start - interval '1 minute');

  insert into public.coaching_runs (series_id, label, registration_opens_at, starts_at, ends_at, capacity, status)
  values (
    p_series_id,
    coalesce(
      nullif(btrim(p_label), ''),
      trim(to_char(p_first_start at time zone 'Europe/London', 'FMDay')) || 's, ' ||
        lower(replace(to_char(p_first_start at time zone 'Europe/London', 'FMHH12:MIam'), ':00', ''))
    ),
    v_opens,
    p_first_start,
    p_first_start + make_interval(weeks => v_total - 1, mins => p_minutes),
    v_capacity,
    'published'
  )
  returning id into v_run_id;

  for i in 1..v_total loop
    v_start := p_first_start + make_interval(weeks => i - 1);
    insert into public.group_coaching_sessions (series_id, run_id, title, starts_at, ends_at, capacity, meeting_url, status)
    values (
      p_series_id,
      v_run_id,
      coalesce(v_series.syllabus[i], v_series.name || ' — session ' || i),
      v_start,
      v_start + make_interval(mins => p_minutes),
      v_capacity,
      nullif(btrim(p_meeting_url), ''),
      'scheduled'
    );
  end loop;

  return v_run_id;
end;
$$;

revoke all on function public.schedule_series_run(uuid, timestamptz, timestamptz, integer, integer, text, text, integer)
  from public, anon, authenticated;


-- ===========================================================================
-- 0017_cohort_intakes  (was migration 0017, before 2026-10-15)
-- ===========================================================================

-- 0017 — Cohort intakes: the cohort stays, and each running of it is an intake.
-- Architecture: note 07 §16.2; note 09 §28.1, §37.
--
-- THE DECISION (owner, 2026-10-09). Until now a cohort row WAS one running of
-- it: it carried the dates and the places, and running the level again meant
-- creating a new cohort with a new product. A cohort is now the fixed thing —
-- Silver, Gold, Platinum: its page, what it delivers, its price — and each
-- time it runs is an INTAKE of it, exactly as a series has runs (0016).
--
--   An INTAKE   one running of a cohort: its eight workshops, a start and an
--               end date, a registration period before it, and its places.
--
--     registration open   from `registration_opens_at` until it starts.
--                         The only time the cohort can be joined.
--     in progress         shown, and closed: it is one group, start to finish.
--     ended               gone from the page. The next intake has its own dates.
--
--   The price buys A PLACE ON ONE INTAKE. Next year's intake is a new place.
--   A full intake closes; a second can be opened beside it.
--
-- Whether a cohort is open is therefore decided by its intakes, never by the
-- cohort. `cohorts.starts_at`, `ends_at` and `capacity` are no longer read.

-- ---------------------------------------------------------------------------
-- 1. Intakes, their workshops, and who is on them
-- ---------------------------------------------------------------------------

create table if not exists public.cohort_intakes (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  -- As customers tell intakes apart: "Spring 2027".
  label      text not null,
  registration_opens_at timestamptz not null default now(),
  -- The first workshop. Registration closes here.
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  -- Places. Null for no limit; the page then makes no claim about size.
  capacity   integer check (capacity is null or capacity > 0),
  status     public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohort_intakes_ends_after_starts check (ends_at > starts_at),
  constraint cohort_intakes_opens_before_start check (registration_opens_at < starts_at)
);

create index if not exists cohort_intakes_cohort_id_idx on public.cohort_intakes (cohort_id);
create index if not exists cohort_intakes_starts_at_idx on public.cohort_intakes (starts_at);

create trigger cohort_intakes_set_updated_at
  before update on public.cohort_intakes
  for each row execute function public.set_updated_at();

comment on table public.cohort_intakes is
  'One running of a cohort: its workshops between starts_at and ends_at, joined between registration_opens_at '
  'and starts_at, for at most `capacity` people. A cohort is open exactly when one of its intakes is.';

alter table public.cohort_intakes enable row level security;
create policy "cohort_intakes: public read published"
  on public.cohort_intakes for select using (status = 'published');
create policy "cohort_intakes: staff read"
  on public.cohort_intakes for select using (public.has_permission('cohorts.read'));

alter table public.cohort_workshops
  add column if not exists intake_id uuid references public.cohort_intakes (id) on delete cascade;

create index if not exists cohort_workshops_intake_id_idx on public.cohort_workshops (intake_id);

comment on column public.cohort_workshops.intake_id is
  'The intake this workshop belongs to: only the people on that intake see it. Null for a workshop created before intakes.';

create table if not exists public.cohort_enrolments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  intake_id      uuid not null references public.cohort_intakes (id) on delete cascade,
  -- The paid place this spent. Null for someone put on by staff.
  entitlement_id uuid references public.entitlements (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, intake_id)
);

create index if not exists cohort_enrolments_intake_id_idx on public.cohort_enrolments (intake_id);
create index if not exists cohort_enrolments_user_id_idx on public.cohort_enrolments (user_id);

comment on table public.cohort_enrolments is
  'A place on an intake of a cohort. Staff delete a row to free the place.';

alter table public.cohort_enrolments enable row level security;
create policy "cohort_enrolments: read own"
  on public.cohort_enrolments for select using (user_id = auth.uid());
create policy "cohort_enrolments: staff read"
  on public.cohort_enrolments for select using (public.has_permission('cohorts.read'));

-- ---------------------------------------------------------------------------
-- 2. Who is in a cohort
-- ---------------------------------------------------------------------------

/** Places taken on an intake. Internal; `intake_places_left` is the public face. */
create or replace function public.intake_seats_taken(p_intake_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.cohort_enrolments ce where ce.intake_id = p_intake_id;
$$;

revoke all on function public.intake_seats_taken(uuid) from public, anon, authenticated;

/** Places still free on an intake, or null where it has no limit. Public. */
create or replace function public.intake_places_left(p_intake_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when ci.capacity is null then null
              else greatest(ci.capacity - public.intake_seats_taken(ci.id), 0) end
  from public.cohort_intakes ci
  where ci.id = p_intake_id and ci.status = 'published';
$$;

grant execute on function public.intake_places_left(uuid) to anon, authenticated;

/**
 * Standing access to a cohort: an entitlement with NO quantity (granted by
 * staff, or bought before intakes). A counted entitlement is a place still to
 * be put on an intake, and opens nothing by itself.
 * Evaluated inside RLS policies, so executable by anon (note 08 §61.1).
 */
create or replace function public.has_standing_cohort_access(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.resource_type = 'cohort'
      and (e.resource_id = p_cohort_id or e.resource_id is null)
      and e.quantity is null
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

/** True when the caller is on this intake. An RLS predicate. */
create or replace function public.holds_intake(p_intake_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cohort_enrolments ce
    where ce.intake_id = p_intake_id and ce.user_id = auth.uid()
  );
$$;

/**
 * True when the caller is in this cohort at all — on any intake of it, past
 * ones included (their recordings stay theirs), or with standing access.
 */
create or replace function public.in_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_standing_cohort_access(p_cohort_id)
      or exists (
        select 1 from public.cohort_enrolments ce
        join public.cohort_intakes ci on ci.id = ce.intake_id
        where ce.user_id = auth.uid() and ci.cohort_id = p_cohort_id
      );
$$;

revoke all on function public.has_standing_cohort_access(uuid) from public;
revoke all on function public.holds_intake(uuid) from public;
revoke all on function public.in_cohort(uuid) from public;
grant execute on function public.has_standing_cohort_access(uuid) to anon, authenticated;
grant execute on function public.holds_intake(uuid) to anon, authenticated;
grant execute on function public.in_cohort(uuid) to anon, authenticated;

-- A workshop is for the people on its intake. (Before: anyone holding the
-- cohort, which would have given next year's workshops to last year's group.)
drop policy if exists "cohort_workshops: entitled read" on public.cohort_workshops;
create policy "cohort_workshops: entitled read"
  on public.cohort_workshops for select
  using (
    (intake_id is not null and public.holds_intake(intake_id))
    or public.has_standing_cohort_access(cohort_id)
  );

drop policy if exists "resources: recording of an accessible experience" on public.resources;
create policy "resources: recording of an accessible experience"
  on public.resources for select
  using (
    exists (
      select 1 from public.cohort_workshops w
      where w.recording_resource_id = resources.id
        and (
          (w.intake_id is not null and public.holds_intake(w.intake_id))
          or public.has_standing_cohort_access(w.cohort_id)
        )
    )
    or exists (
      select 1 from public.group_coaching_sessions s
      where s.recording_resource_id = resources.id
        and (
          public.has_booking('group_coaching_session', s.id)
          or public.has_active_entitlement('group_coaching_series', s.series_id)
          or public.member_holds_session(s.id)
          or public.holds_seat(s.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Joining an intake
-- ---------------------------------------------------------------------------

/**
 * Put a user on an intake, spending a paid place. Internal: it takes a user id.
 *
 *   ok · already
 *   cohort_taken   on another intake of this cohort that has not finished
 *   not_open       registration has not opened yet
 *   closed         the intake has started (or ended)
 *   full · no_place · not_found
 *
 * The intake row is locked, so two people taking the last place are serialised.
 */
create or replace function public.enrol_user_in_intake(p_user_id uuid, p_intake_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  i record;
  v_place record;
begin
  select * into i from public.cohort_intakes where id = p_intake_id and status = 'published' for update;
  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.cohort_enrolments where user_id = p_user_id and intake_id = i.id) then
    return 'already';
  end if;
  if i.registration_opens_at > now() then
    return 'not_open';
  end if;
  if i.starts_at <= now() then
    return 'closed';
  end if;

  if exists (
    select 1
    from public.cohort_enrolments ce
    join public.cohort_intakes o on o.id = ce.intake_id
    where ce.user_id = p_user_id and o.cohort_id = i.cohort_id and o.ends_at > now()
  ) then
    return 'cohort_taken';
  end if;

  if i.capacity is not null and public.intake_seats_taken(i.id) >= i.capacity then
    return 'full';
  end if;

  select * into v_place
  from public.entitlements
  where user_id = p_user_id
    and resource_type = 'cohort'
    and resource_id = i.cohort_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and quantity is not null
    and quantity_used < quantity
  order by created_at
  limit 1
  for update;

  if not found then
    return 'no_place';
  end if;

  update public.entitlements
     set quantity_used = quantity_used + 1,
         status = case when quantity_used + 1 >= quantity then 'consumed' else status end
   where id = v_place.id;

  insert into public.cohort_enrolments (user_id, intake_id, entitlement_id)
  values (p_user_id, i.id, v_place.id);

  return 'ok';
end;
$$;

revoke all on function public.enrol_user_in_intake(uuid, uuid) from public, anon, authenticated;

/** The caller joins an intake with a place they have paid for. */
create or replace function public.enrol_in_intake(p_intake_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  return jsonb_build_object('status', public.enrol_user_in_intake(auth.uid(), p_intake_id));
end;
$$;

revoke all on function public.enrol_in_intake(uuid) from public, anon;
grant execute on function public.enrol_in_intake(uuid) to authenticated;

/**
 * Straight after paying: where the cohort has exactly ONE intake open with a
 * place, the buyer is put on it. With two to choose between, the choice is
 * theirs, made in the Academy; the place they paid for waits until then.
 */
create or replace function public.place_on_open_intake(p_user_id uuid, p_cohort_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intakes uuid[];
begin
  select array_agg(ci.id) into v_intakes
  from public.cohort_intakes ci
  where ci.cohort_id = p_cohort_id
    and ci.status = 'published'
    and ci.registration_opens_at <= now()
    and ci.starts_at > now()
    and (ci.capacity is null or public.intake_seats_taken(ci.id) < ci.capacity);

  if coalesce(cardinality(v_intakes), 0) <> 1 then
    return 'choose';
  end if;
  return public.enrol_user_in_intake(p_user_id, v_intakes[1]);
end;
$$;

revoke all on function public.place_on_open_intake(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Payment → entitlement, and "can it be bought" (replace 0016's)
-- ---------------------------------------------------------------------------

create or replace function public.grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted integer := 0;
  v_item record;
  v_resource_type public.entitlement_resource;
  v_resource_id uuid;
  v_quantity integer;
  v_expires timestamptz;
  v_units integer;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.product_type, p.credits, p.valid_months, p.pack_of,
           p.series_id, pr.billing_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    left join public.prices pr on pr.id = oi.price_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;
    v_quantity := null;
    v_units := greatest(coalesce(v_item.quantity, 1), 1);
    v_expires := case
                   when v_item.valid_months is not null
                     then now() + make_interval(months => v_item.valid_months)
                 end;

    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        -- A PLACE on one intake of the cohort (migration 0017): counted, so it
        -- is spent on joining an intake and does not carry over to the next.
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;
        end if;
        v_quantity := v_units;
      when 'group_coaching' then
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
        if v_resource_id is not null and v_item.credits is null then
          -- A product that sells one whole series, standing.
          v_resource_type := 'group_coaching_series';
        elsif v_item.series_id is not null and coalesce(v_item.credits, 1) > 1 then
          -- The series itself (the eight-session product): a place on ONE RUN
          -- of it — every session, no booking. Registered straight away below
          -- where there is one run to put them on.
          v_resource_type := 'series_pass';
          v_resource_id := v_item.series_id;
          v_quantity := v_units;
        else
          -- One seat, FOR THE PRODUCT'S SERIES: `resource_id` is that series,
          -- and booking spends it there alone. A product with no series grants
          -- a seat good for any (`resource_id` null).
          v_resource_type := 'group_coaching_session';
          v_resource_id := v_item.series_id;
          v_quantity := coalesce(v_item.credits, 1) * v_units;
        end if;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;  -- never a place at every retreat
        end if;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      when 'private_coaching' then
        v_resource_type := 'private_coaching';
        select id into v_resource_id
        from public.private_coaching_services
        where product_id in (v_item.product_id, v_item.pack_of)
        order by (product_id = v_item.product_id) desc
        limit 1;
        if v_resource_id is null then
          continue;  -- a pack whose service is gone grants nothing bookable
        end if;
        v_quantity := coalesce(v_item.credits, 1) * v_units;
      when 'membership' then
        if v_item.billing_type is distinct from 'one_time' then
          continue;  -- a subscription: granted by apply_subscription_membership
        end if;
        v_resource_type := 'membership';
        select id into v_resource_id from public.membership_tiers where product_id = v_item.product_id limit 1;
        if v_resource_id is null then
          continue;
        end if;
        -- A year from now — or from the end of the year already held, so
        -- paying early for the next one loses nothing.
        select greatest(coalesce(max(e.expires_at), now()), now()) + interval '1 year'
          into v_expires
        from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'membership'
          and e.resource_id = v_resource_id
          and e.status = 'active';
      else
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status, quantity, expires_at)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active', v_quantity, v_expires)
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
        if v_resource_type = 'series_pass' then
          perform public.place_on_open_run(v_user_id, v_resource_id);
        elsif v_resource_type = 'cohort' then
          perform public.place_on_open_intake(v_user_id, v_resource_id);
        end if;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;

create or replace function public.coaching_sale_status(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  r record;
  v_taken integer;
  v_user_id uuid := auth.uid();
  v_type public.product_type;
  v_pack_of uuid;
  v_id uuid;
  v_is_series boolean;
  v_series_id uuid;
begin
  select p.product_type, p.pack_of into v_type, v_pack_of
  from public.products p where p.id = p_product_id;

  if v_user_id is not null then
    if v_type = 'course' then
      select id into v_id from public.courses where product_id = p_product_id limit 1;
      if v_id is not null and public.has_active_entitlement('course', v_id) then
        return 'owned';
      end if;

    elsif v_type = 'group_coaching' then
      -- Already paid for and not yet used, for the same series: a place not yet
      -- taken up (the eight-session product), or a single seat.
      select p.series_id, coalesce(p.credits, 1) > 1 into v_id, v_is_series from public.products p where p.id = p_product_id;
      if exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = (case when v_is_series then 'series_pass' else 'group_coaching_session' end)::public.entitlement_resource
          and e.resource_id is not distinct from v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
      -- Already on a run of it that has not finished.
      if v_is_series and exists (
        select 1 from public.coaching_registrations g
        join public.coaching_runs cr on cr.id = g.run_id
        where g.user_id = v_user_id and cr.series_id = v_id and cr.ends_at > now()
      ) then
        return 'owned';
      end if;

    elsif v_type = 'private_coaching' then
      select id into v_id
      from public.private_coaching_services
      where product_id in (p_product_id, v_pack_of)
      order by (product_id = p_product_id) desc
      limit 1;

      if v_id is not null and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'private_coaching'
          and e.resource_id = v_id
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
    end if;
  end if;

  -- GROUP COACHING IS SOLD ONLY WHILE A RUN IS OPEN FOR REGISTRATION (owner,
  -- 2026-10-09): from the day registration opens until the series starts, and
  -- while it has a place. Asked for the signed-out too — it is about the run.
  if v_type = 'group_coaching' then
    select p.series_id into v_series_id from public.products p where p.id = p_product_id;
    if v_series_id is not null then
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.starts_at > now()
      ) then
        return 'closed';
      end if;
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.starts_at > now()
          and public.run_seats_taken(cr.id) < cr.capacity
      ) then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  select * into c from public.cohorts where product_id = p_product_id limit 1;
  if found then
    if c.status <> 'published' then
      return 'unavailable';
    end if;

    if v_user_id is not null then
      -- In the cohort already: on an intake that has not finished, or holding
      -- standing access to it.
      if public.has_standing_cohort_access(c.id) or exists (
        select 1 from public.cohort_enrolments ce
        join public.cohort_intakes ci on ci.id = ce.intake_id
        where ce.user_id = v_user_id and ci.cohort_id = c.id and ci.ends_at > now()
      ) then
        return 'owned';
      end if;
      -- A place paid for and not yet on an intake.
      if exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'cohort'
          and e.resource_id = c.id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and e.quantity is not null
          and e.quantity_used < e.quantity
      ) then
        return 'unused';
      end if;
    end if;

    -- A COHORT IS JOINED ONLY WHILE AN INTAKE IS OPEN FOR REGISTRATION (owner,
    -- 2026-10-09): from the day registration opens until the intake starts,
    -- and while it has a place. The intake decides, not the cohort.
    if exists (
      select 1 from public.cohort_intakes ci
      where ci.cohort_id = c.id and ci.status = 'published'
        and ci.registration_opens_at <= now() and ci.starts_at > now()
        and (ci.capacity is null or public.intake_seats_taken(ci.id) < ci.capacity)
    ) then
      return 'ok';
    end if;
    if exists (
      select 1 from public.cohort_intakes ci
      where ci.cohort_id = c.id and ci.status = 'published'
        and ci.registration_opens_at <= now() and ci.starts_at > now()
    ) then
      return 'full';
    end if;
    if exists (
      select 1 from public.cohort_intakes ci
      where ci.cohort_id = c.id and ci.status = 'published' and ci.starts_at > now()
    ) then
      return 'closed';       -- an intake is coming; registration has not opened
    end if;
    if exists (
      select 1 from public.cohort_intakes ci
      where ci.cohort_id = c.id and ci.status = 'published' and ci.ends_at > now()
    ) then
      return 'past';         -- an intake is under way
    end if;
    return 'unscheduled';    -- no intake has dates
  end if;

  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;
    if v_user_id is not null and public.has_retreat_access(r.id) then
      return 'owned';
    end if;
    if r.starts_at is null then
      return 'unscheduled';
    end if;
    if r.starts_at <= now() then
      return 'past';
    end if;
    if r.requires_application and not exists (
      select 1 from public.retreat_applications a
      where a.retreat_id = r.id and a.user_id = v_user_id and a.status = 'approved'
    ) then
      return 'application';
    end if;
    if r.capacity is not null then
      select count(*) into v_taken
      from public.entitlements e
      where e.resource_type = 'retreat'
        and e.resource_id = r.id
        and e.status = 'active'
        and (e.expires_at is null or e.expires_at > now());
      if v_taken >= r.capacity then
        return 'full';
      end if;
    end if;
    return 'ok';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;


-- ===========================================================================
-- 0018_remove_terms_series_per_year  (was migration 0018, before 2026-10-15)
-- ===========================================================================

-- 0018 — Terms are removed; a member's series are counted by the year.
-- Architecture: note 07 §10.1, §12.1, §14.2.
--
-- THE DECISION (owner, 2026-10-09). Terms (0013) and series runs (0016) both
-- said when a series is on. Runs do it better — a run has its own dates and
-- its own registration — so terms go, and with them the member's "choice for
-- the term" and the per-session booking that went with it.
--
-- A MEMBER NOW TAKES A SERIES THE WAY A BUYER DOES: by registering for a run
-- of it while registration is open, for a seat in all eight sessions. Their
-- membership pays, up to a number of series in each MEMBERSHIP YEAR:
--
--     Silver 1 · Gold 2 · Platinum 4
--
-- That is the coaching site's own offer ("one group series", "2 entire group
-- series", "all 32 … sessions" for the year), and it is what answers the
-- price: a membership that gave a new series every term cost a third of the
-- £130 series it included.
--
-- A membership year runs from the day the membership began, and from each
-- anniversary after it.

-- ---------------------------------------------------------------------------
-- 1. The allowance is per year, and Platinum's is four
-- ---------------------------------------------------------------------------

update public.membership_tiers set series_allowance = 4 where tier = 'platinum' and series_allowance is null;

comment on column public.membership_tiers.series_allowance is
  'Group Coaching series a member of this tier may register for in each MEMBERSHIP YEAR (from the day the membership '
  'began, and each anniversary). Null for no limit.';

alter table public.coaching_registrations
  add column if not exists source text not null default 'purchase'
    check (source in ('purchase', 'membership', 'staff'));

comment on column public.coaching_registrations.source is
  'What the place rests on. A membership''s place lasts while the membership does; a bought one, and one made by staff, last the run.';

-- ---------------------------------------------------------------------------
-- 2. Reading a membership: when it began
-- ---------------------------------------------------------------------------

drop function if exists public.my_membership();
drop function if exists public.membership_of(uuid);

create or replace function public.membership_of(p_user_id uuid)
returns table (
  entitlement_id     uuid,
  tier               public.membership_tier,
  tier_id            uuid,
  tier_name          text,
  rank               integer,
  source_type        public.entitlement_source,
  expires_at         timestamptz,
  series_allowance   integer,
  playlist_allowance integer,
  includes_qa        boolean,
  includes_retreats  boolean,
  yearly             boolean,
  starts_at          timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, t.tier, t.id, t.name, t.rank, e.source_type, e.expires_at,
         t.series_allowance, t.playlist_allowance, t.includes_qa,
         t.includes_retreats and (not t.retreats_require_yearly or y.yearly),
         y.yearly,
         e.starts_at
  from public.entitlements e
  join public.membership_tiers t on t.id = e.resource_id
  left join public.subscriptions s on e.source_type = 'membership' and s.id = e.source_id
  cross join lateral (
    select case
             when e.source_type <> 'membership' then true
             -- Stripe's interval where the webhook has recorded it; otherwise
             -- the length of the period paid for.
             else coalesce(
                    s.billing_interval = 'year',
                    s.current_period_end - s.current_period_start > interval '300 days',
                    false)
           end as yearly
  ) y
  where e.user_id = p_user_id
    and e.resource_type = 'membership'
    and e.status = 'active'
    and e.starts_at <= now()
    and (e.expires_at is null or e.expires_at > now())
  order by t.rank desc, e.expires_at desc nulls first
  limit 1;
$$;

revoke all on function public.membership_of(uuid) from public, anon, authenticated;

create or replace function public.my_membership()
returns table (
  entitlement_id     uuid,
  tier               public.membership_tier,
  tier_id            uuid,
  tier_name          text,
  rank               integer,
  source_type        public.entitlement_source,
  expires_at         timestamptz,
  series_allowance   integer,
  playlist_allowance integer,
  includes_qa        boolean,
  includes_retreats  boolean,
  yearly             boolean,
  starts_at          timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.membership_of(auth.uid());
$$;

revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

/**
 * Series a member has registered for through their membership in the current
 * membership year. Internal: it takes a user id.
 */
create or replace function public.membership_series_used(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.coaching_registrations g
  cross join lateral (select * from public.membership_of(p_user_id)) m
  where g.user_id = p_user_id
    and g.source = 'membership'
    and g.created_at >= m.starts_at
        + make_interval(years => floor(extract(epoch from (now() - m.starts_at)) / 31557600)::int);
$$;

revoke all on function public.membership_series_used(uuid) from public, anon, authenticated;

/** The caller's series for this membership year: how many, and how many are used. */
create or replace function public.my_series_allowance()
returns table (allowance integer, used integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.series_allowance, public.membership_series_used(auth.uid())
  from public.membership_of(auth.uid()) m;
$$;

revoke all on function public.my_series_allowance() from public, anon;
grant execute on function public.my_series_allowance() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A place held through a membership lasts while the membership does
-- ---------------------------------------------------------------------------

create or replace function public.run_seats_taken(p_run_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::int
    from public.coaching_registrations g
    where g.run_id = p_run_id
      and (
        g.source <> 'membership'
        or exists (
          select 1 from public.entitlements e
          where e.id = g.entitlement_id and e.status = 'active'
            and (e.expires_at is null or e.expires_at > now())
        )
      )
  ) + coalesce((
    select max(n)::int from (
      select count(*) as n
      from public.group_coaching_sessions s
      join public.bookings b
        on b.bookable_type = 'group_coaching_session'
       and b.bookable_id = s.id
       and b.status in ('pending', 'confirmed')
      where s.run_id = p_run_id and s.starts_at > now()
      group by s.id
    ) per_session
  ), 0);
$$;

revoke all on function public.run_seats_taken(uuid) from public, anon, authenticated;

create or replace function public.holds_seat(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_coaching_sessions s
    join public.coaching_registrations g on g.run_id = s.run_id and g.user_id = auth.uid()
    where s.id = p_session_id
      and (
        g.source <> 'membership'
        or exists (
          select 1 from public.entitlements e
          where e.id = g.entitlement_id and e.status = 'active'
            and (e.expires_at is null or e.expires_at > now())
        )
      )
  );
$$;

revoke all on function public.holds_seat(uuid) from public;
grant execute on function public.holds_seat(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Registering: a bought place first, else the membership (replaces 0016's)
-- ---------------------------------------------------------------------------

create or replace function public.register_user_for_run(p_user_id uuid, p_run_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_pass record;
  m record;
begin
  select * into r from public.coaching_runs where id = p_run_id and status = 'published' for update;
  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.coaching_registrations where user_id = p_user_id and run_id = r.id) then
    return 'already';
  end if;
  if r.registration_opens_at > now() then
    return 'not_open';
  end if;
  if r.starts_at <= now() then
    return 'closed';
  end if;

  if exists (
    select 1
    from public.coaching_registrations g
    join public.coaching_runs o on o.id = g.run_id
    where g.user_id = p_user_id and o.series_id = r.series_id and o.ends_at > now()
  ) then
    return 'series_taken';
  end if;

  if public.run_seats_taken(r.id) >= r.capacity then
    return 'full';
  end if;

  select * into v_pass
  from public.entitlements
  where user_id = p_user_id
    and resource_type = 'series_pass'
    and (resource_id = r.series_id or resource_id is null)
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and quantity is not null
    and quantity_used < quantity
  order by expires_at asc nulls last, created_at
  limit 1
  for update;

  if found then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case when quantity_used + 1 >= quantity then 'consumed' else status end
     where id = v_pass.id;

    insert into public.coaching_registrations (user_id, run_id, entitlement_id, source)
    values (p_user_id, r.id, v_pass.id, 'purchase');
    return 'ok';
  end if;

  -- No place bought for it: their membership, while it has series left this year.
  select * into m from public.membership_of(p_user_id);
  if m.entitlement_id is null then
    return 'no_pass';
  end if;
  if m.series_allowance is not null and public.membership_series_used(p_user_id) >= m.series_allowance then
    return 'limit_reached';
  end if;

  insert into public.coaching_registrations (user_id, run_id, entitlement_id, source)
  values (p_user_id, r.id, m.entitlement_id, 'membership');
  return 'ok';
end;
$$;

revoke all on function public.register_user_for_run(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Terms go
-- ---------------------------------------------------------------------------

drop policy if exists "gc_sessions: member term read" on public.group_coaching_sessions;

drop policy if exists "resources: recording of an accessible experience" on public.resources;
create policy "resources: recording of an accessible experience"
  on public.resources for select
  using (
    exists (
      select 1 from public.cohort_workshops w
      where w.recording_resource_id = resources.id
        and (
          (w.intake_id is not null and public.holds_intake(w.intake_id))
          or public.has_standing_cohort_access(w.cohort_id)
        )
    )
    or exists (
      select 1 from public.group_coaching_sessions s
      where s.recording_resource_id = resources.id
        and (
          public.has_booking('group_coaching_session', s.id)
          or public.has_active_entitlement('group_coaching_series', s.series_id)
          or public.holds_seat(s.id)
        )
    )
  );

create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_taken integer;
  v_entitlement record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  -- FOR UPDATE serialises everything below against a concurrent booking of the
  -- same session. Without this lock two requests can both read capacity as
  -- available and both insert (note 08 §65).
  select * into v_session
  from public.group_coaching_sessions
  where id = p_session_id
  for update;

  if v_session is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_session.status <> 'scheduled' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_session.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  -- Registered for the run this session belongs to: they have their seat.
  if public.holds_seat(p_session_id) then
    return jsonb_build_object('status', 'enrolled');
  end if;

  -- Already booked? Idempotent: a double click must not consume two credits.
  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'group_coaching_session'
      and bookable_id = p_session_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  select count(*) into v_taken
  from public.bookings
  where bookable_type = 'group_coaching_session'
    and bookable_id = p_session_id
    and status in ('pending', 'confirmed');

  -- Everyone registered for the session's run has a seat in it too.
  if v_session.run_id is not null then
    v_taken := v_taken + (select count(*) from public.coaching_registrations g where g.run_id = v_session.run_id);
  end if;

  if v_taken >= v_session.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_session.capacity);
  end if;

  -- What covers this booking, in order of preference:
  --   1. series access with no quantity   unlimited, consumes nothing
  --   2. a session bought for this series one is spent, soonest to lapse first
  select * into v_entitlement
  from public.entitlements
  where user_id = v_user_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and resource_type = 'group_coaching_series'
    and (resource_id = v_session.series_id or resource_id is null)
    and quantity is null
  limit 1
  for update;

  if v_entitlement is null then
    select * into v_entitlement
    from public.entitlements
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
      and resource_type = 'group_coaching_session'
      -- Sessions bought for a series are spent only on that series (0014).
      and (resource_id is null or resource_id = v_session.series_id)
      and quantity is not null
      and quantity_used < quantity
    order by expires_at asc nulls last, (resource_id is null), created_at
    limit 1
    for update;
  end if;

  if v_entitlement is null then
    -- No covering entitlement. The caller is sent to buy — never charged here,
    -- because booking and payment are separate concerns (note 01 §11).
    return jsonb_build_object('status', 'not_entitled');
  end if;

  if v_entitlement.quantity is not null then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case
                      when quantity_used + 1 >= quantity then 'consumed'
                      else status
                    end
     where id = v_entitlement.id;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
  values
    (v_user_id, 'group_coaching_session', p_session_id, v_entitlement.id,
     'confirmed', v_session.starts_at, v_session.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'ok',
    'booking_id', v_booking_id,
    'consumed_credit', v_entitlement.quantity is not null
  );
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;

drop function if exists public.member_holds_session(uuid);
drop function if exists public.choose_membership_item(text, uuid, uuid);

-- A series is registered for, not chosen: only playlist choices remain.
delete from public.membership_choices where kind = 'series';
alter table public.membership_choices drop constraint if exists membership_choices_series_has_term;
drop index if exists public.membership_choices_unique;
alter table public.membership_choices drop column if exists term_id;
create unique index if not exists membership_choices_unique
  on public.membership_choices (user_id, kind, resource_id);

comment on table public.membership_choices is
  'The playlist a member picked, where their tier includes a number rather than all. Chosen once and kept; staff '
  'remove a row to let a member choose again. (A series is not chosen here: it is registered for — coaching_registrations.)';

drop function if exists public.term_at(timestamptz);
drop table if exists public.coaching_terms;
drop function if exists public.coaching_terms_before_write();

/**
 * A member chooses their playlist. Returns a status rather than raising:
 *   ok · already · included (the tier has every playlist)
 *   limit_reached · not_allowed (a playlist above their tier)
 *   no_membership · not_found · not_authenticated
 */
create or replace function public.choose_playlist(p_playlist_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  m record;
  v_count integer;
  v_min_rank integer;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into m from public.membership_of(v_user_id);
  if m.entitlement_id is null then
    return jsonb_build_object('status', 'no_membership');
  end if;
  if m.playlist_allowance is null then
    return jsonb_build_object('status', 'included');
  end if;

  select t.rank into v_min_rank
  from public.playlists p
  join public.membership_tiers t on t.tier = p.min_tier
  where p.id = p_playlist_id and p.status = 'published';

  if v_min_rank is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_min_rank > m.rank then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  perform pg_advisory_xact_lock(hashtext('membership_choice:' || v_user_id::text));

  if exists (
    select 1 from public.membership_choices
    where user_id = v_user_id and kind = 'playlist' and resource_id = p_playlist_id
  ) then
    return jsonb_build_object('status', 'already');
  end if;

  select count(*) into v_count
  from public.membership_choices
  where user_id = v_user_id and kind = 'playlist';

  if v_count >= m.playlist_allowance then
    return jsonb_build_object('status', 'limit_reached', 'allowance', m.playlist_allowance);
  end if;

  insert into public.membership_choices (user_id, kind, resource_id)
  values (v_user_id, 'playlist', p_playlist_id);

  perform public.sync_membership_entitlements(v_user_id);

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.choose_playlist(uuid) from public, anon;
grant execute on function public.choose_playlist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Membership → what it includes (replaces 0013's): no series at all
-- ---------------------------------------------------------------------------

create or replace function public.sync_membership_entitlements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select * into m from public.membership_of(p_user_id);

  -- Only the rows this function writes: derived from a membership row
  -- (`source_id`), of the three kinds a tier includes. Anything else marked as
  -- membership-sourced is somebody else's to manage.
  update public.entitlements
     set status = 'expired'
   where user_id = p_user_id
     and source_type = 'membership'
     and source_id is not null
     and resource_type in ('group_coaching_series', 'playlist', 'retreat')
     and status = 'active';

  if m.entitlement_id is null then
    return;
  end if;

  insert into public.entitlements
    (user_id, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at)
  select p_user_id, d.resource_type, d.resource_id, 'membership', m.entitlement_id, 'active', now(), m.expires_at
  from (
    -- Group Coaching is not derived (migration 0018): a member takes a place on
    -- a series run, which is a registration, not an entitlement.
    -- Playlists: every one, or the ones chosen.
    select 'playlist'::public.entitlement_resource as resource_type, null::uuid as resource_id
     where m.playlist_allowance is null
    union all
    select 'playlist'::public.entitlement_resource, c.resource_id
      from (
        select mc.resource_id
        from public.membership_choices mc
        where mc.user_id = p_user_id and mc.kind = 'playlist'
        order by mc.created_at, mc.id
        limit coalesce(m.playlist_allowance, 0)
      ) c
     where m.playlist_allowance is not null
    union all
    -- Retreats open without an application (see has_retreat_access).
    select 'retreat'::public.entitlement_resource, null::uuid
     where m.includes_retreats
  ) d
  on conflict (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
    where source_id is not null
  do update set status = 'active', expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.sync_membership_entitlements(uuid) from public, anon, authenticated;

-- Retires the series entitlements earlier migrations derived.
do $$
declare
  r record;
begin
  for r in select distinct user_id from public.entitlements where resource_type = 'membership' and status = 'active' loop
    perform public.sync_membership_entitlements(r.user_id);
  end loop;
end;
$$;


-- ===========================================================================
-- 0019_membership_place_lasts_the_run  (was migration 0019, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0019 — A place taken through a membership lasts the run
-- =============================================================================
--
-- Owner, 2026-10-09. Membership is now one payment for twelve months, and a
-- member registers for the next run of a series whenever they like in that
-- year. Migration 0018 let a place taken through the membership stand only
-- while the membership was live, so a member who registered in their eleventh
-- month lost the last sessions of an eight-week run the day their year ended —
-- having spent one of their series on it.
--
-- A place registered for while a member is now kept to the end of the run.
--
-- The exception is a membership held as a SUBSCRIPTION (none is on sale; the
-- mechanism remains). There the 0018 rule stays, because without it a month's
-- payment would buy a whole series: register, cancel, keep the seat.
--
-- A membership that was revoked or refunded takes its places with it, however
-- it was paid for.
-- =============================================================================

/**
 * Does this registration still stand? Internal: used by `holds_seat` and
 * `run_seats_taken`, which must agree on who has a seat.
 */
create or replace function public.registration_stands(p_source text, p_entitlement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_source <> 'membership'
      or exists (
        select 1 from public.entitlements e
        where e.id = p_entitlement_id
          and e.status in ('active', 'expired')
          and (
            -- A year paid for outright: the place lasts the run.
            e.source_type <> 'membership'
            -- A subscription: only while it is being paid.
            or (e.status = 'active' and (e.expires_at is null or e.expires_at > now()))
          )
      );
$$;

revoke all on function public.registration_stands(text, uuid) from public, anon, authenticated;

create or replace function public.run_seats_taken(p_run_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::int
    from public.coaching_registrations g
    where g.run_id = p_run_id
      and public.registration_stands(g.source, g.entitlement_id)
  ) + coalesce((
    select max(n)::int from (
      select count(*) as n
      from public.group_coaching_sessions s
      join public.bookings b
        on b.bookable_type = 'group_coaching_session'
       and b.bookable_id = s.id
       and b.status in ('pending', 'confirmed')
      where s.run_id = p_run_id and s.starts_at > now()
      group by s.id
    ) per_session
  ), 0);
$$;

revoke all on function public.run_seats_taken(uuid) from public, anon, authenticated;

create or replace function public.holds_seat(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_coaching_sessions s
    join public.coaching_registrations g on g.run_id = s.run_id and g.user_id = auth.uid()
    where s.id = p_session_id
      and public.registration_stands(g.source, g.entitlement_id)
  );
$$;

revoke all on function public.holds_seat(uuid) from public;
grant execute on function public.holds_seat(uuid) to anon, authenticated;

comment on column public.coaching_registrations.source is
  'What the place rests on. A bought place, one made by staff, and one taken through a membership paid for the year '
  'all last the run; one taken through a membership held as a subscription lasts while the subscription does (0019).';
