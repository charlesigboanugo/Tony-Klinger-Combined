-- The curriculum of a Group Coaching series.
--
-- A SERIES AND A SESSION ARE DIFFERENT THINGS (note 07 §11): the series is the
-- parent programme, a session is a scheduled occurrence within it. That
-- distinction is why the eight topics recovered from the live coaching site
-- could not simply be inserted as `group_coaching_sessions` rows —
-- `starts_at`/`ends_at` are NOT NULL there, because a session is something that
-- happens at a time. The syllabus is not scheduled: it is what the series
-- COVERS, taught again on each run, and it is what a customer reads before
-- buying.
--
-- Held as an ordered text[] rather than its own table because a topic is a
-- title and nothing else — eight short strings per series. A table with an id,
-- a position and one text column would add joins and a migration path for no
-- capability that ordering an array does not already give (note 02 §33).
-- Should a topic ever need its own description, resources or duration, it has
-- outgrown an array and should become a table at that point.

alter table public.group_coaching_series
  add column if not exists syllabus text[] not null default '{}';

comment on column public.group_coaching_series.syllabus is
  'Ordered session topics covered by this series — the curriculum shown on the '
  'public product page. Not scheduled occurrences: those are '
  'group_coaching_sessions (note 07 §11).';

-- Same reasoning as catalogue tags (migration 0023): a blank or untrimmed entry
-- is invisible in an admin form and would render as an empty bullet.
create or replace function public.normalise_series_syllabus()
returns trigger
language plpgsql
as $$
begin
  select coalesce(array_agg(t order by ord), '{}')
    into new.syllabus
  from (
    select btrim(v) as t, ord
    from unnest(new.syllabus) with ordinality as u(v, ord)
    where btrim(v) <> ''
  ) cleaned;
  return new;
end;
$$;

drop trigger if exists normalise_series_syllabus on public.group_coaching_series;

create trigger normalise_series_syllabus
  before insert or update of syllabus on public.group_coaching_series
  for each row
  execute function public.normalise_series_syllabus();
