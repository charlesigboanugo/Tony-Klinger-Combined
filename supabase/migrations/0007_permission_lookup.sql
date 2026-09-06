-- 0007 — Caller permission lookup.
-- Architecture: note 06 §26 (centralized authorization helpers).
--
-- The application needs the current user's effective permissions in one call.
-- It cannot simply query role_permissions: reading that table requires
-- `roles.read`, which most operational roles do not hold. A course manager must
-- be able to discover that they hold `courses.update` without also being able
-- to read the entire permission matrix.
--
-- SECURITY DEFINER resolves that: the function reads the join on the caller's
-- behalf and returns only their own permissions, never anyone else's.

create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.name
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

create or replace function public.my_roles()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

comment on function public.my_permissions() is
  'Effective permission names for the calling user. Scoped to auth.uid(); cannot be used to inspect another account.';

revoke all on function public.my_permissions() from anon;
revoke all on function public.my_roles() from anon;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.my_roles() to authenticated;
