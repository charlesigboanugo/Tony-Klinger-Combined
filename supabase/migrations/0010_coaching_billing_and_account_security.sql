-- 0010 — Private coaching slots and hold-then-pay booking; billing self-service; account security self-service.
--
-- Consolidated 2026-09-28 from 0020_private_coaching_booking, 0021_billing_self_service, 0022_account_security_self_service, in their original
-- order. Each section keeps a banner naming its former file, which notes and
-- comments may still cite.

-- ===========================================================================
-- 0020_private_coaching_booking  (was migration 0020, before 2026-09-28)
-- ===========================================================================

-- 0020 — Private coaching: open slots, hold-then-pay booking, credits.
--
-- Owner, 2026-09-27: slots are set in Admin, and the customer pays at booking.
-- Note 09 §35 already fixed the order — private coaching is BOOK-FIRST, because
-- the scarce thing sold is a calendar slot and availability must be checked
-- before payment can mean anything.
--
-- The chain stays the one every reservation uses (note 07 §48):
--
--   slot → hold (pending booking) → payment → order → entitlement → confirmed booking
--
--   1. Staff open SLOTS for a service (a start time; the end follows from the
--      service's length unless set).
--   2. The customer picks one. `hold_private_coaching_slot` locks it and writes
--      a PENDING booking with a hold expiry — long enough to pay (Stripe's
--      shortest checkout lifetime is 30 minutes).
--   3. Checkout sells the service's product. Fulfilment grants a
--      `private_coaching` entitlement of ONE session, and a trigger spends it
--      on the held booking, which becomes confirmed. Paying and holding the
--      session cannot drift apart.
--   4. If the hold lapsed AND someone else has since taken that time, the
--      payment is not lost: the entitlement stays unspent, a credit the
--      customer uses to book another slot without paying again.
--
-- The same credit is what a timely cancellation returns (48 hours, the policy
-- already stated on the service page), so cancelling is rescheduling.

alter type public.entitlement_resource add value if not exists 'private_coaching';

-- ---------------------------------------------------------------------------
-- Slots
-- ---------------------------------------------------------------------------

create table if not exists public.private_coaching_slots (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.private_coaching_services (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  -- Private: the call link is what the booking buys. Readable only by the
  -- person who booked it and staff, like `event_access`.
  meeting_url text,
  status      text not null default 'open' check (status in ('open', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists private_coaching_slots_service_starts_idx
  on public.private_coaching_slots (service_id, starts_at);

comment on table public.private_coaching_slots is
  'Times Tony is available for a private coaching service. One booking per slot; overlapping slots across services block each other.';

drop trigger if exists private_coaching_slots_set_updated_at on public.private_coaching_slots;
create trigger private_coaching_slots_set_updated_at
  before update on public.private_coaching_slots
  for each row execute function public.set_updated_at();

/** An end time left empty is the start plus the service's length. */
create or replace function public.private_coaching_slots_default_end()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ends_at is null then
    select new.starts_at + make_interval(mins => duration_minutes)
      into new.ends_at
      from public.private_coaching_services where id = new.service_id;
  end if;
  return new;
end;
$$;

drop trigger if exists private_coaching_slots_default_end on public.private_coaching_slots;
create trigger private_coaching_slots_default_end
  before insert or update on public.private_coaching_slots
  for each row execute function public.private_coaching_slots_default_end();

-- The NOT NULL on ends_at is checked after BEFORE triggers run, so the default
-- above satisfies it; staff can still type an explicit end.

alter table public.private_coaching_slots enable row level security;

drop policy if exists "pc_slots: staff read" on public.private_coaching_slots;
create policy "pc_slots: staff read"
  on public.private_coaching_slots for select
  using (public.has_permission('coaching.read'));

drop policy if exists "pc_slots: staff write" on public.private_coaching_slots;
create policy "pc_slots: staff write"
  on public.private_coaching_slots for all
  using (public.has_permission('coaching.manage'))
  with check (public.has_permission('coaching.manage'));

drop policy if exists "pc_slots: booked read" on public.private_coaching_slots;
create policy "pc_slots: booked read"
  on public.private_coaching_slots for select
  using (public.has_booking('private_coaching', id));

-- ---------------------------------------------------------------------------
-- Holds on the booking
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists order_id uuid references public.orders (id) on delete set null,
  add column if not exists hold_expires_at timestamptz;

comment on column public.bookings.hold_expires_at is
  'Pending private coaching bookings only: the slot is held for payment until then.';

create index if not exists bookings_order_id_idx on public.bookings (order_id) where order_id is not null;

/**
 * Whether a private coaching time is taken, by any live booking of ANY
 * service — Tony cannot be in two sessions at once. A pending booking counts
 * only while its hold lasts.
 */
create or replace function public.private_coaching_time_taken(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_ignore_booking uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.bookable_type = 'private_coaching'
      and (p_ignore_booking is null or b.id <> p_ignore_booking)
      and b.starts_at < p_ends_at
      and b.ends_at > p_starts_at
      and (
        b.status = 'confirmed'
        or (b.status = 'pending' and b.hold_expires_at > now())
      )
  );
$$;

revoke all on function public.private_coaching_time_taken(timestamptz, timestamptz, uuid) from anon, authenticated;

/**
 * Open times for a service, for the booking page. Security definer so the
 * slots table itself (with its call links) stays unreadable; only times leave.
 * Twelve hours' notice at least, so nobody books a session starting now.
 */
create or replace function public.private_coaching_availability(p_service_id uuid)
returns table (slot_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.starts_at, s.ends_at
  from public.private_coaching_slots s
  join public.private_coaching_services svc on svc.id = s.service_id and svc.status = 'published'
  where s.service_id = p_service_id
    and s.status = 'open'
    and s.starts_at > now() + interval '12 hours'
    and not public.private_coaching_time_taken(s.starts_at, s.ends_at)
  order by s.starts_at;
$$;

grant execute on function public.private_coaching_availability(uuid) to anon, authenticated;

/**
 * Hold a slot for the caller, or book it outright with an unspent credit.
 *
 *   booked   — a credit covered it; the booking is confirmed now
 *   held     — a pending booking holds the slot until `hold_expires_at`;
 *              the caller now pays for it (checkout names this booking)
 *   taken / past / not_found / not_authenticated
 *
 * The slot row is locked, so two customers choosing the same time are
 * serialised: the second sees it taken.
 */
create or replace function public.hold_private_coaching_slot(
  p_slot_id uuid,
  p_hold_minutes integer default 35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot record;
  v_credit record;
  v_booking_id uuid;
  v_expires timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select s.* into v_slot
  from public.private_coaching_slots s
  join public.private_coaching_services svc on svc.id = s.service_id and svc.status = 'published'
  where s.id = p_slot_id and s.status = 'open'
  for update of s;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_slot.starts_at <= now() + interval '12 hours' then
    return jsonb_build_object('status', 'past');
  end if;

  -- A customer holds one unpaid time at a time: choosing again releases the
  -- earlier hold rather than locking two of Tony's slots.
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
   where user_id = v_user_id
     and bookable_type = 'private_coaching'
     and status = 'pending';

  if public.private_coaching_time_taken(v_slot.starts_at, v_slot.ends_at) then
    return jsonb_build_object('status', 'taken');
  end if;

  -- An unspent credit for this service books it without paying.
  select * into v_credit
  from public.entitlements
  where user_id = v_user_id
    and resource_type = 'private_coaching'
    and resource_id = v_slot.service_id
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and quantity is not null
    and quantity_used < quantity
  order by created_at
  limit 1
  for update;

  if found then
    update public.entitlements
       set quantity_used = quantity_used + 1,
           status = case when quantity_used + 1 >= quantity then 'consumed' else status end
     where id = v_credit.id;

    insert into public.bookings
      (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
    values
      (v_user_id, 'private_coaching', v_slot.id, v_credit.id, 'confirmed', v_slot.starts_at, v_slot.ends_at)
    returning id into v_booking_id;

    return jsonb_build_object('status', 'booked', 'booking_id', v_booking_id);
  end if;

  v_expires := now() + make_interval(mins => greatest(p_hold_minutes, 31));

  insert into public.bookings
    (user_id, bookable_type, bookable_id, status, starts_at, ends_at, hold_expires_at)
  values
    (v_user_id, 'private_coaching', v_slot.id, 'pending', v_slot.starts_at, v_slot.ends_at, v_expires)
  returning id into v_booking_id;

  return jsonb_build_object(
    'status', 'held',
    'booking_id', v_booking_id,
    'service_id', v_slot.service_id,
    'hold_expires_at', v_expires
  );
end;
$$;

revoke all on function public.hold_private_coaching_slot(uuid, integer) from anon;
grant execute on function public.hold_private_coaching_slot(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Payment → entitlement → confirmed booking
-- ---------------------------------------------------------------------------

/**
 * `grant_entitlements_for_order` (0003), with private coaching added: a
 * service's product grants ONE session of that service. Everything else is
 * unchanged.
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
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.product_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;
    v_quantity := null;

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
      when 'private_coaching' then
        v_resource_type := 'private_coaching';
        select id into v_resource_id from public.private_coaching_services where product_id = v_item.product_id limit 1;
        -- Sessions are counted: one bought, one to spend on a slot.
        v_quantity := greatest(coalesce(v_item.quantity, 1), 1);
      else
        -- Memberships grant access through their subscription, not directly
        -- from the order (note 09 §16).
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status, quantity)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active', v_quantity)
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

/**
 * A purchased private coaching session is spent on the booking its order was
 * holding — confirming it — unless that time has since gone to someone else,
 * in which case it stays as a credit to book another slot with.
 */
create or replace function public.entitlements_confirm_private_coaching()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_email text;
  v_service text;
begin
  if new.resource_type <> 'private_coaching' or new.source_type <> 'purchase'
     or new.source_id is null or new.status <> 'active' then
    return new;
  end if;

  select * into v_booking
  from public.bookings
  where order_id = new.source_id
    and user_id = new.user_id
    and bookable_type = 'private_coaching'
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if not found then
    return new;
  end if;

  select email into v_email from auth.users where id = new.user_id;
  select name into v_service from public.private_coaching_services where id = new.resource_id;

  if public.private_coaching_time_taken(v_booking.starts_at, v_booking.ends_at, v_booking.id)
     or v_booking.starts_at <= now() then
    update public.bookings
       set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
     where id = v_booking.id;

    if v_email is not null then
      perform public.enqueue_email(
        'pc-rebook:' || v_booking.id,
        'private_coaching_rebook',
        v_email,
        jsonb_build_object('title', coalesce(v_service, 'Private coaching'))
      );
    end if;
    return new;
  end if;

  update public.bookings
     set status = 'confirmed', entitlement_id = new.id, hold_expires_at = null
   where id = v_booking.id;

  update public.entitlements
     set quantity_used = quantity_used + 1,
         status = case when quantity_used + 1 >= quantity then 'consumed' else status end
   where id = new.id;

  if v_email is not null then
    perform public.enqueue_email(
      'booking:' || v_booking.id,
      'booking_confirmed',
      v_email,
      jsonb_build_object(
        'title', 'Private coaching — ' || coalesce(v_service, 'one to one'),
        'startsAt', v_booking.starts_at
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists entitlements_private_coaching on public.entitlements;
create trigger entitlements_private_coaching
  after insert on public.entitlements
  for each row execute function public.entitlements_confirm_private_coaching();

/** A checkout that expired unpaid gives its held time back straight away. */
create or replace function public.release_private_coaching_hold(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
   where order_id = p_order_id
     and bookable_type = 'private_coaching'
     and status = 'pending';
$$;

revoke all on function public.release_private_coaching_hold(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------

/**
 * `cancel_booking` (0018), with private coaching's rule: cancel at least 48
 * hours ahead and the session comes back as a credit (so cancelling is how
 * a customer reschedules). Inside 48 hours it is not cancelled online — the
 * service page already says to get in touch. Everything else is unchanged.
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
  v_window integer := p_window_hours;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking is null or v_booking.user_id <> v_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('status', 'ok', 'already', true);
  end if;

  if v_booking.bookable_type = 'event' and v_booking.entitlement_id is not null then
    return jsonb_build_object('status', 'paid_ticket');
  end if;

  if v_booking.bookable_type = 'private_coaching' and v_booking.status = 'confirmed' then
    v_window := 48;
    if v_booking.starts_at - interval '48 hours' <= now() then
      return jsonb_build_object('status', 'too_late');
    end if;
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
   where id = p_booking_id;

  if v_booking.entitlement_id is not null
     and v_booking.starts_at is not null
     and v_booking.starts_at - make_interval(hours => v_window) > now()
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

revoke all on function public.cancel_booking(uuid, integer) from anon;
grant execute on function public.cancel_booking(uuid, integer) to authenticated;

/**
 * Staff cancelling a slot cancels whatever is booked on it and returns the
 * customer's session as a credit, whatever the notice — the change was ours.
 */
create or replace function public.private_coaching_slots_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_email text;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  for v_booking in
    select * from public.bookings
    where bookable_type = 'private_coaching'
      and bookable_id = new.id
      and status in ('pending', 'confirmed')
    for update
  loop
    update public.bookings
       set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
     where id = v_booking.id;

    if v_booking.status = 'confirmed' then
      if v_booking.entitlement_id is not null then
        update public.entitlements
           set quantity_used = greatest(quantity_used - 1, 0),
               status = case when status = 'consumed' then 'active' else status end
         where id = v_booking.entitlement_id
           and quantity is not null;
      end if;

      select email into v_email from auth.users where id = v_booking.user_id;
      if v_email is not null then
        perform public.enqueue_email(
          'pc-slot-cancel:' || v_booking.id,
          'booking_cancelled',
          v_email,
          jsonb_build_object('creditReturned', v_booking.entitlement_id is not null, 'byUs', true)
        );
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists private_coaching_slots_cancel on public.private_coaching_slots;
create trigger private_coaching_slots_cancel
  after update of status on public.private_coaching_slots
  for each row execute function public.private_coaching_slots_after_cancel();

-- ===========================================================================
-- 0021_billing_self_service  (was migration 0021, before 2026-09-28)
-- ===========================================================================

-- 0021 — Billing self-service: Stripe customers, receipts, invoices, cancellation state.
--
-- Owner, 2026-09-27: "one should be able to see receipts, change subscription
-- status / cancel subscription and other billing things like cards — do the
-- normal setup and make it production ready."
--
-- The normal setup is Stripe's own: card changes, invoice history and
-- cancellation run in the Stripe Customer Portal, reached from /account/billing.
-- What the site needs for that, and for showing receipts itself:
--
--   billing_customers   one Stripe Customer per account, so cards, invoices and
--                       subscriptions all hang off the same record (checkout
--                       previously sent only an email, and Stripe made a new
--                       customer — or none — every time)
--   payments.receipt_url  Stripe's hosted receipt for a one-off payment
--   invoices            each subscription invoice (first payment and every
--                       renewal), with its hosted page and PDF — renewals had no
--                       record here at all, so they were missing from history
--   orders.checkout_mode  'subscription' orders are receipted by their invoice,
--                       not by a charge receipt, and are not listed twice
--   subscriptions.cancel_at_period_end  "cancelled, access runs to the end of
--                       the paid period" is a state the customer must see

-- ---------------------------------------------------------------------------
-- Stripe customers
-- ---------------------------------------------------------------------------

create table if not exists public.billing_customers (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

comment on table public.billing_customers is
  'The Stripe Customer for each account. Written by the server only (service role).';

alter table public.billing_customers enable row level security;

drop policy if exists "billing_customers: read own" on public.billing_customers;
create policy "billing_customers: read own"
  on public.billing_customers for select
  using (user_id = auth.uid());

drop policy if exists "billing_customers: staff read" on public.billing_customers;
create policy "billing_customers: staff read"
  on public.billing_customers for select
  using (public.has_permission('orders.read'));

-- No insert/update/delete policy: only the service role writes, so a customer
-- can never point their account at someone else's Stripe record.

-- ---------------------------------------------------------------------------
-- Receipts and checkout mode
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists receipt_url text;

alter table public.orders
  add column if not exists checkout_mode text not null default 'payment';

do $$ begin
  alter table public.orders
    add constraint orders_checkout_mode_check check (checkout_mode in ('payment', 'subscription'));
exception when duplicate_object then null; end $$;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- ---------------------------------------------------------------------------
-- Subscription invoices
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  -- The checkout order this invoice paid, for the FIRST invoice of a
  -- subscription only; renewals have none.
  order_id            uuid references public.orders (id) on delete set null,
  provider            text not null default 'stripe',
  provider_invoice_id text not null,
  -- Kept on the invoice because Stripe may deliver `invoice.paid` before the
  -- subscription event that creates our row; the link is filled in then.
  provider_subscription_id text,
  membership_tier     public.membership_tier,
  number              text,
  status              text not null,
  amount_due          integer not null default 0,
  amount_paid         integer not null default 0,
  currency            text not null default 'GBP',
  hosted_invoice_url  text,
  invoice_pdf         text,
  period_start        timestamptz,
  period_end          timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_invoice_id)
);

create index if not exists invoices_user_id_idx on public.invoices (user_id, created_at desc);
create index if not exists invoices_provider_subscription_idx on public.invoices (provider_subscription_id);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "invoices: read own" on public.invoices;
create policy "invoices: read own"
  on public.invoices for select
  using (user_id = auth.uid());

drop policy if exists "invoices: staff read" on public.invoices;
create policy "invoices: staff read"
  on public.invoices for select
  using (public.has_permission('orders.read'));

-- ===========================================================================
-- 0022_account_security_self_service  (was migration 0022, before 2026-09-28)
-- ===========================================================================

-- 0022 — Account security self-service: see and remove your own security keys,
-- see and sign out your own signed-in devices.
--
-- Owner, 2026-09-27: show which device added each key, let a user remove a key
-- (at a higher assurance level), and list signed-in devices with sign-out.
--
-- `auth.mfa_factors` and `auth.sessions` are not exposed to PostgREST, so each
-- read and write here is a SECURITY DEFINER function scoped to `auth.uid()`:
-- nobody can see or touch another account's keys or sessions through these.
--
--   my_security_keys()                   the caller's verified keys, with the
--                                        authenticator model id (AAGUID) and
--                                        when each was last used
--   my_sessions()                        the caller's signed-in sessions
--   sign_out_my_session(id)              end one of the caller's OTHER sessions
--   authorise_security_key_removal(id)   the gate before a key is deleted:
--                                        verified WITH A KEY in the last 10
--                                        minutes, keeps the staff minimum,
--                                        writes the audit entry, queues the
--                                        "a key was removed" email
--
-- The deletion itself is made through the Auth admin API by the server action
-- after this gate passes — the same split as `admin_record_mfa_reset` (0008).

-- ---------------------------------------------------------------------------
-- Keys
-- ---------------------------------------------------------------------------

create or replace function public.my_security_keys()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  last_used_at timestamptz,
  aaguid uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.friendly_name, f.created_at, f.last_challenged_at, f.web_authn_aaguid
    from auth.mfa_factors f
   where f.user_id = auth.uid()
     and f.status = 'verified'
     and f.factor_type = 'webauthn'
   order by f.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

create or replace function public.my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         -- `refreshed_at` is a UTC timestamp without a zone.
         coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at),
         s.user_agent,
         host(s.ip),
         s.aal::text,
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    from auth.sessions s
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by (s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid) desc,
            coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) desc;
$$;

/*
  Ends one of the caller's other sessions. Its refresh tokens go with it
  (ON DELETE CASCADE), so the device cannot renew; and every server request
  here validates the session with the Auth server (`getUser()`), which refuses
  a session that no longer exists — so the device is signed out on its next
  page load, not when its access token expires.

  The CURRENT session is refused: signing yourself out is the Sign out button,
  and doing it here would leave the page in a half-signed-out state.
*/
create or replace function public.sign_out_my_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid then
    raise exception 'use Sign out to end this session' using errcode = '22023';
  end if;

  delete from auth.sessions where id = p_session_id and user_id = v_uid;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Removing a key — the gate
-- ---------------------------------------------------------------------------

create or replace function public.authorise_security_key_removal(p_factor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_name text;
  v_email text;
  v_total integer;
  v_minimum integer := 0;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select f.friendly_name into v_name
    from auth.mfa_factors f
   where f.id = p_factor_id and f.user_id = v_uid and f.status = 'verified';
  if not found then
    raise exception 'key not found' using errcode = 'P0002';
  end if;

  /*
    A HIGHER LEVEL, AND RECENT. The session must have presented a key within
    the last 10 minutes — not merely at some point today. Otherwise anyone with
    a password and an unattended, signed-in laptop could strip the protection
    the key exists to provide. `mfa_amr_claims` is stamped each time a key is
    used on this session, including a re-confirmation.
  */
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (
       select 1 from auth.mfa_amr_claims c
        where c.session_id = v_session
          and c.authentication_method = 'mfa/webauthn'
          and c.updated_at > now() - interval '10 minutes'
     ) then
    raise exception 'reauthentication required' using errcode = '42501', hint = 'reauth';
  end if;

  /*
    THE STAFF MINIMUM. An owner keeps two keys (0004's rule for privileged
    actions); other staff keep one, since Admin cannot be reached without it.
    Customers may remove all of theirs — keys are optional for them.
  */
  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
     where ur.user_id = v_uid and r.name = 'owner'
  ) then
    v_minimum := 2;
  elsif exists (select 1 from public.user_roles ur where ur.user_id = v_uid) then
    v_minimum := 1;
  end if;

  select count(*) into v_total
    from auth.mfa_factors f
   where f.user_id = v_uid and f.status = 'verified';

  if v_total - 1 < v_minimum then
    raise exception 'this account must keep at least % security key%', v_minimum,
      case when v_minimum = 1 then '' else 's' end
      using errcode = '23514', hint = 'minimum';
  end if;

  insert into public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'security_key.removed', 'mfa_factor', p_factor_id::text,
          jsonb_build_object('name', v_name, 'self_service', true));

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is not null then
    perform public.enqueue_email(
      'security_key_removed:' || p_factor_id::text,
      'security_key_removed',
      v_email,
      jsonb_build_object('name', v_name, 'at', now())
    );
  end if;

  return jsonb_build_object('name', v_name);
end;
$$;

revoke all on function public.my_security_keys() from public, anon;
revoke all on function public.my_sessions() from public, anon;
revoke all on function public.sign_out_my_session(uuid) from public, anon;
revoke all on function public.authorise_security_key_removal(uuid) from public, anon;

grant execute on function public.my_security_keys() to authenticated;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.sign_out_my_session(uuid) to authenticated;
grant execute on function public.authorise_security_key_removal(uuid) to authenticated;
