-- =============================================================================
-- 0032 — Zoom for coaching sessions: Group Coaching, workshops, Q&A, retreats,
--        private coaching
-- =============================================================================
--
-- Owner (Charles), 2026-11-12: "get all done", after Zoom for events (0031).
-- Every session that runs on Zoom gets its meeting made by the site, and every
-- person on a group session their own link, which works on one device at a
-- time. Private coaching (one client) gets a meeting made by the site with a
-- plain link, written into the slot's `meeting_url` so everything that already
-- shows that link keeps working.
--
--   uses_zoom                 the switch, on each session table. Off by
--                             default, as on events.
--   zoom_meetings             now also for sessions: (`session_kind`,
--                             `session_id`) instead of `event_id`. A session
--                             row has no foreign key to point at (five
--                             tables), so the job finds a meeting whose session
--                             is gone by looking.
--   zoom_session_registrants  one per person per session meeting: their own
--                             link. Readable by that person and by staff.
--   session_attendance()      WHO IS ON EACH SESSION, taken out of
--                             `session_reminders_due` (0017) unchanged, so the
--                             Zoom registrations and the reminders can never
--                             disagree about who is on a session.
--   session_reminders_due     rebuilt on `session_attendance()`; on a Zoom
--                             session the link it returns is the person's own.
-- =============================================================================

alter table public.group_coaching_sessions add column if not exists uses_zoom boolean not null default false;
alter table public.cohort_workshops        add column if not exists uses_zoom boolean not null default false;
alter table public.member_qa_sessions      add column if not exists uses_zoom boolean not null default false;
alter table public.retreat_batches         add column if not exists uses_zoom boolean not null default false;
alter table public.private_coaching_slots  add column if not exists uses_zoom boolean not null default false;

alter table public.zoom_meetings
  add column if not exists session_kind text,
  add column if not exists session_id   uuid,
  -- Private coaching only: the meeting's plain link, also written to the slot.
  add column if not exists join_url     text,
  -- When the event or session ends, as last synced: the job leaves meetings
  -- finished more than a day ago alone, so its list does not grow for ever.
  add column if not exists ends_at      timestamptz;

do $$ begin
  alter table public.zoom_meetings
    add constraint zoom_meetings_session_kind_check
      check (session_kind in ('group', 'workshop', 'qa', 'retreat', 'private')),
    add constraint zoom_meetings_one_owner_check
      check (session_kind is null or event_id is null),
    add constraint zoom_meetings_session_key unique (session_kind, session_id);
exception when duplicate_object or duplicate_table then null; end $$;

comment on column public.zoom_meetings.event_id is
  'The event this meeting is for. NULL with no session_kind: the event was deleted, and the job removes the meeting from Zoom.';

drop policy if exists "zoom_meetings: staff read" on public.zoom_meetings;
create policy "zoom_meetings: staff read"
  on public.zoom_meetings for select
  using (
    public.has_permission('events.read') or public.has_permission('coaching.read')
    or public.has_permission('cohorts.read') or public.has_permission('memberships.read')
    or public.has_permission('retreats.read')
  );

create table if not exists public.zoom_session_registrants (
  meeting_row_id uuid not null references public.zoom_meetings (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  registrant_id  text not null,
  join_url       text not null,
  created_at     timestamptz not null default now(),
  primary key (meeting_row_id, user_id)
);

create index if not exists zoom_session_registrants_user_idx on public.zoom_session_registrants (user_id);

alter table public.zoom_session_registrants enable row level security;

-- Written only by the server with the service role. Someone who stops being on
-- a session (a cancelled booking, a lapsed pass) is removed by the next sync.
create policy "zoom_session_registrants: own"
  on public.zoom_session_registrants for select
  using (user_id = auth.uid());

create policy "zoom_session_registrants: staff read"
  on public.zoom_session_registrants for select
  using (
    public.has_permission('coaching.read') or public.has_permission('cohorts.read')
    or public.has_permission('memberships.read') or public.has_permission('retreats.read')
  );

-- ---------------------------------------------------------------------------
-- Who is on each session — the rules from 0017, unchanged, in one place.
-- `private` rows are keyed on the BOOKING (as in 0017); Zoom keys private
-- meetings on the slot and registers nobody, so it does not read them.
-- ---------------------------------------------------------------------------

create or replace function public.session_attendance()
returns table (kind text, item_id uuid, user_id uuid, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Every Coaching Pass holder, with what their pass includes.
  members as (
    select distinct e.user_id
    from public.entitlements e
    where e.resource_type = 'membership'
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  ),

  attendance as (
    -- Group Coaching: booked singly...
    select 'group'::text as kind, s.id as item_id, b.user_id, b.created_at as joined_at
    from public.group_coaching_sessions s
    join public.bookings b
      on b.bookable_type = 'group_coaching_session' and b.bookable_id = s.id
     and b.status = 'confirmed'
    where s.status = 'scheduled'
    union
    -- ...or through a registration on the run.
    select 'group', s.id, r.user_id, r.created_at
    from public.group_coaching_sessions s
    join public.coaching_registrations r on r.run_id = s.run_id
    where s.status = 'scheduled'

    union
    -- Private coaching.
    select 'private', b.id, b.user_id, b.created_at
    from public.bookings b
    join public.private_coaching_slots sl on sl.id = b.bookable_id and sl.status = 'open'
    where b.bookable_type = 'private_coaching' and b.status = 'confirmed'

    union
    -- Cohort workshops: a place on the intake...
    select 'workshop', w.id, ce.user_id, ce.created_at
    from public.cohort_workshops w
    join public.cohort_enrolments ce on ce.intake_id = w.intake_id
    where w.status = 'scheduled'
    union
    -- ...or standing access to the cohort.
    select 'workshop', w.id, e.user_id, e.created_at
    from public.cohort_workshops w
    join public.entitlements e
      on e.resource_type = 'cohort'
     and (e.resource_id = w.cohort_id or e.resource_id is null)
     and e.quantity is null
     and e.status = 'active'
     and e.starts_at <= now()
     and (e.expires_at is null or e.expires_at > now())
    where w.status = 'scheduled'

    union
    -- The members' Q&A: every holder whose tier includes it.
    select 'qa', q.id, m.user_id, null::timestamptz
    from public.member_qa_sessions q
    cross join members m
    cross join lateral public.membership_of(m.user_id) mo
    where q.status = 'scheduled' and mo.includes_qa

    union
    -- Retreats: a place on the batch...
    select 'retreat', bt.id, rp.user_id, rp.created_at
    from public.retreat_batches bt
    join public.retreats rt on rt.id = bt.retreat_id and rt.status = 'published'
    join public.retreat_places rp on rp.batch_id = bt.id
    where bt.status = 'published'
    union
    -- ...or a pass that covers it.
    select 'retreat', bt.id, e.user_id, e.created_at
    from public.retreat_batches bt
    join public.retreats rt on rt.id = bt.retreat_id and rt.status = 'published'
    join public.entitlements e
      on e.resource_type = 'retreat'
     and e.resource_id is null
     and e.status = 'active'
     and e.starts_at <= now()
     and (e.expires_at is null or e.expires_at > now())
    where bt.status = 'published' and not rt.requires_application
  )

  select kind, item_id, user_id, joined_at from attendance;
$$;

revoke all on function public.session_attendance() from public, anon, authenticated;

create or replace function public.session_reminders_due(p_kind text)
returns table (
  kind        text,
  item_id     uuid,
  user_id     uuid,
  email       text,
  title       text,
  group_name  text,
  group_slug  text,
  starts_at   timestamptz,
  join_url    text,
  notes       text
)
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Someone who signed up in the last two hours has just been told the date;
  -- a "coming up" email on top of that is noise. Same rule as events.
  window_ as (
    select now() as now_,
           case p_kind
             when 'day_before' then interval '26 hours'
             when 'starting'   then interval '75 minutes'
           end as ahead
  ),

  sessions as (
    select 'group'::text as kind, s.id as item_id, s.title, gs.name as group_name,
           gs.slug as group_slug, s.starts_at, s.meeting_url as join_url, null::text as notes,
           s.uses_zoom
    from public.group_coaching_sessions s
    left join public.group_coaching_series gs on gs.id = s.series_id
    union all
    -- Private: a Zoom meeting's link is written to the slot, so it is read as is.
    select 'private', b.id, coalesce(svc.name, 'Private coaching'), svc.name, svc.slug,
           b.starts_at, sl.meeting_url, null, false
    from public.bookings b
    join public.private_coaching_slots sl on sl.id = b.bookable_id
    left join public.private_coaching_services svc on svc.id = sl.service_id
    where b.bookable_type = 'private_coaching'
    union all
    select 'workshop', w.id, w.title, c.name, c.slug, w.starts_at, w.meeting_url, null, w.uses_zoom
    from public.cohort_workshops w
    join public.cohorts c on c.id = w.cohort_id
    union all
    select 'qa', q.id, q.title, null, null, q.starts_at, q.meeting_url, q.description, q.uses_zoom
    from public.member_qa_sessions q
    union all
    select 'retreat', bt.id, rt.name || ' · ' || bt.label, rt.name, rt.slug,
           bt.starts_at, bt.join_url, bt.joining_notes, bt.uses_zoom
    from public.retreat_batches bt
    join public.retreats rt on rt.id = bt.retreat_id
  ),

  -- One row per person per session, however many ways they hold it. On a Zoom
  -- session the link is the person's own, never the session's shared one.
  rows_ as (
    select distinct on (a.kind, a.item_id, a.user_id)
           a.kind, a.item_id, a.user_id, a.joined_at, s.title, s.group_name, s.group_slug,
           s.starts_at, s.notes,
           case when s.uses_zoom then zr.join_url else nullif(trim(s.join_url), '') end as join_url
    from public.session_attendance() a
    join sessions s on s.kind = a.kind and s.item_id = a.item_id
    left join public.zoom_meetings zm on zm.session_kind = a.kind and zm.session_id = a.item_id
    left join public.zoom_session_registrants zr on zr.meeting_row_id = zm.id and zr.user_id = a.user_id
    order by a.kind, a.item_id, a.user_id
  )

  select r.kind, r.item_id, r.user_id, u.email::text, r.title, r.group_name, r.group_slug,
         r.starts_at, r.join_url, r.notes
  from rows_ r
  join auth.users u on u.id = r.user_id
  cross join window_ w
  where w.ahead is not null
    and r.starts_at > w.now_
    and r.starts_at <= w.now_ + w.ahead
    and case p_kind
          when 'day_before' then r.joined_at is null or r.joined_at < w.now_ - interval '2 hours'
          -- "Starting soon" exists to hand over the link; without one it says nothing new.
          when 'starting'   then r.join_url ~* '^https?://'
          else false
        end;
$$;

revoke all on function public.session_reminders_due(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The signed-in person's own links for one kind of session, for the Academy
-- pages. Their registrant rows are theirs to read already; this joins the
-- meeting row (staff-only) for its session id without exposing the rest of it.
-- ---------------------------------------------------------------------------

create or replace function public.my_zoom_links(p_kind text)
returns table (session_id uuid, join_url text)
language sql
stable
security definer
set search_path = public
as $$
  select m.session_id, r.join_url
  from public.zoom_session_registrants r
  join public.zoom_meetings m on m.id = r.meeting_row_id
  where r.user_id = auth.uid() and m.session_kind = p_kind;
$$;

revoke all on function public.my_zoom_links(text) from public, anon;
grant execute on function public.my_zoom_links(text) to authenticated;
