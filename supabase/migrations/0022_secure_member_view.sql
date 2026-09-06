-- SECURITY FIX: public.active_member_emails leaked member email addresses.
--
-- A Postgres view runs with the privileges of its OWNER, not its caller, unless
-- told otherwise. `active_member_emails` selects from `subscriptions` and
-- `auth.users` — both RLS-protected — but the view itself has no RLS and, being
-- owned by postgres, read straight past theirs.
--
-- Supabase additionally grants SELECT on public objects to `anon` and
-- `authenticated`. The anon key is public by design, so the combination made
-- every active member's email address readable by anybody:
--
--   curl .../rest/v1/active_member_emails -H "apikey: <anon>"
--   [{"email":"gold@test.local","membership_tier":"gold"}]
--
-- Verified before and after this migration.
--
-- THE FIX IS THE REVOKE, not security_invoker.
--
-- security_invoker = true was tried first and is wrong here: it makes the view
-- run as the caller, and `service_role` has no SELECT on `auth.users`, so the
-- audience sync — the view's only legitimate reader — was denied along with
-- everybody else. Granting service_role access to auth.users to work around
-- that would widen a far more sensitive surface than the one being closed.
--
-- Owner rights are therefore kept, and ACCESS IS CONTROLLED BY THE GRANT: with
-- anon and authenticated revoked, no client role can reach the view at all,
-- whatever the underlying RLS would have said. service_role retains its grant
-- and continues to work.
--
-- Verified both ways: anon now gets "permission denied for view", the service
-- role still reads it.

revoke all on public.active_member_emails from anon, authenticated;

comment on view public.active_member_emails is
  'Members list source for the Brevo audience sync. SERVICE ROLE ONLY: it exposes '
  'email addresses across all users and must never be granted to a client role.';
