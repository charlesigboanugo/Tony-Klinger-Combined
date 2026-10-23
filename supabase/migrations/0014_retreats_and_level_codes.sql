-- =============================================================================
-- 0014 — Tiers and levels as codes; retreat batches, places and applications
-- =============================================================================
--
-- Consolidated 2026-10-15 from migrations 0029, 0030, 0031, 0032, 0033, 0034, in their
-- original order (the site was not yet in production). Each section keeps
-- its former number, which older notes and comments still cite.
-- =============================================================================


-- ===========================================================================
-- 0029_tiers_and_levels_are_codes  (was migration 0029, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0029 — Pass tiers and cohort levels become codes staff can add to
-- =============================================================================
--
-- Owner, 2026-10-14: it should be possible to create a new Coaching Pass and a
-- new cohort, "but only create a new level name since it is unique".
--
-- Until now both were fixed lists built into the database
-- (`membership_tier`: silver, gold, platinum, ultimate; `cohort_level`:
-- silver, gold, platinum), so a new level was refused outright. Both become
-- plain text CODES:
--
--   * A code is lower case, letters, digits, `-` or `_`, starting with a
--     letter ("silver", "diamond", "gold-plus"). It is chosen once, when the
--     pass or cohort is created, and the admin form locks it afterwards. The
--     display name is separate and can change freely.
--   * A code is UNIQUE: one pass per tier code (as before), and now also one
--     cohort per level code. Each running of a cohort is an intake, not a new
--     cohort (0017).
--   * ORDER comes from a number, never from the code. Pass tiers already
--     compared by `rank` everywhere ("Gold and above" = rank of the playlist's
--     lowest tier); cohorts gain a `rank` for the order they are shown in.
--
-- Everything that held one of the two types is converted in place; no value
-- changes. A playlist's lowest tier and a subscription's tier now REFERENCE
-- the pass tier's code, so neither can name a tier that does not exist, and a
-- tier still in use cannot be deleted. Invoices keep the code as history,
-- without a reference.
--
-- The two functions that RETURN the tier, and the view that shows it, are
-- rebuilt unchanged apart from the type, with the same grants.
-- =============================================================================

-- Things built on the old types, dropped here and rebuilt below.
drop view if exists public.active_member_emails;
drop function if exists public.my_membership();
drop function if exists public.membership_of(uuid);

alter table public.playlists alter column min_tier drop default;

alter table public.membership_tiers alter column tier          type text using tier::text;
alter table public.playlists        alter column min_tier      type text using min_tier::text;
alter table public.subscriptions    alter column membership_tier type text using membership_tier::text;
alter table public.invoices         alter column membership_tier type text using membership_tier::text;
alter table public.cohorts          alter column cohort_level  type text using cohort_level::text;

drop type public.membership_tier;
drop type public.cohort_level;

-- Codes: what they may look like, and that each is used once.
alter table public.membership_tiers
  add constraint membership_tiers_tier_is_a_code
  check (tier ~ '^[a-z][a-z0-9_-]{0,39}$');

alter table public.cohorts
  add constraint cohorts_level_is_a_code
  check (cohort_level ~ '^[a-z][a-z0-9_-]{0,39}$'),
  add constraint cohorts_cohort_level_key unique (cohort_level);

comment on column public.membership_tiers.tier is
  'The pass tier''s code: unique, fixed once created (the admin form locks it). Order comes from rank, never from the code.';
comment on column public.cohorts.cohort_level is
  'The cohort''s level code: unique (one cohort per level; each running is an intake), fixed once created. Order comes from rank.';

-- References to a pass tier's code.
alter table public.playlists
  add constraint playlists_min_tier_fkey
  foreign key (min_tier) references public.membership_tiers (tier) on update cascade;
alter table public.playlists alter column min_tier set default 'silver';

alter table public.subscriptions
  add constraint subscriptions_membership_tier_fkey
  foreign key (membership_tier) references public.membership_tiers (tier) on update cascade;

-- The order cohorts are shown in, lowest first; was a list in the application.
alter table public.cohorts add column if not exists rank integer not null default 0;
update public.cohorts
   set rank = case cohort_level when 'silver' then 1 when 'gold' then 2 when 'platinum' then 3 else rank end;
comment on column public.cohorts.rank is 'Order on the site, lowest first.';

-- -----------------------------------------------------------------------------
-- Rebuilt with `tier text`; otherwise exactly as in 0018.
-- -----------------------------------------------------------------------------
create function public.membership_of(p_user_id uuid)
returns table(
  entitlement_id uuid, tier text, tier_id uuid, tier_name text, rank integer,
  source_type public.entitlement_source, expires_at timestamptz, series_allowance integer,
  playlist_allowance integer, includes_qa boolean, includes_retreats boolean, yearly boolean,
  starts_at timestamptz
)
language sql
stable security definer
set search_path to 'public'
as $function$
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
$function$;

revoke all on function public.membership_of(uuid) from public, anon, authenticated;

create function public.my_membership()
returns table(
  entitlement_id uuid, tier text, tier_id uuid, tier_name text, rank integer,
  source_type public.entitlement_source, expires_at timestamptz, series_allowance integer,
  playlist_allowance integer, includes_qa boolean, includes_retreats boolean, yearly boolean,
  starts_at timestamptz
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select * from public.membership_of(auth.uid());
$function$;

revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- As in 0005: who to email about membership news. Server-side only.
create view public.active_member_emails as
  select distinct u.email, s.membership_tier
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
   where s.status = 'active'::public.subscription_status
     and u.email is not null;

revoke all on public.active_member_emails from anon, authenticated;


-- ===========================================================================
-- 0030_retreat_batches  (was migration 0030, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0030 — Retreat batches
-- =============================================================================
--
-- Owner, 2026-10-14: a retreat should run "year after year or multiple times a
-- year at will, with batches", as a cohort runs as intakes; and the joining
-- link belongs to each batch, not to a separate list.
--
-- Until now a retreat row WAS one running: its own dates, places and product.
-- Running it again meant a second retreat with a second product. Now:
--
--   retreats          fixed (Level One, Two, Three), always on the site, one
--                     product and price; requires_application and level stay.
--   retreat_batches   one running of a retreat: label, registration window,
--                     dates, places, and its joining link and notes. As many
--                     as wanted, per year or per season.
--   retreat_places    who has a place on which batch, and the purchase that
--                     paid for it (like cohort_enrolments).
--
-- Buying a retreat still grants an entitlement to the retreat, and now also
-- puts the buyer on its open batch (the soonest, if more than one is open).
-- A Coaching Pass that includes the retreat still covers every batch of a
-- retreat open without an interview, without taking a numbered place.
--
-- THE LINK STAYS PRIVATE. Batches are not readable by the public: staff read
-- them, and a person reads only a batch they have a place on (or that their
-- pass covers). The public site reads dates through retreat_batch_dates(), a
-- function returning published batches without the link and notes.
--
-- Existing data moves across unchanged: each retreat with dates becomes a
-- retreat with one batch carrying those dates, places and link; each place
-- bought goes onto that batch. retreat_access is then dropped, and the
-- dates and capacity columns leave retreats.
-- =============================================================================

create table public.retreat_batches (
  id                     uuid primary key default gen_random_uuid(),
  retreat_id             uuid not null references public.retreats (id) on delete cascade,
  label                  text not null,
  registration_opens_at  timestamptz not null default now(),
  registration_closes_at timestamptz,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  capacity               integer check (capacity is null or capacity > 0),
  join_url               text,
  joining_notes          text,
  status                 public.content_status not null default 'draft',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint retreat_batches_ends_after_starts check (ends_at > starts_at),
  constraint retreat_batches_opens_before_start check (registration_opens_at < starts_at),
  constraint retreat_batches_closes_after_opens check (registration_closes_at is null or registration_closes_at > registration_opens_at)
);
create index retreat_batches_retreat_id_idx on public.retreat_batches (retreat_id);
create index retreat_batches_starts_at_idx on public.retreat_batches (starts_at);
create trigger retreat_batches_set_updated_at
  before update on public.retreat_batches
  for each row execute function public.set_updated_at();
alter table public.retreat_batches enable row level security;

comment on table public.retreat_batches is
  'One running of a retreat: its dates, registration window, places and joining link. The public reads dates through retreat_batch_dates; the link is for people with a place.';

create table public.retreat_places (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  batch_id       uuid not null references public.retreat_batches (id) on delete cascade,
  entitlement_id uuid references public.entitlements (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, batch_id)
);
create index retreat_places_batch_id_idx on public.retreat_places (batch_id);
alter table public.retreat_places enable row level security;

comment on table public.retreat_places is
  'Who has a place on which retreat batch, and the entitlement that paid for it.';

-- -----------------------------------------------------------------------------
-- Places, and who may see a batch.
-- -----------------------------------------------------------------------------
create function public.retreat_batch_places_taken(p_batch_id uuid)
returns integer
language sql stable security definer set search_path to 'public'
as $$
  select count(*)::int from public.retreat_places rp where rp.batch_id = p_batch_id;
$$;

create function public.retreat_batch_places_left(p_batch_id uuid)
returns integer
language sql stable security definer set search_path to 'public'
as $$
  select case when b.capacity is null then null
              else greatest(b.capacity - public.retreat_batch_places_taken(b.id), 0) end
  from public.retreat_batches b
  where b.id = p_batch_id and b.status = 'published';
$$;
grant execute on function public.retreat_batch_places_left(uuid) to anon, authenticated;

-- The caller may see this batch's link: a place on it, or a pass that covers a
-- retreat open without an interview.
create function public.has_retreat_batch_access(p_batch_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.retreat_places rp
    where rp.batch_id = p_batch_id and rp.user_id = auth.uid()
  ) or exists (
    select 1
    from public.retreat_batches b
    join public.retreats r on r.id = b.retreat_id
    join public.entitlements e on e.user_id = auth.uid()
    where b.id = p_batch_id
      and not r.requires_application
      and e.resource_type = 'retreat'
      and e.resource_id is null
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  );
$$;
grant execute on function public.has_retreat_batch_access(uuid) to authenticated;

create policy "retreat_batches: staff read" on public.retreat_batches
  for select using (public.has_permission('retreats.read'));
create policy "retreat_batches: attendees read" on public.retreat_batches
  for select using (public.has_retreat_batch_access(id));

create policy "retreat_places: read own" on public.retreat_places
  for select using (user_id = auth.uid());
create policy "retreat_places: staff read" on public.retreat_places
  for select using (public.has_permission('retreats.read'));

-- What the public may know about a batch: everything but the link and notes.
-- A function, not a view: a view runs with its owner's rights and would read
-- past RLS, and no view in public may be readable by a client role.
create function public.retreat_batch_dates(p_retreat_ids uuid[] default null)
returns table(
  id uuid, retreat_id uuid, label text, registration_opens_at timestamptz,
  registration_closes_at timestamptz, starts_at timestamptz, ends_at timestamptz, capacity integer
)
language sql stable security definer set search_path to 'public'
as $$
  select b.id, b.retreat_id, b.label, b.registration_opens_at, b.registration_closes_at,
         b.starts_at, b.ends_at, b.capacity
    from public.retreat_batches b
   where b.status = 'published'
     and (p_retreat_ids is null or b.retreat_id = any (p_retreat_ids))
   order by b.starts_at;
$$;
grant execute on function public.retreat_batch_dates(uuid[]) to anon, authenticated;

-- Put a buyer on the retreat's open batch: the soonest open one with a place.
create function public.place_on_open_retreat_batch(p_user_id uuid, p_retreat_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_batch uuid;
  v_entitlement uuid;
begin
  select b.id into v_batch
  from public.retreat_batches b
  where b.retreat_id = p_retreat_id
    and b.status = 'published'
    and b.registration_opens_at <= now()
    and coalesce(b.registration_closes_at, b.starts_at) > now()
    and b.starts_at > now()
    and (b.capacity is null or public.retreat_batch_places_taken(b.id) < b.capacity)
  order by b.starts_at
  limit 1;
  if v_batch is null then
    return 'none';
  end if;

  select e.id into v_entitlement
  from public.entitlements e
  where e.user_id = p_user_id and e.resource_type = 'retreat' and e.resource_id = p_retreat_id
    and e.status = 'active'
  order by e.created_at desc
  limit 1;

  insert into public.retreat_places (user_id, batch_id, entitlement_id)
  values (p_user_id, v_batch, v_entitlement)
  on conflict (user_id, batch_id) do nothing;
  return 'placed';
end;
$$;
revoke all on function public.place_on_open_retreat_batch(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Move the existing data across.
-- -----------------------------------------------------------------------------
insert into public.retreat_batches
  (retreat_id, label, registration_opens_at, starts_at, ends_at, capacity, join_url, joining_notes, status)
select r.id,
       to_char(r.starts_at at time zone 'Europe/London', 'FMMonth YYYY'),
       least(r.created_at, r.starts_at - interval '1 day'),
       r.starts_at,
       coalesce(r.ends_at, r.starts_at + interval '8 hours'),
       r.capacity,
       a.join_url,
       a.joining_notes,
       r.status
  from public.retreats r
  left join public.retreat_access a on a.retreat_id = r.id
 where r.starts_at is not null;

insert into public.retreat_places (user_id, batch_id, entitlement_id, created_at)
select e.user_id, b.id, e.id, e.created_at
  from public.entitlements e
  join public.retreat_batches b on b.retreat_id = e.resource_id
 where e.resource_type = 'retreat'
   and e.resource_id is not null
on conflict (user_id, batch_id) do nothing;

-- The link now lives on the batch.
drop policy if exists "retreat_access: attendees read" on public.retreat_access;
drop policy if exists "retreat_access: staff read" on public.retreat_access;
drop table public.retreat_access;

alter table public.retreats drop column starts_at;
alter table public.retreats drop column ends_at;
alter table public.retreats drop column capacity;

-- -----------------------------------------------------------------------------
-- Selling a retreat, and placing its buyer.
-- -----------------------------------------------------------------------------
create or replace function public.coaching_sale_status(p_product_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- GROUP COACHING (owner, 2026-10-09).
  --   The series   sold only while a run is open for registration: from the day
  --                registration opens until the series starts, with a place.
  --   One session  sold for a DATE the buyer chooses as they pay (0022), so it
  --                is on sale for as long as a session of the series is still
  --                to come with a seat, the series running or not.
  -- Asked for the signed-out too — it is about the series, not the person.
  if v_type = 'group_coaching' then
    select p.series_id, coalesce(p.credits, 1) > 1 into v_series_id, v_is_series
    from public.products p where p.id = p_product_id;
    if v_series_id is not null and v_is_series then
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.registration_closes_at > now()
      ) then
        return 'closed';
      end if;
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.registration_closes_at > now()
          and public.run_seats_taken(cr.id) < cr.capacity
      ) then
        return 'full';
      end if;
    elsif v_series_id is not null then
      if not exists (select 1 from public.coming_sessions(v_series_id)) then
        return 'closed';
      end if;
      if not exists (select 1 from public.coming_sessions(v_series_id) cs where cs.places_left > 0) then
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

  -- A RETREAT IS BOOKED ONTO ONE OF ITS BATCHES (migration 0030, owner
  -- 2026-10-14), as a cohort is joined on an intake: while a batch is open
  -- for registration and has a place. The batch decides, not the retreat.
  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;

    if v_user_id is not null then
      -- On a batch of it that has not finished, or covered by a pass for a
      -- retreat open without an interview.
      if exists (
        select 1 from public.retreat_places rp
        join public.retreat_batches b on b.id = rp.batch_id
        where rp.user_id = v_user_id and b.retreat_id = r.id and b.ends_at > now()
      ) or (not r.requires_application and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'retreat'
          and e.resource_id is null
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
      )) then
        return 'owned';
      end if;
    end if;

    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published'
        and b.registration_opens_at <= now()
        and coalesce(b.registration_closes_at, b.starts_at) > now()
        and b.starts_at > now()
        and (b.capacity is null or public.retreat_batch_places_taken(b.id) < b.capacity)
    ) then
      if r.requires_application and not exists (
        select 1 from public.retreat_applications a
        where a.retreat_id = r.id and a.user_id = v_user_id and a.status = 'approved'
      ) then
        return 'application';
      end if;
      return 'ok';
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published'
        and b.registration_opens_at <= now()
        and coalesce(b.registration_closes_at, b.starts_at) > now()
        and b.starts_at > now()
    ) then
      return 'full';
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published' and b.starts_at > now()
    ) then
      return 'closed';       -- a batch is coming; registration is not open
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published' and b.ends_at > now()
    ) then
      return 'past';         -- a batch is under way
    end if;
    return 'unscheduled';    -- no batch has dates
  end if;

  return 'ok';
end;
$function$;

create or replace function public.grant_entitlements_for_order(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    select oi.product_id, oi.quantity, oi.metadata, p.product_type, p.credits, p.valid_months, p.pack_of,
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
        -- AN UPGRADE (0027): the pass they hold becomes this tier for the rest
        -- of ITS OWN year. Nothing new is granted and no year is added: the
        -- same entitlement, the same start and end, a higher tier. Series
        -- already taken still count, so moving from one a year to two gives
        -- one more. Only ever upward, and only their own live pass.
        if v_item.metadata ? 'upgrade_from' then
          update public.entitlements e
             set resource_id = v_resource_id
           where e.id = (v_item.metadata->>'upgrade_from')::uuid
             and e.user_id = v_user_id
             and e.resource_type = 'membership'
             and e.source_type <> 'membership'
             and e.status = 'active'
             and (e.expires_at is null or e.expires_at > now())
             and (select t.rank from public.membership_tiers t where t.id = v_resource_id)
               > (select t.rank from public.membership_tiers t where t.id = e.resource_id);
          if found then
            v_granted := v_granted + 1;
            continue;  -- upgraded in place; no second pass
          end if;
          -- The pass it was to upgrade is gone (ended in the meantime): fall
          -- through and grant the tier paid towards as a pass of its own.
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
        elsif v_resource_type = 'retreat' then
          -- A place on the retreat's open batch (migration 0030).
          perform public.place_on_open_retreat_batch(v_user_id, v_resource_id);
        elsif v_resource_type = 'group_coaching_session' and v_item.metadata ? 'session_id' then
          -- One session, bought for a date (0022): the seat is taken as they
          -- pay. If that session filled in the moments between, the session
          -- they paid for stays on their account to use on another date.
          perform public.book_session_for(v_user_id, (v_item.metadata->>'session_id')::uuid);
        end if;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$function$;


-- ===========================================================================
-- 0031_retreat_levels_unique  (was migration 0031, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0031 — A retreat level is used once
-- =============================================================================
--
-- Owner, 2026-10-14: a retreat's level cannot be edited, and a second retreat
-- cannot take a level already in use. Each level (1, 2, 3, …) is one retreat;
-- each time it runs is a batch (0030), never a second retreat at that level.
-- The admin form locks the level once the retreat exists; this enforces the
-- uniqueness. A retreat with no level (one that does not run at levels) is
-- unaffected.
-- =============================================================================

create unique index retreats_level_key on public.retreats (level) where level is not null;


-- ===========================================================================
-- 0032_retreat_applications_per_batch  (was migration 0032, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0032 — Retreat applications: applied for online, per batch
-- =============================================================================
--
-- Owner, 2026-10-14: a by-interview retreat needs an application form on the
-- site (it pointed at the contact form, and staff copied details across), an
-- email when someone is approved, and approvals that do not last for ever.
-- Applications should then be seen in admin by batch, approved or not, with
-- past batches kept apart.
--
--   * An application is for ONE BATCH (batch_id). That is also the expiry:
--     approval lets the person book that batch; the next batch is applied for
--     again. One application per person per batch.
--   * message holds what they wrote, for staff to read in admin; answers
--     keeps the same as fields.
--   * approved_at is stamped when an application becomes approved.
--   * apply_for_retreat is how the site applies: for a published batch of a
--     by-interview retreat whose registration is open. A declined or withdrawn
--     application can be made again; one already in hand is left as it is.
--   * Selling and placing read approval per batch.
--
-- There are no applications yet, so nothing is moved. retreat_id is kept,
-- filled from the batch, so existing reads still work.
-- =============================================================================

alter table public.retreat_applications
  add column batch_id uuid references public.retreat_batches (id) on delete cascade,
  add column message text,
  add column approved_at timestamptz;

alter table public.retreat_applications drop constraint retreat_applications_retreat_id_user_id_key;
alter table public.retreat_applications
  add constraint retreat_applications_batch_id_user_id_key unique (batch_id, user_id);
create index retreat_applications_batch_id_idx on public.retreat_applications (batch_id);

comment on column public.retreat_applications.batch_id is
  'The batch applied for. Approval lets the person book this batch only.';
comment on column public.retreat_applications.message is
  'What the applicant wrote, as one text for staff to read.';

-- Stamp the moment of approval; clear it if the status moves away again.
create function public.retreat_application_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_at := null;
  end if;
  -- The retreat always follows from the batch.
  if new.batch_id is not null then
    select b.retreat_id into new.retreat_id from public.retreat_batches b where b.id = new.batch_id;
  end if;
  return new;
end;
$$;
create trigger retreat_applications_stamp
  before insert or update on public.retreat_applications
  for each row execute function public.retreat_application_stamp();

-- Apply for a batch, from the site.
create function public.apply_for_retreat(p_batch_id uuid, p_message text, p_answers jsonb default '{}'::jsonb)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_batch record;
  v_existing text;
begin
  if v_user is null then
    raise exception 'sign in to apply' using errcode = '42501';
  end if;
  if coalesce(btrim(p_message), '') = '' then
    raise exception 'tell us about your project' using errcode = '23514';
  end if;

  select b.*, r.requires_application into v_batch
  from public.retreat_batches b join public.retreats r on r.id = b.retreat_id
  where b.id = p_batch_id and b.status = 'published' and r.status = 'published';
  if not found or not v_batch.requires_application then
    raise exception 'this retreat does not take applications' using errcode = '23514';
  end if;
  if not (v_batch.registration_opens_at <= now()
          and coalesce(v_batch.registration_closes_at, v_batch.starts_at) > now()
          and v_batch.starts_at > now()) then
    raise exception 'applications for this batch are closed' using errcode = '23514';
  end if;

  select a.status into v_existing
  from public.retreat_applications a where a.batch_id = p_batch_id and a.user_id = v_user;

  if v_existing is null then
    insert into public.retreat_applications (retreat_id, batch_id, user_id, status, answers, message)
    values (v_batch.retreat_id, p_batch_id, v_user, 'submitted', coalesce(p_answers, '{}'::jsonb), btrim(p_message));
    return 'submitted';
  elsif v_existing in ('declined', 'withdrawn') then
    update public.retreat_applications
       set status = 'submitted', answers = coalesce(p_answers, '{}'::jsonb), message = btrim(p_message)
     where batch_id = p_batch_id and user_id = v_user;
    return 'submitted';
  end if;
  return v_existing;   -- already in hand: submitted, interviewing or approved
end;
$$;
revoke all on function public.apply_for_retreat(uuid, text, jsonb) from public, anon;
grant execute on function public.apply_for_retreat(uuid, text, jsonb) to authenticated;

create or replace function public.coaching_sale_status(p_product_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- GROUP COACHING (owner, 2026-10-09).
  --   The series   sold only while a run is open for registration: from the day
  --                registration opens until the series starts, with a place.
  --   One session  sold for a DATE the buyer chooses as they pay (0022), so it
  --                is on sale for as long as a session of the series is still
  --                to come with a seat, the series running or not.
  -- Asked for the signed-out too — it is about the series, not the person.
  if v_type = 'group_coaching' then
    select p.series_id, coalesce(p.credits, 1) > 1 into v_series_id, v_is_series
    from public.products p where p.id = p_product_id;
    if v_series_id is not null and v_is_series then
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.registration_closes_at > now()
      ) then
        return 'closed';
      end if;
      if not exists (
        select 1 from public.coaching_runs cr
        where cr.series_id = v_series_id and cr.status = 'published'
          and cr.registration_opens_at <= now() and cr.registration_closes_at > now()
          and public.run_seats_taken(cr.id) < cr.capacity
      ) then
        return 'full';
      end if;
    elsif v_series_id is not null then
      if not exists (select 1 from public.coming_sessions(v_series_id)) then
        return 'closed';
      end if;
      if not exists (select 1 from public.coming_sessions(v_series_id) cs where cs.places_left > 0) then
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

  -- A RETREAT IS BOOKED ONTO ONE OF ITS BATCHES (migration 0030, owner
  -- 2026-10-14), as a cohort is joined on an intake: while a batch is open
  -- for registration and has a place. The batch decides, not the retreat.
  select * into r from public.retreats where product_id = p_product_id limit 1;
  if found then
    if r.status <> 'published' then
      return 'unavailable';
    end if;

    if v_user_id is not null then
      -- On a batch of it that has not finished, or covered by a pass for a
      -- retreat open without an interview.
      if exists (
        select 1 from public.retreat_places rp
        join public.retreat_batches b on b.id = rp.batch_id
        where rp.user_id = v_user_id and b.retreat_id = r.id and b.ends_at > now()
      ) or (not r.requires_application and exists (
        select 1 from public.entitlements e
        where e.user_id = v_user_id
          and e.resource_type = 'retreat'
          and e.resource_id is null
          and e.status = 'active'
          and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now())
      )) then
        return 'owned';
      end if;
    end if;

    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published'
        and b.registration_opens_at <= now()
        and coalesce(b.registration_closes_at, b.starts_at) > now()
        and b.starts_at > now()
        and (b.capacity is null or public.retreat_batch_places_taken(b.id) < b.capacity)
    ) then
      -- By interview: an APPROVED application for an open batch (0032). An
      -- approval is for one batch; the next batch is applied for afresh.
      if r.requires_application and not exists (
        select 1 from public.retreat_applications a
        join public.retreat_batches ob on ob.id = a.batch_id
        where a.user_id = v_user_id and a.status = 'approved'
          and ob.retreat_id = r.id and ob.status = 'published'
          and ob.registration_opens_at <= now()
          and coalesce(ob.registration_closes_at, ob.starts_at) > now()
          and ob.starts_at > now()
      ) then
        return 'application';
      end if;
      return 'ok';
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published'
        and b.registration_opens_at <= now()
        and coalesce(b.registration_closes_at, b.starts_at) > now()
        and b.starts_at > now()
    ) then
      return 'full';
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published' and b.starts_at > now()
    ) then
      return 'closed';       -- a batch is coming; registration is not open
    end if;
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published' and b.ends_at > now()
    ) then
      return 'past';         -- a batch is under way
    end if;
    return 'unscheduled';    -- no batch has dates
  end if;

  return 'ok';
end;
$function$;

create or replace function public.place_on_open_retreat_batch(p_user_id uuid, p_retreat_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch uuid;
  v_entitlement uuid;
begin
  select b.id into v_batch
  from public.retreat_batches b
  where b.retreat_id = p_retreat_id
    and b.status = 'published'
    and b.registration_opens_at <= now()
    and coalesce(b.registration_closes_at, b.starts_at) > now()
    and b.starts_at > now()
    and (b.capacity is null or public.retreat_batch_places_taken(b.id) < b.capacity)
  -- The batch they were approved for comes first (a by-interview retreat,
  -- 0032); otherwise the soonest.
  order by exists (
             select 1 from public.retreat_applications a
             where a.batch_id = b.id and a.user_id = p_user_id and a.status = 'approved'
           ) desc,
           b.starts_at
  limit 1;
  if v_batch is null then
    return 'none';
  end if;

  select e.id into v_entitlement
  from public.entitlements e
  where e.user_id = p_user_id and e.resource_type = 'retreat' and e.resource_id = p_retreat_id
    and e.status = 'active'
  order by e.created_at desc
  limit 1;

  insert into public.retreat_places (user_id, batch_id, entitlement_id)
  values (p_user_id, v_batch, v_entitlement)
  on conflict (user_id, batch_id) do nothing;
  return 'placed';
end;
$function$;


-- ===========================================================================
-- 0033_retreat_places_source  (was migration 0033, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0033 — How a retreat place was taken
-- =============================================================================
--
-- Owner, 2026-10-14: Retreat places should read like Series run registrations,
-- which say how each place was taken. A retreat place now records the same:
-- 'purchase' (bought; the default, set by placement on payment), 'membership'
-- (through a Coaching Pass), or 'staff' (added by hand). Places already held
-- are 'purchase' when a purchase paid for them, otherwise 'staff'.
-- =============================================================================

alter table public.retreat_places
  add column source text not null default 'purchase'
  check (source in ('purchase', 'membership', 'staff'));

update public.retreat_places set source = 'staff' where entitlement_id is null;

comment on column public.retreat_places.source is
  'How the place was taken: purchase, membership (a Coaching Pass) or staff.';


-- ===========================================================================
-- 0034_retreat_application_closed  (was migration 0034, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0034 — Retreat applications: telling the applicant when one is closed
-- =============================================================================
--
-- Owner, 2026-10-14: an applicant hears when they are approved, but not when
-- their application is declined or withdrawn. Both now send one email, worded
-- for either case, that says they can apply again.
--
--   * closed_at is stamped when an application becomes declined or withdrawn,
--     the same way approved_at is stamped on approval. The email is sent once
--     per closing: saving it again does not resend, closing it afresh does.
--   * staff_note is an optional line from staff, added to that email. Written
--     for the applicant to read.
-- =============================================================================

alter table public.retreat_applications
  add column closed_at timestamptz,
  add column staff_note text;

comment on column public.retreat_applications.closed_at is
  'When the application was last declined or withdrawn; null while it is open or approved.';
comment on column public.retreat_applications.staff_note is
  'Optional line from staff, included in the email sent when the application is declined or withdrawn.';

-- Stamp approval and closing; clear each stamp when the status moves away.
create or replace function public.retreat_application_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_at := null;
  end if;
  if new.status in ('declined', 'withdrawn')
     and (tg_op = 'INSERT' or old.status not in ('declined', 'withdrawn')) then
    new.closed_at := now();
  elsif new.status not in ('declined', 'withdrawn') then
    new.closed_at := null;
  end if;
  -- The retreat always follows from the batch.
  if new.batch_id is not null then
    select b.retreat_id into new.retreat_id from public.retreat_batches b where b.id = new.batch_id;
  end if;
  return new;
end;
$$;
