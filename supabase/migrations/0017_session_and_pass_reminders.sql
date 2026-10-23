-- =============================================================================
-- 0017 — Reminders for coaching sessions, and before a Coaching Pass ends
-- =============================================================================
--
-- Owner, 2026-10-16. Events already had reminders (`event_reminders_due`, in
-- 0009); nothing reminded anyone before a Group Coaching session, a private
-- session, a cohort workshop, the members' Q&A or a retreat, and nothing told a
-- holder their Coaching Pass was about to end. Note 09 §44.
--
-- Two read-only functions, service role only, read by scheduled jobs in
-- `src/lib/jobs`. The jobs queue each message through `enqueue_email` with a
-- key per person, session and kind, so a run that repeats, overlaps or catches
-- up after a missed schedule never sends twice.
--
--   session_reminders_due(kind)   'day_before': sessions starting within 26
--                                 hours. 'starting': sessions starting within
--                                 75 minutes that have a joining link, which
--                                 the email carries.
--
--   passes_ending_due(kind)       'month': a pass ending in 8 to 30 days (when
--                                 buying again opens). 'week': ending within 7.
--
-- WHO IS ON A SESSION mirrors the access rules that show it in the Academy, so
-- a reminder goes to exactly the people who can open it:
--
--   group     a confirmed booking of the session, or a registration on its run
--             (`holds_seat`)
--   private   a confirmed booking of the slot
--   workshop  a place on the workshop's intake, or standing access to its
--             cohort (`cohort_workshops: entitled read`)
--   qa        a Coaching Pass whose tier includes the Q&A (`has_member_benefit`)
--   retreat   a place on the batch, or a pass that covers retreats open without
--             an interview (`has_retreat_batch_access`)
-- =============================================================================

create or replace function public.session_reminders_due(p_kind text)
returns table (
  kind        text,
  item_id     uuid,
  user_id     uuid,
  email       text,
  title       text,
  -- The series, cohort, service or retreat the session belongs to.
  group_name  text,
  -- Where the session lives in the Academy, for the cohort page link.
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
  ),

  sessions as (
    select 'group'::text as kind, s.id as item_id, s.title, gs.name as group_name,
           gs.slug as group_slug, s.starts_at, s.meeting_url as join_url, null::text as notes
    from public.group_coaching_sessions s
    left join public.group_coaching_series gs on gs.id = s.series_id
    union all
    select 'private', b.id, coalesce(svc.name, 'Private coaching'), svc.name, svc.slug,
           b.starts_at, sl.meeting_url, null
    from public.bookings b
    join public.private_coaching_slots sl on sl.id = b.bookable_id
    left join public.private_coaching_services svc on svc.id = sl.service_id
    where b.bookable_type = 'private_coaching'
    union all
    select 'workshop', w.id, w.title, c.name, c.slug, w.starts_at, w.meeting_url, null
    from public.cohort_workshops w
    join public.cohorts c on c.id = w.cohort_id
    union all
    select 'qa', q.id, q.title, null, null, q.starts_at, q.meeting_url, q.description
    from public.member_qa_sessions q
    union all
    select 'retreat', bt.id, rt.name || ' · ' || bt.label, rt.name, rt.slug,
           bt.starts_at, bt.join_url, bt.joining_notes
    from public.retreat_batches bt
    join public.retreats rt on rt.id = bt.retreat_id
  )

  -- One row per person per session, however many ways they hold it.
  select distinct on (a.kind, a.item_id, a.user_id)
         a.kind, a.item_id, a.user_id, u.email::text, s.title, s.group_name, s.group_slug,
         s.starts_at, nullif(trim(s.join_url), ''), s.notes
  from attendance a
  join sessions s on s.kind = a.kind and s.item_id = a.item_id
  join auth.users u on u.id = a.user_id
  cross join window_ w
  where w.ahead is not null
    and s.starts_at > w.now_
    and s.starts_at <= w.now_ + w.ahead
    and case p_kind
          when 'day_before' then a.joined_at is null or a.joined_at < w.now_ - interval '2 hours'
          -- "Starting soon" exists to hand over the link; without one it says nothing new.
          when 'starting'   then s.join_url ~* '^https?://'
          else false
        end
  order by a.kind, a.item_id, a.user_id;
$$;

revoke all on function public.session_reminders_due(text) from public, anon, authenticated;

/**
 * Coaching Passes about to end, for the "your pass ends soon" email.
 *
 * A pass is one payment for twelve months and does not renew (owner,
 * 2026-10-09); a holder can buy again from thirty days before it ends. So:
 *
 *   'month'  ends in 8 to 30 days: buying again is open.
 *   'week'   ends within 7 days: the last call.
 *
 * Left out:
 *   - a pass on a subscription that will renew by itself (the monthly plan,
 *     off sale but still running for anyone already on it);
 *   - a holder who has already bought the next one — any other live or
 *     future pass that runs past this one's end;
 *   - a pass shorter than 60 days (a short staff grant), which would otherwise
 *     get the 'month' email the day it was given.
 */
create or replace function public.passes_ending_due(p_kind text)
returns table (
  entitlement_id uuid,
  user_id        uuid,
  email          text,
  tier_name      text,
  expires_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.user_id, u.email::text, t.name, e.expires_at
  from public.entitlements e
  join public.membership_tiers t on t.id = e.resource_id
  join auth.users u on u.id = e.user_id
  left join public.subscriptions s on e.source_type = 'membership' and s.id = e.source_id
  where e.resource_type = 'membership'
    and e.status = 'active'
    and e.starts_at <= now()
    and e.expires_at is not null
    and e.expires_at > now()
    and e.expires_at - e.starts_at > interval '60 days'
    and (e.source_type <> 'membership' or s.cancel_at_period_end or s.id is null)
    and case p_kind
          when 'month' then e.expires_at >  now() + interval '7 days'
                        and e.expires_at <= now() + interval '30 days'
          when 'week'  then e.expires_at <= now() + interval '7 days'
          else false
        end
    and not exists (
      select 1 from public.entitlements n
      where n.user_id = e.user_id
        and n.id <> e.id
        and n.resource_type = 'membership'
        and n.status = 'active'
        and (n.expires_at is null or n.expires_at > e.expires_at)
    );
$$;

revoke all on function public.passes_ending_due(text) from public, anon, authenticated;

-- The events list from 0009 was revoked from anon and authenticated by name,
-- but Postgres also grants EXECUTE to PUBLIC when a function is created, and
-- that grant stayed: anyone, signed in or not, could call it through the API
-- and read every ticket holder's email and joining link. Closed here, beside
-- the two new lists, which revoke from PUBLIC as well.
revoke all on function public.event_reminders_due(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The same gap in six more functions (owner: "fix them", 2026-10-16)
-- ---------------------------------------------------------------------------
-- Each was meant to be server-only — its migration revoked it from anon and
-- authenticated — but the PUBLIC grant every new function gets was left in
-- place, so all six could be called through the API by anyone:
--
--   record_marketing_consent / withdraw_marketing_consent
--       sign any email address up to marketing, or unsubscribe it
--   consume_rate_limit / cleanup_rate_limits
--       use up another visitor's rate limit, locking them out of a form
--   release_private_coaching_hold
--       cancel a customer's held private-coaching time, given the order id
--   private_coaching_time_taken
--       read which times are booked
--
-- The site calls all of them only with the service key, and the functions
-- that call them inside the database run as their owner, so nothing that
-- uses them changes.
revoke all on function public.record_marketing_consent(text, public.consent_source, text, text, uuid) from public, anon, authenticated;
revoke all on function public.withdraw_marketing_consent(text) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.cleanup_rate_limits() from public, anon, authenticated;
revoke all on function public.release_private_coaching_hold(uuid) from public, anon, authenticated;
revoke all on function public.private_coaching_time_taken(timestamptz, timestamptz, uuid) from public, anon, authenticated;
