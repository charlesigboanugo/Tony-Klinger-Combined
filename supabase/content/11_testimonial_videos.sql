-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- The filmed client testimonials from tonyklingercoaching.com/video-testimonials,
-- audited 2026-09-26 from the page's own video data, including the two behind
-- "Load More" (Josh's and Phil's), which the page's structured data omits.
-- Eleven videos, every one a Wix upload, every one playing on the old site.
--
-- LISTED AHEAD OF THEIR LINKS, as the /watch uploads are (09_*.sql): each is
-- published with its cover and marked "Coming soon" until it has a video.
-- The owner uploads the file to Livid (or YouTube / Vimeo); giving one its
-- video is then, or the same through Admin → Testimonial videos:
--
--   update public.testimonial_videos
--   set video_provider = 'livid', video_id = '<id>'
--   where slug = '<slug>';
--
-- Upload file for each (current-website/tonyklingercoaching.com/site-files/video/),
-- matched by the filename Wix recorded and confirmed by duration:
--
--   sen-monro-short          11 - N T 3 You Cannot do it on Your Own - Sen Monro.mp4
--   sharon-touviano-short    08 - N T 4 I would've been lost - Sharon Touviano.mp4
--   phil-miller-short        10 - NT 1 It's been fantastic - Phil Miller.mp4
--   paul-greenwood           09 - NT 2 It's Quite In-Depth - Paul Greenwood.mp4
--   compilation              07 - Testimonial Comp 6.mp4
--   sharon                   03 - Sharon's Testimonial.mp4
--   sen                      04 - Sen's Testimonial.mp4
--   amanda                   01 - Amanda's Testimonial.mp4
--   francesca                06 - Francesca Testimonial.mp4
--   josh                     05 - Josh Testimonial.mp4
--   phil                     02 - Phil's Testimonial.mp4
--
-- NAMES ARE THE OLD SITE'S, NOT INFERRED. The four short clips carried a full
-- name (and the name is burned into the Zoom frame); the longer ones were
-- titled by first name only ("Sen's Testimonial"). Several are plainly the
-- same people, but a surname the site did not give is not added here.
--
-- Order is the old page's. Covers are each video's own Wix cover frame
-- (scripts/import-images.mjs, TESTIMONIAL_VIDEO_COVERS), except Sharon's,
-- whose chosen frame was black — the next frame Wix generated is used.

insert into public.testimonial_videos
  (slug, title, attributed_to, context, duration_seconds, position, status)
values
  ('sen-monro-short',       'You cannot do it on your own', 'Sen Monro',       'coaching', 50,  10,  'published'),
  ('sharon-touviano-short', 'I would''ve been lost',        'Sharon Touviano', 'coaching', 28,  20,  'published'),
  ('phil-miller-short',     'It''s been fantastic',          'Phil Miller',     'coaching', 25,  30,  'published'),
  ('paul-greenwood',        'It''s quite in-depth',          'Paul Greenwood',  'coaching', 47,  40,  'published'),
  ('compilation',           'Testimonials from very satisfied customers', null, 'coaching', 72,  50,  'published'),
  ('sharon',                null,                            'Sharon',          'coaching', 67,  60,  'published'),
  ('sen',                   null,                            'Sen',             'coaching', 25,  70,  'published'),
  ('amanda',                null,                            'Amanda',          'coaching', 66,  80,  'published'),
  ('francesca',             null,                            'Francesca',       'coaching', 140, 90,  'published'),
  ('josh',                  null,                            'Josh',            'coaching', 10,  100, 'published'),
  ('phil',                  null,                            'Phil',            'coaching', 59,  110, 'published')
on conflict (slug) do nothing;
