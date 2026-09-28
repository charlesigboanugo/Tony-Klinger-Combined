-- 0007 — Staff invitations and lost-key recovery; video on lessons and a record of what has been watched.
--
-- Consolidated 2026-09-28 from 0008_staff_accounts, 0009_lesson_video_and_progress, in their original
-- order. Each section keeps a banner naming its former file, which notes and
-- comments may still cite.

-- ===========================================================================
-- 0008_staff_accounts  (was migration 0008, before 2026-09-28)
-- ===========================================================================

-- 0008 — Inviting people to hold accounts, and clearing lost security keys.
--
-- Consolidated 2026-09-23 from migrations 0035, 0036, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- user invitations  (was migration 0035)
-- ===========================================================================

-- Inviting a person to hold an account, and recording who did it.
--
-- Note 06 §14 lists viewing and searching users but no way to CREATE one, so
-- an administrator could grant a role only to somebody who had already signed
-- up for themselves. Staff are exactly the people who never do that: nobody
-- signs up as a customer in order to be given the support role.
--
-- INVITATION, NOT ACCOUNT CREATION WITH A PASSWORD.
--
-- An administrator who types someone's first password knows their credential,
-- so the account is no longer provably that person's — and note 05 §11.1 spends
-- its effort on exactly that property. An invitation instead proves control of
-- the mailbox and lets the invitee set their own secret, which is also the only
-- version an audit trail can honestly describe.
--
-- WHY A NEW PERMISSION rather than reusing `users.update`. Creating an account
-- is not editing one: it adds a principal to the system, and the account can
-- then be given roles. Note 06 §33 asks for least privilege, and rolling it
-- into `users.update` would silently hand it to every role that can correct a
-- customer's name.

insert into public.permissions (name, description) values
  ('users.invite', 'Invite a new user by email')
on conflict (name) do nothing;

-- Owner and admin only. Note the earlier blanket grant in 0005 assigns owner
-- every permission that EXISTED THEN — a permission added later is not covered
-- by it, so it must be granted here explicitly or the owner would not hold it.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where r.name in ('owner', 'admin')
   and p.name = 'users.invite'
on conflict do nothing;

/**
 * Record that an invitation was sent — note 06 §13, §31.
 *
 * The invitation itself is a GoTrue admin call and cannot happen in SQL, so
 * this is deliberately NARROW: it takes no action name and no resource type,
 * and can therefore only ever write the one entry it is named for. A general
 * "log anything" function that let the caller choose the permission it checks
 * would let anyone holding any permission forge entries about anything.
 *
 * It re-checks `users.invite` and the second factor in the database, so the
 * audit row cannot be written by a caller who could not have performed the
 * invitation (note 06 §2 — the application check is never the only one).
 */
create or replace function public.admin_record_user_invite(
  p_user_id uuid,
  p_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  perform public.assert_admin_action('users.invite');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'user_invited', 'user', p_user_id::text, p_reason,
     jsonb_build_object('email', p_email));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_record_user_invite(uuid, text, text) from anon;
grant execute on function public.admin_record_user_invite(uuid, text, text) to authenticated;


-- ===========================================================================
-- mfa recovery  (was migration 0036)
-- ===========================================================================

-- Clearing somebody's security keys, when they have lost them.
--
-- WHY THIS BECAME NECESSARY. Until now a second factor was demanded only of
-- staff, so a customer could never be locked out by one. Now that anyone who
-- registers a key is asked for it at sign-in (note 05 §11.1), a customer who
-- loses their only key cannot reach their account at all — and note 05 already
-- says recovery is "an administrative operation performed by another authorized
-- person", which described a control that did not exist.
--
-- WHO MAY CLEAR WHOSE KEYS. Note 05 §11.1 sets the rule; this puts it in the
-- database rather than only in the interface:
--
--   customer's keys   -> anyone holding users.reset_mfa
--   staff member's    -> an OWNER only. Staff keys guard the admin area, so
--                        clearing them is an access decision, not support work.
--   an owner's        -> REFUSED. Nobody can rescue an owner from inside the
--                        application; aal2 is required by the RLS policies
--                        themselves, so this is deliberately service-role SQL
--                        against production and nothing less.
--
-- The last rule is also what stops this becoming an escalation path: an admin
-- who could strip the owner's keys could lock the one account that can undo
-- anything they do.

insert into public.permissions (name, description) values
  ('users.reset_mfa', 'Clear a user''s security keys so they can register again')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where r.name in ('owner', 'admin')
   and p.name = 'users.reset_mfa'
on conflict do nothing;

/**
 * Authorize and record a security-key reset — note 05 §11.1, note 06 §31.
 *
 * Called BEFORE the keys are removed, so a refusal happens while there is still
 * something to refuse. The removal itself is a GoTrue admin call and cannot
 * happen in SQL, which is exactly why the decision is made here: the rule about
 * who may clear whose keys must not live only in a Server Action.
 */
create or replace function public.admin_record_mfa_reset(
  p_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_is_owner boolean;
  v_target_is_staff boolean;
begin
  perform public.assert_admin_action('users.reset_mfa');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  if p_user_id = v_actor then
    -- Otherwise the second factor is optional for anyone who can reach this:
    -- hold the permission, clear your own keys, and the requirement is gone.
    raise exception 'you cannot clear your own keys' using errcode = '42501';
  end if;

  select
    bool_or(r.name = 'owner'),
    count(*) > 0
    into v_target_is_owner, v_target_is_staff
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.user_id = p_user_id;

  if coalesce(v_target_is_owner, false) then
    raise exception 'an owner account cannot be recovered from inside the application'
      using errcode = '42501';
  end if;

  if coalesce(v_target_is_staff, false) and not public.has_role('owner') then
    raise exception 'only an owner may clear a staff member''s keys'
      using errcode = '42501';
  end if;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'mfa_reset', 'user', p_user_id::text, p_reason,
     jsonb_build_object('staff', coalesce(v_target_is_staff, false)));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_record_mfa_reset(uuid, text) from anon;
grant execute on function public.admin_record_mfa_reset(uuid, text) to authenticated;

-- ===========================================================================
-- 0009_lesson_video_and_progress  (was migration 0009, before 2026-09-28)
-- ===========================================================================

-- 0009 — Video on lessons, and a record of what has been watched.
--
-- Consolidated 2026-09-23 from migrations 0037, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- lesson video and progress  (was migration 0037)
-- ===========================================================================

-- Video on lessons, and a record of what has been watched.
--
-- Two things the Academy could not do: play anything, and remember anything.
-- `lessons` held a title and prose, so a course was a reading list; and there
-- was no progress table at all, which is why /academy/progress was a permanent
-- empty state rather than a page.
--
-- ============================================================================
-- WHY A PROVIDER AND AN ID, NOT A URL
-- ============================================================================
--
-- The platform is expected to move to Livid. Storing a finished embed URL would
-- make that a rewrite of every row AND of whatever code parses those URLs, and
-- it would put the playable address in the database where any query that
-- forgets its entitlement check leaks it.
--
-- Storing (provider, id) instead means:
--
--   * switching provider is `update lessons set video_provider = 'livid'`
--     alongside new ids — a data change, not a schema or code change;
--   * the playable URL is COMPOSED SERVER-SIDE, after the entitlement check, so
--     it exists only in a response that has already been authorised.
--
-- That second property is the important one. Note 05's gating argument is that
-- a domain-locked video cannot tell our membership tiers apart — the host will
-- happily play for anyone who embeds it — so the URL itself must never reach a
-- browser that has not been checked. The column shape enforces where that
-- decision has to happen.
--
-- `video_hash` is Vimeo's unlisted-link token: an unlisted video needs
-- `?h=<hash>` or the player refuses it. Livid has no equivalent, so the column
-- is nullable rather than the provider being modelled twice.

alter table public.lessons
  add column if not exists video_provider text,
  add column if not exists video_id text,
  add column if not exists video_hash text,
  add column if not exists video_duration_seconds integer;

-- YouTube is a lesson video host alongside vimeo and livid.
--
-- The predecessor CMS holds all 41 course lesson videos as YouTube URLs, and
-- they stay there until they are re-uploaded to Livid (R29, owner's decision
-- 2026-09-05). Adding the provider is what makes "later" cost nothing: the row
-- names a host and an id, so the move is an update of two columns.
--
-- ============================================================================
-- WHAT YOUTUBE CANNOT DO, RECORDED SO IT IS NOT DISCOVERED LATER
-- ============================================================================
--
-- Withholding the URL server-side is a real control and this platform does it:
-- a lesson row is unreadable without a live entitlement, and the playable
-- address is composed only after that row comes back. But the guarantee stops
-- at the first person who copies the URL out of their own page.
--
--   Vimeo / Livid  can refuse to play except when embedded on our domains, so
--                  a leaked URL is worth little off-site.
--   YouTube        has NO domain restriction for unlisted video. The URL is
--                  the credential, it never expires, and it cannot be revoked
--                  except by taking the video down and re-uploading it.
--
-- That is the weakness README R29 option (b) names, and it is being accepted
-- deliberately as an interim state rather than overlooked. It is the reason the
-- move to Livid remains worth doing, and the reason this comment exists.

alter table public.lessons
  add constraint lessons_video_is_complete check (
    (video_provider is null and video_id is null)
    or (video_provider in ('vimeo', 'livid', 'youtube') and video_id is not null)
  );

comment on column public.lessons.video_provider is
  'vimeo, livid or youtube. Null for a lesson that is written material only. '
  'The playable URL is composed server-side after the entitlement check and is '
  'never stored, so moving provider is a data change (note 07 §34.1). YouTube '
  'is interim: unlisted YouTube cannot be domain-restricted, so a leaked URL '
  'plays anywhere for ever (R29).';

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------
--
-- One row per lesson a person has finished. Deliberately NOT a percentage or a
-- playback position: those are guesses that go stale, and a course reads as
-- "eleven of nineteen done" far more usefully than "58%". Absence means not
-- done, so nothing has to be written when somebody merely opens a lesson.

create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_progress_user_id_idx
  on public.lesson_progress (user_id);

alter table public.lesson_progress enable row level security;

-- Own rows only. Progress is personal data (note 05 §22): nobody else's is
-- readable, and staff read it through the service role when they need to.
create policy "lesson_progress: own read"
  on public.lesson_progress for select
  using (user_id = auth.uid());

create policy "lesson_progress: own delete"
  on public.lesson_progress for delete
  using (user_id = auth.uid());

-- Marking a lesson done requires being ENTITLED TO IT, not merely signed in.
-- Without this, anyone with a session could post rows for every lesson id they
-- could guess and manufacture a completed course they never had access to.
create policy "lesson_progress: entitled write"
  on public.lesson_progress for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.lessons l
        join public.course_modules m on m.id = l.module_id
       where l.id = lesson_progress.lesson_id
         and public.has_active_entitlement('course', m.course_id)
    )
  );

comment on table public.lesson_progress is
  'One row per completed lesson. Absence means not completed, so opening a '
  'lesson writes nothing. Personal data — own rows only (note 05 §22).';
