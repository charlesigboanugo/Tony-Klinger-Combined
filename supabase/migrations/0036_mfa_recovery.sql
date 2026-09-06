-- Clearing somebody's security keys, when they have lost them.
--
-- WHY THIS BECAME NECESSARY. Until now a second factor was demanded only of
-- staff, so a customer could never be locked out by one. Now that anyone who
-- registers a key is asked for it at sign-in (note 05 §11.1), a customer who
-- loses their only key cannot reach their account at all — and note 05 already
-- says recovery is "an administrative operation performed by another authorized
-- person", which described a control that did not exist.
--
-- WHO MAY CLEAR WHOSE KEYS. Note 05 §11.1 sets the rule; this puts it in the
-- database rather than only in the interface:
--
--   customer's keys   -> anyone holding users.reset_mfa
--   staff member's    -> an OWNER only. Staff keys guard the admin area, so
--                        clearing them is an access decision, not support work.
--   an owner's        -> REFUSED. Nobody can rescue an owner from inside the
--                        application; aal2 is required by the RLS policies
--                        themselves, so this is deliberately service-role SQL
--                        against production and nothing less.
--
-- The last rule is also what stops this becoming an escalation path: an admin
-- who could strip the owner's keys could lock the one account that can undo
-- anything they do.

insert into public.permissions (name, description) values
  ('users.reset_mfa', 'Clear a user''s security keys so they can register again')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where r.name in ('owner', 'admin')
   and p.name = 'users.reset_mfa'
on conflict do nothing;

/**
 * Authorize and record a security-key reset — note 05 §11.1, note 06 §31.
 *
 * Called BEFORE the keys are removed, so a refusal happens while there is still
 * something to refuse. The removal itself is a GoTrue admin call and cannot
 * happen in SQL, which is exactly why the decision is made here: the rule about
 * who may clear whose keys must not live only in a Server Action.
 */
create or replace function public.admin_record_mfa_reset(
  p_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_is_owner boolean;
  v_target_is_staff boolean;
begin
  perform public.assert_admin_action('users.reset_mfa');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  if p_user_id = v_actor then
    -- Otherwise the second factor is optional for anyone who can reach this:
    -- hold the permission, clear your own keys, and the requirement is gone.
    raise exception 'you cannot clear your own keys' using errcode = '42501';
  end if;

  select
    bool_or(r.name = 'owner'),
    count(*) > 0
    into v_target_is_owner, v_target_is_staff
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.user_id = p_user_id;

  if coalesce(v_target_is_owner, false) then
    raise exception 'an owner account cannot be recovered from inside the application'
      using errcode = '42501';
  end if;

  if coalesce(v_target_is_staff, false) and not public.has_role('owner') then
    raise exception 'only an owner may clear a staff member''s keys'
      using errcode = '42501';
  end if;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'mfa_reset', 'user', p_user_id::text, p_reason,
     jsonb_build_object('staff', coalesce(v_target_is_staff, false)));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_record_mfa_reset(uuid, text) from anon;
grant execute on function public.admin_record_mfa_reset(uuid, text) to authenticated;
