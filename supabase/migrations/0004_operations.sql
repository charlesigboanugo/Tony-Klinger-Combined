-- 0004 — Privileged admin operations, the email outbox, scheduled maintenance, the welcome-once flag and function execute privileges.
--
-- Consolidated 2026-09-23 from migrations 0013, 0015, 0016, 0017, 0018, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- admin operations  (was migration 0013)
-- ===========================================================================

-- 0013 — Privileged administrative operations.
-- Architecture: note 06 §23.1, §25.1, §31, §32; note 07 §29.
--
-- Granting an entitlement hands a customer paid access without payment. It is
-- economically equivalent to giving away product, so the permission check, the
-- MFA requirement and the audit record all happen in ONE transaction with the
-- grant itself. Split across application calls, a failure could leave access
-- granted with no record of who did it.

/**
 * Assert that the caller may perform a privileged admin action.
 *
 * Both conditions matter: the permission, and that this session actually
 * presented a second factor (note 06 §25.1). A stolen aal1 session token holds
 * no administrative power even if it reaches the database directly.
 */
-- Access to /admin is gated on ONE verified factor: that is what proves the
-- session. The second key is lockout insurance, and refusing an operator entry
-- until they hold it inverts its purpose — it penalises them at exactly the
-- moment it is meant to protect them.
--
-- The owner is the exception. If an admin loses their key, an owner clears it:
-- a support task. If the owner loses their only key, nobody can help, because
-- aal2 is required by the RLS policies themselves — recovery means service-role
-- SQL against production (note 05 §11.1, break-glass).
--
-- So: one key to work; two keys before the unrecoverable account may perform a
-- privileged operation.

create or replace function public.verified_factor_count()
returns integer
language sql
stable
security definer
set search_path = auth, public
as $$
  select count(*)::integer
  from auth.mfa_factors
  where user_id = auth.uid()
    and status = 'verified';
$$;

comment on function public.verified_factor_count() is
  'Number of verified MFA factors for the calling user.';

revoke all on function public.verified_factor_count() from anon;
grant execute on function public.verified_factor_count() to authenticated;

create or replace function public.assert_admin_action(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.has_permission(p_permission) then
    raise exception 'missing permission: %', p_permission using errcode = '42501';
  end if;

  if not public.has_aal2() then
    raise exception 'second factor required' using errcode = '42501';
  end if;

  -- The owner account cannot be recovered by anyone else, so it must hold a
  -- spare key before it is allowed to act.
  if public.has_role('owner') and public.verified_factor_count() < 2 then
    raise exception 'owner accounts require two registered security keys'
      using errcode = '42501';
  end if;
end;
$$;

/** Grant an entitlement by hand. A reason is mandatory (note 06 §23.1). */
create or replace function public.admin_grant_entitlement(
  p_user_id uuid,
  p_resource_type public.entitlement_resource,
  p_resource_id uuid,
  p_reason text,
  p_quantity integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  perform public.assert_admin_action('entitlements.grant');

  if p_reason is null or length(trim(p_reason)) = 0 then
    -- A grant with no reason is indistinguishable from a mistake or an abuse
    -- of privilege, so it is refused rather than recorded as anonymous.
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  insert into public.entitlements
    (user_id, resource_type, resource_id, source_type, status,
     quantity, quantity_used, granted_by, grant_reason, expires_at)
  values
    (p_user_id, p_resource_type, p_resource_id, 'admin_grant', 'active',
     p_quantity, 0, v_actor, p_reason, p_expires_at)
  returning id into v_id;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'entitlement_granted', 'entitlement', v_id::text, p_reason,
     jsonb_build_object(
       'customer_id', p_user_id,
       'resource_type', p_resource_type,
       'resource_id', p_resource_id,
       'quantity', p_quantity
     ));

  return jsonb_build_object('status', 'ok', 'entitlement_id', v_id);
end;
$$;

/** Revoke an entitlement. History is kept — the row is ended, never deleted. */
create or replace function public.admin_revoke_entitlement(
  p_entitlement_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before record;
begin
  perform public.assert_admin_action('entitlements.revoke');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.entitlements where id = p_entitlement_id for update;
  if v_before is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Note 07 §40: historical entitlement records are retained for reporting,
  -- support and reconciliation. Revoking ends access; it does not erase it.
  update public.entitlements set status = 'revoked' where id = p_entitlement_id;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'entitlement_revoked', 'entitlement', p_entitlement_id::text, p_reason,
     jsonb_build_object('customer_id', v_before.user_id, 'previous_status', v_before.status));

  return jsonb_build_object('status', 'ok');
end;
$$;

/**
 * Adjust a consumable entitlement's remaining quantity or expiry.
 *
 * Deliberately a separate permission from grant and revoke: correcting a
 * quantity is the operation most likely to be delegated to support, and it
 * should not carry the power to create or destroy access (note 06 §23.1).
 */
create or replace function public.admin_adjust_entitlement(
  p_entitlement_id uuid,
  p_reason text,
  p_quantity integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before record;
begin
  perform public.assert_admin_action('entitlements.adjust');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.entitlements where id = p_entitlement_id for update;
  if v_before is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  update public.entitlements
     set quantity   = coalesce(p_quantity, quantity),
         expires_at = coalesce(p_expires_at, expires_at),
         status     = case
                        when status = 'consumed'
                         and coalesce(p_quantity, quantity) > quantity_used
                        then 'active'
                        else status
                      end
   where id = p_entitlement_id;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'entitlement_adjusted', 'entitlement', p_entitlement_id::text, p_reason,
     jsonb_build_object(
       'customer_id', v_before.user_id,
       'quantity_before', v_before.quantity,
       'quantity_after', coalesce(p_quantity, v_before.quantity),
       'expires_before', v_before.expires_at,
       'expires_after', coalesce(p_expires_at, v_before.expires_at)
     ));

  return jsonb_build_object('status', 'ok');
end;
$$;

/** Assign or remove a staff role. Owner-level only (note 06 §34). */
create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role_name text,
  p_grant boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id uuid;
begin
  perform public.assert_admin_action('roles.manage');

  select id into v_role_id from public.roles where name = p_role_name;
  if v_role_id is null then
    return jsonb_build_object('status', 'unknown_role');
  end if;

  -- An administrator must not be able to quietly make themselves owner
  -- (note 06 §34). Only an existing owner may confer the owner role.
  if p_role_name = 'owner' and not public.has_role('owner') then
    raise exception 'only an owner may grant the owner role' using errcode = '42501';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_role_id)
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role_id = v_role_id;
  end if;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, case when p_grant then 'role_granted' else 'role_revoked' end,
     'user', p_user_id::text, p_reason,
     jsonb_build_object('role', p_role_name));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_grant_entitlement(uuid, public.entitlement_resource, uuid, text, integer, timestamptz) from anon;
revoke all on function public.admin_revoke_entitlement(uuid, text) from anon;
revoke all on function public.admin_adjust_entitlement(uuid, text, integer, timestamptz) from anon;
revoke all on function public.admin_set_role(uuid, text, boolean, text) from anon;


-- ===========================================================================
-- email outbox  (was migration 0015)
-- ===========================================================================

-- 0015 — Email outbox.
-- Architecture: note 09 §42, §43, §47, §56; note 08 §53.
--
-- Email is not the source of truth for anything (note 09 §42): a booking exists
-- whether or not its confirmation was delivered. So sending is decoupled from
-- the business event that caused it.
--
-- The business transaction writes a ROW here and commits. Delivery happens
-- afterwards, and may fail and be retried without touching the order, booking
-- or entitlement that caused it. A provider outage delays receipts; it does not
-- roll back purchases.

create type public.email_status as enum ('pending', 'sent', 'failed', 'cancelled');

create table public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  -- Natural key for the event that caused this message. Unique, so replaying a
  -- webhook cannot send a second copy of the same receipt (note 09 §21, §56).
  idempotency_key text not null unique,
  template        text not null,
  to_email        text not null,
  to_name         text,
  -- Template variables. Never store secrets or full card data here (note 09 §48).
  payload         jsonb not null default '{}'::jsonb,
  status          public.email_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  -- Set once delivery succeeds; a provider message id for later correlation.
  provider_message_id text,
  sent_at         timestamptz,
  -- Retries back off; this is when the sender may next pick it up.
  next_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index email_messages_pending_idx
  on public.email_messages (next_attempt_at)
  where status = 'pending';

create index email_messages_to_email_idx on public.email_messages (to_email);

create trigger email_messages_set_updated_at
  before update on public.email_messages
  for each row execute function public.set_updated_at();

-- Customers do not read the outbox; staff with the communications permission do.
alter table public.email_messages enable row level security;

create policy "email_messages: staff read"
  on public.email_messages for select
  using (public.has_permission('emails.read'));

/**
 * Queue a message, ignoring duplicates.
 *
 * Returns the row id, or null when this idempotency key has already been
 * queued — which is the correct outcome for a redelivered webhook.
 */
create or replace function public.enqueue_email(
  p_idempotency_key text,
  p_template text,
  p_to_email text,
  p_payload jsonb default '{}'::jsonb,
  p_to_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_messages
    (idempotency_key, template, to_email, to_name, payload)
  values
    (p_idempotency_key, p_template, p_to_email, p_to_name, p_payload)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

/** Claim a batch for sending, so two concurrent runs cannot send the same message. */
create or replace function public.claim_email_batch(p_limit integer default 20)
returns setof public.email_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.email_messages m
     set attempts = m.attempts + 1,
         -- Held for a minute so a crashed run does not immediately re-send.
         next_attempt_at = now() + interval '1 minute'
   where m.id in (
     select id from public.email_messages
      where status = 'pending'
        and next_attempt_at <= now()
      order by created_at
      limit p_limit
      -- SKIP LOCKED lets two senders run side by side without either waiting
      -- or duplicating (note 08 §65).
      for update skip locked
   )
  returning m.*;
end;
$$;

create or replace function public.mark_email_sent(p_id uuid, p_provider_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_messages
     set status = 'sent', sent_at = now(), provider_message_id = p_provider_id,
         last_error = null
   where id = p_id;
$$;

/** Record a failure, backing off exponentially and giving up after 5 attempts. */
create or replace function public.mark_email_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_messages
     set status = (case when attempts >= 5 then 'failed' else 'pending' end)::public.email_status,
         last_error = left(p_error, 500),
         next_attempt_at = now() + (interval '5 minutes' * power(2, least(attempts, 5)))
   where id = p_id;
$$;

revoke all on function public.enqueue_email(text, text, text, jsonb, text) from anon, authenticated;
revoke all on function public.claim_email_batch(integer) from anon, authenticated;
revoke all on function public.mark_email_sent(uuid, text) from anon, authenticated;
revoke all on function public.mark_email_failed(uuid, text) from anon, authenticated;


-- ===========================================================================
-- maintenance jobs  (was migration 0016)
-- ===========================================================================

-- 0016 — Scheduled maintenance.
-- Architecture: note 08 §58; note 09 §44, §45, §46.
--
-- The never-delete list from note 08 §58 is honoured here in the only way that
-- really counts: these functions contain no DELETE against a paid order, a
-- payment, a subscription, an entitlement, a historical booking or an audit
-- row. Expiry is a STATUS TRANSITION.

/**
 * Move lapsed entitlements to 'expired'.
 *
 * A transition, never a deletion. Historical entitlement records are required
 * for reconciliation, support and reporting (note 07 §40, note 08 §55), and
 * they explain past orders long after access has ended.
 */
create or replace function public.expire_lapsed_entitlements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.entitlements
     set status = 'expired'
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return jsonb_build_object('expired', v_count);
end;
$$;

/**
 * Remove spent and lapsed one-time tokens.
 *
 * Safe to delete: a claim token is a credential, not a commercial record. The
 * ORDER it points at is never touched — an unclaimed paid order outlives every
 * token issued for it and can always have a new one minted (note 09 §45).
 */
create or replace function public.cleanup_expired_tokens()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.order_claim_tokens
   where (consumed_at is not null and consumed_at < now() - interval '30 days')
      or (consumed_at is null and expires_at < now() - interval '30 days');

  get diagnostics v_count = row_count;
  return jsonb_build_object('tokens_removed', v_count);
end;
$$;

/**
 * Orders that Stripe may consider paid but we do not.
 *
 * Does not fix anything by itself — it reports, so reconciliation can fetch the
 * authoritative state from Stripe and replay it (note 09 §46). Guessing an
 * order into 'paid' without asking the provider would be inventing a payment.
 */
create or replace function public.orders_awaiting_reconciliation(
  p_older_than interval default interval '15 minutes'
)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.orders
  where status = 'pending'
    and external_reference is not null
    and created_at < now() - p_older_than
  order by created_at
  limit 100;
$$;

revoke all on function public.expire_lapsed_entitlements() from anon, authenticated;
revoke all on function public.cleanup_expired_tokens() from anon, authenticated;
revoke all on function public.orders_awaiting_reconciliation(interval) from anon, authenticated;


-- ===========================================================================
-- welcome  (was migration 0017)
-- ===========================================================================

-- Welcome-once flag — note 05 §7.1, note 09 §42.
--
-- The platform offers four ways in (password, password-after-confirmation,
-- magic link, Google), and only ONE of them sends an email of its own. A person
-- joining through Google or a magic link would otherwise receive nothing at all
-- on creating an account, and see no acknowledgement that they had joined.
--
-- So the welcome is keyed to FIRST SUCCESSFUL SIGN-IN rather than to sign-up:
-- that is the one moment every route in passes through, whether or not a
-- confirmation step preceded it.

alter table public.profiles
  add column if not exists welcomed_at timestamptz;

comment on column public.profiles.welcomed_at is
  'First successful sign-in. Null means the welcome has not yet been shown or sent.';

/**
 * Claim the welcome for the calling user.
 *
 * Returns true for exactly ONE caller and false for every other, including
 * concurrent ones: the `welcomed_at is null` predicate is evaluated under the
 * row lock the UPDATE itself takes, so two simultaneous sign-ins (a magic link
 * opened twice, a double-submitted form) cannot both see a null and both send.
 *
 * The email is queued by the caller only when this returns true, which makes
 * the send at-most-once even before `enqueue_email`'s own idempotency key is
 * considered.
 */
create or replace function public.claim_welcome()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.profiles
     set welcomed_at = now()
   where user_id = auth.uid()
     and welcomed_at is null
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

-- Callable by a signed-in user: it can only ever affect that user's own row,
-- because the WHERE clause is auth.uid() and takes no argument.
grant execute on function public.claim_welcome() to authenticated;
revoke all on function public.claim_welcome() from anon;


-- ===========================================================================
-- function execute privileges  (was migration 0018)
-- ===========================================================================

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
