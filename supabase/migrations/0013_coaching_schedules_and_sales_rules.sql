-- =============================================================================
-- 0013 — Group Coaching schedules and sales rules; masterclasses removed; account deletion
-- =============================================================================
--
-- Consolidated 2026-10-15 from migrations 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, in their
-- original order (the site was not yet in production). Each section keeps
-- its former number, which older notes and comments still cite.
-- =============================================================================


-- ===========================================================================
-- 0020_remove_masterclasses  (was migration 0020, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0020 — Remove masterclasses
-- =============================================================================
--
-- Owner, 2026-10-09: tables that are not in use should go. Masterclasses were
-- dropped as a concept on 2026-09-05 (they fold into Courses), but the table,
-- its permissions and its admin screen stayed behind, empty. Nothing sells one,
-- no product has the type, and no entitlement or booking names one.
--
-- What stays, because Postgres cannot drop a value from an enum that columns
-- use: the label 'masterclass' in the product_type, entitlement_resource and
-- bookable_type enums. It is no longer offered anywhere in the application.
-- =============================================================================

-- A guard, so this cannot silently discard anything on a database that differs
-- from the one it was written against.
do $$
begin
  if exists (select 1 from public.masterclasses)
     or exists (select 1 from public.products where product_type = 'masterclass')
     or exists (select 1 from public.entitlements where resource_type = 'masterclass')
     or exists (select 1 from public.bookings where bookable_type = 'masterclass') then
    raise exception 'masterclass data exists; remove or convert it before dropping the table';
  end if;
end $$;

-- 1. The order pipeline no longer knows the type (0017's function, less one branch).
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
$function$;

revoke all on function public.grant_entitlements_for_order(uuid) from public, anon, authenticated;
grant execute on function public.grant_entitlements_for_order(uuid) to service_role;

-- 2. Course assets are managed by whoever manages courses.
drop policy if exists "course asset uploads are staff only" on storage.objects;
create policy "course asset uploads are staff only"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-assets' and public.has_permission('courses.update'));

drop policy if exists "course asset replacement is staff only" on storage.objects;
create policy "course asset replacement is staff only"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-assets' and public.has_permission('courses.update'));

-- 3. The table, with its policies, and the permissions that guarded it.
drop table public.masterclasses;

delete from public.permissions where name like 'masterclasses.%';

update public.roles set description = 'Manages courses.'
 where name = 'course_manager' and description = 'Manages courses and masterclasses.';


-- ===========================================================================
-- 0021_one_open_run_per_series  (was migration 0021, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0021 — One run of a series open for registration at a time
-- =============================================================================
--
-- Owner, 2026-10-09. Paying for a series, or registering for one with a Coaching
-- Pass, puts the person on its run: there is nothing to choose. Migration 0016
-- allowed two runs of one series to take registrations side by side, and asked
-- the buyer to pick between them. That choice is withdrawn.
--
--   One run of a series takes registrations at a time.
--   A second may be opened once the first is FULL (or has started): the full
--   one is closed to new people, so still only one is taking them.
--
-- Two things hold that:
--   1. opening a run is refused while another run of the same series is taking
--      registrations with places left;
--   2. placement never asks: it takes the run that starts soonest. (A place can
--      come free in a full run after a second has opened. Both then have a
--      place for a while, and the earlier one fills first.)
-- =============================================================================

/**
 * Refuses a published run whose registration window overlaps that of another
 * published run of the same series which still has places.
 */
create or replace function public.coaching_runs_one_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other text;
begin
  if new.status <> 'published' or new.starts_at <= now() then
    return new;
  end if;

  select o.label into v_other
  from public.coaching_runs o
  where o.series_id = new.series_id
    and o.id <> new.id
    and o.status = 'published'
    and o.starts_at > now()
    and o.registration_opens_at < new.starts_at
    and new.registration_opens_at < o.starts_at
    and public.run_seats_taken(o.id) < o.capacity
  order by o.starts_at
  limit 1;

  if found then
    raise exception 'run_already_open: "%" is still taking registrations for this series', v_other
      using errcode = 'P0001',
            hint = 'A second run can be opened once that one is full or has started, or with registration opening after it starts.';
  end if;
  return new;
end;
$$;

revoke all on function public.coaching_runs_one_open() from public, anon, authenticated;

drop trigger if exists coaching_runs_one_open on public.coaching_runs;
create trigger coaching_runs_one_open
  before insert or update of status, series_id, registration_opens_at, starts_at
  on public.coaching_runs
  for each row execute function public.coaching_runs_one_open();

/**
 * Put somebody who has paid for a series on its run. Internal.
 *
 * Returns what `register_user_for_run` returns, or 'none_open' when no run of
 * the series is taking registrations with a place: the place they paid for
 * then waits (`series_pass`) for the next run.
 */
create or replace function public.place_on_open_run(p_user_id uuid, p_series_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid;
begin
  select r.id into v_run
  from public.coaching_runs r
  where r.series_id = p_series_id
    and r.status = 'published'
    and r.registration_opens_at <= now()
    and r.starts_at > now()
    and public.run_seats_taken(r.id) < r.capacity
  order by r.starts_at, r.created_at
  limit 1;

  if v_run is null then
    return 'none_open';
  end if;
  return public.register_user_for_run(p_user_id, v_run);
end;
$$;

revoke all on function public.place_on_open_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_on_open_run(uuid, uuid) to service_role;


-- ===========================================================================
-- 0022_single_session_by_date  (was migration 0022, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0022 — One Group Coaching session is bought for a date
-- =============================================================================
--
-- Owner, 2026-10-09. Booking belongs to one-to-one coaching alone. Everything
-- else puts the buyer where they paid to be: a series, an intake, an event, a
-- retreat. The £25 single session was the exception — bought before the series
-- started, then picked and booked afterwards in the Academy.
--
--   Now the buyer chooses the DATE as they buy. The series page lists the
--   sessions still to come with seats left; £25 pays for that one, and the
--   seat is theirs when the payment clears. Nothing to book.
--
--   It is on sale while the series is running, not only before it starts.
--
-- The chosen session travels on the order line (`order_items.metadata`,
-- `session_id`). Fulfilment grants the session as before and spends it on
-- that date at once. If the session filled between checkout and payment, the
-- session they paid for stays on their account, to use on another date of the
-- same series within three months: the booking screen in the Academy remains
-- for exactly that, and for nothing else.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seats left in one session, and the sessions of a series still to come
-- ---------------------------------------------------------------------------

/** Seats left in a session: its size, less single bookings and everyone on its run. */
create or replace function public.session_places_left(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    s.capacity
    - (select count(*)::int from public.bookings b
        where b.bookable_type = 'group_coaching_session' and b.bookable_id = s.id
          and b.status in ('pending', 'confirmed'))
    - (select count(*)::int from public.coaching_registrations g
        where g.run_id = s.run_id and public.registration_stands(g.source, g.entitlement_id)),
    0)
  from public.group_coaching_sessions s
  where s.id = p_session_id;
$$;

revoke all on function public.session_places_left(uuid) from public;
grant execute on function public.session_places_left(uuid) to anon, authenticated;

/**
 * The sessions of a series a single session can be bought for: scheduled,
 * still to come, on a published run whose registration has opened. Public —
 * the dates sell the session — and it carries no joining link.
 */
create or replace function public.coming_sessions(p_series_id uuid)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, run_label text, places_left integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.starts_at, s.ends_at, r.label, public.session_places_left(s.id)
  from public.group_coaching_sessions s
  join public.coaching_runs r on r.id = s.run_id
  where s.series_id = p_series_id
    and s.status = 'scheduled'
    and s.starts_at > now()
    and r.status = 'published'
    and r.registration_opens_at <= now()
  order by s.starts_at;
$$;

revoke all on function public.coming_sessions(uuid) from public;
grant execute on function public.coming_sessions(uuid) to anon, authenticated;

/**
 * May the caller buy this session? Asked by checkout for the date chosen.
 *
 *   ok · unavailable · past · full · owned (they have a seat in it already)
 */
create or replace function public.session_sale_status(p_session_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_user_id uuid := auth.uid();
begin
  select gs.id, gs.series_id, gs.status, gs.starts_at, gs.run_id, r.status as run_status, r.registration_opens_at
    into s
  from public.group_coaching_sessions gs
  left join public.coaching_runs r on r.id = gs.run_id
  where gs.id = p_session_id;

  if not found or s.status <> 'scheduled' or s.run_status is distinct from 'published'
     or s.registration_opens_at > now() then
    return 'unavailable';
  end if;
  if s.starts_at <= now() then
    return 'past';
  end if;
  if v_user_id is not null and (
       public.holds_seat(p_session_id)
       or exists (
         select 1 from public.bookings b
         where b.user_id = v_user_id and b.bookable_type = 'group_coaching_session'
           and b.bookable_id = p_session_id and b.status in ('pending', 'confirmed'))
     ) then
    return 'owned';
  end if;
  if public.session_places_left(p_session_id) <= 0 then
    return 'full';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.session_sale_status(uuid) from public;
grant execute on function public.session_sale_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Booking, for a named person (0018's book_group_session, taking the user)
-- ---------------------------------------------------------------------------

create or replace function public.book_session_for(p_user_id uuid, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := p_user_id;
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
  if exists (
    select 1 from public.coaching_registrations g
    where g.run_id = v_session.run_id and g.user_id = v_user_id
      and public.registration_stands(g.source, g.entitlement_id)
  ) then
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
    v_taken := v_taken + (
      select count(*) from public.coaching_registrations g
      where g.run_id = v_session.run_id and public.registration_stands(g.source, g.entitlement_id));
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
$function$;

revoke all on function public.book_session_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.book_session_for(uuid, uuid) to service_role;

/** The caller books a session with what they hold. Now only for a session left over (see the header). */
create or replace function public.book_group_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  return public.book_session_for(auth.uid(), p_session_id);
end;
$$;

revoke all on function public.book_group_session(uuid) from public, anon;
grant execute on function public.book_group_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. What may be sold: the one-session product, by date
-- ---------------------------------------------------------------------------

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
$function$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fulfilment takes the seat for the date paid for
-- ---------------------------------------------------------------------------

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

revoke all on function public.grant_entitlements_for_order(uuid) from public, anon, authenticated;
grant execute on function public.grant_entitlements_for_order(uuid) to service_role;


-- ===========================================================================
-- 0023_weekly_sessions_keep_uk_time  (was migration 0023, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0023 — A weekly series keeps its UK time when the clocks change
-- =============================================================================
--
-- `schedule_series_run` made a run's sessions by adding whole weeks to the
-- first session's instant. An instant has no clock: seven days on from 5pm in
-- British Summer Time is 4pm once the clocks have gone back. A series set for
-- "Fridays, 5pm" on 23 October showed 4pm from 30 October.
--
-- The weeks are now added on the UK clock, so every session falls at the same
-- time of day in London as the first, across either change.
--
-- Sessions already created are not moved by this migration: where a run was
-- made before it and crosses a clock change, correct its sessions in Admin →
-- Sessions, or delete the run and create it again.
-- =============================================================================

/** `p_weeks` weeks after `p_first`, at the same time of day in the UK. */
create or replace function public.same_uk_time(p_first timestamptz, p_weeks integer)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select ((p_first at time zone 'Europe/London') + make_interval(weeks => p_weeks)) at time zone 'Europe/London';
$$;

revoke all on function public.same_uk_time(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.same_uk_time(timestamptz, integer) to service_role;

create or replace function public.schedule_series_run(p_series_id uuid, p_first_start timestamp with time zone, p_registration_opens timestamp with time zone DEFAULT NULL::timestamp with time zone, p_count integer DEFAULT NULL::integer, p_minutes integer DEFAULT 60, p_meeting_url text DEFAULT NULL::text, p_label text DEFAULT NULL::text, p_capacity integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    public.same_uk_time(p_first_start, v_total - 1) + make_interval(mins => p_minutes),
    v_capacity,
    'published'
  )
  returning id into v_run_id;

  for i in 1..v_total loop
    v_start := public.same_uk_time(p_first_start, i - 1);
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
$function$;

revoke all on function public.schedule_series_run(uuid, timestamptz, timestamptz, integer, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.schedule_series_run(uuid, timestamptz, timestamptz, integer, integer, text, text, integer) to service_role;


-- ===========================================================================
-- 0024_single_sessions_after_series_starts  (was migration 0024, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0024 — Single sessions go on sale when the series stops selling
-- =============================================================================
--
-- Owner, 2026-10-09. Migration 0022 sold one session for a date from the day a
-- run's registration opened, alongside the series itself. The two then drew on
-- the same seats: someone registering for the series needs a seat in every
-- session, so one single sale in any session took a place off the whole series.
--
--   The series is sold first: from the day registration opens until it starts.
--   Single sessions are sold after: from the moment the series has started
--   (and is closed to new people) for the sessions still to come, while each
--   has a seat.
--
-- The two are never on sale together, so they cannot compete. The first
-- session of a run is therefore never sold singly: the series is still being
-- sold until it begins.
-- =============================================================================

/**
 * The sessions of a series a single session can be bought for: scheduled,
 * still to come, on a published run THAT HAS STARTED. Public, and it carries
 * no joining link.
 */
create or replace function public.coming_sessions(p_series_id uuid)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, run_label text, places_left integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.starts_at, s.ends_at, r.label, public.session_places_left(s.id)
  from public.group_coaching_sessions s
  join public.coaching_runs r on r.id = s.run_id
  where s.series_id = p_series_id
    and s.status = 'scheduled'
    and s.starts_at > now()
    and r.status = 'published'
    and r.starts_at <= now()
  order by s.starts_at;
$$;

revoke all on function public.coming_sessions(uuid) from public;
grant execute on function public.coming_sessions(uuid) to anon, authenticated;

/**
 * May the caller buy this session? Asked by checkout for the date chosen.
 *
 *   ok · unavailable (not on sale, or its series has not started) · past ·
 *   full · owned (they have a seat in it already)
 */
create or replace function public.session_sale_status(p_session_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_user_id uuid := auth.uid();
begin
  select gs.id, gs.series_id, gs.status, gs.starts_at, gs.run_id, r.status as run_status, r.starts_at as run_starts_at
    into s
  from public.group_coaching_sessions gs
  left join public.coaching_runs r on r.id = gs.run_id
  where gs.id = p_session_id;

  if not found or s.status <> 'scheduled' or s.run_status is distinct from 'published'
     or s.run_starts_at > now() then
    return 'unavailable';
  end if;
  if s.starts_at <= now() then
    return 'past';
  end if;
  if v_user_id is not null and (
       public.holds_seat(p_session_id)
       or exists (
         select 1 from public.bookings b
         where b.user_id = v_user_id and b.bookable_type = 'group_coaching_session'
           and b.bookable_id = p_session_id and b.status in ('pending', 'confirmed'))
     ) then
    return 'owned';
  end if;
  if public.session_places_left(p_session_id) <= 0 then
    return 'full';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.session_sale_status(uuid) from public;
grant execute on function public.session_sale_status(uuid) to anon, authenticated;


-- ===========================================================================
-- 0025_series_registration_closes  (was migration 0025, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0025 — When a series stops selling and its single sessions start
-- =============================================================================
--
-- Owner, 2026-10-09 (option A). The series is sold first and single sessions
-- after, never together (0024). Until now the change-over was the series'
-- start. It becomes a date set for each run:
--
--   coaching_runs.registration_closes_at   when registration for the SERIES
--                                          closes. From then on the seats left
--                                          are sold as single sessions, for
--                                          every session still to come —
--                                          the first included, where the date
--                                          is before the series starts.
--
-- Left empty it is the start date, which is how 0024 behaved. It can never be
-- later than the start: nobody joins a series under way.
--
-- Everything that asked "has the run started?" to decide whether the series
-- can still be registered for now asks "has its registration closed?": buying
-- it, a Coaching Pass holder registering, placing a buyer, the one-open-run
-- rule, and the single sessions that take over.
-- =============================================================================

alter table public.coaching_runs add column if not exists registration_closes_at timestamptz;
update public.coaching_runs set registration_closes_at = starts_at where registration_closes_at is null;

comment on column public.coaching_runs.registration_closes_at is
  'When registration for the SERIES closes; from then its remaining seats are sold as single sessions. '
  'Empty on entry means the start date. Never later than the start.';

/** Fills the closing date, and keeps it at the start where it was following it. */
create or replace function public.coaching_runs_closes_default()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.registration_closes_at is not distinct from old.registration_closes_at
     and old.registration_closes_at = old.starts_at then
    -- It was the start date and nobody changed it: it follows the start.
    new.registration_closes_at := new.starts_at;
  end if;
  new.registration_closes_at := least(coalesce(new.registration_closes_at, new.starts_at), new.starts_at);
  return new;
end;
$$;

revoke all on function public.coaching_runs_closes_default() from public, anon, authenticated;

-- Fires before `coaching_runs_one_open` (triggers of one kind run in name
-- order), which reads the date this sets.
drop trigger if exists coaching_runs_closes_default on public.coaching_runs;
create trigger coaching_runs_closes_default
  before insert or update on public.coaching_runs
  for each row execute function public.coaching_runs_closes_default();

alter table public.coaching_runs alter column registration_closes_at set not null;
alter table public.coaching_runs drop constraint if exists coaching_runs_closes_after_opens;
alter table public.coaching_runs
  add constraint coaching_runs_closes_after_opens check (registration_opens_at < registration_closes_at);

-- ---------------------------------------------------------------------------
-- The same functions as before, asking about the closing date
-- ---------------------------------------------------------------------------

create or replace function public.register_user_for_run(p_user_id uuid, p_run_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if r.registration_closes_at <= now() then
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
$function$;

revoke all on function public.register_user_for_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_user_for_run(uuid, uuid) to service_role;

create or replace function public.place_on_open_run(p_user_id uuid, p_series_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_run uuid;
begin
  select r.id into v_run
  from public.coaching_runs r
  where r.series_id = p_series_id
    and r.status = 'published'
    and r.registration_opens_at <= now()
    and r.registration_closes_at > now()
    and public.run_seats_taken(r.id) < r.capacity
  order by r.starts_at, r.created_at
  limit 1;

  if v_run is null then
    return 'none_open';
  end if;
  return public.register_user_for_run(p_user_id, v_run);
end;
$function$;

revoke all on function public.place_on_open_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_on_open_run(uuid, uuid) to service_role;

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
$function$;

revoke all on function public.coaching_sale_status(uuid) from public;
grant execute on function public.coaching_sale_status(uuid) to anon, authenticated;

create or replace function public.coaching_runs_one_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_other text;
begin
  if new.status <> 'published' or new.registration_closes_at <= now() then
    return new;
  end if;

  select o.label into v_other
  from public.coaching_runs o
  where o.series_id = new.series_id
    and o.id <> new.id
    and o.status = 'published'
    and o.registration_closes_at > now()
    and o.registration_opens_at < new.registration_closes_at
    and new.registration_opens_at < o.registration_closes_at
    and public.run_seats_taken(o.id) < o.capacity
  order by o.starts_at
  limit 1;

  if found then
    raise exception 'run_already_open: "%" is still taking registrations for this series', v_other
      using errcode = 'P0001',
            hint = 'A second run can be opened once that one is full or has started, or with registration opening after it starts.';
  end if;
  return new;
end;
$function$;

revoke all on function public.coaching_runs_one_open() from public, anon, authenticated;

drop trigger if exists coaching_runs_one_open on public.coaching_runs;
create trigger coaching_runs_one_open
  before insert or update of status, series_id, registration_opens_at, registration_closes_at, starts_at
  on public.coaching_runs
  for each row execute function public.coaching_runs_one_open();

create or replace function public.coming_sessions(p_series_id uuid)
 RETURNS TABLE(id uuid, title text, starts_at timestamp with time zone, ends_at timestamp with time zone, run_label text, places_left integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.title, s.starts_at, s.ends_at, r.label, public.session_places_left(s.id)
  from public.group_coaching_sessions s
  join public.coaching_runs r on r.id = s.run_id
  where s.series_id = p_series_id
    and s.status = 'scheduled'
    and s.starts_at > now()
    and r.status = 'published'
    and r.registration_closes_at <= now()
  order by s.starts_at;
$function$;

revoke all on function public.coming_sessions(uuid) from public;
grant execute on function public.coming_sessions(uuid) to anon, authenticated;

create or replace function public.session_sale_status(p_session_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  v_user_id uuid := auth.uid();
begin
  select gs.id, gs.series_id, gs.status, gs.starts_at, gs.run_id, r.status as run_status, r.registration_closes_at as run_closes_at
    into s
  from public.group_coaching_sessions gs
  left join public.coaching_runs r on r.id = gs.run_id
  where gs.id = p_session_id;

  if not found or s.status <> 'scheduled' or s.run_status is distinct from 'published'
     or s.run_closes_at > now() then
    return 'unavailable';
  end if;
  if s.starts_at <= now() then
    return 'past';
  end if;
  if v_user_id is not null and (
       public.holds_seat(p_session_id)
       or exists (
         select 1 from public.bookings b
         where b.user_id = v_user_id and b.bookable_type = 'group_coaching_session'
           and b.bookable_id = p_session_id and b.status in ('pending', 'confirmed'))
     ) then
    return 'owned';
  end if;
  if public.session_places_left(p_session_id) <= 0 then
    return 'full';
  end if;
  return 'ok';
end;
$function$;

revoke all on function public.session_sale_status(uuid) from public;
grant execute on function public.session_sale_status(uuid) to anon, authenticated;


-- ===========================================================================
-- 0026_pass_holders_register_first  (was migration 0026, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0026 — Coaching Pass holders register first
-- =============================================================================
--
-- Owner, 2026-10-09. A pass holder takes a seat on a series like anybody else,
-- from the same seats. What they get is a head start: registration opens to
-- them a set time before it is "thrown open" to everyone.
--
--   coaching_runs.pass_opens_at   when pass holders can register for the run.
--                                 Left empty it is `pass_priority_days()`
--                                 (seven) before registration opens to all,
--                                 and it can be set for each run in admin.
--                                 Never later than the public opening.
--
-- In that window a place is taken only through a pass: nothing is on sale yet,
-- so nobody else has one to use. Everything else about registering is as it
-- was — the tier's number for the year, one series once, a seat while places
-- last.
-- =============================================================================

/** Days a pass holder may register ahead of everyone, where a run sets none. */
create or replace function public.pass_priority_days()
returns integer
language sql
immutable
as $$ select 7 $$;

revoke all on function public.pass_priority_days() from public, anon, authenticated;

alter table public.coaching_runs add column if not exists pass_opens_at timestamptz;
update public.coaching_runs
   set pass_opens_at = registration_opens_at - make_interval(days => public.pass_priority_days())
 where pass_opens_at is null;

comment on column public.coaching_runs.pass_opens_at is
  'When Coaching Pass holders can register for the run, ahead of everyone. Empty on entry means pass_priority_days() '
  'before registration opens. Never later than registration_opens_at.';

/** Fills the run's two optional dates, and keeps each following what it defaults from. */
create or replace function public.coaching_runs_closes_default()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lead interval := make_interval(days => public.pass_priority_days());
begin
  if tg_op = 'UPDATE'
     and new.registration_closes_at is not distinct from old.registration_closes_at
     and old.registration_closes_at = old.starts_at then
    -- It was the start date and nobody changed it: it follows the start.
    new.registration_closes_at := new.starts_at;
  end if;
  new.registration_closes_at := least(coalesce(new.registration_closes_at, new.starts_at), new.starts_at);

  if tg_op = 'UPDATE'
     and new.pass_opens_at is not distinct from old.pass_opens_at
     and old.pass_opens_at = old.registration_opens_at - v_lead then
    -- It was the default head start and nobody changed it: it follows the opening.
    new.pass_opens_at := new.registration_opens_at - v_lead;
  end if;
  new.pass_opens_at := least(coalesce(new.pass_opens_at, new.registration_opens_at - v_lead), new.registration_opens_at);
  return new;
end;
$$;

revoke all on function public.coaching_runs_closes_default() from public, anon, authenticated;

alter table public.coaching_runs alter column pass_opens_at set not null;

-- ---------------------------------------------------------------------------
-- Registering, with the head start
-- ---------------------------------------------------------------------------

create or replace function public.register_user_for_run(p_user_id uuid, p_run_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_pass record;
  m record;
  v_early boolean;
begin
  select * into r from public.coaching_runs where id = p_run_id and status = 'published' for update;
  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.coaching_registrations where user_id = p_user_id and run_id = r.id) then
    return 'already';
  end if;
  -- Coaching Pass holders register first (0026): from `pass_opens_at`, ahead
  -- of everyone else. In that window a place can be taken only through a pass.
  v_early := r.registration_opens_at > now();
  if v_early and r.pass_opens_at > now() then
    return 'not_open';
  end if;
  if r.registration_closes_at <= now() then
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
    and not v_early
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
    return case when v_early then 'not_open' else 'no_pass' end;
  end if;
  if m.series_allowance is not null and public.membership_series_used(p_user_id) >= m.series_allowance then
    return 'limit_reached';
  end if;

  insert into public.coaching_registrations (user_id, run_id, entitlement_id, source)
  values (p_user_id, r.id, m.entitlement_id, 'membership');
  return 'ok';
end;
$function$;

revoke all on function public.register_user_for_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_user_for_run(uuid, uuid) to service_role;

-- One run of a series takes registrations at a time: counted from the day
-- pass holders can register, not only from the public opening.
create or replace function public.coaching_runs_one_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_other text;
begin
  if new.status <> 'published' or new.registration_closes_at <= now() then
    return new;
  end if;

  select o.label into v_other
  from public.coaching_runs o
  where o.series_id = new.series_id
    and o.id <> new.id
    and o.status = 'published'
    and o.registration_closes_at > now()
    and o.pass_opens_at < new.registration_closes_at
    and new.pass_opens_at < o.registration_closes_at
    and public.run_seats_taken(o.id) < o.capacity
  order by o.starts_at
  limit 1;

  if found then
    raise exception 'run_already_open: "%" is still taking registrations for this series', v_other
      using errcode = 'P0001',
            hint = 'A second run can be opened once that one is full or has started, or with registration opening after it starts.';
  end if;
  return new;
end;
$function$;

revoke all on function public.coaching_runs_one_open() from public, anon, authenticated;

drop trigger if exists coaching_runs_one_open on public.coaching_runs;
create trigger coaching_runs_one_open
  before insert or update of status, series_id, pass_opens_at, registration_opens_at, registration_closes_at, starts_at
  on public.coaching_runs
  for each row execute function public.coaching_runs_one_open();


-- ===========================================================================
-- 0027_pass_upgrade_for_the_difference  (was migration 0027, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0027 — Moving up a pass for the difference in price
-- =============================================================================
--
-- Owner, 2026-10-10. A pass holder can move up — Silver to Gold, Silver to
-- Platinum, Gold to Platinum — by paying the DIFFERENCE between the two
-- prices, while at least four months of their pass remain. They then hold the
-- higher pass for the rest of the same year, with what it adds: the extra
-- series, every playlist, the Q&A, the retreat.
--
-- Until now a higher tier could be bought at any time at its full price, and
-- started a new year alongside the old one.
--
-- The order line carries the pass being upgraded (`order_items.metadata`,
-- `upgrade_from`: the entitlement's id). The application prices the line at
-- the difference and decides who may upgrade (lib/commerce/pass-upgrade);
-- this function changes the tier of that same entitlement, in place.
-- `entitlements_sync_membership` already fires on a change of `resource_id`,
-- so the playlists and the retreat follow by themselves.
-- =============================================================================

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

revoke all on function public.grant_entitlements_for_order(uuid) from public, anon, authenticated;
grant execute on function public.grant_entitlements_for_order(uuid) to service_role;


-- ===========================================================================
-- 0028_admins_may_delete_accounts  (was migration 0028, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0028 — Admins may delete accounts
-- =============================================================================
--
-- Owner, 2026-10-14: "admin should be able to see or perform delete as well".
--
-- `users.delete` was held by the owner alone (0002 left it out of the admin
-- role with `roles.manage` and `settings.update`). Deleting an account is now
-- an admin task too, through the person's admin page (note 06 §14.4).
--
-- This does not let an admin remove anyone above them. The page refuses to
-- delete an account that holds ANY staff role, and only an owner can revoke
-- the owner role (note 06 §34), so an owner's account stays out of an admin's
-- reach. It is also refused for anyone with live access, a booking to come, a
-- running subscription, or any order.
--
-- `roles.manage` and `settings.update` stay owner-only.
-- =============================================================================

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  join public.permissions p on p.name = 'users.delete'
 where r.name = 'admin'
on conflict do nothing;
