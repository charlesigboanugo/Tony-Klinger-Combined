-- 0010 — Stripe product identifiers.
-- Architecture: note 08 §11, note 09 §12.
--
-- `prices.stripe_price_id` already existed but was never populated: checkout
-- was creating throwaway inline products, so Stripe saw a brand-new Product on
-- every purchase. That makes per-product revenue reporting impossible and gives
-- subscriptions no stable Price to bill against.
--
-- The application remains the source of truth for its own catalogue; these
-- columns just record the counterpart object on Stripe's side.

alter table public.products
  add column if not exists stripe_product_id text unique;

create index if not exists prices_stripe_price_id_idx
  on public.prices (stripe_price_id)
  where stripe_price_id is not null;

comment on column public.products.stripe_product_id is
  'Stripe Product id. Created once by the sync, never per checkout.';
