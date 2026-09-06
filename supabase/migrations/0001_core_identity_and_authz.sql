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
