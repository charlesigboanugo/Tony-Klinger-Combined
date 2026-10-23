-- Local sample data: ten FINISHED series runs and ten FINISHED cohort intakes,
-- each with a few people on it, so the Past tabs of Series registrations and
-- Cohort places have something to show (owner, 2026-10-14).
--
-- LOCAL DATABASE ONLY. Every row is named "Sample past – …"; to remove them,
-- delete coaching_runs and cohort_intakes whose label is like 'Sample past – %'
-- (their registrations and places go with them).
--
-- Safe to run twice: it removes its own earlier rows first.

begin;

delete from public.coaching_runs  where label like 'Sample past – %';
delete from public.cohort_intakes where label like 'Sample past – %';

-- Ten runs, spread over five past years, across the real series.
with series as (
  select id, name, row_number() over (order by name) - 1 as n
    from public.group_coaching_series
   where slug not like 'sample-%'
),
plan as (
  select g as i,
         (date '2021-02-02' + (g * interval '6 months'))::timestamptz + interval '16 hours' as starts
    from generate_series(0, 9) g
)
insert into public.coaching_runs
  (series_id, label, pass_opens_at, registration_opens_at, registration_closes_at, starts_at, ends_at, capacity, status)
select s.id,
       'Sample past – ' || to_char(p.starts, 'Mon YYYY') || ', Tuesdays 4pm',
       p.starts - interval '45 days',
       p.starts - interval '30 days',
       p.starts,
       p.starts,
       p.starts + interval '7 weeks 1 hour',
       8,
       'published'
  from plan p
  join series s on s.n = p.i % (select count(*) from series);

-- Ten intakes, spread over five past years, across the cohorts.
with cohort as (
  select id, row_number() over (order by rank) - 1 as n from public.cohorts
),
plan as (
  select g as i,
         (date '2021-03-01' + (g * interval '6 months'))::timestamptz + interval '18 hours' as starts
    from generate_series(0, 9) g
)
insert into public.cohort_intakes
  (cohort_id, label, registration_opens_at, starts_at, ends_at, capacity, status)
select c.id,
       'Sample past – ' || case when extract(month from p.starts) < 7 then 'Spring ' else 'Autumn ' end || to_char(p.starts, 'YYYY'),
       p.starts - interval '40 days',
       p.starts,
       p.starts + interval '10 weeks',
       10,
       'published'
  from plan p
  join cohort c on c.n = p.i % (select count(*) from cohort);

-- Three to six people on each, from the local test customers.
with people as (
  select id, row_number() over (order by email) as n
    from auth.users
   where email like '%@test.local'
     and email not in ('owner@test.local', 'admin@test.local', 'support@test.local')
),
runs as (
  select id, row_number() over (order by starts_at) as n from public.coaching_runs where label like 'Sample past – %'
)
insert into public.coaching_registrations (user_id, run_id, source, created_at)
select p.id, r.id, 'staff', now()
  from runs r
  join people p on p.n between (r.n * 3) % 30 + 1 and (r.n * 3) % 30 + 3 + (r.n % 4)
on conflict do nothing;

with people as (
  select id, row_number() over (order by email desc) as n
    from auth.users
   where email like '%@test.local'
     and email not in ('owner@test.local', 'admin@test.local', 'support@test.local')
),
intakes as (
  select id, row_number() over (order by starts_at) as n from public.cohort_intakes where label like 'Sample past – %'
)
insert into public.cohort_enrolments (user_id, intake_id, created_at)
select p.id, i.id, now()
  from intakes i
  join people p on p.n between (i.n * 3) % 30 + 1 and (i.n * 3) % 30 + 3 + (i.n % 4)
on conflict do nothing;

select 'runs', count(*) from public.coaching_runs where label like 'Sample past – %'
union all
select 'registrations', count(*) from public.coaching_registrations r join public.coaching_runs c on c.id = r.run_id where c.label like 'Sample past – %'
union all
select 'intakes', count(*) from public.cohort_intakes where label like 'Sample past – %'
union all
select 'places', count(*) from public.cohort_enrolments e join public.cohort_intakes i on i.id = e.intake_id where i.label like 'Sample past – %';

commit;
