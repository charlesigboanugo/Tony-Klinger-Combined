-- =============================================================================
-- 0023 — Authenticator apps as a second step, beside security keys
-- =============================================================================
--
-- Owner, 2026-10-24. Hosted Supabase refuses WebAuthn MFA: the Management API
-- answers "Enabling of MFA with WebAuthn not currently supported", so staff on
-- the test site (and production) could not register a key and could not reach
-- Admin. An authenticator app (TOTP) is allowed there, and Supabase raises a
-- session to aal2 for either kind — so every rule that asks for aal2 (0002,
-- 0004, 0007, 0010, 0019) already accepts it unchanged.
--
-- What does change is the two functions that named WebAuthn outright:
--
--   my_security_keys               listed webauthn factors only; now every
--                                  verified factor, with its `kind`
--   authorise_security_key_removal "used a key in the last 10 minutes" only
--                                  counted `mfa/webauthn`; an app code (amr
--                                  method `totp`) now counts too
--
-- The staff minimum counts both kinds, as it always counted every factor.
-- note 05 §11.1.
-- =============================================================================

-- The return type gains a column, which `create or replace` cannot do.
drop function if exists public.my_security_keys();

create function public.my_security_keys()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  last_used_at timestamptz,
  aaguid uuid,
  -- 'webauthn' (a security key) or 'totp' (an authenticator app)
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.friendly_name, f.created_at, f.last_challenged_at, f.web_authn_aaguid, f.factor_type::text
    from auth.mfa_factors f
   where f.user_id = auth.uid()
     and f.status = 'verified'
     and f.factor_type in ('webauthn', 'totp')
   order by f.created_at;
$$;

revoke all on function public.my_security_keys() from public, anon;
grant execute on function public.my_security_keys() to authenticated;

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
  v_kind text;
  v_email text;
  v_total integer;
  v_minimum integer := 0;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select f.friendly_name, f.factor_type::text into v_name, v_kind
    from auth.mfa_factors f
   where f.id = p_factor_id and f.user_id = v_uid and f.status = 'verified';
  if not found then
    raise exception 'key not found' using errcode = 'P0002';
  end if;

  /*
    A HIGHER LEVEL, AND RECENT. The session must have confirmed with a key or
    an app code within the last 10 minutes — not merely at some point today.
    Otherwise anyone with a password and an unattended, signed-in laptop could
    strip the protection the second step exists to provide. `mfa_amr_claims` is
    stamped each time one is used on this session, including a re-confirmation.
  */
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (
       select 1 from auth.mfa_amr_claims c
        where c.session_id = v_session
          and c.authentication_method in ('mfa/webauthn', 'totp')
          and c.updated_at > now() - interval '10 minutes'
     ) then
    raise exception 'reauthentication required' using errcode = '42501', hint = 'reauth';
  end if;

  /*
    THE STAFF MINIMUM. An owner keeps two (0004's rule for privileged
    actions); other staff keep one, since Admin cannot be reached without it.
    Customers, and holders of a role that is not staff (0019), may remove all
    of theirs — the second step is optional for them.
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
    raise exception 'this account must keep at least % verification method(s)', v_minimum
      using errcode = '23514', hint = 'minimum';
  end if;

  insert into public.audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
  values (v_uid, 'security_key.removed', 'mfa_factor', p_factor_id::text,
          jsonb_build_object('name', v_name, 'kind', v_kind, 'self_service', true));

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is not null then
    perform public.enqueue_email(
      'security_key_removed:' || p_factor_id::text,
      'security_key_removed',
      v_email,
      jsonb_build_object('name', v_name, 'kind', v_kind, 'at', now())
    );
  end if;

  return jsonb_build_object('name', v_name, 'kind', v_kind);
end;
$$;

-- Shown beside the role in Admin's role picker.
update public.roles
   set description = 'Sees everything in the Academy, view only. Not staff: no Admin, no two-step verification required.'
 where name = 'academy_viewer';
