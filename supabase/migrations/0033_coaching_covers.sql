-- Cover images for the coaching entities.
--
-- Only `blog_posts` and `catalogue_items` could hold a cover, so every coaching
-- listing — courses, series, cohorts, retreats, private coaching — had no way to
-- show an image at all. That is why those pages read as text lists: not a
-- styling decision, a missing column.
--
-- ON DELETE SET NULL, never CASCADE. Deleting an image must not delete the
-- course that happened to use it (note 08 §54: cascading deletion is not the
-- default and is chosen per relationship).
--
-- The FK is named explicitly on every table. `catalogue_items` already reaches
-- `resources` two ways and an unnamed embed made PostgREST reject the query
-- with PGRST201 — silently, returning null so pages rendered as though nothing
-- were published. Naming them now avoids repeating that.

alter table public.courses
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.group_coaching_series
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.cohorts
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.retreats
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

alter table public.private_coaching_services
  add column if not exists cover_resource_id uuid
  references public.resources (id) on delete set null;

comment on column public.courses.cover_resource_id is
  'Marketing image for the storefront. PUBLIC bucket only — a course thumbnail '
  'is marketing and is shown to people deciding whether to buy (note 08 §60.1).';

-- Assignments, each VERIFIED BY LOOKING at the image rather than matched on
-- filename. All four carry their own title legibly in the artwork:
--
--   Level 1 / Level 2 / Level 3     the three course levels
--   "Advanced Coaching Sessions"    the Advanced One-to-One service
--
-- NOTHING IS ASSIGNED TO COHORTS, deliberately. The library holds Silver, Gold
-- and Platinum "Subscription" graphics, and cohort levels share those three
-- names — but they are different ladders (note 07 §16.1, closing R17), and the
-- word "Subscription" says those images belong to MEMBERSHIP. Attaching them to
-- cohorts would re-create exactly the confusion that note exists to prevent.
--
-- Nothing is assigned to the Virtual Retreat either: the nearest candidate is
-- "The Deluxe — a one day producer/writer virtual experience", which is a
-- different named product, and asserting they are the same thing is not mine
-- to decide. Both fall back to a generated cover.

update public.courses c
set cover_resource_id = r.id
from (values
  ('level-one',   'site-media/imported/coaching/b8351733-Level-1-groove.jpg'),
  ('level-two',   'site-media/imported/coaching/71b37b0a-Level-2-guu.jpg'),
  ('level-three', 'site-media/imported/coaching/ba0fc322-Level-3-Improved.jpg')
) as v(slug, path)
join public.resources r on r.storage_path = v.path
where c.slug = v.slug
  and c.cover_resource_id is null;

update public.private_coaching_services s
set cover_resource_id = r.id
from public.resources r
where r.storage_path =
        'site-media/imported/coaching/27717408-advanced-coaching-sessions.jpg'
  and s.slug = 'advanced-one-to-one'
  and s.cover_resource_id is null;
