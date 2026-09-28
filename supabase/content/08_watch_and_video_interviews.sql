-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- Watch, and video interviews, audited 2026-09-25.
--
-- tonydklinger.com/watch was a Wix video channel of nine videos. Checked one by
-- one (YouTube and Vimeo through their oEmbed endpoints, Vimeo also with the
-- old site as referrer):
--
--   Sisters Trailer                   live on YouTube                     IN
--   Reaper's Shadow — 2020 teaser     YouTube video removed               out
--   Solo2Darwin Documentary Trailer   Vimeo video gone or private         out
--   The Man Who Got Carter Trailer    Vimeo video gone or private         out
--   Tony Klinger Public Speaking      Wix-hosted only — replaced by the same
--                                     material on Tony's channel, "Tony Klinger
--                                     Speaks"                              IN
--   Give+Get=Go, GGG One, Navegator Promo, The Man Who Got Carter Teaser
--                                     Wix-hosted only: the files exist in the
--                                     capture but video must go on the video
--                                     host (note 09 §40.1), not yet set up  out
--
-- Tony's own YouTube channel (@TDKlinger) also carries broadcast interviews the
-- catalogue did not have; they are added to Interviews, newest first, ahead of
-- the older recordings. His coaching videos belong to the coaching area, not
-- the catalogue, and are not added here.
--
-- Every entry links out to the video on YouTube; its cover is the video's own
-- thumbnail (supabase/content/images/CREDITS.md).

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, position)
values
  ('watch', 'Sisters — Trailer', 'sisters-trailer',
   'The trailer for Sisters, the documentary on Zohra, Afghanistan’s only all-female orchestra.',
   'published', now(), true, 'https://www.youtube.com/watch?v=Hai2_Ay7zCo', 20),
  ('watch', 'Tony Klinger Speaks', 'tony-klinger-speaks',
   'A short look at Tony speaking to audiences — the talks he gives on film, storytelling and his career.',
   'published', now(), true, 'https://www.youtube.com/watch?v=ITX6TgpXDOc', 30),
  ('interviews', 'BBC Radio London with Robert Elms', 'bbc-radio-london-robert-elms',
   'Tony announces the Horizons Vertical Film Challenge on Robert Elms’s show.',
   'published', now(), true, 'https://www.youtube.com/watch?v=cerK5UoLWjA', 1),
  ('interviews', 'BBC Radio Northampton — in conversation with Bernie Keith', 'bbc-radio-northampton-bernie-keith',
   'An in-depth conversation about film: how Tony started, working alongside his father Michael Klinger, and the icons he has worked with.',
   'published', now(), true, 'https://www.youtube.com/watch?v=nI0N2shwp3o', 2),
  ('interviews', 'BBC Radio Newcastle with Kelly Scott', 'bbc-radio-newcastle-kelly-scott',
   'Get Carter, Newcastle and the documentary Dirty, Sexy & Totally Iconic.',
   'published', now(), true, 'https://www.youtube.com/watch?v=Y9j6PTa_RFs', 3),
  ('interviews', 'The Bernie Keith Show — on Get Carter', 'bernie-keith-show-get-carter',
   'BBC Radio Northampton: Tony on Dirty, Sexy & Totally Iconic and the making of his father’s Get Carter.',
   'published', now(), true, 'https://www.youtube.com/watch?v=ylmEvNgiLP4', 4),
  ('interviews', 'BBC Radio Northampton with Akylah Rodriguez', 'bbc-radio-northampton-akylah-rodriguez',
   'Tony talks about his father, upcoming films — and birthday presents.',
   'published', now(), true, 'https://www.youtube.com/watch?v=FfNVOg2UnHE', 5),
  ('interviews', 'Screen Northants TV Interview', 'screen-northants-tv-interview',
   'At the Screen Northants TV Expo: Tony’s journey from ‘gofer’ to making his own films.',
   'published', now(), true, 'https://www.youtube.com/watch?v=ScOxfBEx4uw', 6)
on conflict (category, slug) do nothing;
