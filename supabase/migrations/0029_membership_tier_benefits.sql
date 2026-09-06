-- What each membership tier actually includes.
--
-- The tiers already carried a `description`, but it had been written as a
-- restatement of the price — "Silver membership. £15.00 per month, or £160.00
-- for a year." That is two faults at once: it duplicates `prices`, which is the
-- authority and can change in Admin without touching this text, and it tells a
-- customer nothing about what they would be buying.
--
-- Benefits are held as an ordered text[] for the same reason the Group Coaching
-- syllabus is (migration 0028): each is a short line, ordering is meaningful,
-- and a table of id/position/text would add joins without adding capability.
--
-- CUMULATIVE TIERS ARE NOT DENORMALISED HERE. Note 07 §10 requires Gold to
-- include Silver, and so on. Each row lists only what that tier ADDS; the
-- effective set is resolved by walking `rank` upward, so a benefit added to
-- Silver reaches every tier above it without four edits and without the four
-- lists drifting apart.

alter table public.membership_tiers
  add column if not exists benefits text[] not null default '{}';

comment on column public.membership_tiers.benefits is
  'What this tier ADDS over the one below it, in order. Tiers are cumulative '
  '(note 07 §10) — resolve the effective set by walking rank upward rather than '
  'repeating lower-tier benefits here.';

create or replace function public.normalise_tier_benefits()
returns trigger
language plpgsql
as $$
begin
  select coalesce(array_agg(t order by ord), '{}')
    into new.benefits
  from (
    select btrim(v) as t, ord
    from unnest(new.benefits) with ordinality as u(v, ord)
    where btrim(v) <> ''
  ) cleaned;
  return new;
end;
$$;

drop trigger if exists normalise_tier_benefits on public.membership_tiers;

create trigger normalise_tier_benefits
  before insert or update of benefits on public.membership_tiers
  for each row
  execute function public.normalise_tier_benefits();
