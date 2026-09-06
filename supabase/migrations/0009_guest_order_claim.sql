-- 0009 — Guest order claiming.
-- Architecture: note 05 §29.3, note 09 §6, §7; note 08 §42.
--
-- A guest pays, then links that purchase to an account. The whole security of
-- this rests on one rule: the email address proves nothing on its own.
-- Authorization is possession of an emailed single-use token PLUS an
-- authenticated session.

/**
 * Redeem a claim token for the calling user.
 *
 * Deliberately takes the token HASH, never the token: the caller hashes it, so
 * a database dump or a log line cannot be replayed into a claim.
 *
 * Attaches the order to auth.uid() — never to a user id supplied by the caller
 * (note 05 §29.3). Runs as one transaction: a half-claimed order would be an
 * order the customer can see but has no access from.
 */
create or replace function public.claim_order(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token record;
  v_order record;
  v_granted integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  select * into v_token
  from public.order_claim_tokens
  where token_hash = p_token_hash
  for update;

  if v_token is null then
    -- Same answer for an unknown token and a spent one: distinguishing them
    -- tells an attacker which guesses were once real.
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_token.consumed_at is not null then
    -- Already claimed by this same user: report success so a double click or a
    -- refreshed link is not alarming.
    if v_token.consumed_by = v_user_id then
      return jsonb_build_object('status', 'ok', 'order_id', v_token.order_id, 'already', true);
    end if;
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_token.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_order from public.orders where id = v_token.order_id for update;

  if v_order is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Someone else already owns this order. Never reassign it.
  if v_order.user_id is not null and v_order.user_id <> v_user_id then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  update public.orders
     set user_id = v_user_id,
         guest_email = null   -- the address has served its purpose
   where id = v_order.id;

  update public.order_claim_tokens
     set consumed_at = now(), consumed_by = v_user_id
   where id = v_token.id;

  -- Now that the order has an owner, its entitlements can exist.
  v_granted := public.grant_entitlements_for_order(v_order.id);

  return jsonb_build_object(
    'status', 'ok',
    'order_id', v_order.id,
    'entitlements_granted', v_granted
  );
end;
$$;

revoke all on function public.claim_order(text) from anon;
grant execute on function public.claim_order(text) to authenticated;

comment on function public.claim_order(text) is
  'Links a paid guest order to the CALLING user. Requires a valid, unexpired, unconsumed token hash and an authenticated session. Never trusts an email address alone.';
