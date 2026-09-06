-- 0014 — Two verified factors required for the owner role.
-- Architecture: note 05 §11.1, note 06 §25.1.
--
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

revoke all on function public.verified_factor_count() from anon;
grant execute on function public.verified_factor_count() to authenticated;
