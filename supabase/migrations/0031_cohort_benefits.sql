-- Same pattern as membership_tiers (0029) and private_coaching_services (0030):
-- a cohort's outcome copy belongs in structured data, not squeezed into one
-- description field, so the detail page can render it as a real list.
alter table public.cohorts
  add column if not exists benefits text[] not null default '{}';

comment on column public.cohorts.benefits is
  'What this cohort level delivers, in order — recovered from the predecessor '
  'platform''s pricing page, one entry per outcome paragraph.';

create or replace function public.normalise_cohort_benefits()
returns trigger language plpgsql as $$
begin
  select coalesce(array_agg(t order by ord), '{}') into new.benefits
  from (select btrim(v) as t, ord from unnest(new.benefits) with ordinality as u(v, ord)
        where btrim(v) <> '') c;
  return new;
end; $$;

drop trigger if exists normalise_cohort_benefits on public.cohorts;
create trigger normalise_cohort_benefits
  before insert or update of benefits on public.cohorts
  for each row execute function public.normalise_cohort_benefits();
