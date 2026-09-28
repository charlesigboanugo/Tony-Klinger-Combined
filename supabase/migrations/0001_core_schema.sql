-- 0001 — Core schema: identity, roles and permissions; products, prices and all content and delivery tables; orders, payments, subscriptions, entitlements and bookings.
--
-- Consolidated 2026-09-23 from migrations 0001, 0002, 0003, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- core identity and authz  (was migration 0001)
-- ===========================================================================

-- 0001 — Core identity, roles and permissions.
-- Architecture: note 08 §6–§8, §46–§51; note 06 §39.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enumerations
--
-- membership_tier and cohort_level are DELIBERATELY SEPARATE TYPES.
-- They share three of their labels but are unrelated ladders: a customer can
-- hold a Gold membership and a Platinum cohort at once. Two distinct types mean
-- the database refuses to compare or assign one where the other is expected.
-- Note 07 §16.1, note 08 §12–§13.
-- ---------------------------------------------------------------------------

create type public.membership_tier as enum ('silver', 'gold', 'platinum', 'ultimate');
create type public.cohort_level    as enum ('silver', 'gold', 'platinum');

create type public.content_status  as enum ('draft', 'published', 'archived');
create type public.product_status  as enum ('draft', 'active', 'paused', 'archived');

-- ---------------------------------------------------------------------------
-- Profiles — application identity, keyed to the Supabase Auth user.
-- Never stores credentials; Supabase Auth owns those (note 08 §7).
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  first_name    text,
  last_name     text,
  display_name  text,
  avatar_url    text,
  -- Access lifecycle, distinct from deletion (note 06 §15).
  status        text not null default 'active'
                  check (status in ('active', 'suspended', 'deactivated')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the application profile whenever an Auth user is created, so an Auth
-- user can never exist indefinitely without one (note 08 §23, §57).
-- Idempotent: a replayed insert does nothing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Roles and permissions — staff authorization (note 06 §39, note 08 §46–§49).
-- Entirely separate from customer entitlements (note 06 §35).
-- ---------------------------------------------------------------------------

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index role_permissions_role_id_idx on public.role_permissions (role_id);

-- ---------------------------------------------------------------------------
-- Authorization helpers.
--
-- SECURITY DEFINER so RLS policies can call them without the caller needing
-- read access to the role tables — and so a policy on user_roles does not
-- recurse into itself.
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.name = permission_name
  );
$$;

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = role_name
  );
$$;

-- Any staff role at all. Used to separate customers from operators.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Audit log — note 06 §31, note 08 §51.
-- Never stores secrets in metadata.
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null,
  resource_type text,
  resource_id   text,
  reason        text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);


-- ===========================================================================
-- products content and delivery  (was migration 0002)
-- ===========================================================================

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


-- ===========================================================================
-- commerce entitlements and bookings  (was migration 0003)
-- ===========================================================================

-- 0003 — Orders, payments, subscriptions, entitlements, bookings.
-- Architecture: note 08 §17–§21, §37–§45; note 09 §2, §33, §45.
--
-- The governing rule throughout: PAYMENT ≠ ORDER ≠ ENTITLEMENT ≠ BOOKING.

-- ---------------------------------------------------------------------------
-- Orders (note 08 §39–§42)
--
-- user_id is NULLABLE. A guest order is a real, paid commercial record that has
-- not yet been linked to an account (note 09 §5, §45). It is never treated as
-- an abandoned cart and is never deleted by cleanup.
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'
);

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  -- The email that paid. Proof of nothing on its own — claiming requires the
  -- emailed token plus an authenticated session (note 05 §29.3).
  guest_email    text,
  status         public.order_status not null default 'pending',
  currency       text not null default 'GBP',
  subtotal       integer not null default 0 check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  total          integer not null default 0 check (total >= 0),
  -- Stripe Checkout Session id, for reconciliation (note 09 §46).
  external_reference text unique,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Every order is either attached to an account or carries a contact email.
  constraint orders_have_an_owner_or_an_email check (
    user_id is not null or guest_email is not null
  )
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_guest_email_idx on public.orders (guest_email) where user_id is null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  product_id            uuid references public.products (id) on delete set null,
  price_id              uuid references public.prices (id) on delete set null,
  -- Purchase-time snapshots, so changing a product later cannot rewrite
  -- historical orders (note 08 §40).
  product_name_snapshot text not null,
  unit_amount           integer not null check (unit_amount >= 0),
  quantity              integer not null default 1 check (quantity > 0),
  total_amount          integer not null check (total_amount >= 0),
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Guest order claim tokens (note 05 §29.3)
--
-- Single-use, expiring, server-generated. The token hash is stored, never the
-- token itself, so a database read cannot be turned into a claim.
-- ---------------------------------------------------------------------------

create table public.order_claim_tokens (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  consumed_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index order_claim_tokens_order_id_idx on public.order_claim_tokens (order_id);

-- ---------------------------------------------------------------------------
-- Payments and subscriptions (note 08 §43–§44)
-- ---------------------------------------------------------------------------

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references public.orders (id) on delete set null,
  provider            text not null default 'stripe',
  provider_payment_id text not null,
  amount              integer not null,
  currency            text not null default 'GBP',
  status              text not null,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'cancelled', 'expired', 'incomplete'
);

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  product_id               uuid references public.products (id) on delete set null,
  price_id                 uuid references public.prices (id) on delete set null,
  membership_tier          public.membership_tier,
  provider                 text not null default 'stripe',
  provider_subscription_id text not null,
  status                   public.subscription_status not null,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  -- Access may continue past a failed payment while a grace period applies
  -- (note 09 §17, §24).
  grace_period_ends_at     timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Webhook idempotency: a provider may deliver the same event more than once,
-- and the unique constraint is what makes replay harmless (note 09 §21).
create table public.processed_webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Entitlements (note 08 §17–§21) — the access-control bridge between paying
-- and getting. Never inferred from an order's existence.
-- ---------------------------------------------------------------------------

create type public.entitlement_source as enum (
  'purchase', 'membership', 'bundle', 'promotion', 'admin_grant', 'other'
);

create type public.entitlement_resource as enum (
  'course', 'group_coaching_series', 'group_coaching_session', 'cohort',
  'retreat', 'event', 'masterclass', 'resource', 'release', 'partner_discount'
);

create type public.entitlement_status as enum (
  'active', 'expired', 'consumed', 'revoked'
);

create table public.entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  resource_type public.entitlement_resource not null,
  resource_id   uuid,
  source_type   public.entitlement_source not null,
  source_id     uuid,
  status        public.entitlement_status not null default 'active',
  starts_at     timestamptz not null default now(),
  -- Null means no expiry, where the business rules allow lifetime access.
  expires_at    timestamptz,
  -- Null quantity means unlimited access; a number means consumable credits
  -- (note 08 §20).
  quantity      integer check (quantity is null or quantity >= 0),
  quantity_used integer not null default 0 check (quantity_used >= 0),
  -- Manual grants must stay identifiable and must carry a reason, so free
  -- access can always be told from paid (note 06 §23.1).
  granted_by    uuid references auth.users (id) on delete set null,
  grant_reason  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint entitlements_not_overconsumed check (
    quantity is null or quantity_used <= quantity
  ),
  constraint entitlements_admin_grants_have_a_reason check (
    source_type <> 'admin_grant'
      or (granted_by is not null and grant_reason is not null and length(trim(grant_reason)) > 0)
  )
);

create index entitlements_user_id_idx on public.entitlements (user_id);
create index entitlements_status_idx on public.entitlements (status);
create index entitlements_resource_idx on public.entitlements (resource_type, resource_id);

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings (note 08 §37–§38)
-- ---------------------------------------------------------------------------

create type public.bookable_type as enum (
  'group_coaching_session', 'cohort_workshop', 'private_coaching',
  'retreat', 'event', 'masterclass'
);

create type public.booking_status as enum (
  'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
);

create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  bookable_type  public.bookable_type not null,
  bookable_id    uuid not null,
  -- The entitlement this booking consumed, where one applied. Cancelling can
  -- return the credit transactionally (note 09 §34).
  entitlement_id uuid references public.entitlements (id) on delete set null,
  status         public.booking_status not null default 'confirmed',
  starts_at      timestamptz,
  ends_at        timestamptz,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_bookable_idx on public.bookings (bookable_type, bookable_id);

-- One live booking per customer per bookable. This is the database-level half
-- of the concurrency guarantee — two simultaneous requests cannot both win
-- (note 08 §65).
create unique index bookings_one_live_per_user_per_bookable
  on public.bookings (user_id, bookable_type, bookable_id)
  where status in ('pending', 'confirmed');

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications (note 08 §52)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);
