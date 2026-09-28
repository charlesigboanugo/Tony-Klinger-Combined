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
-- Group coaching series, private coaching, retreats, team, testimonials, extra films and membership benefits.

-- Group coaching series, from the storefront's /group-sessions outline.
--
-- Four series of eight sessions each. THE OUTLINE IS STORED AS THE SERIES
-- DESCRIPTION, and no session rows are created.
--
-- `group_coaching_sessions.starts_at` is NOT NULL, so seeding the eight
-- sessions would mean inventing dates — and a dated session is bookable, so
-- customers would be reserving places at times that do not exist. The running
-- order is content; the schedule is an operational decision an administrator
-- makes in /admin. Nothing is lost: every session title is preserved below.


insert into group_coaching_series (name, slug, description, syllabus, status)
values ('Filmmaking', 'filmmaking', 'The business of a creative career — competing, dealing, and getting paid properly.',
  array[
    'Who are You Competing With?',
    'Doing the Deal',
    'How to Make a Living From Creativity',
    'Don''t Limit Yourself / The Right Attitude',
    'Get Jobs & Get Paid Properly',
    'How should creatives Deal with Money?',
    'Buying & Selling Options in the Creative Industries',
    'Raising your Profile'
  ], 'published')
on conflict (slug) do update set description = excluded.description,
  syllabus = excluded.syllabus, status = 'published';

insert into group_coaching_series (name, slug, description, syllabus, status)
values ('Writing', 'writing', 'Writing for money, and building a writing career that sustains itself.',
  array[
    'Writing For Money (Authors, Poets, Scriptwriters)',
    'Give a Boost to your writing career',
    'Maximizing your writing potential',
    'What do writers have to do?',
    'How to make a book submission to a publisher / How to get a publisher',
    'Why we Writers Write',
    'How to Work with Publishers',
    'What comes first, you or your project?'
  ], 'published')
on conflict (slug) do update set description = excluded.description,
  syllabus = excluded.syllabus, status = 'published';

insert into group_coaching_series (name, slug, description, syllabus, status)
values ('Producing', 'producing', 'Getting a film made, financed, marketed and sold.',
  array[
    'How to Get your Movie made',
    'Choosing your Partners',
    'Raising Money',
    'Casting Actors, the how and why',
    'How to deal with PR & Marketing',
    'Marketing, how to get results',
    'Distribution & Sales Part 1',
    'Distribution & Sales Part 2'
  ], 'published')
on conflict (slug) do update set description = excluded.description,
  syllabus = excluded.syllabus, status = 'published';

insert into group_coaching_series (name, slug, description, syllabus, status)
values ('For all Filmmakers', 'for-all-filmmakers', 'From first idea to a business plan that stands up.',
  array[
    'Finding the right ideas — How and why',
    'Perfecting your treatment, outline, synopsis',
    'How to get that script written — What to aim for',
    'Creating a great Look Book',
    'Delivery of the breakdowns, schedules, budgets and cash flow',
    'Create your critical path analysis',
    'Make your Business Plan irresistible',
    'If it ain''t on the page it ain''t on the stage!'
  ], 'published')
on conflict (slug) do update set description = excluded.description,
  syllabus = excluded.syllabus, status = 'published';



-- Private coaching and retreats, from the storefront.

insert into private_coaching_services (product_id, name, slug, description, benefits, duration_minutes, status)
select p.id, 'Advanced One-to-One Coaching', 'advanced-one-to-one',
  'A direct line to Tony''s own experience, applied to your project.',
  array[
    'Personal insight into your project from a working producer''s perspective',
    'Direct advice on how to mount, produce and market your work',
    'Scheduled to suit you, not a fixed slot',
    'Can be purchased as a gift'
  ],
  60, 'published'
from products p where p.slug = 'one-to-one-single'
on conflict (slug) do update set description = excluded.description,
  benefits = excluded.benefits, status = 'published';

-- The Virtual Retreat is named across the storefront navigation and referenced
-- by the scholarships page, but no retreat page was captured in the export, so
-- there is no description, date or capacity to migrate. Created as a DRAFT so
-- it exists to be completed in /admin rather than published half-empty.
insert into retreats (name, slug, description, requires_application, status)
values ('Virtual Retreat', 'virtual-retreat',
  'Referenced across the previous storefront; details to be confirmed.', true, 'draft')
on conflict (slug) do nothing;


-- The team, from the coaching app's own About pages.
--
-- Photographs are matched by FILENAME, which is reliable here and only here:
-- these files are named `tony.webp`, `helen.JPG` and so on. The 262 images from
-- the main site carry Facebook export ids and numbered names, which is why
-- those are left for a person to assign.

insert into team_members (name, slug, role, bio, position, status, photo_resource_id)
select 'Tony Klinger', 'tony-klinger', 'Founder', 'Tony Klinger is an award-winning producer, director and educator with decades of experience in the international film industry. He has worked with major studios and creative teams across the world, and has authored several acclaimed books on filmmaking and career development. His teaching approach blends real-world knowledge with storytelling that helps creative people achieve their professional goals. Through this programme, Tony helps students break into the industry and thrive in competitive creative environments.', 10, 'published',
       (select id from resources where storage_path ~ '/[0-9a-f]{8}-tony\.[A-Za-z]+$' limit 1)
on conflict (slug) do update
   set role = excluded.role, bio = excluded.bio, status = 'published',
       photo_resource_id = coalesce(excluded.photo_resource_id, team_members.photo_resource_id);

insert into team_members (name, slug, role, bio, position, status, photo_resource_id)
select 'Louize Yafai', 'louize-yafai', 'Junior Partner — Emotional Recovery & Life Transitions Coach', 'Louize Yafai is a Junior Partner with TKOC. Louize is a trusted and accredited Emotional Recovery & Life Transitions Coach who specialises in helping people stay grounded, focused and emotionally resilient during times of change. Drawing from her own journey through divorce and co-parenting as a mother of three, she blends lived experience with professional training to help others regain identity, confidence and clarity when life feels unstable. At TKOC, Louize teaches practical emotional tools to support creatives at every level of the industry, enabling actors, filmmakers and returning or emerging talent to navigate pressure, rejection, reinvention and personal challenges with greater steadiness, courage and self-belief.', 20, 'published',
       (select id from resources where storage_path ~ '/[0-9a-f]{8}-louize\.[A-Za-z]+$' limit 1)
on conflict (slug) do update
   set role = excluded.role, bio = excluded.bio, status = 'published',
       photo_resource_id = coalesce(excluded.photo_resource_id, team_members.photo_resource_id);

insert into team_members (name, slug, role, bio, position, status, photo_resource_id)
select 'Elaine Harrison', 'elaine-harrison', 'PR and Media Executive', 'Elaine Harrison is a PR and Media Executive for Tony Klinger Online, and is also a subject expert for Give Get Go Education, author and coach who helps writers, creatives and leaders bring their ideas to life. With a background spanning magazine editing, TV, and international coaching of chief executives, she has guided authors to publishing deals, earned recognition as a PR strategist, and empowered individuals to find their authentic voice. Author of Today Is The Day You Change Your Life, Elaine blends media expertise with mindset and manifestation coaching to help people turn inspiration into lasting impact.', 30, 'published',
       (select id from resources where storage_path ~ '/[0-9a-f]{8}-elaine\.[A-Za-z]+$' limit 1)
on conflict (slug) do update
   set role = excluded.role, bio = excluded.bio, status = 'published',
       photo_resource_id = coalesce(excluded.photo_resource_id, team_members.photo_resource_id);

insert into team_members (name, slug, role, bio, position, status, photo_resource_id)
select 'Jon Mackley', 'jon-mackley', 'Coaching Modules — Give-Get-Go Education', 'Jon Mackley is a storyteller by instinct and a mentor by vocation. With a background in medieval literature, Gothic fiction, film history and creative writing, he brings a rich and varied portfolio to his work in creative education and media development. His guiding belief is that great stories change lives, and that emerging writers, filmmakers and creatives deserve the tools, structure and support to tell their own. Jon authors and develops coaching modules for Give-Get-Go Education, helping new entrants into the film and TV industries find their voice, build resilience and create a lasting professional presence. Before joining GGGE, Jon was Senior Lecturer in English and Creative Writing at the University of Northampton, specialising in Medieval and Gothic Literature.', 40, 'published',
       (select id from resources where storage_path ~ '/[0-9a-f]{8}-john\.[A-Za-z]+$' limit 1)
on conflict (slug) do update
   set role = excluded.role, bio = excluded.bio, status = 'published',
       photo_resource_id = coalesce(excluded.photo_resource_id, team_members.photo_resource_id);

insert into team_members (name, slug, role, bio, position, status, photo_resource_id)
select 'Helen Kenworthy', 'helen-kenworthy', 'Theatre Practitioner, Educator and Author', 'Helen Kenworthy is a UK-based theatre practitioner, educator and author whose career spans over 30 years. Born in Solihull, she developed a love for theatre, storytelling and creative expression alongside her mother, Valerie Lewis. Mentored by Bill Kenwright CBE, Helen trained in English, Theatre and Education, and went on to direct and produce theatre across regional venues, youth arts programmes and Theatre-in-Education. She founded RYTC (now RYTC Creatives CIC) to combine youth development, mental health awareness and creative empowerment, and is a founding partner of Give Get Go Education. Helen brings her expertise in casting, characterisation, and dealing with actors, agents and their managers. Her philosophy is simple: “You are enough. You are powerful. And of course, you can.”', 50, 'published',
       (select id from resources where storage_path ~ '/[0-9a-f]{8}-helen\.[A-Za-z]+$' limit 1)
on conflict (slug) do update
   set role = excluded.role, bio = excluded.bio, status = 'published',
       photo_resource_id = coalesce(excluded.photo_resource_id, team_members.photo_resource_id);





insert into testimonials (quote, attributed_to, attribution_detail, context, featured, position, status) values
  ('Tony, you are an inspirational person who has provided our society with so much knowledge and talent. You have taught me so much about the film industry and life in general. You are a legend. Thank you for being my friend, always being there for me, and sharing your incredible talent with us.', 'Francesca Lilleystone', 'East London Enquirer', 'general', true, 10, 'published'),
  ('Thank you — I really appreciate your input and your honesty. This class is much more than a writing class. It''s a journey into thinking, feeling, recognising and growing as a person.', 'Phil Miller', null, 'courses', true, 20, 'published'),
  ('Loved the session. Not pandering. Honestly. Exactly what I was looking for.', 'Sharon Touvaino', null, 'coaching', true, 30, 'published'),
  ('Firstly I would like to say how much I have learned from this course. As a complete novice who just sat down and wrote for therapy, I have now seen a creation with possibilities grow from that initial writing. I would never have a clue about writing without your course, so if I ever have something published you are the reason. Once again thank you Tony for enlightening me on how to become an author.', 'Mike Necus', null, 'courses', true, 40, 'published'),
  ('The only reason I didn''t give you full marks all around was to avoid you having difficulty getting through the door with such a swollen head.', 'Geoffrey Iley', null, 'general', false, 50, 'published'),
  ('Simply, very well said! Not only a dynamic film producer, but Tony is also a fabulous example of the importance of understanding the whole process. If you understand every aspect, you''ll value the people doing those jobs and the end result will be substantially improved.', null, 'Client satisfaction survey', 'general', false, 60, 'published'),
  ('Tony Klinger gave us a great event — a masterclass in communicating gems of business wisdom within a hugely entertaining talk.', null, 'Client satisfaction survey', 'general', false, 70, 'published'),
  ('For anyone interested in working in the creative field, the Tony Klinger coaching classes are a must. The classes have been extremely informative; Tony is able to pass on a wealth of knowledge on every aspect of the creative industry, guide you in the right direction, and share the best way to succeed.', null, 'Reporter, East London Enquirer', 'coaching', true, 80, 'published'),
  ('That wasn''t what I expected. I was prepared for some rabble-rousing exhortations to get out there and sell, sell, sell — instead I got this gently spoken guy taking us on a journey to places I, at least, hadn''t seriously considered before.', null, 'Client satisfaction survey', 'coaching', false, 90, 'published'),
  ('It''s true. Just watched today''s one as I missed it live. Thoroughly enjoyed it. Learnt so much. Really love your honesty. Your delivery is superb.', null, 'Client satisfaction survey', 'coaching', false, 100, 'published'),
  ('I have followed your advice several times. It hasn''t failed me.', null, 'Client satisfaction survey', 'coaching', false, 110, 'published')
on conflict do nothing;



-- Cover images, and the films the catalogue was missing.
--
-- EVERY MATCH BELOW WAS VERIFIED BY LOOKING AT THE IMAGE, not inferred from a
-- filename or from which page it sat on. An earlier automated pass matched a
-- radio presenter's portrait to a novel and a stock photo to a film, which is
-- why the rest of the 356 images stay unassigned until a person looks at them.

-- Films found while checking covers: real Tony Klinger work with a poster in
-- the export but no catalogue entry.
insert into catalogue_items (category, title, slug, description, status, published_at, tags, position)
values
  ('films', 'Deep Purple Rises Over Japan', 'deep-purple-rises-over-japan',
   'The original film edition — Budokan, Tokyo, 15 December 1975.', 'published', now(), '{give-get-go:films}', 80),
  ('films', 'Rachel''s Man', 'rachels-man',
   'A biblical romance starring Mickey Rooney and Leonard Whiting, made with Michael Klinger.',
   'published', now(), '{}', 90),
  ('films', 'Gold', 'gold',
   'The 1974 Roger Moore adventure, produced by Michael Klinger.', 'published', now(), '{}', 100)
on conflict (category, slug) do nothing;

-- FILM RUNNING ORDER: newest first, by year of release — the owner's choice
-- (2026-09-24). The first film in this order opens /catalogue/films. Set here,
-- in one place, after every film row exists (these rows are spread across
-- 02_catalogue.sql and this file). Years come from the old site or the film's
-- own listings; Deep Purple Rises Over Japan is its 1985 release, not the 1975
-- concert it records. The two films still in development have no year and
-- follow the finished ones.
update public.catalogue_items ci set position = v.position
from (values
  ('dirty-sexy-and-totally-iconic',  10),  -- 2021, Get Carter's 50th anniversary
  ('sisters',                        20),  -- 2021, UK premiere August 2021
  ('solo2darwin',                    30),  -- 2019
  ('the-man-who-got-carter',         40),  -- 2018, premiered November 2018
  ('full-circle',                    50),  -- 2008
  ('deep-purple-rises-over-japan',   60),  -- 1985
  ('riding-high',                    70),  -- 1981
  ('the-kids-are-alright',           80),  -- 1979
  ('shout-at-the-devil',             90),  -- 1976
  ('the-butterfly-ball',            100),  -- 1976
  ('rachels-man',                   110),  -- 1975
  ('gold',                          120),  -- 1974
  ('just-a-boy',                    130),  -- in development
  ('the-havana-chronicles',         140)   -- in development
) as v(slug, position)
where ci.slug = v.slug and ci.category = 'films';

-- Covers are assigned by `pnpm images:import`, not here: the seed runs before
-- any resource rows exist, so an UPDATE at this point matches nothing.

-- The five poster cards along the bottom of tonydklinger.com/film each link to
-- the film's IMDb page, and the site has no other text for them. They link out
-- the same way here: an external work's card goes to its external home
-- (workHref). Gold's source link was its full-credits page with tracking
-- parameters; this is the title page it belongs to.
update public.catalogue_items ci
   set is_external = true, external_url = v.url
  from (values
    ('the-butterfly-ball',           'https://www.imdb.com/title/tt0074260/'),
    ('shout-at-the-devil',           'https://www.imdb.com/title/tt0075214/'),
    ('deep-purple-rises-over-japan', 'https://www.imdb.com/title/tt0255918/'),
    ('rachels-man',                  'https://www.imdb.com/title/tt0072060/'),
    ('gold',                         'https://www.imdb.com/title/tt0071566/')
  ) as v(slug, url)
 where ci.slug = v.slug and ci.category = 'films';


-- Ultimate has never been sold commercially — it has no product or price on
-- any source site — so it carries its definition from note 07 §9 alone until
-- pricing is decided.
--
-- Benefits revised 2026-09-05 at the user's direction, reversing note 07 §9
-- as originally written: cohorts are a standalone product on their own
-- ladder (note 07 §16.1) and are never bundled free with a membership tier,
-- and Masterclasses no longer exists as a concept (R8 reversed the same
-- day). Free course enrolment replaces both.
update membership_tiers set description = 'Free enrolment in every course, first access to new releases, downloadable resources and partner discounts.',
       benefits = array[
         'Free enrolment in every course',
         'New releases as they are published',
         'Downloadable resources',
         'Partner discounts'
       ]
 where tier = 'ultimate';
