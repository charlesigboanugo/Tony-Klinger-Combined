-- Database tests — run with: pnpm test:db
--
-- pgTAP. Each test asserts that an architectural invariant is enforced by the
-- database itself, not merely written down in a note.
--
-- Runs inside a transaction that is rolled back, so tests never leave state.

begin;
select plan(191);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

-- A tripwire, not a description. It fails whenever a table is added or dropped,
-- which forces a deliberate look at whether the new table has RLS and policies
-- rather than letting one slip in unprotected. The count is NOT repeated in the
-- message: pgTAP already prints have/want, and a hand-written number in the
-- text goes stale silently (it had already drifted to 34 while asserting 35).
select is(
  (select count(*)::int from information_schema.tables where table_schema = 'public'),
  59,
  'public schema table count matches the migrations'
);

select is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'RLS is enabled on every public table'
);

-- Pass tiers and cohort levels are CODES staff can add to (migration 0029):
-- text, unique, and in a fixed format. They stay separate columns in separate
-- tables, so one can never stand in for the other.
select col_type_is('public', 'membership_tiers', 'tier', 'text', 'a pass tier is a text code');
select col_type_is('public', 'cohorts', 'cohort_level', 'text', 'a cohort level is a text code');
select throws_ok(
  $$insert into public.membership_tiers (tier, name, slug, rank) values ('Gold Plus!', 'x', 'x-code-test', 99)$$,
  '23514',
  null,
  'a pass tier code must be lower case letters, digits, - or _'
);

-- An admin grant must name who gave it when it is made (0021), though the name
-- may later be cleared when that person's account is deleted.
select throws_ok(
  $$insert into public.entitlements (user_id, resource_type, resource_id, source_type, status, grant_reason)
    select u.id, 'course', c.id, 'admin_grant', 'active', 'test'
    from auth.users u, public.courses c limit 1$$,
  '23514',
  'an admin grant must name who made it',
  'an admin grant without the granter is refused'
);

-- ---------------------------------------------------------------------------
-- Reference data — shipped by migration 0002_security_and_reference_data, so it must exist everywhere
-- ---------------------------------------------------------------------------

select cmp_ok(
  (select count(*)::int from public.permissions), '>=', 50,
  'permissions are seeded by migration'
);
select is((select count(*)::int from public.roles where is_staff), 9, 'nine staff roles exist');
select is((select count(*)::int from public.membership_tiers), 4, 'four membership tiers exist');
-- Local sample series (`pnpm dev:samples`) are not part of the catalogue.
select is((select count(*)::int from public.group_coaching_series where slug not like 'sample-%'), 4, 'four coaching series exist');

select is(
  (select array_agg(tier::text order by rank) from public.membership_tiers),
  array['silver', 'gold', 'platinum', 'ultimate'],
  'membership tiers are cumulative in rank order'
);

-- Admins grant and revoke roles since 0020 (owner, 2026-10-23; note 06 §34).
-- What keeps them from making themselves owner is `admin_set_role` refusing
-- the owner role to anyone who is not an owner, asserted below.
select is(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
   where r.name = 'admin' and p.name = 'roles.manage'),
  1,
  'the admin role holds roles.manage'
);

select ok(
  pg_get_functiondef('public.admin_set_role(uuid, text, boolean, text)'::regprocedure)
    like '%p_role_name = ''owner'' and not public.has_role(''owner'')%',
  'admin_set_role refuses the owner role to anyone who is not an owner'
);

-- Admins delete accounts too, since 0028 (owner, 2026-10-14; note 06 §14.4).
select is(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
   where r.name = 'admin' and p.name = 'users.delete'),
  1,
  'the admin role holds users.delete'
);

select cmp_ok(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
   where r.name = 'owner'), '>=', 50,
  'the owner role holds every permission'
);

-- Support may correct a quantity but must not create or destroy access.
select is(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
   where r.name = 'support_manager' and p.name in ('entitlements.grant', 'entitlements.revoke')),
  0,
  'support_manager cannot grant or revoke entitlements'
);

-- The Academy's staff view (0018, 0019, note 06 §23.2): five staff roles and
-- the Academy viewer see everything, the rest only what they have bought.
select is(
  (select array_agg(r.name::text order by r.name)
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
   where p.name = 'academy.view_all'),
  array['academy_viewer', 'admin', 'coaching_manager', 'course_manager', 'owner', 'support_manager'],
  'exactly six roles hold academy.view_all'
);

-- The Academy viewer is not staff, and holds nothing else.
select is(
  (select array_agg(r.name::text order by r.name) from public.roles r where not r.is_staff),
  array['academy_viewer'],
  'academy_viewer is the only role that is not staff'
);

select is(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
    where r.name = 'academy_viewer'),
  1,
  'academy_viewer holds only academy.view_all'
);

select policies_are('public', 'lessons',
  array['lessons: entitled read', 'lessons: staff read', 'lessons: academy staff view'],
  'lessons are readable by entitlement, course staff, or the Academy staff view'
);

-- Seeing is not doing: progress still needs a live entitlement to the course.
select ok(
  (select with_check like '%has_active_entitlement%'
     from pg_policies
    where schemaname = 'public' and tablename = 'lesson_progress' and policyname = 'lesson_progress: entitled write'),
  'recording progress still needs an entitlement, not the staff view'
);

-- ---------------------------------------------------------------------------
-- Constraints — each of these must be refused
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.entitlements (user_id, resource_type, source_type)
    select id, 'course', 'admin_grant' from auth.users limit 1$$,
  23514,
  null,
  'an admin grant with no reason is refused'
);

select throws_ok(
  $$insert into public.orders (total) values (100)$$,
  23514,
  null,
  'an order with neither an owner nor an email is refused'
);

select throws_ok(
  $$insert into public.entitlements (user_id, resource_type, source_type, quantity, quantity_used)
    select id, 'group_coaching_session', 'purchase', 8, 9 from auth.users limit 1$$,
  23514,
  null,
  'consuming an entitlement past its quantity is refused'
);

select throws_ok(
  $$insert into public.prices (product_id, amount, billing_type)
    select id, 1000, 'recurring' from public.products limit 1$$,
  23514,
  null,
  'a recurring price with no interval is refused'
);

select throws_ok(
  $$insert into public.cohorts (name, slug, cohort_level) values ('x', 'x', 'gold')$$,
  '23505',
  null,
  'a cohort level is used once: a second cohort cannot take a level already in use'
);

-- ---------------------------------------------------------------------------
-- Identity and assurance level
-- ---------------------------------------------------------------------------

-- One person must never end up with two accounts for the same address: their
-- orders and entitlements would be split across accounts they cannot both
-- reach, and both sign-ins would appear to work (note 05 §7.1).
select is(
  (select count(*)::int from (
     select lower(email) from auth.users where email is not null
     group by lower(email) having count(*) > 1
   ) dupes),
  0,
  'no email address is registered to more than one account'
);

select has_function('public', 'has_aal2', 'has_aal2() exists for RLS predicates');
select has_function('public', 'current_aal', 'current_aal() exists');

-- A session with no aal claim must be treated as aal1, never as verified.
select is(public.has_aal2(), false, 'a session without an aal claim is not treated as aal2');

-- ---------------------------------------------------------------------------
-- Permission lookup (note 06 §26)
-- ---------------------------------------------------------------------------

select has_function('public', 'my_permissions', 'my_permissions() exists');
select has_function('public', 'my_roles', 'my_roles() exists');

-- An operational role must be able to discover its OWN permissions without
-- being able to read the whole permission matrix, which needs roles.read.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000003';  -- support@

select cmp_ok(
  (select count(*)::int from public.my_permissions()), '>', 0,
  'a specialist role can read its own permissions'
);

select is(
  (select count(*)::int from public.role_permissions), 0,
  'the same role cannot read the full permission matrix'
);

reset role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000010';  -- gold@test.local

select cmp_ok(
  (select count(*)::int from public.entitlements), '>', 0,
  'a customer can read their own entitlements'
);
select is(
  (select count(*)::int from public.audit_logs), 0,
  'a customer cannot read the audit log'
);
select is(
  (select count(*)::int from public.order_claim_tokens), 0,
  'a customer cannot read order claim tokens'
);
select is(
  (select count(*)::int from public.blog_posts where status = 'draft'), 0,
  'draft blog posts are not publicly readable'
);
select cmp_ok(
  (select count(*)::int from public.lessons), '>', 0,
  'an entitled customer can read course lessons'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';  -- expired@test.local

select is(
  (select count(*)::int from public.lessons), 0,
  'a customer whose entitlement expired cannot read lessons'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';  -- nobody@test.local

select is(
  (select count(*)::int from public.lessons), 0,
  'a customer who bought nothing cannot read lessons'
);
select is(
  (select count(*)::int from public.entitlements), 0,
  'a customer cannot read another customer''s entitlements'
);

reset role;

-- ---------------------------------------------------------------------------
-- Booking operations (note 09 §29–§35)
-- ---------------------------------------------------------------------------

select has_function('public', 'book_group_session', 'book_group_session() exists');
select has_function('public', 'cancel_booking', 'cancel_booking() exists');

-- A customer holding only CONSUMABLE session credits must still be able to see
-- sessions to spend them on. Regression guard for the 0012 fix: before it, a
-- bundle purchase produced credits that were real and unusable.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000010';

select cmp_ok(
  (select count(*)::int from public.group_coaching_sessions), '>', 0,
  'a customer with session credits can see bookable sessions'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';

select is(
  (select count(*)::int from public.group_coaching_sessions), 0,
  'a customer with no live entitlement sees no sessions'
);

reset role;

-- ---------------------------------------------------------------------------
-- Privileged admin operations (note 06 §23.1, §25.1, §31)
-- ---------------------------------------------------------------------------

select has_function('public', 'admin_grant_entitlement', 'admin_grant_entitlement() exists');
select has_function('public', 'assert_admin_action', 'assert_admin_action() exists');

-- An owner WITHOUT a second factor holds no administrative power. This is the
-- database-level half of note 06 §25.1: a stolen aal1 session cannot grant
-- access even by calling the function directly.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000001';

select throws_ok(
  $$select public.admin_grant_entitlement(
      '00000000-0000-4000-a000-000000000011', 'course', null, 'no mfa')$$,
  '42501',
  null,
  'an owner without a second factor cannot grant an entitlement'
);

-- An OWNER at aal2 with fewer than two registered keys is refused before the
-- action is even considered (migration 0004_operations): an owner account cannot be
-- recovered by anyone else, so it must hold a spare.
set local request.jwt.claim.aal = 'aal2';

select throws_ok(
  $$select public.admin_grant_entitlement(
      '00000000-0000-4000-a000-000000000011', 'course', null, 'valid reason')$$,
  '42501',
  null,
  'an owner with only one key cannot perform a privileged action'
);

reset role;

-- An ADMIN is not subject to the spare-key rule — a lost admin key is a support
-- task, not a lockout. So this reaches the reason check, and a blank reason is
-- refused because an unexplained grant is indistinguishable from a mistake.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000002';
set local request.jwt.claim.aal = 'aal2';

select throws_ok(
  $$select public.admin_grant_entitlement(
      '00000000-0000-4000-a000-000000000011', 'course', null, '  ')$$,
  '23514',
  null,
  'a grant with a blank reason is refused'
);

reset role;

-- A customer with a fully verified session still holds no admin power.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000010';
set local request.jwt.claim.aal = 'aal2';

select throws_ok(
  $$select public.admin_grant_entitlement(
      '00000000-0000-4000-a000-000000000011', 'course', null, 'trying')$$,
  '42501',
  null,
  'a customer cannot grant entitlements even at aal2'
);

reset role;

-- Revoke and adjust (note 06 §23.1). Support may correct a quantity or an
-- expiry but never end access; an admin may end it, with a reason, and the
-- row is kept, marked revoked.
insert into public.entitlements
  (id, user_id, resource_type, source_type, status, quantity, expires_at, granted_by, grant_reason)
values
  ('00000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-000000000011', 'private_coaching',
   'admin_grant', 'active', 2, now() + interval '30 days', '00000000-0000-4000-a000-000000000002', 'test fixture');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000003';  -- support@
set local request.jwt.claim.aal = 'aal2';

select lives_ok(
  $$select public.admin_adjust_entitlement('00000000-0000-4000-a000-0000000000e1', 'one more session', 4)$$,
  'support can adjust an entitlement'
);

select throws_ok(
  $$select public.admin_revoke_entitlement('00000000-0000-4000-a000-0000000000e1', 'trying')$$,
  '42501',
  null,
  'support cannot revoke an entitlement'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000002';  -- admin@
set local request.jwt.claim.aal = 'aal2';

select throws_ok(
  $$select public.admin_revoke_entitlement('00000000-0000-4000-a000-0000000000e1', '  ')$$,
  '23514',
  null,
  'a revoke with a blank reason is refused'
);

select lives_ok(
  $$select public.admin_revoke_entitlement('00000000-0000-4000-a000-0000000000e1', 'granted to the wrong account')$$,
  'an admin can revoke an entitlement'
);

reset role;

select is(
  (select row(quantity, status::text) from public.entitlements where id = '00000000-0000-4000-a000-0000000000e1'),
  row(4, 'revoked'::text),
  'the adjusted quantity held, and the revoked entitlement is kept, marked revoked'
);

select is(
  (select array_agg(action order by created_at, action) from public.audit_logs
    where resource_id = '00000000-0000-4000-a000-0000000000e1'),
  array['entitlement_adjusted', 'entitlement_revoked']::text[],
  'the adjustment and the revoke are both audited'
);

-- ---------------------------------------------------------------------------
-- Email outbox and maintenance (note 09 §42, §44; note 08 §58)
-- ---------------------------------------------------------------------------

select has_table('public', 'email_messages', 'email outbox table exists');
select has_function('public', 'enqueue_email', 'enqueue_email() exists');

-- Queuing twice with the same key must not produce a second message: a
-- redelivered webhook cannot send a duplicate receipt (note 09 §56).
select isnt(
  (select public.enqueue_email('pgtap:dup', 'order_receipt', 'a@test.local')),
  null,
  'first enqueue returns a row id'
);

select is(
  (select public.enqueue_email('pgtap:dup', 'order_receipt', 'a@test.local')),
  null,
  'the same idempotency key does not queue a second message'
);

-- Expiry is a status transition, never a deletion — historical entitlement
-- records are required for reconciliation and support (note 07 §40).
select lives_ok(
  $$select public.expire_lapsed_entitlements()$$,
  'expiry job runs without deleting rows'
);

-- ---------------------------------------------------------------------------
-- Storage buckets (migration 0005_storage_contact_and_consent)
--
-- `public` is a per-BUCKET flag. Flipping one by accident exposes every object
-- in it at a guessable URL, with no error and no sign that anything changed —
-- so the flags are asserted rather than trusted to review.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from storage.buckets
    where id in ('avatars', 'site-media', 'course-assets', 'private-media')),
  4,
  'all four buckets exist'
);

select is(
  (select array_agg(id order by id) from storage.buckets where public),
  array['avatars', 'site-media'],
  'exactly the two marketing buckets are public'
);

-- Gated material must never be world-readable. If either of these becomes
-- public, every worksheet and document is downloadable by anyone who can guess
-- a path, and the entitlement check in front of them becomes decorative.
select is(
  (select bool_or(public) from storage.buckets
    where id in ('course-assets', 'private-media')),
  false,
  'course-assets and private-media are private'
);

-- A bucket with RLS enabled and no policy denies everything, which reads as a
-- broken feature rather than a security setting; the reverse is worse.
select isnt(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'),
  0,
  'storage.objects carries explicit policies'
);

-- ---------------------------------------------------------------------------
-- Function execute privileges (migration 0004_operations)
--
-- PostgreSQL grants EXECUTE to PUBLIC by default, and `revoke ... from anon`
-- does NOT remove a privilege inherited that way. These assertions exist
-- because that mistake was live: every SECURITY DEFINER function here was once
-- callable by anyone holding the anon key, which ships in the browser bundle.
--
-- They are written against `anon` specifically, because that is the role an
-- unauthenticated internet caller gets through PostgREST.
-- ---------------------------------------------------------------------------

-- Privileged operations. Each is called only by trusted server code holding the
-- service key, so an anonymous caller must not be able to reach it at all.
select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'enqueue_email', 'claim_email_batch', 'mark_email_sent',
        'mark_email_failed', 'fulfil_order', 'grant_entitlements_for_order',
        'expire_lapsed_entitlements', 'cleanup_expired_tokens',
        'orders_awaiting_reconciliation', 'assert_admin_action'
      )),
  false,
  'anon cannot execute any privileged function (no open relay, no free entitlements)'
);

-- The outbox in particular carries single-use guest-claim links, and those
-- links are credentials for somebody else's paid order (note 05 §29.3).
select is(
  (select has_function_privilege('anon', 'public.claim_email_batch(integer)', 'execute')),
  false,
  'anon cannot read the email outbox'
);

-- Session-derived operations need a session; anon has none.
select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_welcome', 'claim_order', 'book_group_session', 'cancel_booking',
        'my_permissions', 'my_roles', 'admin_set_role', 'admin_grant_entitlement',
        'admin_revoke_entitlement', 'admin_adjust_entitlement'
      )),
  false,
  'anon cannot execute any session-derived or admin operation'
);

-- The other half of the fix: over-revoking silently breaks the whole
-- application, because these are evaluated inside RLS policy expressions with
-- the privileges of the querying role.
select is(
  (select bool_and(has_function_privilege('anon', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'has_permission', 'has_role', 'is_staff', 'has_active_entitlement',
        'has_session_credits', 'requires_mfa', 'current_aal', 'has_aal2',
        'verified_factor_count', 'has_session_credits_for', 'holds_seat',
        'holds_intake', 'has_standing_cohort_access',
        -- 0012: called from the policies on resources, playlist_videos,
        -- member_qa_sessions and retreat_access.
        'has_member_benefit', 'can_view_playlist', 'has_retreat_access'
      )),
  true,
  'RLS predicate functions remain executable, so policies can still be evaluated'
);

-- Signed-in customers must keep the operations that are scoped to auth.uid().
select is(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_welcome', 'claim_order', 'book_group_session', 'cancel_booking',
        'my_permissions', 'my_roles'
      )),
  true,
  'authenticated keeps the operations scoped to its own session'
);

-- ---------------------------------------------------------------------------
-- Welcome (migration 0004_operations)
-- ---------------------------------------------------------------------------

select has_column('public', 'profiles', 'welcomed_at', 'profiles records the welcome');

-- The welcome must be sent once and only once, however many times sign-in
-- happens. claim_welcome() is what makes that true, not the calling code.
--
-- Asserted with an explicit context rather than the one left over from the
-- tests above: the first draft of this inherited gold@'s session and passed
-- only while that account happened to be already welcomed, so it reported
-- success on a state it had not established.
reset role;
update public.profiles
   set welcomed_at = null
 where user_id = '00000000-0000-4000-a000-000000000011';  -- nobody@test.local

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';

select is(
  (select public.claim_welcome()),
  true,
  'the first sign-in claims the welcome'
);

select is(
  (select public.claim_welcome()),
  false,
  'every later sign-in claims nothing, so the welcome cannot be sent twice'
);

-- No session, no claim: the function reads auth.uid() and takes no argument, so
-- there is no way to ask it to welcome somebody else.
reset role;
set local request.jwt.claim.sub = '';

select is(
  (select public.claim_welcome()),
  false,
  'claim_welcome does nothing without a session'
);

reset role;

-- ---------------------------------------------------------------------------
-- Contact form and rate limiting (note 09 §48)
-- ---------------------------------------------------------------------------

select has_table('public', 'contact_messages', 'contact_messages exists');
select has_table('public', 'rate_limits', 'rate_limits exists');

-- Both must be RLS-protected. contact_messages holds personal data submitted by
-- the public; rate_limits decides whether abuse is throttled, so a client able
-- to write it could lift its own limit.
select ok(
  (select relrowsecurity from pg_class where relname = 'contact_messages'),
  'contact_messages enforces row level security'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'rate_limits'),
  'rate_limits enforces row level security'
);

-- No INSERT policy on contact_messages, deliberately: submissions go through
-- the Server Action, which verifies Turnstile and the rate limit first. An
-- insert policy here would let a caller skip both via the public REST endpoint.
select is(
  (select count(*)::int from pg_policy p
     join pg_class c on c.oid = p.polrelid
    where c.relname = 'contact_messages' and p.polcmd = 'a'),
  0,
  'contact_messages has no client insert policy'
);

-- The limiter must actually refuse. Three allowed, the fourth blocked.
select ok(public.consume_rate_limit('pgtap:limiter', 3, 3600), 'first hit allowed');
select ok(public.consume_rate_limit('pgtap:limiter', 3, 3600), 'second hit allowed');
select ok(public.consume_rate_limit('pgtap:limiter', 3, 3600), 'third hit allowed');
select ok(
  not public.consume_rate_limit('pgtap:limiter', 3, 3600),
  'fourth hit refused once the limit is reached'
);

-- Separate keys must not share a budget, or one visitor could exhaust the
-- limit for everyone.
select ok(
  public.consume_rate_limit('pgtap:other', 3, 3600),
  'a different key has its own budget'
);

-- ---------------------------------------------------------------------------
-- Marketing consent (UK GDPR, PECR reg 22)
-- ---------------------------------------------------------------------------

select has_table('public', 'marketing_consents', 'marketing_consents exists');

select ok(
  (select relrowsecurity from pg_class where relname = 'marketing_consents'),
  'marketing_consents enforces row level security'
);

-- No client write policy: a consent record forged for somebody else's address
-- would be worse than no record at all, because it looks like evidence.
select is(
  (select count(*)::int from pg_policy p
     join pg_class c on c.oid = p.polrelid
    where c.relname = 'marketing_consents' and p.polcmd in ('a', 'w')),
  0,
  'marketing_consents has no client insert or update policy'
);

-- Re-subscribing must update the existing record, not stack duplicates, or the
-- evidence trail becomes ambiguous about which consent is current.
select public.record_marketing_consent(
  'pgtap-consent@test.local', 'newsletter_form', 'wording v1', '/', null
);
select public.record_marketing_consent(
  'pgtap-consent@test.local', 'newsletter_form', 'wording v2', '/', null
);
select is(
  (select count(*)::int from public.marketing_consents
    where email = 'pgtap-consent@test.local'),
  1,
  'a second opt-in updates the existing consent record'
);

-- Withdrawal must be recorded, not deleted: proving somebody opted out matters
-- as much as proving they opted in.
select is(public.withdraw_marketing_consent('pgtap-consent@test.local'), 1,
  'withdrawing consent marks one record');
select isnt(
  (select withdrawn_at from public.marketing_consents
    where email = 'pgtap-consent@test.local'),
  null,
  'withdrawal is recorded rather than removing the row'
);

-- Re-consenting after a withdrawal clears it: a fresh opt-in is valid consent.
select public.record_marketing_consent(
  'pgtap-consent@test.local', 'newsletter_form', 'wording v3', '/', null
);
select is(
  (select withdrawn_at from public.marketing_consents
    where email = 'pgtap-consent@test.local'),
  null,
  'a fresh opt-in clears a previous withdrawal'
);

-- ---------------------------------------------------------------------------
-- Blanket protection invariants
--
-- These replace "remember to enable RLS on the new table" with a test that
-- fails if anyone forgets. The table-count tripwire above notices that
-- SOMETHING changed; these two say what is actually wrong.
-- ---------------------------------------------------------------------------

-- Every base table in `public` must have RLS. No exceptions: a table without it
-- is readable by anyone holding the anon key, which is public by design.
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity),
  '',
  'every table in public enforces row level security'
);

-- Views are the gap RLS does not cover: a view runs with its OWNER's rights, so
-- it reads straight past the RLS on its underlying tables. `active_member_emails`
-- leaked every active member''s email address to anon before this was caught, so
-- no view in `public` may be readable by a client role unless deliberately made so.
select is(
  (select coalesce(string_agg(distinct c.relname, ', '), '')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and (has_table_privilege('anon', c.oid, 'SELECT')
           or has_table_privilege('authenticated', c.oid, 'SELECT'))),
  '',
  'no view in public is readable by anon or authenticated'
);

-- ---------------------------------------------------------------------------
-- Catalogue tags (R25, note 08 §28.2.1)
--
-- Tags curate; categories classify. The failure these guard against is silent:
-- ' films' and 'films' would become two collections that look identical in an
-- admin form, quietly splitting a curated section in half.
-- ---------------------------------------------------------------------------

insert into public.catalogue_items (category, title, slug, status, tags)
values ('films', 'Tag probe', 'tag-probe', 'draft',
        array['  give-get-go:documentaries  ', 'give-get-go:documentaries',
              '', '   ', 'films']);

select is(
  (select tags from public.catalogue_items where slug = 'tag-probe'),
  array['give-get-go:documentaries', 'films'],
  'catalogue tags are trimmed, de-duplicated and stripped of blanks on write'
);

-- A documentary is a film: it keeps its canonical category and is surfaced by
-- tag. If this ever returns a row whose category is not `films`, the eighth
-- category R25 rejected has crept back in.
select is(
  (select category from public.catalogue_items where slug = 'tag-probe'),
  'films'::public.catalogue_category,
  'a Give-Get-Go documentary is stored as a film, not an eighth category'
);

-- Asserts the OPERATOR works, not how many rows happen to carry the tag. The
-- previous version expected exactly one match, so it broke the moment real
-- catalogue content was added — testing the fixture rather than the behaviour.
select ok(
  (select exists (
     select 1 from public.catalogue_items
      where slug = 'tag-probe'
        and tags @> array['give-get-go:documentaries']
   )),
  'containment lookup finds an item by its curation tag'
);

-- And that containment does not match an item lacking the tag.
select ok(
  (select not exists (
     select 1 from public.catalogue_items
      where slug = 'tag-probe'
        and tags @> array['give-get-go:nonexistent']
   )),
  'containment does not match an absent tag'
);

select ok(
  (select indexdef like '%gin%'
     from pg_indexes
    where schemaname = 'public' and indexname = 'catalogue_items_tags_idx'),
  'catalogue tags are GIN-indexed, so containment lookups can use an index'
);

-- ---------------------------------------------------------------------------
-- Team members and public media paths
-- ---------------------------------------------------------------------------

select has_table('public', 'team_members', 'team_members exists');

-- A public page reads team photos, so the PATH of an object in a public bucket
-- must be readable anonymously — the objects themselves already are. Private
-- bucket paths must stay hidden: knowing the key of a gated worksheet is a
-- small but real leak, and reaching one still requires a signed URL.
set local role anon;
select ok(
  (select exists (select 1 from public.resources where storage_path like 'site-media/%')),
  'anon can read paths in a public bucket'
);
select is(
  (select count(*)::int from public.resources where storage_path like 'course-assets/%'),
  0,
  'anon cannot read paths in a private bucket'
);
reset role;

select has_table('public', 'testimonials', 'testimonials exists');

-- Testimonials are marketing copy on public pages, so published ones must be
-- readable anonymously while drafts stay hidden.
set local role anon;
select is(
  (select count(*)::int from public.testimonials where status <> 'published'),
  0,
  'anon sees no unpublished testimonial'
);
reset role;

-- ---------------------------------------------------------------------------
-- Membership delivery, playlists and packs (migration 0012)
-- ---------------------------------------------------------------------------

select has_table('public', 'playlists', 'playlists exists');
select has_table('public', 'playlist_videos', 'playlist_videos exists');
select has_table('public', 'member_qa_sessions', 'member_qa_sessions exists');
select has_table('public', 'membership_choices', 'membership_choices exists');
select has_table('public', 'retreat_batches', 'retreat_batches exists');

-- Reminder lists hold every attendee's email address and joining link: read by
-- the scheduled jobs with the service key, never from the browser.
select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute')
               or has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('session_reminders_due', 'passes_ending_due', 'event_reminders_due')),
  false,
  'reminder lists are not callable from the browser'
);

-- Server-only functions that take any email, key or order: callable from the
-- browser they would let anyone unsubscribe a stranger, lock someone out of a
-- form, or cancel a customer's held time. PUBLIC must be revoked too.
select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute')
               or has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('record_marketing_consent', 'withdraw_marketing_consent', 'consume_rate_limit',
                        'cleanup_rate_limits', 'release_private_coaching_hold', 'private_coaching_time_taken')),
  false,
  'server-only consent, rate-limit and hold functions are not callable from the browser'
);

-- These take a user id or a subscription id. Reachable from the browser, they
-- would let anyone read or rewrite another customer's membership.
select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute')
               or has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('membership_of', 'sync_membership_entitlements', 'apply_subscription_membership',
                        'register_user_for_run', 'place_on_open_run', 'run_seats_taken', 'schedule_series_run',
                        'registration_stands', 'coaching_runs_one_open', 'book_session_for', 'same_uk_time',
                        'coaching_runs_closes_default',
                        'enrol_user_in_intake', 'place_on_open_intake', 'intake_seats_taken',
                        'membership_series_used')),
  false,
  'membership functions that take somebody''s id are not callable from the browser'
);
select is(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('my_membership', 'my_series_allowance', 'choose_playlist', 'register_for_run',
                        'enrol_in_intake', 'coaching_sale_status')),
  true,
  'a signed-in customer keeps the membership operations scoped to their own session'
);

-- Fixtures for the rest of this section, all inside the test transaction.
-- nobody@test.local holds nothing, so what they end up with is what was granted.
create temp table t_m (k text primary key, id uuid);
grant select on t_m to authenticated, anon;  -- read below while acting as the member, and signed out
insert into t_m values ('user', '00000000-0000-4000-a000-000000000011');

with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ((select id from t_m where k = 'user'), 'pending', 'GBP', 2500, 0, 2500)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount)
  select o.id, p.id, pr.id, p.name, pr.amount, 1, pr.amount
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.active
  where p.slug = 'group-coaching-single-filmmaking'
  returning order_id
)
insert into t_m select 'single', order_id from i;
select public.fulfil_order((select id from t_m where k = 'single'), 'pi_test_single', 2500);

-- REGRESSION GUARD. Before 0012 this purchase wrote an entitlement to every
-- series, with no quantity and no end: £25 bought all of Group Coaching.
select results_eq(
  $$select e.resource_type::text, e.quantity, s.slug from public.entitlements e
      join public.group_coaching_series s on s.id = e.resource_id
     where e.source_id = (select id from t_m where k = 'single')$$,
  $$values ('group_coaching_session', 1, 'filmmaking')$$,
  'one session bought on a series is one session of THAT series, not access to every series'
);

with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ((select id from t_m where k = 'user'), 'pending', 'GBP', 16000, 0, 16000)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount)
  select o.id, p.id, pr.id, p.name, pr.amount, 1, pr.amount
  -- The one-off yearly price is retired from sale (content 12: a year now
  -- renews), but the fulfilment path for one is kept and still tested.
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.billing_type = 'one_time'
  where p.slug = 'membership-silver'
  returning order_id
)
insert into t_m select 'silver', order_id from i;
select public.fulfil_order((select id from t_m where k = 'silver'), 'pi_test_silver', 16000);

-- Series runs (migration 0016). Whatever the local database holds is set
-- aside; these are the only runs in the test.
update public.coaching_runs set status = 'draft';
insert into t_m select 'run_filmmaking', public.schedule_series_run(
  (select id from public.group_coaching_series where slug = 'filmmaking'), now() + interval '20 days', now() - interval '1 day');
insert into t_m select 'run_producing', public.schedule_series_run(
  (select id from public.group_coaching_series where slug = 'producing'), now() + interval '20 days', now() - interval '1 day', 8, 60, null, null, 1);
insert into t_m select 'run_started', public.schedule_series_run(
  (select id from public.group_coaching_series where slug = 'for-all-filmmakers'), now() + interval '20 days', now() - interval '30 days');
update public.coaching_runs set starts_at = now() - interval '7 days'
 where id = (select id from t_m where k = 'run_started');

-- A course the member already holds.
insert into public.entitlements (user_id, resource_type, resource_id, source_type, status)
select (select id from t_m where k = 'user'), 'course', c.id, 'promotion', 'active'
from public.courses c where c.slug = 'level-two';

-- A published video in a playlist the member will choose, and one in another.
insert into public.playlist_videos (playlist_id, title, video_provider, video_id, status)
select id, 'Test video — ' || slug, 'vimeo', '123456789', 'published'
from public.playlists where slug in ('writing', 'producing');

-- The retreat has no batch in this test, whatever the local database holds.
delete from public.retreat_batches
 where retreat_id = (select id from public.retreats where slug = 'virtual-retreat-level-1');
-- Cohort intakes (migration 0017). Whatever the local database holds is set
-- aside: Silver has no intake in this test, Gold has one open with one place.
update public.cohort_intakes set status = 'draft';
insert into public.cohort_intakes (cohort_id, label, registration_opens_at, starts_at, ends_at, capacity, status)
select id, 'Test intake', now() - interval '1 day', now() + interval '20 days', now() + interval '80 days', 1, 'published'
from public.cohorts where slug = 'cohort-gold';
insert into t_m select 'intake', id from public.cohort_intakes where label = 'Test intake';
insert into public.cohort_workshops (cohort_id, intake_id, title, starts_at, ends_at)
select i.cohort_id, i.id, 'Test intake workshop', i.starts_at, i.starts_at + interval '3 hours'
from public.cohort_intakes i where i.label = 'Test intake';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';

-- Note 09 §16.1: a member who paid once for a year has no subscription, and is
-- a member all the same — access is read from the entitlement.
select is(
  (select tier::text from public.my_membership()),
  'silver',
  'a one-year lump-sum purchase is a membership, with no subscription behind it'
);
-- A member takes a series by registering for a run of it, up to their tier's
-- number in each membership year (migration 0018). Silver's is one.
select results_eq(
  $$select allowance, used from public.my_series_allowance()$$,
  $$values (1, 0)$$,
  'a Silver member has one series a year, none of it used yet'
);
select is(
  public.register_for_run((select id from t_m where k = 'run_filmmaking'))->>'status',
  'ok',
  'a Silver member registers for a series run through their membership'
);
select is(
  (select count(*)::int from public.group_coaching_sessions s
    where s.run_id = (select id from t_m where k = 'run_filmmaking') and public.holds_seat(s.id)),
  8,
  'and has a seat in all eight sessions, with nothing to book'
);
select is(
  public.register_for_run((select id from t_m where k = 'run_producing'))->>'status',
  'limit_reached',
  'and cannot take a second series in the same membership year'
);
select is(
  public.choose_playlist((select id from public.playlists where slug = 'miscellaneous'))->>'status',
  'not_allowed',
  'a Silver member cannot choose a playlist reserved for Gold and above'
);
select is(
  public.choose_playlist((select id from public.playlists where slug = 'writing'))->>'status',
  'ok',
  'a Silver member chooses a playlist'
);
select is(
  (select array_agg(p.slug order by p.slug)
     from public.playlist_videos v join public.playlists p on p.id = v.playlist_id
    where v.title like 'Test video — %'),
  array['writing'],
  'a member reads the videos of the playlist they chose, and no other'
);
select is(
  public.has_member_benefit('qa'),
  false,
  'the Q&A is not part of Silver'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'retreat-level-1')),
  'unscheduled',
  'a retreat with no date cannot be bought'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'cohort-silver')),
  'unscheduled',
  'a cohort with no intake cannot be joined'
);
-- The cohort is fixed; the intake decides. Gold has one open.
select is(
  public.coaching_sale_status((select id from public.products where slug = 'cohort-gold')),
  'ok',
  'a cohort with an intake open for registration can be joined'
);
select is(
  (select count(*)::int from public.cohort_workshops where title = 'Test intake workshop'),
  0,
  'an intake''s workshops are hidden from someone who is not on it'
);
reset role;
with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ((select id from t_m where k = 'user'), 'pending', 'GBP', 69900, 0, 69900)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount)
  select o.id, p.id, pr.id, p.name, pr.amount, 1, pr.amount
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.active
  where p.slug = 'cohort-gold'
  returning order_id
)
insert into t_m select 'cohort', order_id from i;
select public.fulfil_order((select id from t_m where k = 'cohort'), 'pi_test_cohort', 69900);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';

select is(
  public.holds_intake((select id from t_m where k = 'intake')),
  true,
  'paying for a cohort puts the buyer on its open intake'
);
select is(
  (select count(*)::int from public.cohort_workshops where title = 'Test intake workshop'),
  1,
  'and they see that intake''s workshops'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'cohort-gold')),
  'owned',
  'a cohort they are on cannot be bought again while the intake runs'
);
-- This member bought one Filmmaking session above and has not used it.
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-single-filmmaking')),
  'unused',
  'another session of a series cannot be bought while one is still to be used'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-x8-producing')),
  'ok',
  'but sessions of another series can'
);
-- Producing is not theirs by membership (Filmmaking and Writing are chosen
-- above), so a Producing session can only be paid for with a Producing one.
select is(
  (select public.has_session_credits_for(s.id) from public.group_coaching_series s where s.slug = 'filmmaking'),
  true,
  'a session bought for Filmmaking opens Filmmaking''s sessions'
);
select is(
  (select public.has_session_credits_for(s.id) from public.group_coaching_series s where s.slug = 'producing'),
  false,
  'and not another series'''
);
-- A series is sold only while a run of it is open for registration. Since
-- 0022 the refusal says why: a run under way has started ('past'); a series
-- with no run at all has no dates ('unscheduled').
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-x8-for-all-filmmakers')),
  'past',
  'a series whose run has started cannot be bought'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-single-writing')),
  'unscheduled',
  'nor can a session of a series with no run open'
);
-- £130 is a place on the run: registered on paying, a seat in every session.
reset role;
with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ((select id from t_m where k = 'user'), 'pending', 'GBP', 13000, 0, 13000)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount)
  select o.id, p.id, pr.id, p.name, pr.amount, 1, pr.amount
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.active
  where p.slug = 'group-coaching-x8-producing'
  returning order_id
)
insert into t_m select 'series', order_id from i;
select public.fulfil_order((select id from t_m where k = 'series'), 'pi_test_series', 13000);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';

select is(
  (select count(*)::int from public.group_coaching_sessions s
    where s.run_id = (select id from t_m where k = 'run_producing') and public.holds_seat(s.id)),
  8,
  'buying a series registers the buyer for its run: a seat in all eight sessions'
);
select is(
  public.book_group_session((select s.id from public.group_coaching_sessions s
    where s.run_id = (select id from t_m where k = 'run_producing') order by s.starts_at limit 1))->>'status',
  'enrolled',
  'and there is nothing to book: the seat is already theirs'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-x8-producing')),
  'owned',
  'a series they are registered for cannot be bought again'
);
select is(
  public.run_places_left((select id from t_m where k = 'run_producing')),
  0,
  'the run of one place is now full'
);

select is(
  (select bool_and(public.coaching_sale_status(p.id) = 'owned')
     from public.entitlements e
     join public.courses c on c.id = e.resource_id
     join public.products p on p.id = c.product_id
    where e.user_id = auth.uid() and e.resource_type = 'course' and e.status = 'active'),
  true,
  'a course already held cannot be bought again'
);

reset role;

-- The retreat is for Platinum members paying by the year (owner, 2026-10-08): a
-- month costs less than one retreat place. expired@test.local holds nothing live.
insert into public.subscriptions
  (user_id, membership_tier, provider, provider_subscription_id, status, billing_interval, current_period_start, current_period_end)
values
  ('00000000-0000-4000-a000-000000000012', 'platinum', 'stripe', 'sub_test_platinum', 'active', 'month', now(), now() + interval '1 month');
select public.apply_subscription_membership((select id from public.subscriptions where provider_subscription_id = 'sub_test_platinum'));

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';
select is(public.has_member_benefit('retreats'), false, 'a monthly Platinum member does not get the retreat');
reset role;

update public.subscriptions
   set billing_interval = 'year', current_period_end = now() + interval '1 year'
 where provider_subscription_id = 'sub_test_platinum';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';
select is(
  public.has_retreat_access((select id from public.retreats where slug = 'virtual-retreat-level-1')),
  true,
  'a yearly Platinum member has a place at the open retreat level'
);

reset role;
set local role anon;
-- A signed-out caller carries no subject. Left set, `auth.uid()` would still
-- name the member above and this would test them, not anon.
set local request.jwt.claim.sub = '';

select cmp_ok(
  (select count(*)::int from public.playlists), '>', 0,
  'anon reads the published playlists (their names sell the membership)'
);
select is(
  (select count(*)::int from public.playlist_videos),
  0,
  'anon reads no playlist video'
);

reset role;

-- A place taken through a membership lasts the run (migration 0019). The Silver
-- member above paid for a year and registered for a run; their year now ends.
update public.entitlements set expires_at = now() - interval '1 day'
 where user_id = '00000000-0000-4000-a000-000000000011' and resource_type = 'membership';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
select is(
  (select count(*)::int from public.my_membership()),
  0,
  'the membership has ended'
);
select is(
  (select count(*)::int from public.group_coaching_sessions s
    where s.run_id = (select id from t_m where k = 'run_filmmaking') and public.holds_seat(s.id)),
  8,
  'and the seat in the run registered for while a member is kept to its end'
);
reset role;

-- Not so for a membership held as a subscription: a month's payment must not
-- buy a whole series.
update public.entitlements set source_type = 'membership'
 where user_id = '00000000-0000-4000-a000-000000000011' and resource_type = 'membership';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
select is(
  (select count(*)::int from public.group_coaching_sessions s
    where s.run_id = (select id from t_m where k = 'run_filmmaking') and public.holds_seat(s.id)),
  0,
  'a place taken through a subscription ends with the subscription'
);
reset role;

-- One run of a series takes registrations at a time (migration 0021).
select throws_like(
  $$select public.schedule_series_run(
      (select id from public.group_coaching_series where slug = 'filmmaking'),
      now() + interval '12 days', now() - interval '1 day', 8, 60, null, 'Test second run', null)$$,
  'run_already_open%',
  'a second run cannot be opened while the first is taking registrations'
);

-- ...but can once the first is full: the full one is closed to new people.
-- (The Producing run above has one place, and it is taken.)
select lives_ok(
  $$select public.schedule_series_run(
      (select id from public.group_coaching_series where slug = 'producing'),
      now() + interval '12 days', now() - interval '1 day', 8, 60, null, 'Test second run', null)$$,
  'a second run can be opened once the first is full'
);

-- Placement never asks. With no run of the series open, the place waits.
select is(
  public.place_on_open_run(
    '00000000-0000-4000-a000-000000000012',
    (select id from public.group_coaching_series where slug = 'writing')),
  'none_open',
  'with no run taking registrations, a paid place waits for the next'
);

-- One session is bought for a date (migration 0022): the seat is taken as the
-- order is fulfilled, with nothing to book afterwards.
insert into t_m
select 'dated_session', s.id from public.group_coaching_sessions s
 where s.run_id = (select id from t_m where k = 'run_filmmaking') order by s.starts_at offset 2 limit 1;

with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ('00000000-0000-4000-a000-000000000012', 'pending', 'GBP', 2500, 0, 2500)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount, metadata)
  select o.id, p.id, pr.id, p.name, pr.amount, 1, pr.amount,
         jsonb_build_object('session_id', (select id from t_m where k = 'dated_session'))
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.active
  where p.slug = 'group-coaching-single-filmmaking'
  returning order_id
)
insert into t_m select 'dated_order', order_id from i;
select public.fulfil_order((select id from t_m where k = 'dated_order'), 'pi_test_dated', 2500);

select is(
  (select count(*)::int from public.bookings b
    where b.user_id = '00000000-0000-4000-a000-000000000012'
      and b.bookable_type = 'group_coaching_session'
      and b.bookable_id = (select id from t_m where k = 'dated_session')
      and b.status = 'confirmed'),
  1,
  'a session bought for a date is booked as the order is fulfilled'
);
select is(
  (select count(*)::int from public.entitlements e
    where e.user_id = '00000000-0000-4000-a000-000000000012'
      and e.resource_type = 'group_coaching_session'
      and e.source_id = (select id from t_m where k = 'dated_order')
      and e.quantity_used < e.quantity),
  0,
  'and nothing is left over to book'
);

-- The series is sold first, single sessions after (migration 0024): none is
-- on sale until the run has started.
select is(
  (select count(*)::int from public.coming_sessions((select id from public.group_coaching_series where slug = 'filmmaking'))),
  0,
  'no single session is on sale while the series is still being sold'
);
select is(
  public.session_sale_status((select id from t_m where k = 'dated_session')),
  'unavailable',
  'and a session of a series that has not started cannot be bought'
);

-- Registration for the series closes AHEAD of its start (migration 0025): a
-- date set for the run. From then the series is not sold and its sessions are,
-- the first included.
select is(
  (select registration_closes_at = starts_at from public.coaching_runs where id = (select id from t_m where k = 'run_filmmaking')),
  true,
  'left empty, series registration closes when the series starts'
);
update public.coaching_runs set registration_closes_at = now() - interval '10 minutes'
 where id = (select id from t_m where k = 'run_filmmaking');
-- Asked as nobody in particular: it is about the run, not a person.
set local request.jwt.claim.sub = '';
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-x8-filmmaking')),
  'closed',
  'once its registration has closed, the series is no longer sold'
);
select is(
  (select count(*)::int from public.coming_sessions((select id from public.group_coaching_series where slug = 'filmmaking'))),
  8,
  'and every session of it, the first included, is sold singly'
);

set local role anon;
set local request.jwt.claim.sub = '';
select cmp_ok(
  (select count(*)::int from public.coming_sessions((select id from public.group_coaching_series where slug = 'filmmaking'))),
  '>', 0,
  'anon reads the sessions on sale (the dates sell the session)'
);
select is(
  public.session_sale_status((select id from t_m where k = 'dated_session')),
  'ok',
  'a coming session with a seat can be bought'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';
select is(
  public.session_sale_status((select id from t_m where k = 'dated_session')),
  'owned',
  'somebody with a seat in a session cannot buy it again'
);
reset role;

-- A weekly series keeps its UK time across a clock change (migration 0023).
select is(
  (select count(distinct to_char(public.same_uk_time('2026-10-23 16:00+00'::timestamptz, n) at time zone 'Europe/London', 'HH24:MI'))::int
     from generate_series(0, 7) n),
  1,
  'eight weekly sessions from 23 October all fall at the same UK time'
);

-- Coaching Pass holders register first (migration 0026): a run that opens to
-- everyone in three days is open to them now, seven days ahead by default.
reset role;
insert into t_m select 'run_early', public.schedule_series_run(
  (select id from public.group_coaching_series where slug = 'writing'), now() + interval '20 days', now() + interval '3 days');
select is(
  (select pass_opens_at = registration_opens_at - interval '7 days' from public.coaching_runs where id = (select id from t_m where k = 'run_early')),
  true,
  'left empty, pass holders can register seven days before registration opens to all'
);
select is(
  public.register_user_for_run('00000000-0000-4000-a000-000000000012', (select id from t_m where k = 'run_early')),
  'ok',
  'a pass holder registers ahead of the public opening'
);
select is(
  public.register_user_for_run('00000000-0000-4000-a000-000000000011', (select id from t_m where k = 'run_early')),
  'not_open',
  'somebody without a pass cannot, until it opens to everyone'
);
set local request.jwt.claim.sub = '';
select is(
  public.coaching_sale_status((select id from public.products where slug = 'group-coaching-x8-writing')),
  'closed',
  'and the series is not on sale during the pass holders'' window'
);

-- Moving up a pass for the difference (migration 0027): the SAME pass becomes
-- the higher tier, for the rest of its own year. A fresh Silver pass first.
reset role;
insert into public.entitlements (user_id, resource_type, resource_id, source_type, status, starts_at, expires_at)
select '00000000-0000-4000-a000-000000000011', 'membership', t.id, 'purchase', 'active', now() - interval '30 days', now() + interval '335 days'
from public.membership_tiers t where t.tier = 'silver';
insert into t_m select 'pass_before', e.id from public.entitlements e
 where e.user_id = '00000000-0000-4000-a000-000000000011' and e.resource_type = 'membership'
   and e.status = 'active' and e.expires_at > now() and e.source_type = 'purchase';

with o as (
  insert into public.orders (user_id, status, currency, subtotal, discount_total, total)
  values ('00000000-0000-4000-a000-000000000011', 'pending', 'GBP', 12000, 0, 12000)
  returning id
), i as (
  insert into public.order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount, metadata)
  select o.id, p.id, pr.id, 'Upgrade: Silver Pass to Gold Pass', 12000, 1, 12000,
         jsonb_build_object('upgrade_from', (select id from t_m where k = 'pass_before'))
  from o, public.products p join public.prices pr on pr.product_id = p.id and pr.active
  where p.slug = 'membership-gold'
  returning order_id
)
insert into t_m select 'upgrade_order', order_id from i;
select public.fulfil_order((select id from t_m where k = 'upgrade_order'), 'pi_test_upgrade', 12000);

select results_eq(
  $$select t.tier::text, (e.expires_at::date = (now() + interval '335 days')::date)
      from public.entitlements e join public.membership_tiers t on t.id = e.resource_id
     where e.id = (select id from t_m where k = 'pass_before')$$,
  $$values ('gold', true)$$,
  'an upgrade changes the tier of the same pass and leaves its end date alone'
);
select is(
  (select count(*)::int from public.entitlements e
    where e.user_id = '00000000-0000-4000-a000-000000000011' and e.resource_type = 'membership'
      and e.status = 'active' and e.expires_at > now()),
  1,
  'and adds no second pass'
);
select is(
  (select series_allowance from public.membership_of('00000000-0000-4000-a000-000000000011')),
  2,
  'the holder now has the higher pass''s series for the year'
);

-- ---------------------------------------------------------------------------
-- Retreat batches (migration 0030)
-- ---------------------------------------------------------------------------
reset role;
insert into public.retreat_batches (retreat_id, label, registration_opens_at, starts_at, ends_at, capacity, join_url, status)
select id, 'Test batch', now() - interval '1 day', now() + interval '30 days', now() + interval '31 days', 2,
       'https://example.test/secret-link', 'published'
  from public.retreats where slug = 'virtual-retreat-level-1';

set local role anon;
select is(
  (select count(*)::int from public.retreat_batches),
  0,
  'the public cannot read a retreat batch, so its joining link stays private'
);
select is(
  (select count(*)::int from public.retreat_batch_dates() where label = 'Test batch'),
  1,
  'the public can read a published batch''s dates'
);

reset role;
select is(
  public.place_on_open_retreat_batch(
    '00000000-0000-4000-a000-000000000011',
    (select id from public.retreats where slug = 'virtual-retreat-level-1')),
  'placed',
  'a buyer is placed on the retreat''s open batch'
);
select is(
  (select count(*)::int from public.retreat_places rp
     join public.retreat_batches b on b.id = rp.batch_id
    where b.label = 'Test batch' and rp.user_id = '00000000-0000-4000-a000-000000000011'),
  1,
  'the place is recorded on that batch'
);

select throws_ok(
  $$insert into public.retreats (name, slug, level) values ('Level One again', 'level-one-again-x', 1)$$,
  '23505',
  null,
  'a retreat level is used once: a second retreat cannot take a level already in use'
);

-- ---------------------------------------------------------------------------
-- Retreat applications, per batch (migration 0032)
-- ---------------------------------------------------------------------------
reset role;
insert into public.retreat_batches (retreat_id, label, registration_opens_at, starts_at, ends_at, capacity, status)
select id, 'Application test batch', now() - interval '1 day', now() + interval '40 days', now() + interval '41 days', 6, 'published'
  from public.retreats where slug = 'virtual-retreat-level-2';
-- Read before switching role: a customer cannot read a batch row directly.
select set_config('test.app_batch', (select id::text from public.retreat_batches where label = 'Application test batch'), true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
select is(
  public.apply_for_retreat(current_setting('test.app_batch')::uuid, 'My project'),
  'submitted',
  'a person can apply online for a by-interview retreat''s open batch'
);
select is(
  public.apply_for_retreat(current_setting('test.app_batch')::uuid, 'Again'),
  'submitted',
  'applying again for the same batch makes no second application'
);
select is(
  public.coaching_sale_status((select id from public.products where slug = 'retreat-level-2')),
  'application',
  'while the application awaits approval, the place cannot be bought'
);

reset role;
update public.retreat_applications set status = 'approved'
 where batch_id = (select id from public.retreat_batches where label = 'Application test batch');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
select is(
  public.coaching_sale_status((select id from public.products where slug = 'retreat-level-2')),
  'ok',
  'once approved for the batch, the place can be bought'
);
reset role;

-- ---------------------------------------------------------------------------
-- Media (owner, 2026-10-15)
-- ---------------------------------------------------------------------------

-- A tripwire: deleting a Media item deletes its file, and is refused while
-- anything uses it. What uses it is listed in src/lib/admin/media-usage.ts;
-- a new reference to `resources` fails this until it is added there too.
select is(
  (select count(*)::int from pg_constraint
    where contype = 'f' and confrelid = 'public.resources'::regclass),
  16,
  'every reference to resources is listed in media-usage.ts'
);

select throws_ok(
  $$insert into public.products (name, slug, product_type, status) values
      ('Name Clash Test', 'name-clash-a', 'other', 'active'),
      ('name clash test', 'name-clash-b', 'other', 'paused')$$,
  '23505',
  null,
  'two products on sale cannot share a name, whatever the capitals'
);

select is(
  (select array_agg(id order by id) from storage.buckets),
  array['avatars', 'course-assets', 'private-media', 'site-media']::text[],
  'storage has one public and one private bucket for media, plus avatars and course material'
);

-- ---------------------------------------------------------------------------
-- Lesson and module status (owner, 2026-10-15)
-- ---------------------------------------------------------------------------

-- A learner who holds the course, and a lesson in it to hide and show.
reset role;
-- Any account with no staff role: staff can read every lesson by design.
select set_config('test.learner', (select u.id::text from auth.users u
  where not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                    where ur.user_id = u.id and r.name <> 'customer')
  order by u.created_at limit 1), true);
select set_config('test.course', (select id::text from public.courses where slug = 'level-one'), true);
select set_config('test.lesson', (select l.id::text from public.lessons l join public.course_modules m on m.id = l.module_id
  join public.courses c on c.id = m.course_id where c.slug = 'level-one' order by l.position limit 1), true);
insert into public.entitlements (user_id, resource_type, resource_id, source_type)
values (current_setting('test.learner')::uuid, 'course', current_setting('test.course')::uuid, 'purchase');
update public.lessons set status = 'draft' where id = current_setting('test.lesson')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.learner'), true);
select is(
  (select count(*)::int from public.lessons where id = current_setting('test.lesson')::uuid),
  0,
  'a draft lesson is hidden from a learner who holds the course'
);
select ok(
  (select count(*) from public.lessons l join public.course_modules m on m.id = l.module_id
     where m.course_id = current_setting('test.course')::uuid) > 0,
  'the course''s published lessons are still shown'
);

reset role;
update public.lessons set status = 'published' where id = current_setting('test.lesson')::uuid;
update public.course_modules set status = 'draft'
 where id = (select module_id from public.lessons where id = current_setting('test.lesson')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.learner'), true);
select is(
  (select count(*)::int from public.lessons where id = current_setting('test.lesson')::uuid),
  0,
  'a published lesson in a draft module is hidden too'
);

-- An event someone holds a ticket for stays readable to them after it is
-- unpublished; to anyone else it is gone.
reset role;
select set_config('test.event', (select id::text from public.events order by created_at limit 1), true);
insert into public.bookings (user_id, bookable_type, bookable_id)
values (current_setting('test.learner')::uuid, 'event', current_setting('test.event')::uuid);
update public.events set status = 'draft' where id = current_setting('test.event')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.learner'), true);
select is(
  (select count(*)::int from public.events where id = current_setting('test.event')::uuid),
  1,
  'a ticket holder still sees an event that was unpublished'
);
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::int from public.events where id = current_setting('test.event')::uuid),
  0,
  'an unpublished event is hidden from the public'
);
reset role;

-- 0023: an authenticator app counts as a second step. Listed with its kind,
-- and an app code on this session satisfies the "confirmed recently" gate.
select set_config('test.app_user', gen_random_uuid()::text, true);
select set_config('test.app_session', gen_random_uuid()::text, true);
select set_config('test.app_factor', gen_random_uuid()::text, true);
insert into auth.users (id, email, aud, role)
values (current_setting('test.app_user')::uuid, 'app-user@test.local', 'authenticated', 'authenticated');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values (current_setting('test.app_session')::uuid, current_setting('test.app_user')::uuid, 'aal2', now(), now());
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (current_setting('test.app_factor')::uuid, current_setting('test.app_user')::uuid, 'My phone', 'totp', 'verified', now(), now(), 'x');
select set_config('request.jwt.claim.sub', current_setting('test.app_user'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.app_user'), 'aal', 'aal2', 'session_id', current_setting('test.app_session'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select kind from public.my_security_keys() where id = current_setting('test.app_factor')::uuid),
  'totp',
  'an authenticator app is listed with its kind'
);
select throws_ok(
  $$select public.authorise_security_key_removal(current_setting('test.app_factor')::uuid)$$,
  '42501', 'reauthentication required',
  'removing one without a recent second step asks for one'
);
reset role;
insert into auth.mfa_amr_claims (id, session_id, created_at, updated_at, authentication_method)
values (gen_random_uuid(), current_setting('test.app_session')::uuid, now(), now(), 'totp');
set local role authenticated;
select is(
  public.authorise_security_key_removal(current_setting('test.app_factor')::uuid) ->> 'kind',
  'totp',
  'an app code in the last 10 minutes passes the removal gate'
);
reset role;
select is(
  (select count(*)::int from public.email_messages
    where idempotency_key = 'security_key_removed:' || current_setting('test.app_factor')
      and payload ->> 'kind' = 'totp'),
  1,
  'the removal email says it was an authenticator app'
);
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

select * from finish();
rollback;
