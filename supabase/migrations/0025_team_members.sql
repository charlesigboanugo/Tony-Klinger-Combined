-- Team members — note 06 §16, note 11.
--
-- The coaching practice is taught by five named people, each with a written
-- biography and a photograph, and the previous site gave them a page of their
-- own. They are content an administrator changes — someone joins, a role
-- changes, a bio is rewritten — so they are a table rather than strings in a
-- component that only a deploy can edit.
--
-- `photo_resource_id` points at `resources` like every other image reference,
-- so team photos live in the same media library as everything else rather than
-- being a second, parallel way of storing an image.

create table public.team_members (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  role              text,
  bio               text,
  photo_resource_id uuid references public.resources (id) on delete set null,
  -- Explicit ordering: this is a deliberate presentation sequence, not
  -- alphabetical and not by creation date.
  position          integer not null default 0,
  status            public.content_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;

-- Published members are public: this is marketing content, and the page it
-- feeds is open to anyone.
create policy "published team members are public"
  on public.team_members for select
  using (status = 'published');

create policy "staff read every team member"
  on public.team_members for select to authenticated
  using (public.is_staff());

-- Writes go through the admin CRUD with the service role, which is why there is
-- no client write policy here (note 06 §2).
