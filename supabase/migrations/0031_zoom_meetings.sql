-- =============================================================================
-- 0031 — Zoom: one meeting per online event, one joining link per ticket
-- =============================================================================
--
-- Owner (Charles), 2026-11-12, building the Zoom item then in TO-CONNECT.md. An online event had
-- ONE joining link (event_access.join_url), shown to every ticket holder, so
-- one person could forward it to many. With Zoom registration each ticket
-- holder gets their own link into the same meeting, and Zoom lets a link be
-- used on one device at a time.
--
--   events.uses_zoom    staff switch it on per event. Off by default: the site
--                       never creates a meeting in Tony's Zoom account for an
--                       event nobody asked to put on Zoom (existing events,
--                       samples, in-person events).
--   zoom_meetings       the Zoom meeting made for an event. `event_id` is SET
--                       NULL when the event is deleted, so the row survives as
--                       an orphan the `zoom-sync` job deletes from Zoom.
--   zoom_registrants    one per ticket: Zoom's registrant id and the person's
--                       own join link. Removed from Zoom (and here) when the
--                       ticket is cancelled.
--
-- Zoom is called only from the server (src/lib/zoom), with the service role.
-- Nothing here calls out: the tables record what the server has done, and the
-- job reconciles them against what should be (note 09 §44).
-- =============================================================================

alter table public.events
  add column if not exists uses_zoom boolean not null default false;

comment on column public.events.uses_zoom is
  'Online or hybrid event run on Zoom: the site creates the meeting and registers every ticket holder for their own link.';

create table if not exists public.zoom_meetings (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid unique references public.events (id) on delete set null,
  -- Zoom's numeric meeting id, kept as text (it outgrows integer).
  meeting_id  text,
  -- What the meeting was last made to match (title, start, length), so the job
  -- updates Zoom only when the event has changed.
  signature   text,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.zoom_registrants (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  meeting_row_id  uuid not null references public.zoom_meetings (id) on delete cascade,
  registrant_id   text not null,
  join_url        text not null,
  created_at      timestamptz not null default now()
);

create index if not exists zoom_registrants_meeting_idx on public.zoom_registrants (meeting_row_id);

alter table public.zoom_meetings enable row level security;
alter table public.zoom_registrants enable row level security;

-- Written only by the server with the service role: no write policies.
create policy "zoom_meetings: staff read"
  on public.zoom_meetings for select
  using (public.has_permission('events.read'));

create policy "zoom_registrants: staff read"
  on public.zoom_registrants for select
  using (public.has_permission('events.read'));

-- A ticket holder reads their own link, and only while the ticket is live.
create policy "zoom_registrants: own live ticket"
  on public.zoom_registrants for select
  using (exists (
    select 1 from public.bookings b
    where b.id = zoom_registrants.booking_id
      and b.user_id = auth.uid()
      and b.status in ('pending', 'confirmed', 'completed')
  ));

-- ---------------------------------------------------------------------------
-- Reminders carry the person's own link on a Zoom event. Same as 0009 apart
-- from `join_url`: on a Zoom event it is the ticket's registrant link, never
-- the shared one, so a forwarded reminder still holds only one seat.
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
         e.format,
         case when e.uses_zoom then zr.join_url else a.join_url end,
         a.joining_notes
  from public.bookings b
  join public.events e on e.id = b.bookable_id
  join auth.users u on u.id = b.user_id
  left join public.event_access a on a.event_id = e.id
  left join public.zoom_registrants zr on zr.booking_id = b.id
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

revoke all on function public.event_reminders_due(text) from public, anon, authenticated;
