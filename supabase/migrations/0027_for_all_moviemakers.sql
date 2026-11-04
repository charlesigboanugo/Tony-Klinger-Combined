-- =============================================================================
-- 0027 — For All Filmmakers becomes For All Moviemakers
-- =============================================================================
--
-- Tony, 2026-11-04, from Elaine's review: "Filmmaking" and "For All
-- Filmmakers" were too easily mixed up, so the second is renamed For All
-- Moviemakers, its address included (/coaching/group-coaching/
-- for-all-moviemakers; the old one redirects, next.config.ts).
--
-- Renamed IN PLACE, so every run, booking, order and pass choice that points
-- at the series or its two products keeps pointing at the same rows. 0002
-- seeds the series under its old slug; this follows it, so a fresh setup ends
-- the same as an existing one, and content files 04 and 12 use the new slug.
-- On a fresh setup the products do not exist yet (file 12 creates them), and
-- the second statement changes nothing.
-- =============================================================================

update public.group_coaching_series
   set slug = 'for-all-moviemakers',
       name = 'For All Moviemakers'
 where slug = 'for-all-filmmakers';

update public.products
   set slug = replace(slug, 'for-all-filmmakers', 'for-all-moviemakers'),
       name = regexp_replace(name, 'For all Filmmakers|For All Filmmakers', 'For All Moviemakers'),
       description = regexp_replace(description, 'For all Filmmakers|For All Filmmakers', 'For All Moviemakers'),
       option_group = replace(option_group, 'for-all-filmmakers', 'for-all-moviemakers')
 where slug in ('group-coaching-single-for-all-filmmakers', 'group-coaching-x8-for-all-filmmakers');
