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
