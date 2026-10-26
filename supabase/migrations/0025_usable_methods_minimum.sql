-- =============================================================================
-- 0025 — The verification-method minimum counts only methods that can sign in
-- =============================================================================
--
-- Owner, 2026-10-26. Where security keys are switched off (SECURITY_KEYS, and
-- on hosted Supabase, which refuses them), a key on an account cannot be used
-- to sign in. The staff minimum still counted it, so a staff member holding an
-- authenticator app and a key could remove the app, keep the useless key, and
-- be locked out of Admin at their next sign-in.
--
-- `authorise_security_key_removal` gains `p_keys_usable` (the site passes its
-- setting). With keys unusable, only authenticator apps count towards the
-- minimum, and removing a key is always allowed. With keys usable (the
-- default, so any other caller keeps the old rule) nothing changes.
-- note 05 §11.1.
-- =============================================================================

-- The argument list changes, which `create or replace` cannot do.
drop function if exists public.authorise_security_key_removal(uuid);

create function public.authorise_security_key_removal(
  p_factor_id uuid,
  -- Whether security keys can be used to sign in on this site (the site's
  -- SECURITY_KEYS setting, which the database cannot see).
  p_keys_usable boolean default true
)
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

  /*
    ONLY METHODS THAT CAN SIGN IN COUNT (owner, 2026-10-26). Where keys are
    switched off a key cannot be challenged, so it protects nothing: it can
    always be removed, and it does not count towards the minimum. Counting it
    let a staff member remove their last authenticator app, keep an unusable
    key, and be locked out of Admin at their next sign-in.
  */
  if not p_keys_usable and v_kind = 'webauthn' then
    v_minimum := 0;
  end if;

  select count(*) into v_total
    from auth.mfa_factors f
   where f.user_id = v_uid and f.status = 'verified'
     and (p_keys_usable or f.factor_type = 'totp');

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

revoke all on function public.authorise_security_key_removal(uuid, boolean) from public, anon;
grant execute on function public.authorise_security_key_removal(uuid, boolean) to authenticated;
