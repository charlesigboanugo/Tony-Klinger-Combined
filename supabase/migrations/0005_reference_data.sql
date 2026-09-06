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
