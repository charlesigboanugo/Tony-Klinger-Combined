-- =============================================================================
-- 0030 — One private session: choose the time, then pay
-- =============================================================================
--
-- Owner (Charles), 2026-11-10. Reverses the single-session half of the
-- 2026-10-08 "pay first, then book" rule. With pay-first, two buyers could pay
-- having seen the same open time, and the second was left holding a session
-- with nothing to book if that time had been the last.
--
--   one session   the buyer chooses a time, and it is HELD for them while they
--                 pay (`hold_private_coaching_slot`, 0010: a pending booking
--                 with `hold_expires_at`). Payment confirms it
--                 (`entitlements_confirm_private_coaching`, 0010); an expired
--                 checkout releases it (`release_private_coaching_hold`, 0010),
--                 and an unfinished one lapses by itself when the hold ends.
--   a pack        unchanged: paid for first, each session booked later.
--   a gift        unchanged: paid for first; the recipient books.
--
-- All the machinery above already existed and never stopped running. This adds
-- only the question checkout asks before holding anything: can THIS person
-- have THIS time for THIS product now? Their own earlier hold does not count
-- against them — going back from Stripe and choosing again must not find the
-- time "taken" by themselves; `hold_private_coaching_slot` releases that
-- earlier hold when the new one is made.
-- =============================================================================

create or replace function public.private_slot_sale_status(p_slot_id uuid, p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot record;
begin
  select s.* into v_slot
  from public.private_coaching_slots s
  join public.private_coaching_services svc
    on svc.id = s.service_id and svc.status = 'published'
  where s.id = p_slot_id
    and s.status = 'open'
    and svc.product_id = p_product_id;

  if not found then
    return 'not_found';
  end if;

  -- The same twelve hours' notice as the booking page and the hold.
  if v_slot.starts_at <= now() + interval '12 hours' then
    return 'past';
  end if;

  -- Taken by any live booking but the caller's own unpaid hold.
  if exists (
    select 1 from public.bookings b
    where b.bookable_type = 'private_coaching'
      and b.starts_at < v_slot.ends_at
      and b.ends_at > v_slot.starts_at
      and (
        b.status = 'confirmed'
        or (b.status = 'pending' and b.hold_expires_at > now()
            and b.user_id is distinct from v_user_id)
      )
  ) then
    return 'taken';
  end if;

  return 'ok';
end;
$$;

grant execute on function public.private_slot_sale_status(uuid, uuid) to authenticated;

comment on function public.private_slot_sale_status(uuid, uuid) is
  'Whether the caller can buy one private session for this time now: ok, not_found, past or taken. The caller''s own unpaid hold does not count (0030).';
