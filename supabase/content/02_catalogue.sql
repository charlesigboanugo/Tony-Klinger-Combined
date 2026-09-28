-- REAL SITE CONTENT — part of the production initial setup.
--
-- Everything under supabase/content/ is true of production: Tony Klinger's
-- real products, prices, curriculum, works, writing and team, migrated from
-- the three source sites. It reaches a deployed project through
-- `pnpm content:setup` (scripts/setup-content.mjs), and the local database
-- through `supabase db reset`, which loads these files before seed.sql
-- (config.toml [db.seed]).
--
-- Local-only fixtures — test accounts, their entitlements, placeholder rows —
-- do NOT belong here. They live in seed.sql.
--
-- No begin/commit in these files: the setup script runs them all in ONE
-- transaction, so a failure part-way leaves production untouched.
--
-- The catalogue of works: books, films, watch, stories — with body copy, buy links and cover crops.

-- Works first listed alongside the local placeholders, and real.
insert into public.catalogue_items (category, title, slug, description, status, published_at, is_external, external_url) values
  ('films', 'The Havana Chronicles', 'the-havana-chronicles',
   'A trilogy of screen stories following Havana — 4 Kicks, Honeysuckle Heights and Closed Circuit. In development.',
   'published', now(), false, null),
  ('films', 'Solo2Darwin', 'solo2darwin',
   'Documentary, 2019 — Amanda Harrison flies a 1942 Tiger Moth solo from the UK to Darwin. A Grub Street book of the same name exists separately.',
   'published', now(), false, null),
  -- Not Tony's own work: a talk by Rachel Kolsky on the Jewish contribution to
  -- the British film industry, in which he features. Externally hosted, so it
  -- lives in `watch` and links out rather than opening a detail page here.
  -- It links to the clip itself — Tony's excerpt on his own YouTube channel,
  -- the video the old site's page embedded — not to golondontours.com's home
  -- page, which never mentions the talk (corrected 2026-09-25).
  ('watch', 'Light''s, Chutzpah, Action!!', 'lights-chutzpah-action',
   'Tony Klinger talks about his father, Michael Klinger, in Rachel Kolsky''s talk on the Jewish contribution to the British film industry.',
   'published', now(), true, 'https://www.youtube.com/watch?v=35Rcrm6pDs4')
on conflict (category, slug) do nothing;

-- Real catalogue content — Tony Klinger's published works.
--
-- Sourced from tonydklinger.com (books, film and watch pages) and Wikipedia,
-- researched 2026-09-03. Titles and descriptions are drawn from those pages;
-- NOTHING IS INVENTED. Where a work is externally hosted but its URL was not
-- published on a page I could read, the row is left non-external rather than
-- pointed at a guessed address — a wrong link is worse than a missing one.

insert into public.catalogue_items
  (category, title, slug, description, status, published_at, is_external, external_url, tags, position)
values
  -- Books ------------------------------------------------------------------
  ('books', 'Who Knows: The Making of a Rock Movie', 'who-knows-making-of-a-rock-movie',
   'A behind-the-scenes account of making The Kids Are Alright with The Who — rock ''n'' roll excess, raw power and sheer brilliance.',
   'published', now(), false, null, '{give-get-go:publishing}', 10),

  -- ONE BOOK, not two (owner, 2026-09-25): How to Get Into the Movie Business
  -- includes its sister book, How to Get Your Movie Made, by Someone Who Knows.
  -- They were listed separately on the old site; the sister book's text is a
  -- section of this entry's body, and its old URL redirects here
  -- (next.config.ts).
  ('books', 'How to Get Into the Movie Business', 'how-to-get-into-the-movie-business',
   'Career guidance for aspiring filmmakers, from education and training through networking, internships and specialisation — with its sister book, How to Get Your Movie Made, by Someone Who Knows, in the same volume.',
   'published', now(), false, null, '{give-get-go:publishing}', 20),

  ('books', 'Alsatia, the Search for Treasure', 'alsatia-the-search-for-treasure',
   'Historical fiction set in seventeenth-century London — a pirate, hidden treasure and political intrigue across Europe.',
   'published', now(), false, null, '{give-get-go:publishing}', 40),

  ('books', 'Under God''s Table', 'under-gods-table',
   'A thriller following two childhood friends from Iraq, one Arab and one Jewish, who become enemies in a geopolitical conflict.',
   'published', now(), false, null, '{give-get-go:publishing}', 50),

  ('books', 'The Butterfly Boy', 'the-butterfly-boy',
   'Historical fiction about Arnie, a disabled German mouth painter navigating the Second World War and its aftermath.',
   'published', now(), false, null, '{give-get-go:publishing}', 60),

  -- Twilight of the Gods: My Adventures with The Who is not a separate book:
  -- it is the FIRST EDITION of Who Knows (owner, 2026-09-25). It is recorded
  -- in Who Knows' body, its jacket is in Who Knows' gallery, and its old URL
  -- redirects there (next.config.ts).

  ('books', 'The Who and I', 'the-who-and-i',
   'Tony Klinger on his working relationship with The Who. The audiobook, read by Tony (2h 15min), is coming soon.',
   'published', now(), false, null, '{give-get-go:publishing}', 80),

  -- Films -------------------------------------------------------------------
  ('films', 'The Kids Are Alright', 'the-kids-are-alright',
   'The 1979 concert documentary on The Who — an inside look at the band, with performances and interviews.',
   'published', now(), false, null, '{give-get-go:films}', 10),

  ('films', 'The Man Who Got Carter', 'the-man-who-got-carter',
   'Feature documentary on the film career of Tony''s father, the producer Michael Klinger. Premiered in Romford, 3 November 2018.',
   'published', now(), false, null, '{give-get-go:films,give-get-go:documentaries}', 20),

  ('films', 'Dirty, Sexy & Totally Iconic', 'dirty-sexy-and-totally-iconic',
   'Documentary marking fifty years of Get Carter, with Michael Caine and director Mike Hodges.',
   'published', now(), false, null, '{give-get-go:films,give-get-go:documentaries}', 30),

  ('films', 'Sisters', 'sisters',
   'Documentary on Zohra, the only all-female orchestra in Afghanistan, and the lives of its young musicians.',
   'published', now(), false, null, '{give-get-go:films,give-get-go:documentaries}', 40),

  ('films', 'Full Circle', 'full-circle',
   'A 2008 documentary on the INS Dakar, the Israeli submarine lost in 1968, and a son''s search for his father.',
   'published', now(), false, null, '{give-get-go:films,give-get-go:documentaries}', 50),

  ('films', 'Riding High', 'riding-high',
   'Feature starring motorcycle stunt rider Eddie Kidd as a messenger who enters a stunt competition.',
   'published', now(), false, null, '{give-get-go:films}', 60)
on conflict (category, slug) do nothing;

-- Body copy, recovered verbatim (site chrome trimmed) from the items' own
-- dedicated pages on tonydklinger.com. Every book and film had no body at
-- all — only the one-line description above — because the original crawl
-- recovered page text but nothing had moved it into this column yet. These
-- two are the films with real dedicated pages; books follow below, from their
-- sections on /books. Anything with no source text stays description-only
-- rather than invented.
update public.catalogue_items set body =
'I was asked to make this 1979 rock documentary by The Who because of previous work I''d done for their singer, Roger Daltrey, and for Deep Purple band members on "The Butterfly Ball". The making of this iconic film was an insane experience which I wrote about in my book "Twilight of the Gods". Keith Moon, sadly, did not live to see the film premiere.

The film captured the original band''s chaotic lifestyle, together and apart, both on and off stage. Some of the mayhem included a naked girl jumping out of a giant cake, the film Executive Producer (Sydney Rose) nearly drowning during a practical joke, the explosive interviews (and equipment!), and, above all, the ear-pounding sound of Mod anarchy.'
where slug = 'the-kids-are-alright';

update public.catalogue_items set body =
'The feature film documentary about the sensational film career of Tony''s late father, Michael Klinger — one of Britain''s most influential and successful film producers. The film premiered in Romford on 3 November 2018.

"I made my film this year because I am now the same age as my dad was when he died," said Tony. "I want to share why I and many others loved and respected my father."

Michael was a trailblazer in independent film producing, with early collaborations with Roman Polanski on Repulsion and Cul-de-sac, before creating one of Britain''s most iconic films, Get Carter, in 1971, featuring Michael Caine. Get Carter has since been rated by many as the best British gangster film ever made, and was named Best British Film by Time Out magazine.

From humble beginnings in the streets of Soho, Michael went on to work with stars including Roger Moore, Michael Caine, Peter Finch and Oliver Reed across thirty-three feature films.'
where slug = 'the-man-who-got-carter';

-- Book body copy. Most books have no dedicated page, but each has its own
-- section on tonydklinger.com/books, and that section is the source here —
-- verbatim, with site chrome and "Click the Button below" prompts removed and
-- three missing sentence spaces and one typo ("destructiona") corrected. The
-- Butterfly Boy and Under God's Table add the publisher lines from their own
-- pages; Who Knows adds the two closing paragraphs from the home page. The Who
-- and I (only an audiobook listing) has no text to give, so it stays
-- description-only and, with no body, no page.
update public.catalogue_items ci set body = v.body
from (values
  ('who-knows-making-of-a-rock-movie',
'Grab your backstage pass and discover the story behind the creation of a rock ''n'' roll masterpiece in Who Knows: The Making of a Rock Movie by Tony Klinger.

Klinger takes you on a wild journey behind the scenes of the iconic rock film The Kids Are Alright, which immortalised the legendary band The Who. Klinger paints a vivid picture of the tumultuous world of rock ''n'' roll excess, raw power, astonishing ignorance, and sheer brilliance that defined the making of this iconic movie.

Who Knows is a collision of two dynamic worlds - rock music and filmmaking. Witness the incredible highs and lows, the outrageous moments, and the captivating brilliance that forged The Kids Are Alright into cinematic history.

But that''s not all. Who Knows also offers an exclusive glimpse into the rock ''n'' roll universe through the lens of renowned rock photographer Danny Clifford, featuring rare and unique photos that capture the essence of an era.

If you''re a fan of rock music, filmmaking, or you simply love a good story, Who Knows is a must read. Tony Klinger''s unforgettable journey through the making of The Kids Are Alright - and the almost breaking of himself in the process - will leave you enthralled and inspired by the explosive collision of music and cinema.

Who Knows was first published as Twilight of the Gods: My Adventures with The Who.'),

  ('how-to-get-into-the-movie-business',
'Dreaming of a career in the movie business but unsure where to start? "How to Get Into the Movie Business" has the answers you have been searching for.

Whether you’re a recent graduate looking to break into the film world or considering a career change from an unfulfilling job, this book guides you on the path to a more exciting and rewarding life in film.

Award-winning filmmaker Tony Klinger provides a step-by-step roadmap to entering the industry, covering everything from education and training to networking, internships, and specialisation. Learn how to market yourself effectively, build valuable connections, and develop the persistence and resilience needed to succeed in one of the most competitive fields out there.

## Also in this book: How to Get Your Movie Made, by Someone Who Knows

Dreaming of making the next Hollywood blockbuster? How about an award-winning short film? Or even just higher-quality, more entertaining home videos? This book is your guide to making it happen.

With over 50 years of professional experience in the industry, including producing classics like "The Kids Are Alright", award-winning filmmaker Tony Klinger shares his wealth of knowledge and insider secrets to help progress your filmmaking career. From scriptwriting and casting to securing finance, marketing, and distribution, Tony’s insights provide the essential tools you need to bring your film vision to life.

Whether you are a seasoned professional or an aspiring filmmaker, "How to Get Your Movie Made by Someone Who Knows" is the roadmap to achieving your cinematic dreams.'),

  ('alsatia-the-search-for-treasure',
'Step into the shadowy streets of early 17th-century London, where the River Thames is vast, the air is foul, and life is harsh and fleeting. Amidst the filth and squalor, there is Alsatia - a notorious sanctuary for misfits, outlaws, and the desperate, a place where the law doesn’t reach and anything can happen.

In this world of survival, love, hate, and the constant hope for a better life, "Alsatia – The Search for Treasure" weaves a tale of adventure and intrigue. When a Spanish galleon carrying a fortune large enough to fund an empire is seized by the ruthless pirate Captain Van Der Welt, the stakes are set for an epic quest. Secretly working for the cunning and seductive Lady Violet, Van Der Welt sets off a deadly chain of events that pulls in kings, queens, the Pope, and a cast of colourful characters - all vying for the unimaginable riches hidden somewhere in Alsatia.

As Alsatia becomes a vibrant, lawless mini-city within London, it draws in a motley crew - the desperate, the depraved, the innocent, and the ambitious - each with their own reasons for seeking refuge in this chaotic haven. As the hunt for the treasure intensifies, alliances are formed and broken, and no one can be trusted. Will Lady Violet outwit the powerful forces that seek the treasure for themselves? Who will emerge victorious in this high-stakes battle for survival?

From the tumultuous streets of London to the halls of power across Europe, "Alsatia – The Search for Treasure" is a gripping tale of intrigue, betrayal, and the human spirit’s unyielding quest for hope and redemption. Follow these unforgettable characters as they navigate the perils of a century marked by civil war, plague, fire, and the execution of a king.

Dive into a world where good people are sometimes forced to do bad things, and where the quest for treasure leads to a clash between ambition and survival.'),

  ('under-gods-table',
'Today''s headlines and tomorrow''s.

Two boyhood friends, an Arab and a Jew from Iraq grow up to become deadly enemies living, loving and fighting across the globe.

Beginning their journey as Ehud and Moiz, the new world gives them westernized names, Eddie and Mo. They grow up to be secretly radicalized warriors, each convinced they are right and that any means are justified in order to achieve victory.

Can their brotherly love survive a never-ending war? Is the love these two boys once enjoyed more enduring than their hate against impossible odds?

The story climaxes when Israel''s famed security service, Mossad, discovers where Iraq''s weapons of mass destruction are hidden scratched on the bottom of an ancient table. A frantic race ensues to discover the weapons.

Against a background of societies collapsing into anarchy, are the two men, now implacable enemies, once blood brothers, Eddie and Mo. Whoever wins their private war will inherit the world.

Published by Gonzo Multimedia and available on Amazon and various other platforms.'),

  ('the-butterfly-boy',
'This powerful book takes the reader on a dramatic, sweeping journey through two World Wars in Germany and races on around the globe throughout that tumultuous century. The Butterfly Boy is the story of Arnie, who as a small boy loses the use of his arms through polio, yet conquers this to grow up to be the "greatest mouth painter in the world".

Born in a sleepy German town, Arnie rises to become one of Hitler''s favourite artists despite his handicap and Jewish mother. Arnie risks his life to undertake covert activities for the Allies and the Christian resistance movement. Arnie matures into a great handsome bull of a man, who, despite not having the use of his arms still manages to be a great womaniser and hell raiser. The conflict between Arnie and his childhood nemesis, now senior Nazi officer, Ratwerller, is a battle to the death that flashes through their lives like a sharpened razor. They stop at nothing to seek the destruction of one another.

After the war, Arnie, the Butterfly Boy, builds the Mouth Painting Charity around the world from which he makes tens of millions of dollars whilst destroying anyone that stands on his way. But it is his own waywardness and his unresolved past that haunts him. This is the story of an extraordinary man, taking an extraordinary journey during extraordinary times. You will love and fear for Arnie, and be hypnotised by him.

Published by Gonzo Multi Media and available now on Amazon and other leading platforms. The audio book version is published by Andrews UK Limited, and read by James Whale.')
) as v(slug, body)
where ci.slug = v.slug and ci.category = 'books';

-- Where to buy, listen or read more — every outbound link the live site gives
-- for a book, attached to the section it sits in (note the Stripe link: it is
-- the "FOR SIGNED COPIES" button beside Who Knows on both / and /books).
-- Amazon links are reduced to their /dp/ form; the stripped parts were search
-- tracking parameters. Five books have no link anywhere on the site.
insert into public.catalogue_item_links (catalogue_item_id, label, url, position)
select ci.id, v.label, v.url, v.position
from (values
  ('who-knows-making-of-a-rock-movie', 'Buy a signed copy', 'https://buy.stripe.com/eVa1801nw30Y5qwcMN', 10),
  ('under-gods-table', 'Gonzo Books', 'https://www.gonzopublishers.com/god-s-table', 10),
  ('under-gods-table', 'Amazon', 'https://www.amazon.co.uk/dp/1908728701', 20),
  ('under-gods-table', 'Google Books', 'https://books.google.co.uk/books/about/Under_God_s_Table.html?id=AjlJtAEACAAJ', 30),
  ('the-butterfly-boy', 'Gonzo Books', 'https://www.gonzopublishers.com/copy-of-new-page', 10),
  ('the-butterfly-boy', 'Amazon (paperback)', 'https://www.amazon.co.uk/dp/1782346856', 20),
  ('the-butterfly-boy', 'Amazon (audiobook)', 'https://www.amazon.co.uk/dp/B00E5UXAW6', 30),
  ('the-butterfly-boy', 'Oak Tree Press (audiobook)', 'http://oaktreepress.co.uk/audio-books-2/audio-books-2/the-butterfly-boy/', 40),
  ('the-butterfly-boy', 'Review on J-Wire', 'http://www.jwire.com.au/the-butterfly-boy-a-book-review/', 50)
) as v(slug, label, url, position)
join public.catalogue_items ci on ci.slug = v.slug and ci.category = 'books'
on conflict (catalogue_item_id, url) do nothing;

-- Films the first catalogue pass missed. Just A Boy has its own page under the
-- old site's catalogue (/just-a-boy); Shout at the Devil and The Butterfly Ball
-- are two of the five poster cards along the bottom of /film. Text is taken
-- from those pages; where a source says only that the film exists, the entry
-- says only that too.
insert into public.catalogue_items
  (category, title, slug, description, body, status, published_at, is_external, external_url, tags, position)
values
  ('films', 'Just A Boy', 'just-a-boy',
   'The true story of Richard McCann, a five-year-old boy who woke up to find his mother had gone — written and produced by Tony Klinger.',
'I am very fortunate to be involved in many diverse projects. When I met Richard McCann, the “BOY” in the title, I became instantly interested. It is the true, ultimately uplifting and inspiring, story of a five-year-old boy who woke-up and discovered his mother had gone.

The film depicts how the murder of one woman can ruin an entire family and trigger decades of drink, drugs, and deprivation. Despite Richard being beaten and abused for years, being thrown-out of the army, ‘going off the rails’ with drugs and being imprisoned, he retained his humanity. Somehow, he decided life did not need to continue that way.

Richard’s story is one of redemption and personal triumph. It shows us all how, with the will and determination, you can and you will overcome. How could I resist writing and producing this film?',
   'published', now(), false, null, '{}', 110),

  ('films', 'Shout at the Devil', 'shout-at-the-devil',
   'One of the films Tony Klinger made with his father, the producer Michael Klinger.',
   null, 'published', now(), false, null, '{}', 120),

  ('films', 'The Butterfly Ball', 'the-butterfly-ball',
   'A music film made with a host of music legends, including members of Deep Purple.',
   null, 'published', now(), false, null, '{}', 130)
on conflict (category, slug) do nothing;

-- Film body copy from tonydklinger.com, verbatim apart from trimming: /film
-- for Dirty Sexy & Totally Iconic, Full Circle and Riding High; the Sisters
-- press release for its synopsis and the Parliament screening; Solo2Darwin's
-- own page, less the dated "starting 11th May this year"; and the three
-- Havana Chronicles synopsis pages as three `## ` sections, each opening with
-- the tagline /the-havana-chronicles printed above that story's synopsis link;
-- one sentence the source had broken across two lines is rejoined.
update public.catalogue_items ci set body = v.body
from (values
  ('dirty-sexy-and-totally-iconic',
$b$Six Finger Productions with AR Media & Give-Get-Go Films & The Ted Lewis Centre present …

‘Dirty, Sexy and Totally Iconic’ is a documentary celebration of the 50th anniversary of British pop-noir classic ‘Get Carter’, a film rated by many as the best British gangster film of all time and billed as the “Best British Film ever” by Time Out magazine.

Producer and Presenter, Tony Klinger takes the viewer on a fascinating, personal and emotional journey to celebrate the 50th anniversary of the great film production of his father, the late Michael Klinger. The documentary traces all the elements that went into the iconic film, including fascinating interviews with some of the stars and crew including legendary actor Michael Caine and Director Mike Hodges.$b$),

  ('full-circle',
$b$Full Circle is a 2008 documentary film about the INS Dakar, an Israeli submarine that disappeared in 1968, the wreckage of which was found in 1999. Full Circle tells the tale of a son's unrelenting investigation to find his lost father and 68 fellow submariners. “The Men of the INS Dakar – Never Forgotten”.

In 1968, submariner Dan Manor was lost at sea with 68 fellow submariners. Dan was returning home to Israel aboard the INS Dakar to see his newborn son Arnon, when tragedy struck.$b$),

  ('riding-high',
$b$London-born motorcycle stunt rider Eddie Kidd stars as Dave Munday, a motorcycle messenger who lives with his eccentric, tough and extremely with-it grandma (Irene Handl) in a small seaside town. Dave is bored with his job but sticks with it because of the opportunities it gives him to fantasise with his bike as a stunt rider. One day, Dave sees a giant poster challenging all comers to beat American champion stunt rider Judas S. Chariot (Bill Mitchell) to jump the Devil's Leap - a disused railway viaduct across the Blackwater River in Essex - and win a gold plated dream machine. Dave rallies his friends around him at a local gig and the challenge is accepted. Marvin Ravensdorf (Murray Salem) is the flamboyant promoter of the big biking show and gives a dazzling party at a leading hotel, at which Dave makes a spectacular entrance and busts the party wide open.$b$),

  ('solo2darwin',
$b$We have just started work on a brilliant story about Amanda Harrison undertaking a huge journey following her triumph over cancer, and trying to encourage women over the world to get into STEM fields. We will be sharing updates of her journey throughout the experience and will be producing a feature documentary film. It is proudly our first Give-Get=Go film.

To celebrate and promote women in aviation and engineering Amanda will be flying her 1942 Tiger Moth (DH82a) from the UK to Darwin in Australia.

9,260 nautical Miles · 30 days · 23 countries · 33 take offs and landings

The aims: To Inspire women to achieve. To inspire cancer survivors to achieve great things in their life. To promote females in flying. To promote STEM amongst women. To inspire dyslexics to achieve and see dyslexia as a gift not a disability. To create the “Richard Harrison Aviation Apprenticeship Fund” to fund engineering apprenticeships for women.$b$),

  ('sisters',
$b$‘SISTERS’ follows UK musician, Dan Blackwell to Kabul to meet Afghanistan's first ever female orchestra ‘Zohra,’ the first female orchestra in a country where it is forbidden for women and girls to play music. Every member of this orchestra has faced terrible adversity to play music. Dan learned about ‘Zohra’ online and contacted them first via Facebook and then followed with an email.

‘SISTERS’ producer Tony Klinger met with MP’s and representatives of the House of Lords on Tuesday 19th October at a special screening at the Houses of Parliament of the documentary feature film ‘SISTERS’. A true story by musician and director Dan Blackwell as he investigates the lives of the members of ‘Zohra’ the first and last all-female orchestra in Afghanistan.

‘I was delighted to host this amazing film and thank Tony Klinger for bringing it to Westminster. Everyone should see this film and see the joy of music in the young Afghan women’s faces. The music institute has now been closed down and I urge the new leadership to reopen it immediately so that Afghan children can learn to celebrate the musical culture of Afghanistan.’  FLICK DRUMMOND MP$b$),

  ('the-havana-chronicles',
$b$A trilogy of screen stories, each following Havana.

## 4 Kicks

Hot, steamy, innocence blown away by intense sudden and unexpected, extreme violence. A beautiful girl seeks to destroy her family and everyone around her.

Things are awfully slow on the US Air Force base in the hot, sultry South of Europe, long forgotten guardians of the continent. It’s too slow for Havana, a girl on the cusp of being a woman.

Her friends Tony and James who find themselves hanging around each other, out for Kicks: anything to beat back the boredom for an hour, even a minute. Havana is the daughter of Colonel Bill, the Big Man who runs the base, and his bitter, browbeaten wife, Liz.

Havana is aware that she’s a girl who has an effortless sensual beauty and sexual attraction for almost every man she encounters and she relishes the visceral power this give her.

Together with Tony, Bill’s military chauffeur, Havana leads James, a well intentioned but naive political activist, they begin to engineer small, wild happenings, designed to shock society and anonymously aggravate her father, from who she’s alienated big time.

All three of the young people get their “kicks” out of the melodramatic reaction of the local towns people and Havana is thrilled that her father is near to having a stroke, and with the increasing power she has over the boys.

The boys are fascinated by Havana; they can't leave her, and so they find themselves going along with her scheme to shake up the place with ever -increasing gags that soon spiral out of control.

They join her seeming recklessness as it escalates into apparent insanity. The group swing a wrecking ball onto the local police station, knocking it to rubble. A policeman is caught on the john as the building collapses around him, but he come through, and it’s all in fun, right?

Will Bill wake up to reality in time to save his daughter from her actions?

Who gets the final “Kicks?”

## Honeysuckle Heights

HONEYSUCKLE HEIGHTS is where Havana is taken. Havana is in captivity but is she going to be tamed?

Havana is in captivity but is she going to be tamed?

We begin on the Highway and in the first minutes we are involved in a massive smash up in which Havana is a total heroine, saving several people from certain death.

HONEYSUCKLE HEIGHTS is where Havana is then taken when her parents make a deal for her to avoid jail time for a series of crimes she’s committed but which aren’t easy to prove.

Initially she is misled by one of the inhabitants who fakes that they’re the Doctor in charge.

In the luxurious surroundings of HONEYSUCKLE HEIGHTS dark secrets are hidden in unlit corridors. Taken off the streets in an effort to protect her from a life in prison. Havana hides from the truth but wherever she turns she’s confronted by her new reality.

Realizing that she’s been duped Havana rescues the real medical director and his team from their captivity.

But what do you expect in a residential home for people with mental illnesses other than a great many crazy people, including many of the staff. The Medical Director is a transsexual who is a gifted Doctor who is also revealed to be in the grip of a gambling obsession.

The Doctor uses the information she has illegitimately recorded without Havana’s permission to force her to fight for money with no holds barred. Blood and spittle fly as the fights are barbaric, exciting and rouse the crowds to hysteria.

## Closed Circuit

Havana remorselessly seeks her revenge. Her mission is to kill each of the 'Beast of Satan' gang members with the aid of the town’s closed circuit camera system. She can see them all...

Havana is back, and she wants revenge.

CLOSED CIRCUIT television is watching you now. A workman in overalls fixes up the ubiquitous cameras in many locales as we watch. On the corner of a building overlooking a car park, in a shop above a changing room, pointed at an apartment block. Everywhere we look the cameras are looking back at us.

How does a girl cope with the knowledge that she is the result of a savage occult gang rape? Havana Silver makes the discovery when she is living the life of an all-American 17 year old. Her idyllic lifestyle changes overnight when she receives the news via a prayer book, bequeathed to her by her long dead mother.

Havana discovers the truth of her mother’s rape by her fellow passing out police officer cadets, of the B of S club, of her conception, of the cover up. Havana needs to avenge her mother, and this becomes her mission.

But what punishment befits a rapist? Havana has a selection of suitably horrific ideas, which she puts in to practice with the aid of her tap into the town’s closed circuit camera system. She sees everywhere all of the time, she can manipulate the traffic lights, the trains, just about every remotely controllable machine in the area. When Havana puts her mind to something, failure is not an option. Tying the rapists together is the clandestine, “Beast of Satan” club, a secret society that uses women as sexual sacrifices. The group is merciless; its history is full of murder, sexual abuse and other atrocities. The club cannot be infiltrated or exposed, since its members are all police officers from all over the country. Havana’s only option is to become a police officer herself, and infiltrate wherever she can.

Havana remorselessly seeks her revenge. Her method is to kill each of the gang members in turn by making love, using whatever she can on them individually until they each die macabre deaths. We realise that the wicked and uncaring boys they were when they did this terrible thing to her are not the men they now are and we are forced to ask the question, do they deserve this fate.

Outside her mission, Havana is a beautiful, gentle young woman, and this side of her is adored by George her new journalist boyfriend. With George, Havana is clever, demure and gentle, his perfect partner. George is besotted, but why can he not see her on an evening, and why does she never talks about her work, or her past?

Closed Circuit is a brutal and ruthless trip around the mind of a woman who we care for and fear in equal measure. Havana is a dichotomy, when she is good she is perfect; when she is bad she is terrifying. Havana is capable of loving George like men dream of, and then she is capable of luring a victim with wild sex, slashing his face to ribbons, dousing him with petrol and setting him alight.

In Closed Circuit, tension is never far away; we are always surprised by Havana’s next move. This is a story of passion aroused by lust and revenge until it is totally out of control; when no one can draw the line between right and wrong.

Closed Circuit is the modern thriller with a tense, spellbinding plot. More than this, viewers are left asking themselves “who is watching me right now?”$b$)
) as v(slug, body)
where ci.slug = v.slug and ci.category = 'films';

-- Fuller text from the films' own pages (2026-09-23 sweep of the whole site):
-- The Man Who Got Carter from /the-man-who-got-carter (the /film excerpt was a
-- subset; "View the Trailer down below" dropped, the trailer is not hosted
-- anywhere that survives the Wix site); Sisters from its Chichester premiere
-- page and press release; Solo2Darwin gains the /solo2darwin-and-geopolitics
-- update on the flight's return from Beirut.
update public.catalogue_items set body = $b$The feature film documentary about the sensational film career of Tony's late father, Michael Klinger. One of Britain's most influential and successful film producers who shaped the industry immeasurably.

The film Premiered in Romford on November 3rd 2018.

“I made my film this year because I am now the same age as my dad was when he died;” said Tony, “I want to share why I and many others loved and respected my father.”

Michael was a trailblazer in his field of independent film producing, resulting in early collaborations with master director Roman Polanski on ‘Repulsion’ and ‘Cul-de-sac’. He also went on to create one of Britain’s most Iconic films ‘Get Carter’ in 1971, featuring the great Michael Caine.

This film has been rated by many as the best British gangster film of all time, and recently was recognised as the Best British Film ever by Time Out magazine.

Working in an industry that was then in a serious slump, Michael Klinger’s unique talents, sharp wit, and impeccable resolve led to a career in which he had become the most successful film producer in the country and gave him a permanent positive impact on the world of film.

The Romford Film Foundation said: “What an incredible day it was at the Michael Klinger retrospective all thanks to the icon who is Tony Klinger - Watching Cul de Sac, Pulp and Get Carter in the way they are supposed to be seen. On a big cinema screen. Definitely recommend it. Then we watched the new documentary about Michael Klinger life and work. Now here is a man who I would loved to have met. The genuine love that people still have him spills through the screen and brought an actual tear or two to my eye. Tony Klinger You sir, have created a beautiful and very moving commemoration to you Father, one everybody is proud to have participated in and to have watched. Thank you"

From humble beginnings in the streets of Soho, Michael’s surged through the changing times and evolved into a man who reached remarkable achievements. He worked with stars such as Roger Moore, Michael Caine, Peter Finch, Oliver Reed, and many others in his thirty-three feature films.$b$
where slug = 'the-man-who-got-carter' and category = 'films';

update public.catalogue_items set body = $b$Sisters follows UK musician, Dan Blackwell to Kabul to meet Afghanistan's first ever female orchestra ‘Zohra’, the first female orchestra in a country where it is forbidden for women and girls to play music. Every member of this orchestra has faced terrible adversity to play music. Dan learned about Zohra online and got in contact with them first via Facebook and then followed with an email.

This extraordinary documentary feature film ‘Sisters’ is a real-life story; it investigates the lives of the Zohra members, the first all-female orchestra in Afghanistan’s and their two young leaders: Negin Khpalwak and Zarifa Adiba.

Dan Blackwell is a travelling musician and film maker from the UK. After working in the industry as a Session Guitarist, Producer and Composer, Dan launched a project called '4bar Collective'. The aim was to collaborate with large numbers of musicians, recording 4 bars of music from each to create original tracks and a network of cross promotion for all the artists involved. ‘Sister’ & Soundtrack Composed by Dan Blackwell & Tom Biggs

“When I discovered Zohra online, I was inspired to completely rework the structure of the project into a documentary series and working with Tony Klinger helps me realise this ambition.” — Dan Blackwell, director of ‘Sisters’

Negin Khpalwak, the Conductor of Zohra. At 20 years old she is the oldest member and the leader of the Zohra Ensemble. She sticks with and leads Zohra as the country’s first female conductor despite multiple death threats and family disputes. Zarifa is nowhere to be seen until Dan tracks her down. Discovering her precarious situation, Dan stays with her as she prepares to flee Afghanistan leaving close friends and family behind.

Zarifa Adiba — along with Negin, Zarifa was the outspoken second leader of Zohra until she fled the country during the production of this film.

'I would rather die standing on my feet than living on one knee' — Zarifa Adiba

‘Sisters’ had its UK premiere at the Chichester International Film Festival on Monday 16th August 2021, introduced by Executive Producer Tony Klinger.

‘SISTERS’ producer Tony Klinger met with MP’s and representatives of the House of Lords on Tuesday 19th October at a special screening at the Houses of Parliament of the documentary feature film ‘SISTERS’. A true story by musician and director Dan Blackwell as he investigates the lives of the members of ‘Zohra’ the first and last all-female orchestra in Afghanistan.

‘I was delighted to host this amazing film and thank Tony Klinger for bringing it to Westminster. Everyone should see this film and see the joy of music in the young Afghan women’s faces. The music institute has now been closed down and I urge the new leadership to reopen it immediately so that Afghan children can learn to celebrate the musical culture of Afghanistan.’ — Flick Drummond MP$b$
where slug = 'sisters' and category = 'films';

update public.catalogue_items set body = body || $b$

$b$ || $b$Solo2Darwin to temporarily return to the UK to await permissions and new weather window. Following on from detailed discussions around some of the barriers currently holding up Amanda Harrison in Beirut, it has been decided that Amanda will fly G-AXAN back to the UK temporarily and await the clearing of airspace and the next weather window to fly safely through India, Bangladesh, Myanmar, Thailand and Indonesia.

There are two weather windows to get down to Australia, May/June and Sept/Oct. With the delay in opening the airspace in Pakistan Solo2Darwin has lost the May/June window. Amanda will fly a shorter route back to the UK flying from Beirut to Cyprus then on through Greece, Italy and France. The route is shorter and less problematic as it isn’t Amy’s route.

Solo2Darwin will re-plan a start from Beirut at an achievable weather window. It will also give Amanda an opportunity to be in the UK in time for planned appointments with her oncologist, which were at risk as delays got longer. Solo2Darwin will still complete and the energy and momentum generated around the adventure will continue and grow.$b$
where slug = 'solo2darwin' and category = 'films' and body not like '%Beirut%';

-- Every outbound link the site gives for a film, where it still resolves
-- (checked 2026-09-23). Left out as dead: sistersfilm.co.uk (404) and the
-- Sisters Amazon Prime listing (404).
insert into public.catalogue_item_links (catalogue_item_id, label, url, position)
select ci.id, v.label, v.url, v.position
from (values
  ('the-kids-are-alright', 'Buy the DVD on Amazon', 'https://www.amazon.co.uk/dp/B0001FYRLM', 10),
  ('sisters', 'Watch the film on YouTube', 'https://www.youtube.com/watch?v=P4125B0Dt5I', 10),
  ('sisters', 'Trailer', 'https://www.youtube.com/watch?v=Hai2_Ay7zCo', 20),
  ('sisters', 'Sisters on Facebook', 'https://www.facebook.com/Sistersgivegetgo', 30),
  ('solo2darwin', 'Solo2Darwin — Amanda J Harrison', 'https://www.amandajharrison.com/solo2darwin', 10)
) as v(slug, label, url, position)
join public.catalogue_items ci on ci.slug = v.slug and ci.category = 'films'
on conflict (catalogue_item_id, url) do nothing;

-- Full Circle's images are not from the old sites: openly licensed photographs
-- of the INS Dakar from Wikimedia Commons (supabase/content/images/CREDITS.md).
-- CC BY-SA requires attribution where they are shown, so the page carries it.
update public.catalogue_items set body = body || $b$

Photographs, via Wikimedia Commons. Cover: the INS Dakar, 1968, by a Bamahane photographer (Israel Defense Forces), CC BY-SA 3.0. The Dakar's masts in the western Mediterranean on 18 January 1968, probably its last photograph, from the Clandestine Immigration and Naval Museum, CC0. The Dakar's emblem, Israel Defense Forces, CC BY-SA 3.0.$b$
where slug = 'full-circle' and category = 'films' and body not like '%Photographs, via Wikimedia Commons%';

-- Which edge of the cover a card keeps when it crops to fill (migration 0008_catalogue_and_site_media;
-- default 'top'). Set only where the title sits elsewhere, checked against the
-- crop: Alsatia's title is top left of a square painting, Sisters' is at the
-- left of a landscape poster, Just A Boy's top left of a landscape still.
-- Solo2Darwin's still is over twice as wide as it
-- is tall, so no 3:4 crop can hold its title; centre keeps the pilot on the
-- wing instead, and the card's caption carries the title.
update public.catalogue_items set cover_focus = 'left'
  where slug in ('alsatia-the-search-for-treasure', 'sisters', 'just-a-boy');
update public.catalogue_items set cover_focus = 'center'
  where slug = 'solo2darwin';

-- Entries retired on 2026-09-25 (owner): each duplicated another book — see
-- the comments at their former rows. Inserts above never delete, so a
-- database set up before then needs this to drop them. Their URLs redirect
-- (next.config.ts), and their cover resources are left in place, unused.
delete from public.catalogue_items
where category = 'books'
  and slug in ('how-to-get-your-movie-made', 'twilight-of-the-gods');
