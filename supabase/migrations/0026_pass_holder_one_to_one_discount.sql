-- =============================================================================
-- 0026 — A pass holder's discount on one-to-one sessions
-- =============================================================================
--
-- Owner, 2026-11-02, from Elaine's review: "a small discount on £150 private
-- sessions for pass holders would give people a natural next step up".
--
-- Each pass type carries its own percentage, set in admin (0 for none). It
-- applies to a SINGLE one-to-one session bought by the holder for themselves:
-- not to the pack, which has its own saving, and not to a gift, which someone
-- else pays for. The site prices the line on the server at checkout (as a pass
-- upgrade is priced) and the order records the full price, the discount and
-- the total. note 09 §16.2.
-- =============================================================================

alter table public.membership_tiers
  add column private_coaching_discount_percent smallint not null default 0
    check (private_coaching_discount_percent between 0 and 90);

comment on column public.membership_tiers.private_coaching_discount_percent is
  'Percent off a single one-to-one session for holders of this pass (0 for none).';

/** The caller's discount on a single one-to-one session, from their live pass. 0 for none. */
create function public.my_private_coaching_discount()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select t.private_coaching_discount_percent::int
    from public.membership_of(auth.uid()) m
    join public.membership_tiers t on t.id = m.tier_id
    limit 1
  ), 0);
$$;

revoke all on function public.my_private_coaching_discount() from public, anon;
grant execute on function public.my_private_coaching_discount() to authenticated;
