-- =============================================================================
-- 0016 — Checkout knows when an email has an account; purchases made with
--        your own email can be added from your account
-- =============================================================================
--
-- Owner, 2026-10-15 ("do what's best"): a guest at checkout whose email already
-- has an account is offered sign-in first, so the purchase lands in that account
-- instead of waiting to be claimed. Not a hard block: the payer and the account
-- holder are not always the same person (a gift, a parent, an employer), and a
-- forgotten password must not lose the sale. Note 05 §29.2–§29.3.
--
-- Two functions:
--
--   email_has_account(email)   service role only. Asked by the checkout action,
--                              which rate-limits it per caller, so it cannot be
--                              used freely to test which addresses are customers.
--
--   my_unclaimed_orders() /    a signed-in customer whose CONFIRMED account email
--   claim_my_orders()          is the email a paid guest order was made with can
--                              see that order and add it with one click. Holding
--                              the confirmed address is the same proof the emailed
--                              claim link gives (the link goes to that inbox), so
--                              this is not linking "merely because the email
--                              matched": the order is attached only by the
--                              account holder's own action, never automatically.
--                              The emailed link (claim_order) is unchanged and
--                              still covers a different account or an expired
--                              link through support.
-- =============================================================================

create or replace function public.email_has_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
  );
$$;

revoke all on function public.email_has_account(text) from public, anon, authenticated;
grant execute on function public.email_has_account(text) to service_role;

comment on function public.email_has_account(text) is
  'True when an account exists for the address. Service role only: the checkout action rate-limits the question per caller (note 05 §29.2).';


-- The calling user's confirmed email, or null. Shared by the two functions below
-- so the rule "confirmed address only" is written once.
create or replace function public.my_confirmed_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email) from auth.users
  where id = auth.uid()
    and email is not null
    and email_confirmed_at is not null;
$$;

revoke all on function public.my_confirmed_email() from public, anon, authenticated;


create or replace function public.my_unclaimed_orders()
returns table (order_id uuid, paid_at timestamptz, total integer, currency text, items text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.paid_at, o.total, o.currency,
         string_agg(p.name, ', ' order by p.name)
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.products p on p.id = oi.product_id
  where o.user_id is null
    and o.status = 'paid'
    and lower(o.guest_email) = public.my_confirmed_email()
  group by o.id
  order by o.paid_at desc nulls last;
$$;

revoke all on function public.my_unclaimed_orders() from public, anon;
grant execute on function public.my_unclaimed_orders() to authenticated;

comment on function public.my_unclaimed_orders() is
  'Paid guest orders made with the calling user''s confirmed email and not yet in any account (note 05 §29.3).';


create or replace function public.claim_my_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := public.my_confirmed_email();
  v_order record;
  v_claimed integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  if v_email is null then
    return jsonb_build_object('status', 'unconfirmed');
  end if;

  for v_order in
    select id from public.orders
    where user_id is null
      and status = 'paid'
      and lower(guest_email) = v_email
    for update
  loop
    update public.orders
       set user_id = v_user_id,
           guest_email = null
     where id = v_order.id;

    -- The emailed link for this order has done its job; spend it so it cannot
    -- be used afterwards (claim_order would refuse anyway: the order has an owner).
    update public.order_claim_tokens
       set consumed_at = now(), consumed_by = v_user_id
     where order_id = v_order.id and consumed_at is null;

    perform public.grant_entitlements_for_order(v_order.id);
    v_claimed := v_claimed + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'claimed', v_claimed);
end;
$$;

revoke all on function public.claim_my_orders() from public, anon;
grant execute on function public.claim_my_orders() to authenticated;

comment on function public.claim_my_orders() is
  'Adds every paid guest order made with the calling user''s confirmed email to their account, at their request. Never runs automatically (note 05 §29.3).';


-- ---------------------------------------------------------------------------
-- Gifts (owner, 2026-10-15). A gift is a guest order made out to the
-- recipient's email: they add it to their account with the emailed link, or
-- from their account once signed in with that email, exactly as any guest
-- purchase. `is_gift` changes only the wording of that email and of admin
-- views — it grants nothing. The payer's receipt comes from Stripe to the
-- payer, never to the recipient.
-- ---------------------------------------------------------------------------

alter table public.orders add column is_gift boolean not null default false;

comment on column public.orders.is_gift is
  'Bought for someone else: guest_email is the recipient''s, who claims it like any guest order (note 05 §29.2).';
