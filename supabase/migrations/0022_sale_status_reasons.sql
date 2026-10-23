-- =============================================================================
-- 0022 — "Can't be bought" gives the right reason
-- =============================================================================
--
-- Found in the end-to-end test, 2026-10-23. `coaching_sale_status` refused the
-- right things but sometimes for the wrong stated reason:
--
--   a retreat or cohort whose dates have all passed   "has no date yet"
--   a series with no run at all                        "registration ... closes
--                                                       on the date shown on its
--                                                       page" (there was none)
--
-- New status 'ended' for a retreat or cohort whose every batch or intake has
-- finished; for a series with no run still to start, 'past' while one is under
-- way and 'unscheduled' when there is none; 'unscheduled' also for a
-- single session when its series has no run still to come. Everything
-- else is unchanged (the body is 0014's, with those four branches added).
-- =============================================================================

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
        -- No run still to START is not "registration not open" (0022): that
        -- promised a date the page didn't have. A run under way has started;
        -- with no run at all, there are no dates yet.
        if not exists (
          select 1 from public.coaching_runs cr
          where cr.series_id = v_series_id and cr.status = 'published' and cr.starts_at > now()
        ) then
          if exists (
            select 1 from public.coaching_runs cr
            where cr.series_id = v_series_id and cr.status = 'published' and cr.ends_at > now()
          ) then
            return 'past';
          end if;
          return 'unscheduled';
        end if;
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
        -- A run still ahead: singles wait for its registration to close
        -- ('closed', worded for singles in checkout). No run at all: no dates.
        if exists (
          select 1 from public.coaching_runs cr
          where cr.series_id = v_series_id and cr.status = 'published' and cr.ends_at > now()
        ) then
          return 'closed';
        end if;
        return 'unscheduled';  -- no run of the series still to come (0022)
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
    if exists (
      select 1 from public.cohort_intakes ci
      where ci.cohort_id = c.id and ci.status = 'published'
    ) then
      return 'ended';        -- every intake has finished (0022)
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
    if exists (
      select 1 from public.retreat_batches b
      where b.retreat_id = r.id and b.status = 'published'
    ) then
      return 'ended';        -- every batch has finished (0022)
    end if;
    return 'unscheduled';    -- no batch has dates
  end if;

  return 'ok';
end;
$function$;
