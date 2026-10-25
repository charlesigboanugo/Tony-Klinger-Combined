-- =============================================================================
-- 0024 — An opt-out on the site holds against every marketing list
-- =============================================================================
--
-- Owner, 2026-10-25. Unsubscribing in Account → Notifications took the person
-- off the Brevo lists, but the next purchase put them back on Customers and the
-- daily sync put an active subscriber back on Members: neither looked at the
-- withdrawal recorded here. And a buyer had no consent row at all, so the page
-- showed "Not subscribed" to someone who was on the Customers list, with no way
-- to leave it from there.
--
--   marketing_opted_out   true when an address has consent rows and none is
--                         live: they said no, and nothing adds them again
--   record_soft_opt_in    a buyer's 'checkout' row (the notice under the
--                         checkout button), written only while they have not
--                         opted out; returns whether they may be marketed to
--
-- A withdrawal is still undone only by a fresh opt-in the person makes
-- themselves (record_marketing_consent). Buying again does not undo it.
-- note 09 §42.
-- =============================================================================

create or replace function public.marketing_opted_out(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from public.marketing_consents
            where email = lower(trim(p_email))
         )
     and not exists (
           select 1 from public.marketing_consents
            where email = lower(trim(p_email))
              and withdrawn_at is null
         );
$$;

create or replace function public.record_soft_opt_in(
  p_email text,
  p_consent_text text default null,
  p_consent_url text default null,
  p_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.marketing_opted_out(p_email) then
    return false;
  end if;

  insert into public.marketing_consents
    (email, user_id, source, consent_text, consent_url, granted_at)
  values
    (lower(trim(p_email)), p_user_id, 'checkout', p_consent_text, p_consent_url, now())
  on conflict (email, source) do update
    set granted_at   = now(),
        consent_text = coalesce(excluded.consent_text, public.marketing_consents.consent_text),
        consent_url  = coalesce(excluded.consent_url, public.marketing_consents.consent_url),
        user_id      = coalesce(excluded.user_id, public.marketing_consents.user_id)
    -- A withdrawn checkout row stays withdrawn: the person re-subscribed some
    -- other way (or this would have returned above), and that row is the
    -- evidence of the earlier refusal.
    where public.marketing_consents.withdrawn_at is null;

  return true;
end;
$$;

-- Server-only, like the other consent functions (0017).
revoke all on function public.marketing_opted_out(text) from public, anon, authenticated;
revoke all on function public.record_soft_opt_in(text, text, text, uuid) from public, anon, authenticated;
