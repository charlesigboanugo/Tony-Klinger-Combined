-- 0002 — Row Level Security, reference data (roles, permissions, tiers), MFA assurance helpers and the caller permission lookup.
--
-- Consolidated 2026-09-23 from migrations 0004, 0005, 0006, 0007, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- row level security  (was migration 0004)
-- ===========================================================================

-- 0004 — Row Level Security.
-- Architecture: note 08 §59–§61; note 05 §33; note 06 §28.
--
-- RLS complements server-side authorization; it does not replace it. The point
-- is that a mistake in application code cannot expose another customer's rows.
--
-- The service-role key bypasses everything here. That is why it is confined to
-- webhook processing and scheduled jobs (note 08 §61).
--
-- Tables with RLS enabled and NO policy are deny-all to every client. That is
-- deliberate for the token and webhook-bookkeeping tables.

-- ---------------------------------------------------------------------------
-- Customer-owned data — the owner, and staff holding the right permission.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "profiles: update own"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles: staff read"
  on public.profiles for select
  using (public.has_permission('users.read'));

alter table public.orders enable row level security;

create policy "orders: read own"
  on public.orders for select
  using (user_id = auth.uid());

create policy "orders: staff read"
  on public.orders for select
  using (public.has_permission('orders.read'));

alter table public.order_items enable row level security;

create policy "order_items: read own"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

create policy "order_items: staff read"
  on public.order_items for select
  using (public.has_permission('orders.read'));

alter table public.payments enable row level security;

create policy "payments: read own"
  on public.payments for select
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id and o.user_id = auth.uid()
  ));

create policy "payments: staff read"
  on public.payments for select
  using (public.has_permission('payments.read'));

alter table public.subscriptions enable row level security;

create policy "subscriptions: read own"
  on public.subscriptions for select
  using (user_id = auth.uid());

create policy "subscriptions: staff read"
  on public.subscriptions for select
  using (public.has_permission('memberships.read'));

-- Entitlements are readable by their owner — this is what `/account/entitlements`
-- reads (note 03 §24). Writes are never client-side: they come from webhook
-- processing or the admin area, both of which run server-side.
alter table public.entitlements enable row level security;

create policy "entitlements: read own"
  on public.entitlements for select
  using (user_id = auth.uid());

create policy "entitlements: staff read"
  on public.entitlements for select
  using (public.has_permission('entitlements.read'));

alter table public.bookings enable row level security;

create policy "bookings: read own"
  on public.bookings for select
  using (user_id = auth.uid());

create policy "bookings: staff read"
  on public.bookings for select
  using (public.has_permission('bookings.read'));

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications: mark own read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.retreat_applications enable row level security;

create policy "retreat_applications: read own"
  on public.retreat_applications for select
  using (user_id = auth.uid());

create policy "retreat_applications: create own"
  on public.retreat_applications for insert
  with check (user_id = auth.uid());

create policy "retreat_applications: staff read"
  on public.retreat_applications for select
  using (public.has_permission('retreats.read'));

-- ---------------------------------------------------------------------------
-- Deny-all tables.
--
-- RLS on, no policies: unreachable by anon and authenticated clients. Only the
-- service role touches these, from server-side code.
-- ---------------------------------------------------------------------------

alter table public.order_claim_tokens enable row level security;
alter table public.processed_webhook_events enable row level security;

-- Audit logs are readable by staff with the permission and writable by nobody
-- through the client — an audit trail a client can write is not an audit trail.
alter table public.audit_logs enable row level security;

-- "audit_logs: staff read" is created in 0006, once has_aal2() exists: reading
-- the audit log needs the permission AND a second factor.

-- ---------------------------------------------------------------------------
-- Authorization tables — readable so the UI can resolve the current user's own
-- roles; never writable from a client (note 06 §13).
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;

create policy "user_roles: read own"
  on public.user_roles for select
  using (user_id = auth.uid());

create policy "user_roles: staff read"
  on public.user_roles for select
  using (public.has_permission('roles.read'));

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "roles: staff read"
  on public.roles for select using (public.has_permission('roles.read'));
create policy "permissions: staff read"
  on public.permissions for select using (public.has_permission('roles.read'));
create policy "role_permissions: staff read"
  on public.role_permissions for select using (public.has_permission('roles.read'));

-- ---------------------------------------------------------------------------
-- Public content.
--
-- Readable by anyone when published; otherwise only by staff holding the
-- relevant permission. A draft must not be reachable by guessing its slug —
-- that is enforced here, not by omitting a link (note 08 §28.1).
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
create policy "products: public read active"
  on public.products for select using (status = 'active');
create policy "products: staff read"
  on public.products for select using (public.has_permission('products.read'));

alter table public.prices enable row level security;
create policy "prices: public read active"
  on public.prices for select using (active = true);
create policy "prices: staff read"
  on public.prices for select using (public.has_permission('products.read'));

alter table public.membership_tiers enable row level security;
create policy "membership_tiers: public read active"
  on public.membership_tiers for select using (active = true);

alter table public.blog_posts enable row level security;
create policy "blog_posts: public read published"
  on public.blog_posts for select
  using (status = 'published' and (published_at is null or published_at <= now()));
create policy "blog_posts: staff read"
  on public.blog_posts for select using (public.has_permission('blog.read'));

alter table public.catalogue_items enable row level security;
create policy "catalogue_items: public read published"
  on public.catalogue_items for select
  using (status = 'published' and (published_at is null or published_at <= now()));
create policy "catalogue_items: staff read"
  on public.catalogue_items for select using (public.has_permission('catalogue.read'));

alter table public.catalogue_item_resources enable row level security;
create policy "catalogue_item_resources: public read published"
  on public.catalogue_item_resources for select
  using (exists (
    select 1 from public.catalogue_items c
    where c.id = catalogue_item_resources.catalogue_item_id
      and c.status = 'published'
  ));

alter table public.events enable row level security;
create policy "events: public read published"
  on public.events for select using (status = 'published');
create policy "events: staff read"
  on public.events for select using (public.has_permission('events.read'));

alter table public.courses enable row level security;
create policy "courses: public read published"
  on public.courses for select using (status = 'published');
create policy "courses: staff read"
  on public.courses for select using (public.has_permission('courses.read'));

alter table public.group_coaching_series enable row level security;
create policy "gc_series: public read published"
  on public.group_coaching_series for select using (status = 'published');

alter table public.cohorts enable row level security;
create policy "cohorts: public read published"
  on public.cohorts for select using (status = 'published');

alter table public.retreats enable row level security;
create policy "retreats: public read published"
  on public.retreats for select using (status = 'published');

alter table public.private_coaching_services enable row level security;
create policy "private_coaching_services: public read published"
  on public.private_coaching_services for select using (status = 'published');

-- ---------------------------------------------------------------------------
-- Entitlement-gated content.
--
-- Course modules, lessons, workshops, sessions, masterclasses and resources are
-- delivery, not marketing. Access requires a live entitlement — being signed in
-- is not enough (note 07 §19, note 05 §19).
-- ---------------------------------------------------------------------------

create or replace function public.has_active_entitlement(
  p_resource_type public.entitlement_resource,
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = auth.uid()
      and e.resource_type = p_resource_type
      and (e.resource_id = p_resource_id or e.resource_id is null)
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

alter table public.course_modules enable row level security;
create policy "course_modules: entitled read"
  on public.course_modules for select
  using (public.has_active_entitlement('course', course_id));
create policy "course_modules: staff read"
  on public.course_modules for select using (public.has_permission('courses.read'));

alter table public.lessons enable row level security;
create policy "lessons: entitled read"
  on public.lessons for select
  using (exists (
    select 1 from public.course_modules m
    where m.id = lessons.module_id
      and public.has_active_entitlement('course', m.course_id)
  ));
create policy "lessons: staff read"
  on public.lessons for select using (public.has_permission('courses.read'));

alter table public.masterclasses enable row level security;
create policy "masterclasses: entitled read"
  on public.masterclasses for select
  using (public.has_active_entitlement('masterclass', id));
create policy "masterclasses: staff read"
  on public.masterclasses for select using (public.has_permission('masterclasses.read'));

alter table public.group_coaching_sessions enable row level security;
-- "gc_sessions: entitled read" is created in 0012, with has_session_credits().
create policy "gc_sessions: staff read"
  on public.group_coaching_sessions for select using (public.has_permission('coaching.read'));

alter table public.cohort_workshops enable row level security;
create policy "cohort_workshops: entitled read"
  on public.cohort_workshops for select
  using (public.has_active_entitlement('cohort', cohort_id));
create policy "cohort_workshops: staff read"
  on public.cohort_workshops for select using (public.has_permission('cohorts.read'));

-- Resources are private by default: no blanket public policy. They are served
-- through their parent experience, which carries the entitlement check
-- (note 07 §23, note 08 §26).
alter table public.resources enable row level security;
create policy "resources: staff read"
  on public.resources for select using (public.is_staff());


-- ===========================================================================
-- reference data  (was migration 0005)
-- ===========================================================================

-- 0005 — Reference data.
--
-- Permissions, roles and membership tiers are not sample data: the application
-- cannot authorize anyone or price anything without them. They therefore belong
-- in a migration, which is what `supabase db push` ships to a real project.
--
-- `supabase/seed.sql` is local-only (it runs on `supabase start` and
-- `supabase db reset`), so reference data must not live there.
--
-- Every statement is idempotent, so re-running a migration replay is safe.

-- Permissions (note 06 §8, §17–§23, §23.1)
-- ---------------------------------------------------------------------------

insert into public.permissions (name, description) values
  ('users.read',              'View users'),
  ('users.update',            'Update users'),
  ('users.delete',            'Delete users'),
  ('roles.read',              'View roles and permissions'),
  ('roles.manage',            'Assign roles and permissions'),
  ('products.read',           'View products and prices'),
  ('products.create',         'Create products'),
  ('products.update',         'Update products'),
  ('products.delete',         'Delete products'),
  ('memberships.read',        'View membership plans and subscribers'),
  ('memberships.update',      'Update membership plans'),
  ('entitlements.read',       'View customer entitlements'),
  ('entitlements.grant',      'Grant an entitlement by hand'),
  ('entitlements.adjust',     'Adjust entitlement quantity or expiry'),
  ('entitlements.revoke',     'Revoke an entitlement'),
  ('orders.read',             'View orders'),
  ('payments.read',           'View payments'),
  ('refunds.manage',          'Process refunds'),
  ('courses.read',            'View courses'),
  ('courses.create',          'Create courses'),
  ('courses.update',          'Update courses'),
  ('courses.publish',         'Publish courses'),
  ('masterclasses.read',      'View masterclasses'),
  ('masterclasses.create',    'Create masterclasses'),
  ('masterclasses.update',    'Update masterclasses'),
  ('masterclasses.publish',   'Publish masterclasses'),
  ('blog.read',               'View blog posts'),
  ('blog.create',             'Create blog posts'),
  ('blog.update',             'Update blog posts'),
  ('blog.publish',            'Publish blog posts'),
  ('blog.delete',             'Delete blog posts'),
  ('catalogue.read',          'View catalogue items'),
  ('catalogue.create',        'Create catalogue items'),
  ('catalogue.update',        'Update catalogue items'),
  ('catalogue.publish',       'Publish catalogue items'),
  ('catalogue.delete',        'Delete catalogue items'),
  ('coaching.read',           'View coaching programmes and sessions'),
  ('coaching.manage',         'Manage coaching programmes and sessions'),
  ('cohorts.read',            'View cohorts'),
  ('cohorts.manage',          'Manage cohorts, participants and sessions'),
  ('retreats.read',           'View retreats'),
  ('retreats.manage',         'Manage retreats and applications'),
  ('events.read',             'View events'),
  ('events.create',           'Create events'),
  ('events.update',           'Update events'),
  ('events.delete',           'Delete events'),
  ('bookings.read',           'View bookings'),
  ('bookings.manage',         'Create, change and cancel bookings'),
  ('emails.read',             'View email templates and sends'),
  ('emails.send',             'Send customer emails'),
  ('audit.read',              'Read the audit log'),
  ('settings.read',           'View system settings'),
  ('settings.update',         'Change system settings')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Roles (note 06 §4–§6)
-- `owner` names the business owner's role, never a person (note 06 §4).
-- ---------------------------------------------------------------------------

insert into public.roles (name, description) values
  ('owner',                  'Business owner. Highest application-level privilege.'),
  ('admin',                  'Broad operational access, short of owner-only capabilities.'),
  ('content_manager',        'Manages blog and catalogue content.'),
  ('course_manager',         'Manages courses and masterclasses.'),
  ('coaching_manager',       'Manages coaching programmes, cohorts and sessions.'),
  ('booking_manager',        'Manages bookings and availability.'),
  ('finance_manager',        'Manages orders, payments and refunds.'),
  ('communications_manager', 'Manages customer email and notifications.'),
  ('support_manager',        'Customer support. Reads widely, changes little.')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Role → permission assignments (note 06 §10, §33 least privilege)
-- ---------------------------------------------------------------------------

-- Owner: everything.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'owner'
on conflict do nothing;

-- Admin: everything except role management and settings changes, which stay
-- owner-level so an admin cannot silently elevate themselves (note 06 §34).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'admin'
  and p.name not in ('roles.manage', 'settings.update', 'users.delete')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.name = any(
  case r.name
    when 'content_manager' then array[
      'blog.read','blog.create','blog.update','blog.publish','blog.delete',
      'catalogue.read','catalogue.create','catalogue.update','catalogue.publish','catalogue.delete']
    when 'course_manager' then array[
      'courses.read','courses.create','courses.update','courses.publish',
      'masterclasses.read','masterclasses.create','masterclasses.update','masterclasses.publish']
    when 'coaching_manager' then array[
      'coaching.read','coaching.manage','cohorts.read','cohorts.manage',
      'bookings.read','bookings.manage']
    when 'booking_manager' then array[
      'bookings.read','bookings.manage','events.read','retreats.read','coaching.read']
    when 'finance_manager' then array[
      'orders.read','payments.read','refunds.manage','memberships.read','entitlements.read']
    when 'communications_manager' then array[
      'emails.read','emails.send']
    -- Support reads to explain what a customer can access, and may correct a
    -- quantity or expiry — but cannot create or destroy entitlements
    -- (note 06 §23.1).
    when 'support_manager' then array[
      'users.read','orders.read','bookings.read','memberships.read',
      'entitlements.read','entitlements.adjust']
    else array[]::text[]
  end
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Membership tiers — cumulative, ordered by rank (note 07 §5–§10)
-- ---------------------------------------------------------------------------

insert into public.membership_tiers (tier, name, slug, rank, description) values
  ('silver',   'Silver',             'silver',   1, '1 video playlist and 1 Group Coaching series (8 sessions).'),
  ('gold',     'Gold',               'gold',     2, 'Everything in Silver, plus a second Group Coaching series — 16 sessions in total.'),
  ('platinum', 'Platinum',           'platinum', 3, 'Everything in Gold, plus all 4 series (32 sessions), virtual retreats and new courses during membership.'),
  ('ultimate', 'Ultimate Membership','ultimate', 4, 'Everything in Platinum, plus unlimited cohort access, new releases, masterclasses, partner discounts and downloadable resources.')
on conflict (tier) do nothing;

-- ---------------------------------------------------------------------------
-- The four Group Coaching series (note 07 §11)
-- ---------------------------------------------------------------------------

insert into public.group_coaching_series (name, slug, description, status) values
  ('Filmmaking',         'filmmaking',          'Eight sessions on filmmaking.', 'draft'),
  ('Writing',            'writing',             'Eight sessions on writing.',    'draft'),
  ('Producing',          'producing',           'Eight sessions on producing.',  'draft'),
  ('For All Filmmakers', 'for-all-filmmakers',  'Eight sessions for all filmmakers.', 'draft')
on conflict (slug) do nothing;


-- ===========================================================================
-- assurance level  (was migration 0006)
-- ===========================================================================

-- 0006 — Assurance level helpers for staff MFA.
-- Architecture: note 05 §11.1, note 06 §25.1.
--
-- Supabase records how strongly a session is authenticated in the `aal` claim:
--   aal1  password / magic link / OAuth only
--   aal2  a WebAuthn factor was also verified
--
-- Staff permissions require aal2. Enforcing it here rather than only in the
-- application means a stolen aal1 token cannot reach the row even if it reaches
-- the query.

create or replace function public.current_aal()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'),
    'aal1'
  );
$$;

create or replace function public.has_aal2()
returns boolean
language sql
stable
as $$
  select public.current_aal() = 'aal2';
$$;

-- Whether this user is required to hold a second factor. Staff are; customers
-- are not (note 05 §11.1).
create or replace function public.requires_mfa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff();
$$;

comment on function public.has_aal2() is
  'True when the current session has verified a WebAuthn factor. Staff-facing RLS predicates require this once MFA enrolment ships (note 06 §25.1).';

-- The audit log is tightened now, because nothing reads it yet and it is the
-- record that must survive a compromised staff session.
--
-- The remaining staff predicates switch to requiring aal2 in the same change
-- that ships WebAuthn enrolment. Tightening them before an operator can enrol
-- would lock every administrator out of an area they cannot yet get a factor
-- for — a self-inflicted outage, not security.
create policy "audit_logs: staff read"
  on public.audit_logs for select
  using (public.has_permission('audit.read') and public.has_aal2());


-- ===========================================================================
-- permission lookup  (was migration 0007)
-- ===========================================================================

-- 0007 — Caller permission lookup.
-- Architecture: note 06 §26 (centralized authorization helpers).
--
-- The application needs the current user's effective permissions in one call.
-- It cannot simply query role_permissions: reading that table requires
-- `roles.read`, which most operational roles do not hold. A course manager must
-- be able to discover that they hold `courses.update` without also being able
-- to read the entire permission matrix.
--
-- SECURITY DEFINER resolves that: the function reads the join on the caller's
-- behalf and returns only their own permissions, never anyone else's.

create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.name
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

create or replace function public.my_roles()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

comment on function public.my_permissions() is
  'Effective permission names for the calling user. Scoped to auth.uid(); cannot be used to inspect another account.';

revoke all on function public.my_permissions() from anon;
revoke all on function public.my_roles() from anon;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.my_roles() to authenticated;
