-- Same fault as membership_tiers (migration 0029): description restated the
-- price rather than saying what the session includes.
alter table public.private_coaching_services
  add column if not exists benefits text[] not null default '{}';

comment on column public.private_coaching_services.benefits is
  'What the session includes, in order — not the price, which lives in prices.';

create or replace function public.normalise_service_benefits()
returns trigger language plpgsql as $$
begin
  select coalesce(array_agg(t order by ord), '{}') into new.benefits
  from (select btrim(v) as t, ord from unnest(new.benefits) with ordinality as u(v, ord)
        where btrim(v) <> '') c;
  return new;
end; $$;

drop trigger if exists normalise_service_benefits on public.private_coaching_services;
create trigger normalise_service_benefits
  before insert or update of benefits on public.private_coaching_services
  for each row execute function public.normalise_service_benefits();
