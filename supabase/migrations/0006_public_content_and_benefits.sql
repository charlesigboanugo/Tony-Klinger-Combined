-- 0006 — Public content (catalogue tags, team, testimonials, group coaching syllabus) and the benefits and covers on memberships, private coaching and cohorts.
--
-- Consolidated 2026-09-28 from 0006_public_content, 0007_benefits_and_covers, in their original
-- order. Each section keeps a banner naming its former file, which notes and
-- comments may still cite.

-- ===========================================================================
-- 0006_public_content  (was migration 0006, before 2026-09-28)
-- ===========================================================================

-- 0006 — Catalogue tags, unique resource paths, team members, public resource paths, testimonials and the group coaching syllabus.
--
-- Consolidated 2026-09-23 from migrations 0023, 0024, 0025, 0026, 0027, 0028, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- catalogue tags  (was migration 0023)
-- ===========================================================================

-- Catalogue tags — curation without new categories.
--
-- Closes reconciliation item R25 (note 08 §28.2.1, note 11 Resolution).
--
-- `category` classifies: it says what a work IS, one value from a fixed set of
-- seven media types, and it never changes. `tags` curate: they say which
-- collections a work APPEARS IN, many values from an open set, edited whenever
-- an editor re-curates a collection.
--
-- This exists because Give-Get-Go's three sections are subsets, not categories.
-- Note 11 calls Publishing "the Give-Get-Go Books publishing imprint" — a
-- subset of `books`, not all of it — and Films is the same. So mapping a
-- section onto a whole category would have been wrong even for the sections
-- that appeared to fit, and Documentaries had no category at all.
--
-- A documentary is a FILM. It keeps its canonical home at
-- /catalogue/films/[slug] and appears under Give-Get-Go by tag. It is not an
-- eighth category: the seven are media types, and admitting one genre among
-- them would invite every other genre to follow.

alter table public.catalogue_items
  add column if not exists tags text[] not null default '{}';

comment on column public.catalogue_items.tags is
  'Curation labels. `category` says what the work is; a tag says which curated '
  'collection it appears in. Give-Get-Go sections are views filtered by the '
  'give-get-go:* tags (note 08 §28.2.1).';

-- GIN supports the containment/overlap operators (@>, &&) that tag filtering
-- uses. A btree index cannot answer those.
create index if not exists catalogue_items_tags_idx
  on public.catalogue_items using gin (tags);

-- Tags are normalised on write rather than rejected.
--
-- The hazard is silent, not loud: ' films' and 'films' would become two
-- different collections, and a trailing space is invisible in an admin form.
-- Rejecting the write would surface as an error an editor cannot see the cause
-- of; trimming it makes the mistake impossible instead. Duplicates are dropped
-- for the same reason — a tag applied twice is the same collection once.
--
-- Order is preserved so an editor's intent survives; only blanks and repeats
-- are removed.
create or replace function public.normalise_catalogue_tags()
returns trigger
language plpgsql
as $$
begin
  select coalesce(array_agg(distinct_tag order by first_position), '{}')
    into new.tags
  from (
    select btrim(t) as distinct_tag, min(ordinality) as first_position
    from unnest(new.tags) with ordinality as u(t, ordinality)
    where btrim(t) <> ''
    group by btrim(t)
  ) as cleaned;

  return new;
end;
$$;

comment on function public.normalise_catalogue_tags() is
  'Trims whitespace, drops blanks and de-duplicates catalogue tags on write so '
  'that two spellings of one tag cannot silently become two collections.';

drop trigger if exists normalise_catalogue_tags on public.catalogue_items;

create trigger normalise_catalogue_tags
  before insert or update of tags on public.catalogue_items
  for each row
  execute function public.normalise_catalogue_tags();

-- Backstop invariant. The trigger guarantees this, but the constraint states it
-- so a future path that bypasses the trigger cannot quietly reintroduce blanks.
-- `array_position` is used rather than a subquery: CHECK constraints cannot
-- contain subqueries.
alter table public.catalogue_items
  drop constraint if exists catalogue_tags_have_no_blank_entries;

alter table public.catalogue_items
  add constraint catalogue_tags_have_no_blank_entries
    check (array_position(tags, '') is null);


-- ===========================================================================
-- resource storage path unique  (was migration 0024)
-- ===========================================================================

-- One resource row per stored object.
--
-- The image import relies on it: PostgREST's `resolution=ignore-duplicates`
-- needs a unique constraint to conflict against, or a re-run doubles every row.
-- It is also right on its own terms: a storage object
-- lives at exactly one path, and two resources pointing at the same bytes is
-- ambiguity, not a feature. `external_url` is deliberately NOT constrained —
-- the same video can legitimately be referenced by several resources.

create unique index resources_storage_path_key
  on public.resources (storage_path);


-- ===========================================================================
-- team members  (was migration 0025)
-- ===========================================================================

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


-- ===========================================================================
-- public resource paths  (was migration 0026)
-- ===========================================================================

-- Let anyone read the PATH of an object that lives in a public bucket.
--
-- `resources` was staff-read only, which is right for the table as a whole: it
-- also holds paths into `course-assets` and `documents`, and knowing the key of
-- a gated worksheet is a small but real leak.
--
-- But it meant a public page could not resolve the photo for a team member or
-- the cover for a catalogue item — the embedded join returned null and the
-- image silently did not render, which is exactly what happened.
--
-- Paths in `site-media` and `avatars` are safe to expose because THE OBJECTS
-- THEMSELVES ARE ALREADY PUBLIC: those buckets are `public = true`, so anyone
-- can fetch the file without authenticating. Publishing the key of a file that
-- needs no key reveals nothing.
--
-- The private buckets are deliberately excluded. Reaching one of those still
-- requires a signed URL minted after an entitlement check (note 08 §26).

create policy "resource paths in public buckets are readable"
  on public.resources for select
  using (
    storage_path is not null
    and (
      storage_path like 'site-media/%'
      or storage_path like 'avatars/%'
    )
  );


-- ===========================================================================
-- testimonials  (was migration 0027)
-- ===========================================================================

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


-- ===========================================================================
-- group coaching syllabus  (was migration 0028)
-- ===========================================================================

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

-- ===========================================================================
-- 0007_benefits_and_covers  (was migration 0007, before 2026-09-28)
-- ===========================================================================

-- 0007 — Benefits on membership tiers, private coaching and cohorts; cover images for coaching entities; linking team members to accounts.
--
-- Consolidated 2026-09-23 from migrations 0029, 0030, 0031, 0033, 0034, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- membership tier benefits  (was migration 0029)
-- ===========================================================================

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


-- ===========================================================================
-- private coaching benefits  (was migration 0030)
-- ===========================================================================

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


-- ===========================================================================
-- cohort benefits  (was migration 0031)
-- ===========================================================================

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


-- ===========================================================================
-- coaching covers  (was migration 0033)
-- ===========================================================================

-- Cover images for the coaching entities.
--
-- Only `blog_posts` and `catalogue_items` could hold a cover, so every coaching
-- listing — courses, series, cohorts, retreats, private coaching — had no way to
-- show an image at all. That is why those pages read as text lists: not a
-- styling decision, a missing column.
--
-- ON DELETE SET NULL, never CASCADE. Deleting an image must not delete the
-- course that happened to use it (note 08 §54: cascading deletion is not the
-- default and is chosen per relationship).
--
-- The FK is named explicitly on every table. `catalogue_items` already reaches
-- `resources` two ways and an unnamed embed made PostgREST reject the query
-- with PGRST201 — silently, returning null so pages rendered as though nothing
-- were published. Naming them now avoids repeating that.

alter table public.courses
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.group_coaching_series
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.cohorts
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.retreats
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.private_coaching_services
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

comment on column public.courses.cover_resource_id is
  'Marketing image for the storefront. PUBLIC bucket only — a course thumbnail '
  'is marketing and is shown to people deciding whether to buy (note 08 §60.1).';

-- Which image each course and service uses is content, not schema: it is
-- assigned by scripts/import-images.mjs once the images exist.


-- ===========================================================================
-- team members user link  (was migration 0034)
-- ===========================================================================

-- Link a team member to the user account they are.
--
-- `team_members` was an island: name, slug, role, bio, photo — with no
-- connection to `profiles` or `auth.users` at all. So the five people on
-- /about/team existed twice in the system if they also had accounts, and there
-- was no way to say "this user is on the team" or to reach a team member's
-- orders, entitlements or roles from their public entry.
--
-- NULLABLE, deliberately. Two things are being modelled and only one of them
-- requires an account:
--
--   a USER who is also shown publicly   -> user_id set
--   a person shown publicly, no account -> user_id null
--
-- All five existing rows are the second kind — Tony, Louize, Elaine, Jon and
-- Helen were seeded from the old site's copy and have no accounts. Making the
-- column NOT NULL would mean either inventing accounts for them or deleting
-- real published content, so it is optional and the admin links them when an
-- account exists.
--
-- UNIQUE, so one account cannot appear on the team page twice. Note 03 §37 —
-- one person, one address.
--
-- ON DELETE SET NULL rather than CASCADE: deleting an account must not silently
-- remove a published biography from the public site (note 08 §54). The entry
-- stays and simply stops being linked.

alter table public.team_members
  add column if not exists user_id uuid
  references auth.users (id) on delete set null;

create unique index if not exists team_members_user_id_key
  on public.team_members (user_id)
  where user_id is not null;

comment on column public.team_members.user_id is
  'The account this team member is, when they have one. Null for people shown '
  'on the site who do not hold an account. Being a team member is a PUBLIC '
  'presentation choice and is independent of staff roles: a team member need '
  'not be staff, and staff need not appear on the team page (note 06 §11).';

-- NOTHING IS LINKED AUTOMATICALLY.
--
-- An earlier draft of this migration tried to match seeded team members to
-- accounts by email. It could not: `team_members` has no email column, and the
-- join fell back to comparing an address against a display name, which is
-- meaningless. Guessing at identity is the same mistake the catalogue cover
-- work had to undo twice, and the stakes are higher here — a wrong link would
-- attach one person's orders and entitlements to another person's public
-- profile.
--
-- Linking is therefore an explicit act in /admin/users, performed by someone
-- who knows who these people are.
