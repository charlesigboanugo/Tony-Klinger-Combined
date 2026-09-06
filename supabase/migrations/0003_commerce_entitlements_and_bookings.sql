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
