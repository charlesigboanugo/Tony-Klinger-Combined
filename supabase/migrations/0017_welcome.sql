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

-- Existing accounts are treated as already welcomed. Without this, everybody
-- who already has an account would be shown a first-run page and emailed a
-- welcome the next time they signed in.
update public.profiles
   set welcomed_at = created_at
 where welcomed_at is null;

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
