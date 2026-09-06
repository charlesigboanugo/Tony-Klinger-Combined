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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lessons_video_is_complete'
  ) then
    alter table public.lessons
      add constraint lessons_video_is_complete check (
        (video_provider is null and video_id is null)
        or (video_provider in ('vimeo', 'livid') and video_id is not null)
      );
  end if;
end $$;

comment on column public.lessons.video_provider is
  'vimeo or livid. Null for a lesson that is written material only. The '
  'playable URL is composed server-side after the entitlement check and is '
  'never stored, so moving provider is a data change (note 07 §R29).';

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
