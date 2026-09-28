-- 0009 — Event covers, galleries and registration; tickets, waitlist and check-in; Academy delivery of booked sessions and recordings.
--
-- Consolidated 2026-09-28 from 0017_event_media_and_registration, 0018_event_tickets_waitlist_and_checkin, 0019_academy_delivery, in their original
-- order. Each section keeps a banner naming its former file, which notes and
-- comments may still cite.

-- ===========================================================================
-- 0017_event_media_and_registration  (was migration 0017, before 2026-09-28)
-- ===========================================================================

-- 0017 — Event covers, event photo galleries, and registration for free events.
--
-- Events could hold no image at all, so /events read as a text list and a past
-- event could not show what happened (owner, 2026-09-26: event photos on the
-- single event page, and on the index where events have them). And "Register a
-- place" linked to /bookings, which only lists group coaching sessions — a dead
-- end. Note 03 §8.1: a free event still produces a booking, because capacity
-- and attendance must be tracked. This adds that booking path for free events.
-- Paid events need an event product in the checkout, which does not exist yet;
-- until it does, their pages send people to ask rather than to a broken flow.

-- ---------------------------------------------------------------------------
-- Cover — same shape as the coaching covers (0007). ON DELETE SET NULL: deleting
-- an image must never delete the event that used it. Named FK so PostgREST
-- embeds stay unambiguous.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists cover_resource_id uuid
  constraint events_cover_resource_id_fkey
  references public.resources (id) on delete set null;

comment on column public.events.cover_resource_id is
  'Marketing image for /events and the event page. PUBLIC bucket only.';

-- ---------------------------------------------------------------------------
-- Gallery — photographs from (or for) an event, in order. A join table rather
-- than an array so each image keeps referential integrity with `resources`.
-- ---------------------------------------------------------------------------

create table if not exists public.event_images (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  resource_id uuid not null
              constraint event_images_resource_id_fkey
              references public.resources (id) on delete cascade,
  position    integer not null default 0,
  caption     text,
  created_at  timestamptz not null default now(),
  unique (event_id, resource_id)
);

create index if not exists event_images_event_idx on public.event_images (event_id, position);

alter table public.event_images enable row level security;

-- Readable exactly when the event itself is: published, or staff with events.read.
create policy "event_images: public read with published event"
  on public.event_images for select
  using (exists (
    select 1 from public.events e
    where e.id = event_images.event_id and e.status = 'published'
  ));

create policy "event_images: staff read"
  on public.event_images for select
  using (public.has_permission('events.read'));

create policy "event_images: staff write"
  on public.event_images for all
  using (public.has_permission('events.update'))
  with check (public.has_permission('events.update'));

-- ---------------------------------------------------------------------------
-- Places taken — the count a visitor needs ("12 places left") without being
-- able to read anyone's booking. Bookings RLS only shows a customer their own.
-- ---------------------------------------------------------------------------

create or replace function public.event_places_taken(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.bookings b
  join public.events e on e.id = b.bookable_id and e.status = 'published'
  where b.bookable_type = 'event'
    and b.bookable_id = p_event_id
    and b.status in ('pending', 'confirmed');
$$;

grant execute on function public.event_places_taken(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Register for a free event. Mirrors book_group_session (0003): the event row
-- is locked FOR UPDATE so two requests cannot both take the last place, and a
-- repeat is reported rather than duplicated (the partial unique index on
-- bookings is the database-level backstop). Returns a status, never raises.
-- ---------------------------------------------------------------------------

create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event record;
  v_taken integer;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if v_event is null or v_event.status <> 'published' then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Paid places go through an order first (note 03 §8.1), never here.
  if not v_event.is_free then
    return jsonb_build_object('status', 'paid');
  end if;

  -- No date yet means nothing to hold a place on.
  if v_event.starts_at is null then
    return jsonb_build_object('status', 'unscheduled');
  end if;

  if v_event.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  if exists (
    select 1 from public.bookings
    where user_id = v_user_id
      and bookable_type = 'event'
      and bookable_id = p_event_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  if v_event.capacity is not null then
    select count(*) into v_taken
    from public.bookings
    where bookable_type = 'event'
      and bookable_id = p_event_id
      and status in ('pending', 'confirmed');

    if v_taken >= v_event.capacity then
      return jsonb_build_object('status', 'full');
    end if;
  end if;

  insert into public.bookings
    (user_id, bookable_type, bookable_id, status, starts_at, ends_at)
  values
    (v_user_id, 'event', p_event_id, 'confirmed', v_event.starts_at, v_event.ends_at)
  returning id into v_booking_id;

  return jsonb_build_object('status', 'ok', 'booking_id', v_booking_id);
end;
$$;

revoke all on function public.register_for_event(uuid) from anon;
grant execute on function public.register_for_event(uuid) to authenticated;

-- ===========================================================================
-- 0018_event_tickets_waitlist_and_checkin  (was migration 0018, before 2026-09-28)
-- ===========================================================================

-- 0018 — Event tickets, formats, private joining details, waitlist and check-in.
--
-- Owner, 2026-09-26: "where is ask for a ticket meant to go, did you account for
-- waitlist, what of QR code or ticket or code confirmation, and on event day,
-- did you account for online and physical — do what's best."
--
-- The chain stays the one note 03 §8.1 fixes for every reservation:
--
--   event → (payment → order → entitlement, for a paid event) → booking → attendance
--
-- A booking on an event IS the ticket. It now carries a reference code (shown
-- as text and as a QR code) and a check-in time. A paid ticket is created the
-- moment the order's `event` entitlement is granted, so paying and holding a
-- ticket can never drift apart. A waitlist sits beside a full event, and a
-- cancelled place is offered to the next person on it.

-- ---------------------------------------------------------------------------
-- Format and venue
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.event_format as enum ('in_person', 'online', 'hybrid');
exception when duplicate_object then null; end $$;

alter table public.events
  add column if not exists format public.event_format not null default 'in_person',
  add column if not exists venue_address text;

comment on column public.events.location is
  'Short public place name ("Tyneside Cinema, Newcastle", "Online, on Zoom").';
comment on column public.events.venue_address is
  'Full street address for in-person and hybrid events; public, linked to a map.';

-- ---------------------------------------------------------------------------
-- Joining details — PRIVATE. The link to an online event is what a ticket buys,
-- so it cannot sit on `events`, which anyone can read. Readable only by the
-- event's ticket holders and staff.
-- ---------------------------------------------------------------------------

create table if not exists public.event_access (
  event_id      uuid primary key references public.events (id) on delete cascade,
  join_url      text,
  joining_notes text,
  updated_at    timestamptz not null default now()
);

alter table public.event_access enable row level security;

create policy "event_access: ticket holders read"
  on public.event_access for select
  using (exists (
    select 1 from public.bookings b
    where b.bookable_type = 'event'
      and b.bookable_id = event_access.event_id
      and b.user_id = auth.uid()
      and b.status in ('pending', 'confirmed', 'completed')
  ));

create policy "event_access: staff read"
  on public.event_access for select
  using (public.has_permission('events.read'));

create policy "event_access: staff write"
  on public.event_access for all
  using (public.has_permission('events.update'))
  with check (public.has_permission('events.update'));

-- ---------------------------------------------------------------------------
-- Ticket reference and check-in on the booking
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists reference text,
  add column if not exists checked_in_at timestamptz;

create unique index if not exists bookings_reference_key
  on public.bookings (reference) where reference is not null;

/**
 * A ticket reference: "TK-" and eight characters from an alphabet with no
 * look-alikes (no 0/O, 1/I/L), so it can be read aloud at a door. 30^8 ≈ 6.5e11
 * combinations: not guessable, and it is only ever a lookup for staff.
 */
create or replace function public.new_ticket_reference()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_ref text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_ref := 'TK-';
    for i in 0..7 loop
      v_ref := v_ref || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where reference = v_ref);
  end loop;
  return v_ref;
end;
$$;

/**
 * Every event booking gets a reference, however it was made (free registration,
 * paid ticket, or a staff insert), and leaves the waitlist it may have been on.
 */
create or replace function public.bookings_event_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bookable_type = 'event' and new.reference is null then
    new.reference := public.new_ticket_reference();
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_event_reference on public.bookings;
create trigger bookings_event_reference
  before insert on public.bookings
  for each row execute function public.bookings_event_before_insert();

-- ---------------------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------------------

create table if not exists public.event_waitlist (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- When this person was told a place had opened. They are then first to act,
  -- but the place is not held: registration stays first come, first served.
  notified_at timestamptz,
  unique (event_id, user_id)
);

create index if not exists event_waitlist_queue_idx on public.event_waitlist (event_id, created_at);

alter table public.event_waitlist enable row level security;

create policy "event_waitlist: read own"
  on public.event_waitlist for select using (user_id = auth.uid());
create policy "event_waitlist: staff read"
  on public.event_waitlist for select using (public.has_permission('events.read'));

-- ---------------------------------------------------------------------------
-- Emails and side effects, in the same transaction as the booking change
-- ---------------------------------------------------------------------------

/**
 * After an event booking is made: send the ticket, and take the person off the
 * event's waitlist. Keyed on the booking, so a replay cannot send two tickets.
 */
create or replace function public.bookings_event_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_event record;
begin
  if new.bookable_type <> 'event' then
    return new;
  end if;

  delete from public.event_waitlist where event_id = new.bookable_id and user_id = new.user_id;

  select email into v_email from auth.users where id = new.user_id;
  select name, starts_at, ends_at, location, format into v_event from public.events where id = new.bookable_id;

  -- FOUND, not `v_event is not null`: a record is only NOT NULL when every
  -- field is, so an event without a location or end time would silently
  -- send no ticket.
  if v_email is not null and found then
    perform public.enqueue_email(
      'event-ticket:' || new.id,
      'event_ticket',
      v_email,
      jsonb_build_object(
        'bookingId', new.id,
        'reference', new.reference,
        'title', v_event.name,
        'startsAt', v_event.starts_at,
        'endsAt', v_event.ends_at,
        'location', v_event.location,
        'format', v_event.format
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_event_ticket on public.bookings;
create trigger bookings_event_ticket
  after insert on public.bookings
  for each row execute function public.bookings_event_after_insert();

/**
 * When an event place is given up, tell the next person waiting. One place,
 * one person: the earliest who has not already been told.
 */
create or replace function public.bookings_event_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next record;
  v_email text;
  v_event record;
begin
  if new.bookable_type <> 'event'
     or new.status <> 'cancelled'
     or old.status = 'cancelled' then
    return new;
  end if;

  select * into v_event from public.events where id = new.bookable_id;
  if v_event is null or v_event.starts_at is null or v_event.starts_at <= now() then
    return new;
  end if;

  select * into v_next
  from public.event_waitlist
  where event_id = new.bookable_id and notified_at is null
  order by created_at
  limit 1
  for update skip locked;

  if v_next is null then
    return new;
  end if;

  update public.event_waitlist set notified_at = now() where id = v_next.id;
  select email into v_email from auth.users where id = v_next.user_id;

  if v_email is not null then
    perform public.enqueue_email(
      'event-place:' || v_next.id || ':' || new.id,
      'event_place_available',
      v_email,
      jsonb_build_object(
        'title', v_event.name,
        'slug', v_event.slug,
        'startsAt', v_event.starts_at,
        'isFree', v_event.is_free
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_event_cancelled on public.bookings;
create trigger bookings_event_cancelled
  after update of status on public.bookings
  for each row execute function public.bookings_event_after_cancel();

/**
 * A paid ticket is issued when the order's `event` entitlement is granted —
 * by the webhook, by reconciliation, or when a guest order is claimed. It
 * consumes that entitlement, so one purchase is one ticket.
 */
create or replace function public.entitlements_issue_event_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  if new.resource_type <> 'event' or new.resource_id is null or new.status <> 'active' then
    return new;
  end if;

  select * into v_event from public.events where id = new.resource_id;
  if v_event is null then
    return new;
  end if;

  if not exists (
    select 1 from public.bookings
    where user_id = new.user_id
      and bookable_type = 'event'
      and bookable_id = new.resource_id
      and status in ('pending', 'confirmed')
  ) then
    insert into public.bookings
      (user_id, bookable_type, bookable_id, entitlement_id, status, starts_at, ends_at)
    values
      (new.user_id, 'event', new.resource_id, new.id, 'confirmed', v_event.starts_at, v_event.ends_at);
  end if;

  return new;
end;
$$;

drop trigger if exists entitlements_event_ticket on public.entitlements;
create trigger entitlements_event_ticket
  after insert on public.entitlements
  for each row execute function public.entitlements_issue_event_ticket();

-- ---------------------------------------------------------------------------
-- Public and customer functions
-- ---------------------------------------------------------------------------

/**
 * Whether a paid event can be sold right now, by product. Checked by checkout
 * before a payment is taken. (Between that check and payment another buyer can
 * take the last place; the ticket is still issued, and staff see the event one
 * over capacity rather than a paying customer being turned away.)
 */
create or replace function public.event_sale_status(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event record;
  v_taken integer;
begin
  select * into v_event from public.events where product_id = p_product_id and status = 'published' limit 1;
  if v_event is null then return 'not_found'; end if;
  if v_event.starts_at is null then return 'unscheduled'; end if;
  if v_event.starts_at <= now() then return 'past'; end if;
  if v_event.capacity is not null then
    select count(*) into v_taken from public.bookings
    where bookable_type = 'event' and bookable_id = v_event.id and status in ('pending', 'confirmed');
    if v_taken >= v_event.capacity then return 'full'; end if;
  end if;
  return 'ok';
end;
$$;

grant execute on function public.event_sale_status(uuid) to anon, authenticated;

/** Join a full event's waitlist. Returns a status and, on success, a position. */
create or replace function public.join_event_waitlist(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event record;
  v_position integer;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_event from public.events where id = p_event_id and status = 'published';
  if v_event is null then return jsonb_build_object('status', 'not_found'); end if;
  if v_event.starts_at is not null and v_event.starts_at <= now() then
    return jsonb_build_object('status', 'past');
  end if;

  if exists (
    select 1 from public.bookings
    where user_id = v_user_id and bookable_type = 'event' and bookable_id = p_event_id
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('status', 'already_booked');
  end if;

  insert into public.event_waitlist (event_id, user_id)
  values (p_event_id, v_user_id)
  on conflict (event_id, user_id) do nothing;

  select count(*) into v_position from public.event_waitlist w
  where w.event_id = p_event_id
    and w.created_at <= (select created_at from public.event_waitlist where event_id = p_event_id and user_id = v_user_id);

  return jsonb_build_object('status', 'ok', 'position', v_position);
end;
$$;

create or replace function public.leave_event_waitlist(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.event_waitlist where event_id = p_event_id and user_id = auth.uid() returning 1
  )
  select jsonb_build_object('status', 'ok', 'removed', (select count(*) from gone));
$$;

/** The caller's waitlist position for an event, or null. */
create or replace function public.my_waitlist_position(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when mine.created_at is null then null else (
    select count(*)::integer from public.event_waitlist w
    where w.event_id = p_event_id and w.created_at <= mine.created_at
  ) end
  from (select (select created_at from public.event_waitlist
                where event_id = p_event_id and user_id = auth.uid()) as created_at) mine;
$$;

revoke all on function public.join_event_waitlist(uuid) from anon;
revoke all on function public.leave_event_waitlist(uuid) from anon;
revoke all on function public.my_waitlist_position(uuid) from anon;
grant execute on function public.join_event_waitlist(uuid) to authenticated;
grant execute on function public.leave_event_waitlist(uuid) to authenticated;
grant execute on function public.my_waitlist_position(uuid) to authenticated;

/**
 * A paid ticket cannot be cancelled from the account: giving it up is a refund
 * question, handled by a person (terms: cancellations and refunds). Free event
 * places and everything else keep the original behaviour.
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

  if v_booking.bookable_type = 'event' and v_booking.entitlement_id is not null then
    return jsonb_build_object('status', 'paid_ticket');
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

-- ---------------------------------------------------------------------------
-- Staff: attendees and check-in (events.read / events.update)
-- ---------------------------------------------------------------------------

create or replace function public.event_attendees(p_event_id uuid)
returns table (
  booking_id    uuid,
  reference     text,
  name          text,
  email         text,
  status        public.booking_status,
  paid          boolean,
  checked_in_at timestamptz,
  booked_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('events.read') then
    return;
  end if;
  return query
    select b.id, b.reference,
           coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.display_name, u.email::text),
           u.email::text, b.status, b.entitlement_id is not null, b.checked_in_at, b.created_at
    from public.bookings b
    join auth.users u on u.id = b.user_id
    left join public.profiles p on p.user_id = b.user_id
    where b.bookable_type = 'event' and b.bookable_id = p_event_id
      and b.status <> 'cancelled'
    order by coalesce(p.last_name, p.display_name, u.email::text);
end;
$$;

/**
 * Check a ticket in by its reference (from the QR code or typed at the door).
 * `p_undo` reverses a mistaken check-in. Returns who it is and for what, so
 * the door can see the name before letting someone in.
 */
create or replace function public.check_in_ticket(p_reference text, p_undo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_name text;
  v_event record;
begin
  if not public.has_permission('events.update') then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into v_booking from public.bookings
  where reference = upper(trim(p_reference)) and bookable_type = 'event'
  for update;

  if v_booking is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select name, starts_at into v_event from public.events where id = v_booking.bookable_id;
  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.display_name, u.email::text)
    into v_name
  from auth.users u left join public.profiles p on p.user_id = u.id
  where u.id = v_booking.user_id;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'name', v_name, 'event', v_event.name, 'eventId', v_booking.bookable_id);
  end if;

  if p_undo then
    update public.bookings set checked_in_at = null where id = v_booking.id;
    return jsonb_build_object('status', 'undone', 'name', v_name, 'event', v_event.name, 'eventId', v_booking.bookable_id, 'reference', v_booking.reference);
  end if;

  if v_booking.checked_in_at is not null then
    return jsonb_build_object('status', 'already', 'name', v_name, 'event', v_event.name, 'eventId', v_booking.bookable_id,
                              'reference', v_booking.reference, 'checkedInAt', v_booking.checked_in_at);
  end if;

  update public.bookings set checked_in_at = now() where id = v_booking.id;
  return jsonb_build_object('status', 'ok', 'name', v_name, 'event', v_event.name, 'eventId', v_booking.bookable_id, 'reference', v_booking.reference);
end;
$$;

revoke all on function public.event_attendees(uuid) from anon;
revoke all on function public.check_in_ticket(text, boolean) from anon;
grant execute on function public.event_attendees(uuid) to authenticated;
grant execute on function public.check_in_ticket(text, boolean) to authenticated;
revoke all on function public.new_ticket_reference() from anon, authenticated;

-- Event places registered before this migration get a reference too.
update public.bookings
   set reference = public.new_ticket_reference()
 where bookable_type = 'event' and reference is null;

-- ---------------------------------------------------------------------------
-- Reminders — read by the `event-reminders` job (lib/jobs), service role only.
-- `day_before`: live tickets for events starting within the next 26 hours.
-- `starting`:   live tickets for online or hybrid events starting within 75
--               minutes, which carry the joining link.
-- The job sends each through enqueue_email with a per-booking key, so a run
-- that repeats, overlaps or is missed and caught up never sends twice.
-- ---------------------------------------------------------------------------

create or replace function public.event_reminders_due(p_kind text)
returns table (
  booking_id    uuid,
  reference     text,
  email         text,
  title         text,
  starts_at     timestamptz,
  location      text,
  venue_address text,
  format        public.event_format,
  join_url      text,
  joining_notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.reference, u.email::text, e.name, e.starts_at, e.location, e.venue_address,
         e.format, a.join_url, a.joining_notes
  from public.bookings b
  join public.events e on e.id = b.bookable_id
  join auth.users u on u.id = b.user_id
  left join public.event_access a on a.event_id = e.id
  where b.bookable_type = 'event'
    and b.status in ('pending', 'confirmed')
    and e.status = 'published'
    and e.starts_at > now()
    and case p_kind
          when 'day_before' then e.starts_at <= now() + interval '26 hours'
                                 and b.created_at < now() - interval '2 hours'
          when 'starting'   then e.format <> 'in_person' and e.starts_at <= now() + interval '75 minutes'
          else false
        end;
$$;

revoke all on function public.event_reminders_due(text) from anon, authenticated;

-- ===========================================================================
-- 0019_academy_delivery  (was migration 0019, before 2026-09-28)
-- ===========================================================================

-- 0019 — Academy delivery: booked sessions stay readable, recordings are
-- reached through their parent (note 07 §23, §35, §36).
--
-- 1. A BOOKED SESSION MUST NOT DISAPPEAR WHEN THE LAST CREDIT IS SPENT.
--
--    `gc_sessions: entitled read` (0003) lets a customer see a session while
--    they hold a series entitlement or UNSPENT credits. Booking with your last
--    credit therefore hid the very session you had just booked: its title
--    resolved to null on /account/bookings and the Academy had no row to show
--    a join link or replay from. Holding a live or attended booking is itself
--    a reason to read that one session.
--
-- 2. RECORDINGS INHERIT THEIR PARENT'S ACCESS (note 07 §23).
--
--    `resources` is staff-read only apart from public-bucket paths (0006). A
--    workshop's or session's `recording_resource_id` could therefore never be
--    resolved by the customer it was recorded for. These policies expose a
--    resource row only when it is the recording of something the caller may
--    already open. A row in a private bucket still yields only a PATH — the
--    object itself needs a signed URL minted server-side (note 08 §26).
--
--    Session replays go to people who booked the session or hold its series,
--    NOT to anyone merely holding credits: credits buy a seat, and a seat you
--    never took is not a replay you are owed.

create or replace function public.has_booking(
  p_bookable_type public.bookable_type,
  p_bookable_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.user_id = auth.uid()
      and b.bookable_type = p_bookable_type
      and b.bookable_id = p_bookable_id
      and b.status in ('confirmed', 'completed')
  );
$$;

comment on function public.has_booking(public.bookable_type, uuid) is
  'True when the caller holds a confirmed or completed booking of this bookable.';

drop policy if exists "gc_sessions: booked read" on public.group_coaching_sessions;
create policy "gc_sessions: booked read"
  on public.group_coaching_sessions for select
  using (public.has_booking('group_coaching_session', id));

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
        )
    )
  );
