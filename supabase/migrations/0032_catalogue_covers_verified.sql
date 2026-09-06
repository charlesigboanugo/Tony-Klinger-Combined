-- Six more catalogue covers, each one VERIFIED BY LOOKING AT THE IMAGE.
--
-- This repeats the method the earlier cover work settled on, and deliberately
-- not the one that was reverted. An automated matching pass has already been
-- attempted on this data and it assigned a pxfuel stock photo to The Havana
-- Chronicles and `SleepingItOff.PNG` to The Kids Are Alright. Page association
-- is not identification, and neither is a filename.
--
-- So: every one of the 380 images in the public bucket was rendered into
-- contact sheets and inspected. The six below are the ones that could be
-- positively identified. Each is matched on the artwork's OWN content —
-- the title is legible in the image itself:
--
--   Alsatia, the Search for Treasure   book cover, title on the jacket
--   How to Get Into the Movie Business  yellow cover, title + author photo
--   How to Get Your Movie Made...       yellow cover, full title
--   Twilight of the Gods                book cover, "My adventures with The Who"
--   Solo2Darwin                         biplane artwork captioned Solo2Darwin
--   Dirty, Sexy & Totally Iconic        the film's own 50th-anniversary poster
--
-- ONE NEAR-MISS IS RECORDED so it is not "fixed" later by someone matching on
-- filename: `FullSnip_poster.PNG` looks like it belongs to **Full Circle** and
-- does not. It is a poster for *The Man Who Got Carter*. It is left alone.
--
-- THE OTHER SIX ITEMS KEEP A NULL COVER, deliberately:
--   An unpublished book        no cover exists — that is what the title says
--   Full Circle                no artwork in the library
--   Mister Producer            no artwork in the library
--   The Havana Chronicles      only pxfuel stock photos, which is exactly the
--                              wrong assignment that was reverted before
--   The Tony Klinger Podcast   no artwork in the library
--   Light's, Chutzpah, Action  no artwork in the library
--
-- A wrong poster on a work's page is a visible error and worse than an honest
-- empty state, which the card layout already handles as a normal case.
--
-- Resolved by slug and storage_path rather than fixed UUIDs, so this survives a
-- `db reset` that regenerates ids.

update public.catalogue_items ci
set cover_resource_id = r.id
from (values
  ('alsatia-the-search-for-treasure',
   'site-media/imported/main/c389ffdd-Screenshot-2024-09-05-215117.png'),
  ('how-to-get-into-the-movie-business',
   'site-media/imported/main/12914c3c-Screenshot-2024-09-05-221742.png'),
  ('how-to-get-your-movie-made',
   'site-media/imported/main/35d85e51-Screenshot-2024-09-05-224504.png'),
  ('twilight-of-the-gods',
   'site-media/imported/main/1d142866-TwlightBook_pic.PNG'),
  ('solo2darwin',
   'site-media/imported/main/0e6097d0-Screenshot-2024-09-05-220917.png'),
  ('dirty-sexy-and-totally-iconic',
   'site-media/imported/main/db9f68da-MV5BYjJmZDdjNmMtOGY5MS00ODM5LThhZDItMmRlMmE1YWJhMWEyXkEyXkFqcGdeQXVyMzY3OTgyODA_._V1_.jpg')
) as v(slug, path)
join public.resources r on r.storage_path = v.path
where ci.slug = v.slug
  and ci.cover_resource_id is null;
