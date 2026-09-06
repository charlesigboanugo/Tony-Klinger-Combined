-- 0002 — Products, prices, Academy content, coaching, cohorts, events, blog,
-- catalogue. Architecture: note 08 §9–§14, §22–§35, §28.1–§28.2.

-- ---------------------------------------------------------------------------
-- Products and prices (note 08 §9–§11)
-- ---------------------------------------------------------------------------

create type public.product_type as enum (
  'membership', 'course', 'group_coaching', 'cohort',
  'private_coaching', 'retreat', 'event', 'masterclass', 'bundle', 'other'
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  product_type public.product_type not null,
  status       public.product_status not null default 'draft',
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create type public.billing_type      as enum ('one_time', 'recurring');
create type public.billing_interval  as enum ('month', 'year');

create table public.prices (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  currency     text not null default 'GBP',
  -- Minor units (pence). Integer, never floating point, for money.
  amount       integer not null check (amount >= 0),
  billing_type public.billing_type not null,
  interval     public.billing_interval,
  -- Stripe's identifier for this price; the application remains the source of
  -- truth for its own orders (note 09 §12).
  stripe_price_id text unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A recurring price must state its interval; a one-time price must not.
  constraint prices_interval_matches_billing_type check (
    (billing_type = 'recurring' and interval is not null) or
    (billing_type = 'one_time'  and interval is null)
  )
);

create index prices_product_id_idx on public.prices (product_id);

create trigger prices_set_updated_at
  before update on public.prices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership tiers (note 08 §14). Cumulative: `rank` orders the ladder so
-- entitlement resolution can include every lower tier (note 07 §10).
-- ---------------------------------------------------------------------------

create table public.membership_tiers (
  id          uuid primary key default gen_random_uuid(),
  tier        public.membership_tier not null unique,
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  rank        integer not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger membership_tiers_set_updated_at
  before update on public.membership_tiers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Courses, modules, lessons, resources (note 08 §22–§26)
-- ---------------------------------------------------------------------------

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products (id) on delete set null,
  title       text not null,
  slug        text not null unique,
  description text,
  status      public.content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index course_modules_course_id_idx on public.course_modules (course_id);

create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.course_modules (id) on delete cascade,
  title      text not null,
  slug       text not null,
  content    text,
  position   integer not null default 0,
  status     public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);

create index lessons_module_id_idx on public.lessons (module_id);

-- Resources are files and links. Private ones live in Supabase Storage behind
-- access control, never in the public static directory (note 08 §26).
create table public.resources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  resource_type text not null,
  storage_path  text,
  external_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint resources_have_a_location check (
    storage_path is not null or external_url is not null
  )
);

-- ---------------------------------------------------------------------------
-- Masterclasses (note 08 §27). product_id only where separately purchasable.
-- ---------------------------------------------------------------------------

create table public.masterclasses (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid references public.products (id) on delete set null,
  title                 text not null,
  slug                  text not null unique,
  description           text,
  status                public.content_status not null default 'draft',
  starts_at             timestamptz,
  ends_at               timestamptz,
  meeting_url           text,
  recording_resource_id uuid references public.resources (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Group Coaching: four series, eight sessions each (note 08 §29–§31).
-- A series is the programme; a session is one scheduled occurrence.
-- ---------------------------------------------------------------------------

create table public.group_coaching_series (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  status      public.content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.group_coaching_sessions (
  id                    uuid primary key default gen_random_uuid(),
  series_id             uuid not null references public.group_coaching_series (id) on delete cascade,
  title                 text not null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  -- Capacity is data, not a hard-coded 8 (note 08 §31).
  capacity              integer not null default 8 check (capacity > 0),
  coach_id              uuid references auth.users (id) on delete set null,
  meeting_url           text,
  recording_resource_id uuid references public.resources (id) on delete set null,
  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'cancelled', 'completed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint gcs_ends_after_starts check (ends_at > starts_at)
);

create index gcs_series_id_idx on public.group_coaching_sessions (series_id);
create index gcs_starts_at_idx on public.group_coaching_sessions (starts_at);

-- ---------------------------------------------------------------------------
-- Interactive Cohorts — distinct from Group Coaching (note 08 §32–§33).
-- Uses cohort_level, never membership_tier.
-- ---------------------------------------------------------------------------

create table public.cohorts (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references public.products (id) on delete set null,
  name         text not null,
  slug         text not null unique,
  description  text,
  cohort_level public.cohort_level not null,
  status       public.content_status not null default 'draft',
  starts_at    timestamptz,
  ends_at      timestamptz,
  capacity     integer check (capacity > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.cohort_workshops (
  id                    uuid primary key default gen_random_uuid(),
  cohort_id             uuid not null references public.cohorts (id) on delete cascade,
  title                 text not null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  position              integer not null default 0,
  meeting_url           text,
  recording_resource_id uuid references public.resources (id) on delete set null,
  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'cancelled', 'completed')),
  created_at            timestamptz not null default now(),
  constraint cohort_workshops_ends_after_starts check (ends_at > starts_at)
);

create index cohort_workshops_cohort_id_idx on public.cohort_workshops (cohort_id);

-- ---------------------------------------------------------------------------
-- Retreats, events, private coaching services (note 08 §34–§36)
-- ---------------------------------------------------------------------------

create table public.retreats (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  capacity    integer check (capacity > 0),
  -- Not every retreat uses every stage (note 09 §39).
  requires_application boolean not null default false,
  status      public.content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.retreat_applications (
  id           uuid primary key default gen_random_uuid(),
  retreat_id   uuid not null references public.retreats (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'submitted'
                 check (status in ('submitted', 'interviewing', 'approved', 'declined', 'withdrawn')),
  answers      jsonb not null default '{}'::jsonb,
  reviewed_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (retreat_id, user_id)
);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  location    text,
  capacity    integer check (capacity > 0),
  -- A free event still produces a booking, because capacity and attendance
  -- must be tracked (note 03 §8.1).
  is_free     boolean not null default false,
  status      public.content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.private_coaching_services (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references public.products (id) on delete set null,
  name              text not null,
  slug              text not null unique,
  description       text,
  duration_minutes  integer not null check (duration_minutes > 0),
  status            public.content_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Blog (note 08 §28.1)
-- ---------------------------------------------------------------------------

create table public.blog_posts (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  excerpt           text,
  content           text,
  status            public.content_status not null default 'draft',
  published_at      timestamptz,
  author_user_id    uuid references auth.users (id) on delete set null,
  cover_resource_id uuid references public.resources (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index blog_posts_status_idx on public.blog_posts (status);
create index blog_posts_published_at_idx on public.blog_posts (published_at desc);

create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue (note 08 §28.2)
--
-- The seven categories are VALUES, not tables. Individual works — The Havana
-- Chronicles, Solo2Darwin, Lights, Chutzpah, Action!! — are rows in the
-- appropriate category, never top-level categories (note 03 §7).
-- ---------------------------------------------------------------------------

create type public.catalogue_category as enum (
  'books', 'films', 'audio', 'interviews',
  'stories-from-the-front-line', 'podcasts', 'watch'
);

create table public.catalogue_items (
  id                uuid primary key default gen_random_uuid(),
  category          public.catalogue_category not null,
  title             text not null,
  slug              text not null,
  description       text,
  body              text,
  status            public.content_status not null default 'draft',
  published_at      timestamptz,
  -- Where a work lives on an external platform the entry still exists so it can
  -- be listed and described, but the application links out (note 08 §28.2).
  is_external       boolean not null default false,
  external_url      text,
  cover_resource_id uuid references public.resources (id) on delete set null,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (category, slug),
  constraint catalogue_external_items_have_a_url check (
    (is_external = false) or (external_url is not null)
  )
);

create index catalogue_items_category_idx on public.catalogue_items (category);
create index catalogue_items_status_idx on public.catalogue_items (status);

create trigger catalogue_items_set_updated_at
  before update on public.catalogue_items
  for each row execute function public.set_updated_at();

create table public.catalogue_item_resources (
  catalogue_item_id uuid not null references public.catalogue_items (id) on delete cascade,
  resource_id       uuid not null references public.resources (id) on delete cascade,
  position          integer not null default 0,
  primary key (catalogue_item_id, resource_id)
);
