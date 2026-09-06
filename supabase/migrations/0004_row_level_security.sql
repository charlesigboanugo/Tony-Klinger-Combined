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

create policy "audit_logs: staff read"
  on public.audit_logs for select
  using (public.has_permission('audit.read'));

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
create policy "gc_sessions: entitled read"
  on public.group_coaching_sessions for select
  using (public.has_active_entitlement('group_coaching_series', series_id));
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
