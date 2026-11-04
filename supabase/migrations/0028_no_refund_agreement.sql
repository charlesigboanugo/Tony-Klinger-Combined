-- =============================================================================
-- 0028 — The buyer's agreement that a booking is non-refundable
-- =============================================================================
--
-- Tony, 2026-11-04: "Once your booking is confirmed, payments are
-- non-refundable. If we are unable to deliver our service as agreed, a full
-- refund will be provided."
--
-- By default a UK online buyer may cancel within 14 days (Consumer Contracts
-- Regulations 2013). That right ends early only where the buyer asked for the
-- service or the recordings to start straight away and accepted losing it. So
-- checkout says so under "Continue to payment", pressing it is the agreement,
-- and the order keeps WHEN it was given: the evidence, should a
-- refund ever be disputed. Null on orders made before this (they were sold
-- under the full 14 days).
-- =============================================================================

alter table public.orders add column no_refund_agreed_at timestamptz;

comment on column public.orders.no_refund_agreed_at is
  'When the buyer agreed, by continuing to payment at checkout, that the purchase starts at once and is non-refundable once confirmed (waiving the 14-day cancellation right). Null before 0028.';
