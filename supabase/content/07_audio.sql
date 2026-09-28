-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- The Audio collection: Tony's own audio works — audiobooks and dramas he
-- wrote or read. Interviews and podcast appearances are not here; they have
-- their own collections (06_interviews_and_podcasts.sql).
--
-- Audited 2026-09-25 against tonydklinger.com /audio and /audiobooks:
--
--   /audio        a 2020 press release ("Give-Get-Go Audio Launches") that
--                 links no recording — stale, NOT carried over.
--   /audiobooks   The Butterfly Boy, read by James Whale — still on sale,
--                 verified on the Google Play UK listing and Audible: IN.
--                 The Who and I, read by Tony, listed as "coming soon" — it
--                 was released only as a CD in a 250-copy box set, and its
--                 availability could not be confirmed: waiting on the owner.
--
-- Also waiting on the owner: the radio drama Reaper's Shadow (no recording in
-- the capture). The three untitled recordings once listed here were
-- identified by transcription on 2026-09-26 — two interviews, now in
-- 10_identified_interview_audio.sql, and a promo (Radio_pitch1), not added.

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, position, body)
values
  ('audio', 'The Butterfly Boy — the audiobook', 'the-butterfly-boy-audiobook',
   'Tony''s novel, read by James Whale — the story of Arnie, who overcame polio and the Nazi regime to become an artist.',
   'published', now(), false, null, 10,
'''The Butterfly Boy'' is an amazing story of Arnie and his remarkable life and career as an artist, despite polio paralysing both arms — overcoming both the disease and the Nazi regime of the Second World War.

Wonderfully read by James Whale, the audiobook is published by Andrews UK Limited and is available on Audible, Google Play and other leading platforms.')
on conflict (category, slug) do nothing;

insert into public.catalogue_item_links (catalogue_item_id, label, url, position)
select ci.id, v.label, v.url, v.position
from public.catalogue_items ci
join (values
  ('Listen on Audible', 'https://www.audible.com/pd/The-Butterfly-Boy-Audiobook/B00E4PGH36', 10),
  ('Google Play', 'https://play.google.com/store/audiobooks/details/The_Butterfly_Boy?id=AQAAAIAX1y5XKM', 20)
) as v(label, url, position) on true
where ci.category = 'audio' and ci.slug = 'the-butterfly-boy-audiobook'
on conflict (catalogue_item_id, url) do nothing;
