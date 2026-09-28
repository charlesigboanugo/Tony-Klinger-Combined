-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- Two interviews whose recordings were in the tonydklinger.com capture but
-- untitled and untagged, so 07_audio.sql held them back ("nothing is added on
-- a guess"). Identified 2026-09-26 by transcribing their opening minutes:
--
--   Get Carter Q&A Edited.MP3   the live Q&A after the world premiere of The
--                               Man Who Got Carter at Romford — Colin Vaines
--                               and Tony, hosted by James Whale. The old
--                               site's news archive played it as "Q&A Session
--                               - Romford Film Foundation"; its words are the
--                               body below.
--   GeorgeWilderJr.mp3          Tony on The George Wilder Jr. Show, the week
--                               The Man Who Got Carter premiered in England.
--                               On no old page; described from the recording.
--
-- Also checked and NOT added: Radio_pitch1.mp3 is a 35-second promo for The
-- Man Who Got Carter, not an interview; "Tony Klinger and Vinvent Price.mp3"
-- is an earlier, shorter cut of the Look Back Machine interview, whose full
-- version the old page played and 06 carries. From the coaching site's
-- library: "screen-capture (1).mp3" is Akylah Rodriguez's BBC Radio
-- Northampton show and the two "y2mate" files are the BBC Radio Newcastle and
-- Bernie Keith interviews — all three already entries (08), linking to the
-- same recordings on YouTube.
--
-- Both have body text, so each has a page of its own; the recordings are
-- attached by scripts/import-audio.mjs.

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, position, body)
values
  ('interviews', 'The Man Who Got Carter — premiere Q&A', 'the-man-who-got-carter-premiere-qa',
   'Colin Vaines and Tony in a live Q&A after the world premiere, hosted by James Whale.',
   'published', now(), false, null, 80,
'Listen to the live Q&A session with Colin Vaines and Tony Klinger, hosted by James Whale.

This event was kindly hosted by the Romford Film Foundation and recorded by Alan Taylor-Shearer following the showing of The Man Who Got Carter at the world premiere in Romford’s Premiere Cinema.'),
  ('interviews', 'The George Wilder Jr. Show', 'the-george-wilder-jr-show',
   'Tony on filmmaking and storytelling, the week The Man Who Got Carter premiered.',
   'published', now(), false, null, 90,
'Tony joined George Wilder Jr. on his show in the week The Man Who Got Carter, his feature documentary about his father, the film producer Michael Klinger, premiered in England — talking about filmmaking, writing and telling stories by every means he can.')
on conflict (category, slug) do nothing;
