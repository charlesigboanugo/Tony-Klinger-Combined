-- 0016 — Scheduled maintenance.
-- Architecture: note 08 §58; note 09 §44, §45, §46.
--
-- The never-delete list from note 08 §58 is honoured here in the only way that
-- really counts: these functions contain no DELETE against a paid order, a
-- payment, a subscription, an entitlement, a historical booking or an audit
-- row. Expiry is a STATUS TRANSITION.

/**
 * Move lapsed entitlements to 'expired'.
 *
 * A transition, never a deletion. Historical entitlement records are required
 * for reconciliation, support and reporting (note 07 §40, note 08 §55), and
 * they explain past orders long after access has ended.
 */
create or replace function public.expire_lapsed_entitlements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.entitlements
     set status = 'expired'
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return jsonb_build_object('expired', v_count);
end;
$$;

/**
 * Remove spent and lapsed one-time tokens.
 *
 * Safe to delete: a claim token is a credential, not a commercial record. The
 * ORDER it points at is never touched — an unclaimed paid order outlives every
 * token issued for it and can always have a new one minted (note 09 §45).
 */
create or replace function public.cleanup_expired_tokens()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.order_claim_tokens
   where (consumed_at is not null and consumed_at < now() - interval '30 days')
      or (consumed_at is null and expires_at < now() - interval '30 days');

  get diagnostics v_count = row_count;
  return jsonb_build_object('tokens_removed', v_count);
end;
$$;

/**
 * Orders that Stripe may consider paid but we do not.
 *
 * Does not fix anything by itself — it reports, so reconciliation can fetch the
 * authoritative state from Stripe and replay it (note 09 §46). Guessing an
 * order into 'paid' without asking the provider would be inventing a payment.
 */
create or replace function public.orders_awaiting_reconciliation(
  p_older_than interval default interval '15 minutes'
)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.orders
  where status = 'pending'
    and external_reference is not null
    and created_at < now() - p_older_than
  order by created_at
  limit 100;
$$;

revoke all on function public.expire_lapsed_entitlements() from anon, authenticated;
revoke all on function public.cleanup_expired_tokens() from anon, authenticated;
revoke all on function public.orders_awaiting_reconciliation(interval) from anon, authenticated;
