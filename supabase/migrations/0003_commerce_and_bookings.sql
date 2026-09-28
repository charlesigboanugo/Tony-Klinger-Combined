-- 0003 — Order fulfilment, guest order claiming, Stripe product ids, booking operations and session visibility for credit holders.
--
-- Consolidated 2026-09-23 from migrations 0008, 0009, 0010, 0011, 0012, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- order fulfilment  (was migration 0008)
-- ===========================================================================

-- 0008 — Order fulfilment.
-- Architecture: note 09 §15, §21, §22, §28; note 05 §29.
--
-- Turning a paid order into entitlements happens in one database transaction.
-- Doing it as a sequence of application writes leaves a customer who paid with
-- an order marked paid and no access, if the process dies midway.

-- Duplicate protection: replaying a webhook must not grant a second copy of the
-- same entitlement (note 09 §21). Partial, because manual grants and
-- membership-derived rows have no source order.
create unique index if not exists entitlements_unique_per_order
  on public.entitlements (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
  where source_id is not null;

/**
 * Grant the entitlements an order's items imply.
 *
 * Only for orders already attached to an account. A paid guest order stays
 * unfulfilled until it is claimed (note 05 §29.3) — it is a real, paid record
 * in the meantime, never discarded.
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
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, p.product_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;

    -- Map the purchased product to the thing it grants access to.
    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
      when 'group_coaching' then
        v_resource_type := 'group_coaching_series';
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      else
        -- Memberships grant access through their subscription, not directly
        -- from the order (note 09 §16).
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active')
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

/**
 * Mark an order paid and fulfil it, atomically and idempotently.
 *
 * Safe to call repeatedly: a provider may deliver the same event more than
 * once, and reconciliation may replay it deliberately (note 09 §21, §46).
 */
create or replace function public.fulfil_order(
  p_order_id uuid,
  p_provider_payment_id text default null,
  p_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_granted integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if v_order is null then
    return jsonb_build_object('status', 'unknown_order');
  end if;

  if v_order.status <> 'paid' then
    update public.orders
       set status = 'paid', paid_at = coalesce(paid_at, now())
     where id = p_order_id;
  end if;

  if p_provider_payment_id is not null then
    insert into public.payments
      (order_id, provider, provider_payment_id, amount, currency, status, paid_at)
    values
      (p_order_id, 'stripe', p_provider_payment_id,
       coalesce(p_amount, v_order.total), v_order.currency, 'succeeded', now())
    on conflict (provider, provider_payment_id) do nothing;
  end if;

  v_granted := public.grant_entitlements_for_order(p_order_id);

  return jsonb_build_object(
    'status', 'ok',
    'order_id', p_order_id,
    'claimed', v_order.user_id is not null,
    'entitlements_granted', v_granted
  );
end;
$$;

revoke all on function public.fulfil_order(uuid, text, integer) from anon, authenticated;
revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;


-- ===========================================================================
-- guest order claim  (was migration 0009)
-- ===========================================================================

-- 0009 — Guest order claiming.
-- Architecture: note 05 §29.3, note 09 §6, §7; note 08 §42.
--
-- A guest pays, then links that purchase to an account. The whole security of
-- this rests on one rule: the email address proves nothing on its own.
-- Authorization is possession of an emailed single-use token PLUS an
-- authenticated session.

/**
 * Redeem a claim token for the calling user.
 *
 * Deliberately takes the token HASH, never the token: the caller hashes it, so
 * a database dump or a log line cannot be replayed into a claim.
 *
 * Attaches the order to auth.uid() — never to a user id supplied by the caller
 * (note 05 §29.3). Runs as one transaction: a half-claimed order would be an
 * order the customer can see but has no access from.
 */
create or replace function public.claim_order(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token record;
  v_order record;
  v_granted integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_token
  from public.order_claim_tokens
  where token_hash = p_token_hash
  for update;

  if v_token is null then
    -- Same answer for an unknown token and a spent one: distinguishing them
    -- tells an attacker which guesses were once real.
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_token.consumed_at is not null then
    -- Already claimed by this same user: report success so a double click or a
    -- refreshed link is not alarming.
    if v_token.consumed_by = v_user_id then
      return jsonb_build_object('status', 'ok', 'order_id', v_token.order_id, 'already', true);
    end if;
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_token.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_order from public.orders where id = v_token.order_id for update;

  if v_order is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Someone else already owns this order. Never reassign it.
  if v_order.user_id is not null and v_order.user_id <> v_user_id then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  update public.orders
     set user_id = v_user_id,
         guest_email = null   -- the address has served its purpose
   where id = v_order.id;

  update public.order_claim_tokens
     set consumed_at = now(), consumed_by = v_user_id
   where id = v_token.id;

  -- Now that the order has an owner, its entitlements can exist.
  v_granted := public.grant_entitlements_for_order(v_order.id);

  return jsonb_build_object(
    'status', 'ok',
    'order_id', v_order.id,
    'entitlements_granted', v_granted
  );
end;
$$;

revoke all on function public.claim_order(text) from anon;
grant execute on function public.claim_order(text) to authenticated;

comment on function public.claim_order(text) is
  'Links a paid guest order to the CALLING user. Requires a valid, unexpired, unconsumed token hash and an authenticated session. Never trusts an email address alone.';


-- ===========================================================================
-- stripe product ids  (was migration 0010)
-- ===========================================================================

-- 0010 — Stripe product identifiers.
-- Architecture: note 08 §11, note 09 §12.
--
-- `prices.stripe_price_id` already existed but was never populated: checkout
-- was creating throwaway inline products, so Stripe saw a brand-new Product on
-- every purchase. That makes per-product revenue reporting impossible and gives
-- subscriptions no stable Price to bill against.
--
-- The application remains the source of truth for its own catalogue; these
-- columns just record the counterpart object on Stripe's side.

alter table public.products
  add column if not exists stripe_product_id text unique;

create index if not exists prices_stripe_price_id_idx
  on public.prices (stripe_price_id)
  where stripe_price_id is not null;

comment on column public.products.stripe_product_id is
  'Stripe Product id. Created once by the sync, never per checkout.';


-- ===========================================================================
-- booking operations  (was migration 0011)
-- ===========================================================================

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


-- ===========================================================================
-- session visibility for credit holders  (was migration 0012)
-- ===========================================================================

-- 0012 — Session visibility for credit holders.
--
-- A customer may read a scheduled session through either route to it: a
-- `group_coaching_series` entitlement, or unspent `group_coaching_session`
-- credits. Note 07 §14 allows buying individual sessions and eight-session
-- bundles, which produce only credits — series access alone would leave those
-- buyers unable to see a session to spend them on.

create or replace function public.has_session_credits()
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
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and e.quantity is not null
      and e.quantity_used < e.quantity
  );
$$;

create policy "gc_sessions: entitled read"
  on public.group_coaching_sessions for select
  using (
    -- Series access covers every session in that series...
    public.has_active_entitlement('group_coaching_series', series_id)
    -- ...and unspent credits are usable against any scheduled session.
    or public.has_session_credits()
  );

comment on function public.has_session_credits() is
  'True when the caller holds at least one unspent group coaching session credit.';
