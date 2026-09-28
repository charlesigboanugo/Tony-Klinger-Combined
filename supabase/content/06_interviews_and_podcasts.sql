-- REAL SITE CONTENT — part of the production initial setup (see 01_*.sql).
--
-- Podcasts and interviews, from tonydklinger.com/interviews and the old site's
-- Podcasts menu, audited 2026-09-25. Every entry here was checked that day:
-- an external link had to resolve to the actual episode (YouTube and SoundCloud
-- through their oEmbed endpoints, the rest by fetching the page), and a hosted
-- recording had to exist in the capture. EXCLUDED, with the reason:
--
--   Movie Date / Food Film Music   YouTube video removed (oEmbed 404)
--   The Right Buzz                 Spreaker episode gone (page and API 404)
--   BBC Radio Northampton, x2      BBC Sounds programmes expired (404)
--   Play Morricone For Me          Mixcloud show removed (404)
--   Dare to Be Authentic           BlogTalkRadio no longer exists
--   The Russ Kane Show             SoundCloud widget whose track was never captured
--   Romford Q&A, Public Speaking   video — belongs on the video host (note 09 §40.1),
--                                  not yet uploaded there
--
-- Classification: a PODCAST appearance is filed under podcasts, a radio or
-- broadcast interview under interviews — one canonical category per work
-- (note 08 §28.2.1). The old site mixed both on one page.
--
-- An external entry links straight out. A hosted recording has body text, so
-- it has a page of its own, and its audio is attached by
-- scripts/import-audio.mjs (files cannot be uploaded from SQL). Descriptions
-- and bodies are the old site's words, lightly corrected (capitalisation,
-- a "NEW" prefix and player chrome dropped; Michael Klinger called a
-- producer, not a "film director" as the old page had it); nothing is invented.

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, position)
values
  ('podcasts', 'The Tony Klinger Podcast', 'the-tony-klinger-podcast',
   'Tony’s own series on YouTube — beginning with how to get your kids into the film industry.',
   'published', now(), true, 'https://www.youtube.com/playlist?list=PLECLKL2ZtIJqEshp2zTx3qxbo--C2myvF', 10),
  ('podcasts', 'Follow Your Dream Podcast', 'follow-your-dream-podcast',
   'Tony Klinger, international award-winning filmmaker and author — The Who’s The Kids Are Alright, and The Avengers.',
   'published', now(), true, 'https://www.followyourdreampodcast.com/episodes/tony-klinger-international-award-winning-filmmaker-and-author-including-the-whos-the-kids-are-alright-and-he-worked-on-the-avengers', 20),
  ('podcasts', 'The Sod’s Law Podcast', 'the-sods-law-podcast',
   'It’s Tony Klinger week on the Sod’s Law Podcast with Daniel M. Rosenberg — filmmaking, storytelling and much, much more.',
   'published', now(), true, 'https://www.youtube.com/watch?v=Go79P8jzGnQ', 30),
  ('podcasts', 'Southeast Media Podcasts', 'southeast-media-podcasts',
   'Host Jodi Hockinson welcomes Tony Klinger, author of Under God’s Table.',
   'published', now(), false, null, 40),
  ('podcasts', 'The Look Back Machine Podcast', 'the-look-back-machine-podcast',
   'Tony on working with the legendary Vincent Price on The Butterfly Ball (1977).',
   'published', now(), false, null, 50),
  ('podcasts', 'Waffleon Podcast', 'waffleon-podcast',
   'Med’s and Kell mention Tony and his documentary in the October episode of their podcast.',
   'published', now(), true, 'https://www.podbean.com/media/share/pb-6t6pv-9dce05', 60),
  ('podcasts', 'The Audio Ade-Memoire Podcast', 'the-audio-ade-memoire-podcast',
   'A discussion of The Man Who Got Carter with hosts Alan Taylor-Shearer and Adrian Silas.',
   'published', now(), false, null, 70),
  ('podcasts', 'This Is Happening Podcast', 'this-is-happening-podcast',
   'The L.A.-based podcast had Tony round to talk everything film, his projects, and many anecdotes.',
   'published', now(), true, 'https://soundcloud.com/thisishappeningthepodcast/episode-16-tony-klinger', 80),
  ('interviews', 'Starlight Broadcasting', 'starlight-broadcasting',
   'Steve Harris interviews Tony, son of Michael Klinger — an interview that ran long enough to need two parts.',
   'published', now(), false, null, 10),
  ('interviews', 'BBC Radio Birmingham with Danny Kelly', 'bbc-radio-birmingham-danny-kelly',
   'Tony and Danny Kelly on the life and legacy of Kirk Douglas.',
   'published', now(), false, null, 20),
  ('interviews', 'The Douglas Coleman Show', 'the-douglas-coleman-show',
   'Tony on his years with The Who, and what he has in store.',
   'published', now(), false, null, 30),
  ('interviews', 'Hope FM', 'hope-fm',
   'Tony with Deborah Fennella and Tony C Gough on their Bournemouth afternoon show.',
   'published', now(), false, null, 40),
  ('interviews', 'Soul Radio USA — Spotlight On', 'soul-radio-usa-spotlight-on',
   'Tony talks with Steve Harris about his career and what is in the pipeline.',
   'published', now(), false, null, 50),
  ('interviews', 'TalkRADIO with James Whale', 'talkradio-james-whale',
   'Tony on TalkRADIO ahead of the world premiere of The Man Who Got Carter.',
   'published', now(), false, null, 60),
  ('interviews', 'Worlds Most Amazing People', 'worlds-most-amazing-people',
   'Tony on New York’s WMAP radio show, on his career and The Man Who Got Carter.',
   'published', now(), false, null, 70)
on conflict (category, slug) do nothing;

update public.catalogue_items ci set body = v.body
from (values
  ('southeast-media-podcasts',
'Join host Jodi Hockinson as she welcomes Tony Klinger, author of Under God’s Table. Tony Klinger is a writer & filmmaker. In June he received Romford’s “Lifetime Achievement Award” which joins his many other awards. He writes novels, film scripts and plays. His novel, Under God’s Table, and his book, The Who and I, about making his film, The Kids are Alright, are now on sale.

The second edition of another of his novels, The Butterfly Boy, is expected to be available before Christmas. Tony’s latest film production, a feature documentary, titled The Man Who Got Carter, premiered in 2018. In a career that spans being an academic, business leader, film-maker and writer Klinger simply calls himself a storyteller.'),

  ('the-look-back-machine-podcast',
'In full festive Halloween spirit, the good folks at the Look Back Machine Podcast interviewed Tony about his experience with the legendary Vincent Price on The Butterfly Ball (1977). Vincent’s performance as the narrator motivated Tony through the cursed production.'),

  ('the-audio-ade-memoire-podcast',
'Tony made an appearance on The Audio Ade-Memoire podcast show, having a brilliant discussion on The Man Who Got Carter with the excellent hosts, Alan Taylor-Shearer and Adrian Silas.'),

  ('starlight-broadcasting',
'On Thursday 18th June 2020 Steve Harris of Starlight Broadcasting interviewed producer, director and author Tony Klinger, the son of UK film producer Michael Klinger, but the interview lasted longer than expected so it had to be split into two parts.'),

  ('bbc-radio-birmingham-danny-kelly',
'Tony appeared on Danny Kelly’s show to discuss the recent passing of one of Hollywood’s Golden Age legends, Kirk Douglas.

They discuss Kirk’s roots, his family, legacy and more.'),

  ('the-douglas-coleman-show',
'Tony sat down to talk with Douglas Coleman and enjoyed discussing his past experiences with rock band The Who, as well as delving into some of the things Tony has in store for the future.'),

  ('hope-fm',
'Tony was kindly invited on to talk with Deborah Fennella and Tony C Gough on their afternoon radio show in Bournemouth. They have a great discussion about Tony’s father Michael Klinger, as well as the exciting plans for the new musical with David Courtney, ‘The Show Must Go On’.'),

  ('soul-radio-usa-spotlight-on',
'Tony was a guest on SoulRadioUSA, having an excellent interview with Steve Harris about his career and current projects, sharing anecdotes and information on what is in the pipeline.'),

  ('talkradio-james-whale',
'Tony made an appearance on TalkRADIO with host James Whale, who was also due to host the Q&A session at the world premiere of The Man Who Got Carter.'),

  ('worlds-most-amazing-people',
'Tony made an appearance on the Worlds Most Amazing People (WMAP) radio show in New York, answering questions on his career as well as discussing The Man Who Got Carter.')
) as v(slug, body)
where ci.slug = v.slug and ci.category in ('podcasts', 'interviews');

-- Starlight Broadcasting's interview is two YouTube videos, so the entry has
-- a page carrying both parts rather than linking out to one of them.
insert into public.catalogue_item_links (catalogue_item_id, label, url, position)
select ci.id, v.label, v.url, v.position
from public.catalogue_items ci
join (values
  ('Watch part 1 on YouTube', 'https://www.youtube.com/watch?v=OO0Jzv93-v4', 10),
  ('Watch part 2 on YouTube', 'https://www.youtube.com/watch?v=c-Kupqa9aek', 20)
) as v(label, url, position) on true
where ci.category = 'interviews' and ci.slug = 'starlight-broadcasting'
on conflict (catalogue_item_id, url) do nothing;
