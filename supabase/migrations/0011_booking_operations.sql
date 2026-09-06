-- 0011 — Booking operations.
-- Architecture: note 09 §29–§35; note 08 §64, §65; note 01 §11, §13.
--
-- This is where PAYMENT ≠ ENTITLEMENT ≠ BOOKING becomes concrete. Holding an
-- entitlement is not a booking; making a booking consumes the entitlement and
-- reserves a specific seat.
--
-- All of it happens in one transaction, because the alternative loses money or
-- oversells: checking capacity, consuming a credit and creating the booking as
-- three separate statements lets two concurrent requests both see the last seat
-- as free.

/**
 * Book a place on a scheduled group coaching session.
 *
 * Returns a status rather than raising, so the UI can explain what happened.
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
  order by (quantity is null) desc   -- prefer unlimited access over spending a credit
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

/**
 * Cancel a booking, returning the credit when cancellation is timely.
 *
 * Note 09 §34: cancelling a booking is not the same as permanently consuming
 * the entitlement. Whether the credit comes back is a business rule, and the
 * window is configurable rather than hard-coded into the UI.
 */
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_window_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking record;
  v_returned boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  -- Ownership is checked here, not only in RLS: a booking id in a request must
  -- never let one customer cancel another's place (note 05 §31).
  if v_booking is null or v_booking.user_id <> v_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('status', 'ok', 'already', true);
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where id = p_booking_id;

  -- Return the credit only if cancelled far enough ahead.
  if v_booking.entitlement_id is not null
     and v_booking.starts_at is not null
     and v_booking.starts_at - make_interval(hours => p_window_hours) > now()
  then
    update public.entitlements
       set quantity_used = greatest(quantity_used - 1, 0),
           status = case when status = 'consumed' then 'active' else status end
     where id = v_booking.entitlement_id
       and quantity is not null;

    v_returned := found;
  end if;

  return jsonb_build_object('status', 'ok', 'credit_returned', v_returned);
end;
$$;

revoke all on function public.book_group_session(uuid) from anon;
revoke all on function public.cancel_booking(uuid, integer) from anon;
grant execute on function public.book_group_session(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid, integer) to authenticated;
