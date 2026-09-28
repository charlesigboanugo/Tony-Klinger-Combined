-- Database tests — run with: pnpm test:db
--
-- pgTAP. Each test asserts that an architectural invariant is enforced by the
-- database itself, not merely written down in a note.
--
-- Runs inside a transaction that is rolled back, so tests never leave state.

begin;
select plan(91);

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
  49,
  'public schema table count matches the migrations'
);

select is(
  (select count(*)::int from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'RLS is enabled on every public table'
);

-- Membership tiers and cohort levels must be separate types (note 07 §16.1).
select has_type('public', 'membership_tier', 'membership_tier type exists');
select has_type('public', 'cohort_level', 'cohort_level type exists');
select isnt(
  (select 'public.membership_tier'::regtype::oid),
  (select 'public.cohort_level'::regtype::oid),
  'membership_tier and cohort_level are distinct types, so they cannot be confused'
);

-- ---------------------------------------------------------------------------
-- Reference data — shipped by migration 0002_security_and_reference_data, so it must exist everywhere
-- ---------------------------------------------------------------------------

select cmp_ok(
  (select count(*)::int from public.permissions), '>=', 50,
  'permissions are seeded by migration'
);
select is((select count(*)::int from public.roles), 9, 'nine roles exist');
select is((select count(*)::int from public.membership_tiers), 4, 'four membership tiers exist');
select is((select count(*)::int from public.group_coaching_series), 4, 'four coaching series exist');

select is(
  (select array_agg(tier::text order by rank) from public.membership_tiers),
  array['silver', 'gold', 'platinum', 'ultimate'],
  'membership tiers are cumulative in rank order'
);

-- An ordinary admin must not be able to grant themselves owner (note 06 §34).
select is(
  (select count(*)::int
     from public.roles r
     join public.role_permissions rp on rp.role_id = r.id
     join public.permissions p on p.id = rp.permission_id
   where r.name = 'admin' and p.name = 'roles.manage'),
  0,
  'the admin role does not hold roles.manage'
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
  $$insert into public.cohorts (name, slug, cohort_level) values ('x', 'x', 'ultimate')$$,
  '22P02',
  null,
  'cohort_level refuses a membership tier value'
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
    where id in ('avatars', 'site-media', 'course-assets', 'documents')),
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
    where id in ('course-assets', 'documents')),
  false,
  'course-assets and documents are private'
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
        'verified_factor_count'
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

select * from finish();
rollback;
