-- 0008 — Order fulfilment.
-- Architecture: note 09 §15, §21, §22, §28; note 05 §29.
--
-- Turning a paid order into entitlements happens in one database transaction.
-- Doing it as a sequence of application writes leaves a customer who paid with
-- an order marked paid and no access, if the process dies midway.

-- Duplicate protection: replaying a webhook must not grant a second copy of the
-- same entitlement (note 09 §21). Partial, because manual grants and
-- membership-derived rows have no source order.
create unique index if not exists entitlements_unique_per_order
  on public.entitlements (user_id, resource_type, coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), source_id)
  where source_id is not null;

/**
 * Grant the entitlements an order's items imply.
 *
 * Only for orders already attached to an account. A paid guest order stays
 * unfulfilled until it is claimed (note 05 §29.3) — it is a real, paid record
 * in the meantime, never discarded.
 */
create or replace function public.grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_granted integer := 0;
  v_item record;
  v_resource_type public.entitlement_resource;
  v_resource_id uuid;
begin
  select user_id into v_user_id from public.orders where id = p_order_id;
  if v_user_id is null then
    return 0;  -- unclaimed guest order; nothing to attach access to yet
  end if;

  for v_item in
    select oi.product_id, p.product_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    v_resource_type := null;
    v_resource_id := null;

    -- Map the purchased product to the thing it grants access to.
    case v_item.product_type
      when 'course' then
        v_resource_type := 'course';
        select id into v_resource_id from public.courses where product_id = v_item.product_id limit 1;
      when 'cohort' then
        v_resource_type := 'cohort';
        select id into v_resource_id from public.cohorts where product_id = v_item.product_id limit 1;
      when 'group_coaching' then
        v_resource_type := 'group_coaching_series';
        select id into v_resource_id from public.group_coaching_series where product_id = v_item.product_id limit 1;
      when 'retreat' then
        v_resource_type := 'retreat';
        select id into v_resource_id from public.retreats where product_id = v_item.product_id limit 1;
      when 'event' then
        v_resource_type := 'event';
        select id into v_resource_id from public.events where product_id = v_item.product_id limit 1;
      when 'masterclass' then
        v_resource_type := 'masterclass';
        select id into v_resource_id from public.masterclasses where product_id = v_item.product_id limit 1;
      else
        -- Memberships grant access through their subscription, not directly
        -- from the order (note 09 §16).
        continue;
    end case;

    if v_resource_type is not null then
      insert into public.entitlements
        (user_id, resource_type, resource_id, source_type, source_id, status)
      values
        (v_user_id, v_resource_type, v_resource_id, 'purchase', p_order_id, 'active')
      on conflict do nothing;

      if found then
        v_granted := v_granted + 1;
      end if;
    end if;
  end loop;

  return v_granted;
end;
$$;

/**
 * Mark an order paid and fulfil it, atomically and idempotently.
 *
 * Safe to call repeatedly: a provider may deliver the same event more than
 * once, and reconciliation may replay it deliberately (note 09 §21, §46).
 */
create or replace function public.fulfil_order(
  p_order_id uuid,
  p_provider_payment_id text default null,
  p_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_granted integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if v_order is null then
    return jsonb_build_object('status', 'unknown_order');
  end if;

  if v_order.status <> 'paid' then
    update public.orders
       set status = 'paid', paid_at = coalesce(paid_at, now())
     where id = p_order_id;
  end if;

  if p_provider_payment_id is not null then
    insert into public.payments
      (order_id, provider, provider_payment_id, amount, currency, status, paid_at)
    values
      (p_order_id, 'stripe', p_provider_payment_id,
       coalesce(p_amount, v_order.total), v_order.currency, 'succeeded', now())
    on conflict (provider, provider_payment_id) do nothing;
  end if;

  v_granted := public.grant_entitlements_for_order(p_order_id);

  return jsonb_build_object(
    'status', 'ok',
    'order_id', p_order_id,
    'claimed', v_order.user_id is not null,
    'entitlements_granted', v_granted
  );
end;
$$;

revoke all on function public.fulfil_order(uuid, text, integer) from anon, authenticated;
revoke all on function public.grant_entitlements_for_order(uuid) from anon, authenticated;
