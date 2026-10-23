-- =============================================================================
-- 0019 — The Academy viewer: a role that is not staff
-- =============================================================================
--
-- Owner, 2026-10-23. Tony may want people he works with to see how the Academy
-- looks, in full, without buying it and without any part of Admin. Note 06
-- §23.2.
--
-- Until now, holding ANY role made an account staff: `is_staff()` was "has a
-- row in user_roles", and the app read it the same way. Staff must keep a
-- security key, see Admin in their menu, and are read into a dozen staff-only
-- policies. None of that fits someone who only looks.
--
-- So a role now says whether it is staff (`roles.is_staff`, true for every role
-- that existed). `academy_viewer` is the first that is not: it holds only
-- `academy.view_all` (0018). Everything that asked "does this account hold a
-- role" now asks "does it hold a STAFF role":
--
--   is_staff()                       every staff-read policy, signed storage
--   admin_record_mfa_reset           a viewer's keys are cleared like a customer's
--   authorise_security_key_removal   a viewer keeps no minimum number of keys
--
-- A viewer gets recordings through their own policy below, since the
-- recordings a staff member sees come through "resources: staff read".
-- =============================================================================

alter table public.roles
  add column if not exists is_staff boolean not null default true;

comment on column public.roles.is_staff is
  'Holding this role makes an account staff: security key required, Admin offered, staff read policies apply. False for roles that only widen what a customer can see.';

insert into public.roles (name, description, is_staff) values
  ('academy_viewer', 'Sees everything in the Academy, view only. Not staff: no Admin, no security key required.', false)
on conflict (name) do update set is_staff = excluded.is_staff, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  join public.permissions p on p.name = 'academy.view_all'
 where r.name = 'academy_viewer'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Staff means a staff role
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid()
       and r.is_staff
  );
$$;

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
    bool_or(r.is_staff)
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

create or replace function public.authorise_security_key_removal(p_factor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_name text;
  v_email text;
  v_total integer;
  v_minimum integer := 0;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select f.friendly_name into v_name
    from auth.mfa_factors f
   where f.id = p_factor_id and f.user_id = v_uid and f.status = 'verified';
  if not found then
    raise exception 'key not found' using errcode = 'P0002';
  end if;

  /*
    A HIGHER LEVEL, AND RECENT. The session must have presented a key within
    the last 10 minutes — not merely at some point today. Otherwise anyone with
    a password and an unattended, signed-in laptop could strip the protection
    the key exists to provide. `mfa_amr_claims` is stamped each time a key is
    used on this session, including a re-confirmation.
  */
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (
       select 1 from auth.mfa_amr_claims c
        where c.session_id = v_session
          and c.authentication_method = 'mfa/webauthn'
          and c.updated_at > now() - interval '10 minutes'
     ) then
    raise exception 'reauthentication required' using errcode = '42501', hint = 'reauth';
  end if;

  /*
    THE STAFF MINIMUM. An owner keeps two keys (0004's rule for privileged
    actions); other staff keep one, since Admin cannot be reached without it.
    Customers, and holders of a role that is not staff (0019), may remove all
    of theirs — keys are optional for them.
  */
  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
     where ur.user_id = v_uid and r.name = 'owner'
  ) then
    v_minimum := 2;
  elsif exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
     where ur.user_id = v_uid and r.is_staff
  ) then
    v_minimum := 1;
  end if;

  select count(*) into v_total
    from auth.mfa_factors f
   where f.user_id = v_uid and f.status = 'verified';

  if v_total - 1 < v_minimum then
    raise exception 'this account must keep at least % security key%', v_minimum,
      case when v_minimum = 1 then '' else 's' end
      using errcode = '23514', hint = 'minimum';
  end if;

  insert into public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'security_key.removed', 'mfa_factor', p_factor_id::text,
          jsonb_build_object('name', v_name, 'self_service', true));

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is not null then
    perform public.enqueue_email(
      'security_key_removed:' || p_factor_id::text,
      'security_key_removed',
      v_email,
      jsonb_build_object('name', v_name, 'at', now())
    );
  end if;

  return jsonb_build_object('name', v_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Recordings in the staff view, for those who are not staff
-- ---------------------------------------------------------------------------

-- Only the recordings of what the Academy delivers: not every resource row,
-- which "resources: staff read" gives staff.
create policy "resources: academy staff view recording"
  on public.resources for select
  using (
    public.has_permission('academy.view_all')
    and (
      exists (select 1 from public.cohort_workshops w where w.recording_resource_id = resources.id)
      or exists (select 1 from public.group_coaching_sessions s where s.recording_resource_id = resources.id)
      or exists (select 1 from public.member_qa_sessions q where q.recording_resource_id = resources.id)
    )
  );
