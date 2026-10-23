-- =============================================================================
-- 0011 — Entitlement kinds
-- =============================================================================
--
-- Consolidated 2026-10-15 from migrations 0011, 0015, in their
-- original order (the site was not yet in production). Each section keeps
-- its former number, which older notes and comments still cite.
--
-- New values of `entitlement_resource`. Kept in a file of their own: Postgres
-- refuses to use an enum value in the same transaction that adds it, and the
-- files after this one use them.
-- =============================================================================


-- ===========================================================================
-- 0011_membership_entitlement_types  (was migration 0011, before 2026-10-15)
-- ===========================================================================

-- 0011 — Entitlement types for membership delivery.
-- Architecture: note 07 §5–§12, §31; note 09 §16.1.
--
-- A file of its own because Postgres will not let a new enum value be USED in
-- the transaction that adds it, and 0012 uses both in policies and SQL
-- functions.
--
--   membership   the customer holds a tier. `resource_id` is the
--                `membership_tiers` row. This is the row note 09 §16.1 means by
--                "ENTITLEMENT is the source of truth for ACCESS": it exists for
--                a subscriber and for a one-year lump-sum member alike.
--   playlist     a members' video playlist. `resource_id` is the playlist, or
--                null for every playlist.

alter type public.entitlement_resource add value if not exists 'membership';
alter type public.entitlement_resource add value if not exists 'playlist';


-- ===========================================================================
-- 0015_series_pass_entitlement_type  (was migration 0015, before 2026-10-15)
-- ===========================================================================

-- 0015 — Entitlement type for a place on a series.
-- Architecture: note 07 §14.2.
--
-- A file of its own for the reason 0011 gives: a new enum value cannot be used
-- in the transaction that adds it, and 0016 uses this one.
--
--   series_pass   a paid place on ONE run of a Group Coaching series — what
--                 the eight-session product buys. `resource_id` is the series.
--                 Spent on registering for a run; lapses if never used.
--
-- Deliberately not `group_coaching_series`: that type means standing access to
-- a series, which the session and recording policies honour. A pass opens
-- nothing until it is spent on a run.

alter type public.entitlement_resource add value if not exists 'series_pass';
