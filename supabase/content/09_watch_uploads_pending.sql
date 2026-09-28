-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- The rest of tonydklinger.com/watch, audited 2026-09-26 from the page's own
-- video data (Wix's channel list, including the videos behind "Load More",
-- which the original capture never saw). The live page lists sixteen videos:
--
--   playing, linkable        Sisters Trailer (08_*.sql), DC Video Promo (here)
--   playing, Wix upload      the ten below, listed ahead of their links
--   dead                     Solo2Darwin and The Man Who Got Carter trailers,
--                            Give Get Go Promo (Vimeo 404); Reaper's Shadow
--                            teaser (YouTube 404)
--
-- LISTED AHEAD OF THEIR LINKS (owner, 2026-09-26). Each Wix upload is
-- entered complete — title, description from the old site, collection, cover
-- (the video's own Wix cover) — and PUBLISHED WITHOUT A LINK: it shows on its
-- collection's wall with its cover, marked "Coming soon", and is not
-- clickable (no link, no body, so `workHref` is null and `awaitingLink` is
-- true). The owner is uploading the files to Livid, YouTube or Vimeo; giving
-- one its link is then:
--
--   update public.catalogue_items
--   set is_external = true, external_url = '<link>'
--   where slug = '<slug>';
--
-- Upload file for each (current-website/tonydklinger.com/site-files/video/),
-- matched by the ORIGINAL FILENAME Wix recorded for the upload, not by guess:
--
--   tony-klinger-public-speaking     264 - tony_klinger_public_spea_g_cut.mp4
--   the-man-who-got-carter-teaser    09 - The Man Who Got Carter Trailer (1).mp4
--   navegator-promo                  08 - Navegator Promo First Cut.mp4
--   festival-game-introduction       01 - FestivalGameIntro.mp4
--   butterfly-boy-introduction       02 - ButterflyBoy_edit.mp4
--   give-get-go-video                NOT IN THE CAPTURE — download Give+Get=Go.mp4 from the old site's Wix Media Manager
--   ggg-one                          04 - GGG_short3.mp4
--   ggg-two                          05 - GGG_short2.mp4
--   ggg-three                        06 - GGG_short.mp4
--   romford-film-festival-qa         03 - Romford_QA_2018.mp4

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, position)
values
  ('watch', 'DC Video Promo', 'dc-video-promo',
   'David Courtney’s music profile — the songwriter behind Roger Daltrey’s first solo album, and Tony’s collaborator on the musical The Show Must Go On.',
   'published', now(), true, 'https://www.youtube.com/watch?v=-kJMBhjZmRc', 40),
  ('watch', 'Tony Klinger Public Speaking', 'tony-klinger-public-speaking',
   'Tony shares his expertise on presentations and public speaking.',
   'published', now(), false, null, 50),
  ('watch', 'The Man Who Got Carter — Teaser Trailer', 'the-man-who-got-carter-teaser',
   'The teaser for The Man Who Got Carter, Tony’s documentary about his father, the producer Michael Klinger.',
   'published', now(), false, null, 60),
  ('watch', 'Navegator Promo', 'navegator-promo',
   'Author Geoffrey Iley shares some initial information on what the Navegator story brings to the table, and why you should be interested in the upcoming film project.',
   'published', now(), false, null, 70),
  ('watch', 'Festival Game — Introduction', 'festival-game-introduction',
   'Tony introduces one of his earlier and most cherished works, the film Festival Game.',
   'published', now(), false, null, 80),
  ('watch', 'The Butterfly Boy — Introduction', 'butterfly-boy-introduction',
   'Tony Klinger talks about his novel The Butterfly Boy and the amazing story of Arnie.',
   'published', now(), false, null, 90),
  ('watch', 'Give+Get=Go', 'give-get-go-video',
   'Tony introduces Give-Get-Go.',
   'published', now(), false, null, 100),
  ('watch', 'GGG One', 'ggg-one',
   'Tony presents the many reasons to be interested in the wonderful experience Give-Get-Go can offer you.',
   'published', now(), false, null, 110),
  ('watch', 'GGG Two', 'ggg-two',
   'Tony explains how the Give-Get-Go experience can benefit you.',
   'published', now(), false, null, 120),
  ('watch', 'GGG Three', 'ggg-three',
   'Tony explains how the Give-Get-Go experience can benefit you.',
   'published', now(), false, null, 130),
  ('interviews', 'Romford Film Festival Q&A', 'romford-film-festival-qa',
   'Tony in conversation after receiving the Lifetime Achievement Award at the 2018 Romford Film Festival.',
   'published', now(), false, null, 7)
on conflict (category, slug) do nothing;
