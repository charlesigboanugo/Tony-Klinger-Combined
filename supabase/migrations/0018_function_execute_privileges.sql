-- Close the function-execute hole — note 05 §15, note 06 §2, note 08 §65.
--
-- THE PROBLEM
--
-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default. The
-- earlier migrations tried to withdraw that with
--
--     revoke all on function public.enqueue_email(...) from anon, authenticated;
--
-- which does nothing at all. Neither role ever held a DIRECT grant; both
-- inherit the privilege through PUBLIC, and revoking from a role does not
-- remove what it inherits. Every SECURITY DEFINER function in this schema was
-- therefore callable over PostgREST by anyone holding the anon key — a key that
-- ships in the browser bundle and is not a secret.
--
-- Verified against the local stack before writing this: an anonymous caller
-- could POST /rest/v1/rpc/enqueue_email and queue mail to any address (an open
-- relay sending from our verified sender), then POST
-- /rest/v1/rpc/claim_email_batch and read the outbox back — which carries
-- single-use guest-claim links, and those links ARE credentials for somebody
-- else's paid order (note 05 §29.3). `fulfil_order` was equally exposed, which
-- grants entitlements with no payment, as were the maintenance jobs that expire
-- everyone's access.
--
-- THE FIX
--
-- Revoke from PUBLIC — the grant that actually exists — and then hand execute
-- back deliberately, per function, to the narrowest role that needs it.

-- Start from a clean slate: no function in this schema is callable by default.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end $$;

-- And for anything added later, so this cannot silently regress.
alter default privileges in schema public revoke execute on functions from public;

/**
 * Grant execute back, deliberately.
 *
 * Driven by function NAME rather than by a written-out signature: a hardcoded
 * signature silently fails the whole migration when an argument type differs
 * (has_active_entitlement takes an enum, not text), and would quietly miss a
 * future overload. Every overload of a named function gets the same grant.
 */
do $$
declare
  fn record;

  -- 1. RLS PREDICATES — anon and authenticated.
  --
  -- Evaluated inside policy expressions, which run with the privileges of the
  -- querying role. Without execute here every policy referencing them raises
  -- "permission denied for function" and the application stops reading, so this
  -- grant is load-bearing rather than convenience.
  --
  -- Safe to expose: each is scoped to auth.uid() and answers only a yes/no
  -- question about the caller's own access. None takes an instruction.
  predicates text[] := array[
    'has_permission', 'has_role', 'is_staff', 'has_active_entitlement',
    'has_session_credits', 'requires_mfa', 'current_aal', 'has_aal2',
    'verified_factor_count'
  ];

  -- 2. USER AND ADMIN OPERATIONS — authenticated only.
  --
  -- Each derives the actor from auth.uid() rather than from an argument, so a
  -- signed-in caller can only act on their own behalf. Not granted to anon:
  -- every one is meaningless without a session.
  --
  -- The admin_* entries must be reachable by a signed-in staff session because
  -- each calls assert_admin_action(), which reads auth.uid() to check the
  -- permission and the aal2 requirement (note 06 §2). The grant is therefore
  -- not the control — assert_admin_action is. A customer calling these gets the
  -- same refusal as an anonymous one.
  operations text[] := array[
    'my_permissions', 'my_roles', 'claim_welcome', 'claim_order',
    'book_group_session', 'cancel_booking',
    'admin_grant_entitlement', 'admin_revoke_entitlement',
    'admin_adjust_entitlement', 'admin_set_role'
  ];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    if fn.proname = any (predicates) then
      execute format('grant execute on function %s to anon, authenticated', fn.signature);
    elsif fn.proname = any (operations) then
      execute format('grant execute on function %s to authenticated', fn.signature);
    end if;
  end loop;
end $$;

/**
 * EVERYTHING ELSE — service role only, by omission.
 *
 * fulfil_order, grant_entitlements_for_order, enqueue_email, claim_email_batch,
 * mark_email_sent, mark_email_failed, expire_lapsed_entitlements,
 * cleanup_expired_tokens, orders_awaiting_reconciliation and
 * assert_admin_action are deliberately granted to NOBODY here. They are called
 * only by trusted server code holding the service key — the Stripe webhook, the
 * cron jobs and the outbox dispatcher — and service_role holds its own grants.
 *
 * The trigger functions (handle_new_user, set_updated_at) need no grant either:
 * PostgreSQL checks EXECUTE on a trigger function when the trigger is CREATED,
 * not each time it fires.
 */
