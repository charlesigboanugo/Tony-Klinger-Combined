-- 0012 — Session visibility for credit holders.
--
-- Bug: the policy added in 0004 let a customer read scheduled sessions only if
-- they held a `group_coaching_series` entitlement. But note 07 §14 allows
-- buying an individual session or an eight-session bundle, which produces a
-- CONSUMABLE `group_coaching_session` entitlement and no series entitlement at
-- all.
--
-- The effect was that someone who bought a bundle could not see a single
-- session to spend it on — the credits were real and unusable.
--
-- Access to a session now follows from either route.

create or replace function public.has_session_credits()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = auth.uid()
      and e.resource_type = 'group_coaching_session'
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and e.quantity is not null
      and e.quantity_used < e.quantity
  );
$$;

drop policy if exists "gc_sessions: entitled read" on public.group_coaching_sessions;

create policy "gc_sessions: entitled read"
  on public.group_coaching_sessions for select
  using (
    -- Series access covers every session in that series...
    public.has_active_entitlement('group_coaching_series', series_id)
    -- ...and unspent credits are usable against any scheduled session.
    or public.has_session_credits()
  );

comment on function public.has_session_credits() is
  'True when the caller holds at least one unspent group coaching session credit.';
