-- Inviting a person to hold an account, and recording who did it.
--
-- Note 06 §14 lists viewing and searching users but no way to CREATE one, so
-- an administrator could grant a role only to somebody who had already signed
-- up for themselves. Staff are exactly the people who never do that: nobody
-- signs up as a customer in order to be given the support role.
--
-- INVITATION, NOT ACCOUNT CREATION WITH A PASSWORD.
--
-- An administrator who types someone's first password knows their credential,
-- so the account is no longer provably that person's — and note 05 §11.1 spends
-- its effort on exactly that property. An invitation instead proves control of
-- the mailbox and lets the invitee set their own secret, which is also the only
-- version an audit trail can honestly describe.
--
-- WHY A NEW PERMISSION rather than reusing `users.update`. Creating an account
-- is not editing one: it adds a principal to the system, and the account can
-- then be given roles. Note 06 §33 asks for least privilege, and rolling it
-- into `users.update` would silently hand it to every role that can correct a
-- customer's name.

insert into public.permissions (name, description) values
  ('users.invite', 'Invite a new user by email')
on conflict (name) do nothing;

-- Owner and admin only. Note the earlier blanket grant in 0005 assigns owner
-- every permission that EXISTED THEN — a permission added later is not covered
-- by it, so it must be granted here explicitly or the owner would not hold it.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where r.name in ('owner', 'admin')
   and p.name = 'users.invite'
on conflict do nothing;

/**
 * Record that an invitation was sent — note 06 §13, §31.
 *
 * The invitation itself is a GoTrue admin call and cannot happen in SQL, so
 * this is deliberately NARROW: it takes no action name and no resource type,
 * and can therefore only ever write the one entry it is named for. A general
 * "log anything" function that let the caller choose the permission it checks
 * would let anyone holding any permission forge entries about anything.
 *
 * It re-checks `users.invite` and the second factor in the database, so the
 * audit row cannot be written by a caller who could not have performed the
 * invitation (note 06 §2 — the application check is never the only one).
 */
create or replace function public.admin_record_user_invite(
  p_user_id uuid,
  p_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  perform public.assert_admin_action('users.invite');

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  insert into public.audit_logs
    (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values
    (v_actor, 'user_invited', 'user', p_user_id::text, p_reason,
     jsonb_build_object('email', p_email));

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_record_user_invite(uuid, text, text) from anon;
grant execute on function public.admin_record_user_invite(uuid, text, text) to authenticated;
