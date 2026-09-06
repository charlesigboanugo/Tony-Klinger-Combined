-- 0006 — Assurance level helpers for staff MFA.
-- Architecture: note 05 §11.1, note 06 §25.1.
--
-- Supabase records how strongly a session is authenticated in the `aal` claim:
--   aal1  password / magic link / OAuth only
--   aal2  a WebAuthn factor was also verified
--
-- Staff permissions require aal2. Enforcing it here rather than only in the
-- application means a stolen aal1 token cannot reach the row even if it reaches
-- the query.

create or replace function public.current_aal()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'),
    'aal1'
  );
$$;

create or replace function public.has_aal2()
returns boolean
language sql
stable
as $$
  select public.current_aal() = 'aal2';
$$;

-- Whether this user is required to hold a second factor. Staff are; customers
-- are not (note 05 §11.1).
create or replace function public.requires_mfa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff();
$$;

comment on function public.has_aal2() is
  'True when the current session has verified a WebAuthn factor. Staff-facing RLS predicates require this once MFA enrolment ships (note 06 §25.1).';

-- The audit log is tightened now, because nothing reads it yet and it is the
-- record that must survive a compromised staff session.
--
-- The remaining staff predicates switch to requiring aal2 in the same change
-- that ships WebAuthn enrolment. Tightening them before an operator can enrol
-- would lock every administrator out of an area they cannot yet get a factor
-- for — a self-inflicted outage, not security.
drop policy if exists "audit_logs: staff read" on public.audit_logs;

create policy "audit_logs: staff read"
  on public.audit_logs for select
  using (public.has_permission('audit.read') and public.has_aal2());
