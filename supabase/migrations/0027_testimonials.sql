-- Testimonials — real customer proof from the previous sites.
--
-- These carried the coaching storefront: it had two pages of them plus a set of
-- filmed client testimonials. They are the strongest thing the old site had and
-- the new one showed none of them.
--
-- `attributed_to` is nullable on purpose. Several of the strongest quotes were
-- published anonymously ("Many audience members responded to client
-- satisfaction surveys"), and inventing a name for one would be fabricating a
-- customer.

create table public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  quote         text not null,
  attributed_to text,
  attribution_detail text,
  -- Where it belongs. Null shows it anywhere.
  context       text check (context in ('coaching', 'courses', 'cohorts', 'general')),
  featured      boolean not null default false,
  position      integer not null default 0,
  status        public.content_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();

alter table public.testimonials enable row level security;

create policy "published testimonials are public"
  on public.testimonials for select
  using (status = 'published');

create policy "staff read every testimonial"
  on public.testimonials for select to authenticated
  using (public.is_staff());
