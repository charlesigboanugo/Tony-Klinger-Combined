-- REAL SITE CONTENT — part of the production initial setup (see 01).
--
-- The coaching offer as confirmed with the owner on 2026-10-08: what each
-- membership tier includes, the playlists, session packs, the Virtual Retreat's
-- three levels, and the wording of every product.
--
-- THE LAST WORD, AND SAFE TO RE-RUN. Files 01 and 04 created these rows from
-- the source sites; this file sets them to the confirmed offer. Every statement
-- is keyed on a slug and is an upsert or an update, so it can also be run on
-- its own against a database that already holds the content:
--
--   pnpm content:setup --env <file> --only 12_coaching_offer.sql
--
-- Needs migration 0012 (playlists, packs, retreat levels, tier allowances).
--
-- Sources: tonyklingercoaching.com /plans-pricing, /copy-of-platinum (Silver),
-- /gold, /copy-of-gold (Platinum), /group-sessions, the Group Coaching and
-- One to One service pages, and the Level 1–3 product pages (the Virtual
-- Retreat). Where the old site promised something nobody has confirmed still
-- holds — a weekly upload, the first Wednesday at 5pm, 25% off a 2022 renewal,
-- a fee credited against an in-person retreat — it is left out rather than
-- repeated as a promise.

-- ---------------------------------------------------------------------------
-- Membership tiers. `benefits` is the tier's FULL list (migration 0012): each
-- tier reads complete in itself, with no "everything in Silver" line and no
-- benefit stated twice.
--
-- "A year" (migration 0018, owner 2026-10-09): a member registers for a run of
-- a series, as a buyer does, up to their tier's number in each membership year
-- — Silver 1, Gold 2, Platinum 4. This is the coaching site's own offer, and it
-- replaces the per-term choice tried the day before.

update membership_tiers set
  description = 'Access to one Group Coaching series a year and one video playlist, both of your choosing.',
  benefits = array[
    'Access to one Group Coaching series a year, of your choice, with its eight live sessions',
    'Access to the replays of the sessions in your series',
    'Access to one video playlist of your choice: Filmmaking, Writing or Producing',
    'New videos added to your playlist regularly'
  ]
 where tier = 'silver';

update membership_tiers set
  description = 'Access to two Group Coaching series a year, every video playlist and a live Q&A with Tony each month.',
  benefits = array[
    'Access to two Group Coaching series a year, of your choice, with their sixteen live sessions',
    'Access to the replays of the sessions in your series',
    'Access to every video playlist, including the Miscellaneous playlist, kept for Gold and Platinum',
    'New videos added to the playlists regularly',
    'A live, hour-long Q&A with Tony every month',
    'Access to all the Q&A recordings'
  ]
 where tier = 'gold';

update membership_tiers set
  description = 'Access to four Group Coaching series a year, every video playlist, the monthly Q&A with Tony and free entry to every Level One Virtual Retreat.',
  benefits = array[
    'Access to four Group Coaching series a year, with their thirty-two live sessions',
    'Access to the replays of the sessions in your series',
    'Access to every video playlist, including the Miscellaneous playlist, kept for Gold and Platinum',
    'New videos added to the playlists regularly',
    'A live, hour-long Q&A with Tony every month',
    'Access to all the Q&A recordings',
    'Free entry to every Level One Virtual Retreat'
  ]
 where tier = 'platinum';

-- THE NAME: "Coaching Pass" (owner, 2026-10-09). What is sold is a year's
-- package of coaching, not a subscription one belongs to, so the storefront
-- says Pass: Silver Pass, Gold Pass, Platinum Pass. Only the words change —
-- slugs, tables and the `membership` product type keep their names.
update membership_tiers set name = initcap(tier::text) || ' Pass';
update products set name = 'Silver Pass' where slug = 'membership-silver';
update products set name = 'Gold Pass' where slug = 'membership-gold';
update products set name = 'Platinum Pass' where slug = 'membership-platinum';

update products set description = 'Access to one Group Coaching series a year and one video playlist of your choice.'
 where slug = 'membership-silver';
update products set description = 'Access to two Group Coaching series a year, every video playlist and the monthly Q&A with Tony.'
 where slug = 'membership-gold';
update products set description = 'Access to four Group Coaching series a year, every video playlist, the monthly Q&A with Tony and free entry to every Level One Virtual Retreat.'
 where slug = 'membership-platinum';

-- MEMBERSHIP IS ONE PAYMENT FOR TWELVE MONTHS (owner, 2026-10-09). It is a
-- bundle, not a subscription: paid once, it runs for a year and ends, and
-- nothing is charged again. This reverses the day before's "a year renews like
-- a month", and takes the monthly plan off sale with it: at £15 a month a
-- member could register for a £130 series and leave after two.
--
-- The figures are the coaching site's own yearly prices, loaded by file 01 as
-- one-off payments (£160, £280, £560) and already in Stripe. The subscription
-- prices are removed where nothing points at them, so no stale plan sits in
-- Admin → Prices; one that a past order or a live subscription still names is
-- switched off instead, because that record needs it. A plan can be put back
-- on sale by adding a recurring price in admin, and the storefront words
-- itself from whatever is active.
delete from prices pr
 using products p
 where p.id = pr.product_id
   and p.product_type = 'membership'
   and pr.billing_type = 'recurring'
   and not exists (select 1 from order_items oi where oi.price_id = pr.id)
   and not exists (select 1 from subscriptions s where s.price_id = pr.id);

update prices pr set active = false
  from products p
 where p.id = pr.product_id
   and p.product_type = 'membership'
   and pr.billing_type = 'recurring'
   and pr.active;

update prices pr set active = true
  from products p
 where p.id = pr.product_id
   and p.product_type = 'membership'
   and p.status = 'active'
   and pr.billing_type = 'one_time'
   and not pr.active
   and not exists (
     select 1 from prices x
      where x.product_id = pr.product_id and x.billing_type = 'one_time' and x.active
   )
   and pr.id = (
     select y.id from prices y
      where y.product_id = pr.product_id and y.billing_type = 'one_time'
      order by y.created_at desc
      limit 1
   );

-- ---------------------------------------------------------------------------
-- Playlists. Three subjects a Silver member chooses between, and the
-- Miscellaneous playlist reserved for Gold and above. Videos are added in
-- Admin → Playlist videos.
-- ---------------------------------------------------------------------------

insert into playlists (name, slug, description, min_tier, position, status) values
  ('Filmmaking', 'filmmaking',
   'Building a career in film: the business behind the craft, and how working filmmakers make a living from it.',
   'silver', 10, 'published'),
  ('Writing', 'writing',
   'Writing for the screen and the page, and getting what you write in front of the people who buy it.',
   'silver', 20, 'published'),
  ('Producing', 'producing',
   'Getting a film made: partners, money, casting, marketing, sales and distribution.',
   'silver', 30, 'published'),
  ('Miscellaneous', 'miscellaneous',
   'Everything that does not fit one subject: conversations, stories from a life in film and answers to pass holders'' questions.',
   'gold', 40, 'published')
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  min_tier = excluded.min_tier, position = excluded.position;

-- ---------------------------------------------------------------------------
-- Group Coaching (owner, 2026-10-09; migration 0014).
--
--   £25   one session of ONE series, which the customer then picks.
--   £130  a place on ONE RUN of a series: a seat in all eight sessions, with
--         no booking (migration 0016). Bought only while a run is open for
--         registration; the buyer is put on the run as they pay.
--
-- So each series has its own two products — eight in all — and each product
-- names its series (`series_id`), which is what makes the sessions it grants
-- usable on that series only. The two share an `option_group`, so the site
-- offers the switch between "1 session" and "8 sessions" wherever either is.
-- ---------------------------------------------------------------------------

insert into products (name, slug, product_type, description, status, series_id, credits, valid_months, option_group, option_label, option_position)
select v.name, v.slug, 'group_coaching', v.description, 'active', s.id, v.credits, 3,
       'group-coaching-' || s.slug, v.label, v.position
  from group_coaching_series s
 cross join lateral (values
   (s.name || ' — 1 Session', 'group-coaching-single-' || s.slug,
    'One live, hour-long session of the ' || s.name || ' series, on the date you choose.',
    1, '1 session', 10),
   (s.name || ' — The Series', 'group-coaching-x8-' || s.slug,
    'A place on the ' || s.name || ' series: a seat in all eight live, hour-long sessions, with no booking.',
    8, 'The series', 20)
 ) as v(name, slug, description, credits, label, position)
 where s.slug in ('filmmaking', 'writing', 'producing', 'for-all-filmmakers')
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, series_id = excluded.series_id,
  credits = excluded.credits, valid_months = excluded.valid_months, pack_of = null,
  option_group = excluded.option_group, option_label = excluded.option_label,
  option_position = excluded.option_position;

insert into prices (product_id, currency, amount, billing_type, active)
select p.id, 'GBP', case when p.credits = 1 then 2500 else 13000 end, 'one_time', true
  from products p
 where (p.slug like 'group-coaching-single-%' or p.slug like 'group-coaching-x8-%')
   and not exists (select 1 from prices pr where pr.product_id = p.id and pr.active);

-- A series is not itself a product: its two products point at it.
update group_coaching_series set product_id = null where product_id is not null;

-- The two products that were good for any series are no longer sold, and are
-- removed (owner, 2026-10-09). Where an order already placed names one, that
-- product is kept, paused, because the order needs it.
update products set pack_of = null
 where pack_of in (select id from products where slug in ('group-coaching-single', 'group-coaching-x8'));
delete from products p
 where p.slug in ('group-coaching-single', 'group-coaching-x8')
   and not exists (select 1 from order_items oi where oi.product_id = p.id);
update products set status = 'paused', option_group = null
 where slug in ('group-coaching-single', 'group-coaching-x8') and status = 'active';

-- ---------------------------------------------------------------------------
-- One-to-one coaching: one session, or a pack of eight at £1,000
-- (/plans-pricing, "Adv Coaching Bundle"). Both are to use within six months
-- (owner, 2026-10-08), with the same rule for buying more as Group Coaching.
-- ---------------------------------------------------------------------------

update products set
  name = 'One-to-One Coaching — 1 Session',
  description = 'One hour of private coaching with Tony Klinger, at a time that suits you.',
  credits = 1, valid_months = 6, pack_of = null,
  option_group = 'one-to-one', option_label = '1 session', option_position = 10
 where slug = 'one-to-one-single';

update products set
  name = 'One-to-One Coaching — 8 Sessions',
  description = 'Eight hours of private coaching with Tony Klinger. Use them within six months.',
  credits = 8, valid_months = 6,
  pack_of = (select id from products where slug = 'one-to-one-single'),
  option_group = 'one-to-one', option_label = '8 sessions', option_position = 20
 where slug = 'one-to-one-x8';

-- The Stripe price goes with the old amount: a Stripe price cannot change its
-- amount, and checkout charges whatever Stripe price the row names, so leaving
-- it would show £1,000 here and take £130 there. Cleared, the next catalogue
-- sync creates the right one; until then checkout prices the line itself.
update prices set amount = 100000, stripe_price_id = null
 where product_id = (select id from products where slug = 'one-to-one-x8')
   and amount = 13000;

update private_coaching_services set
  description = 'An hour with Tony on your own project or career: where it stands, what it needs and what to do next.',
  benefits = array[
    'A private, hour-long session with Tony Klinger, online',
    'Personal insight into your project or your career',
    'Direct advice on how to mount, produce and market your work',
    'A time that suits you, chosen from Tony''s diary',
    'Available as a gift: get in touch and we will set it up in their name'
  ]
 where slug = 'advanced-one-to-one';

-- ---------------------------------------------------------------------------
-- Interactive Cohorts and courses — wording only.
-- ---------------------------------------------------------------------------

update cohorts set description = 'For those starting out: find where you fit in the film industry and build a credible path into it.'
 where slug = 'cohort-silver';
update cohorts set description = 'For those ready to work: move from preparing for the industry to operating within it.'
 where slug = 'cohort-gold';
update cohorts set description = 'For established creatives: develop pitch-ready projects and learn how money, distribution and reputation shape a career.'
 where slug = 'cohort-platinum';

update products p set description = c.description
  from cohorts c
 where c.product_id = p.id and c.slug in ('cohort-silver', 'cohort-gold', 'cohort-platinum');

update products p set description = c.description
  from courses c
 where c.product_id = p.id and c.slug in ('level-one', 'level-two');

-- Level Three is removed (owner, 2026-10-09): a draft course with no lessons
-- and a product nobody could be sold. Kept, paused, only where somebody holds
-- it or an order names it.
delete from courses c
 where c.slug = 'level-three'
   and not exists (select 1 from course_modules m where m.course_id = c.id)
   and not exists (select 1 from entitlements e where e.resource_type = 'course' and e.resource_id = c.id);
delete from products p
 where p.slug = 'course-level-three'
   and not exists (select 1 from courses c where c.product_id = p.id)
   and not exists (select 1 from order_items oi where oi.product_id = p.id);
-- Its cover photograph's record, once no course shows it. (The stored file is
-- removed in the Supabase dashboard → Storage → site-media.)
delete from resources r
 where r.storage_path like '%coaching-level-three-cover.%'
   and not exists (select 1 from courses c where c.cover_resource_id = r.id);

-- Not sold until there is something to deliver: a bundle grants nothing (no
-- fulfilment rule exists for one), so a customer reaching one by URL would pay
-- and receive nothing. Paused, not removed (the owner is keeping The Deluxe in
-- case it is wanted): set the status back to "active" in Admin → Products.
update products set status = 'paused'
 where slug in ('course-level-three', 'bundle-the-deluxe', 'bundle-deluxe-level-1',
                'bundle-deluxe-level-2', 'bundle-deluxe-level-3')
   and status = 'active';

-- ---------------------------------------------------------------------------
-- The Virtual Retreat: one day, online, at three levels. No date yet — a level
-- is shown with "date to be announced" and cannot be bought until an
-- administrator adds a batch with its dates (migration 0030). Places (six for
-- Level Two, four for Level Three) are set on that batch, not here: since
-- 0030 a retreat has no capacity of its own, and writing one stopped a fresh
-- setup at this file (found 2026-10-15).
--
-- Level One is open to anyone. Levels Two and Three are entered by interview
-- (written as words on the site, as the courses' levels are: owner, 2026-10-08)
-- (`requires_application`), for six and four writers.
-- ---------------------------------------------------------------------------

insert into products (name, slug, product_type, description, status, option_group, option_label, option_position) values
  ('Virtual Retreat — Level One', 'retreat-level-1', 'retreat',
   'A day online with working mentors: watch them at work, sit in on the pitching sessions and have your own questions answered.',
   'active', 'virtual-retreat', 'Level One', 10),
  ('Virtual Retreat — Level Two', 'retreat-level-2', 'retreat',
   'The Level One day, and live feedback on your own project from a mentor matched to it. Six writers, by interview.',
   'active', 'virtual-retreat', 'Level Two', 20),
  ('Virtual Retreat — Level Three', 'retreat-level-3', 'retreat',
   'The Level One and Two day, and your project pitched live to the full panel of mentors. Four writers, by invitation.',
   'active', 'virtual-retreat', 'Level Three', 30)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  option_group = excluded.option_group, option_label = excluded.option_label,
  option_position = excluded.option_position;

-- Prices have no natural key, so each is added only where the product has none.
insert into prices (product_id, currency, amount, billing_type, active)
select p.id, 'GBP', v.amount, 'one_time', true
  from (values ('retreat-level-1', 19950), ('retreat-level-2', 39950), ('retreat-level-3', 49950)) as v(slug, amount)
  join products p on p.slug = v.slug
 where not exists (select 1 from prices pr where pr.product_id = p.id and pr.active);

insert into retreats (product_id, name, slug, description, level, position, requires_application, benefits, status)
select p.id, v.name, v.slug, v.description, v.level, v.level * 10, v.requires_application, v.benefits, 'published'
  from (values
    ('retreat-level-1', 'Virtual Retreat — Level One', 'virtual-retreat-level-1',
     'A day online with working mentors: watch them at work, sit in on the pitching sessions and have your own questions answered.',
     1, false,
     array[
       'Access to the mentors'' live presentations, by video conference',
       'Access to the mentoring sessions, where writers receive feedback on their projects',
       'Access to the pitching sessions, where projects are sold to industry professionals',
       'A recorded presentation answering the questions you send in beforehand',
       'Access to the private retreat community, which carries on after the day'
     ]),
    ('retreat-level-2', 'Virtual Retreat — Level Two', 'virtual-retreat-level-2',
     'The whole Level One day, and live feedback on your own project from a mentor matched to it. Six writers, by interview.',
     2, true,
     array[
       'Live feedback on your own pitch from a mentor matched to your project, for up to twenty minutes',
       'Your two-page synopsis read by your mentor before the day',
       'One of only six places, offered by interview',
       'Access to the mentors'' live presentations, by video conference',
       'Access to every mentoring and pitching session of the day',
       'A recorded presentation answering the questions you send in beforehand',
       'Access to the private retreat community, which carries on after the day'
     ]),
    ('retreat-level-3', 'Virtual Retreat — Level Three', 'virtual-retreat-level-3',
     'The whole Level One and Two day, and your project pitched live to the full panel of mentors. Four writers, by invitation.',
     3, true,
     array[
       'A live pitch of your project to the full panel of mentors',
       'Feedback from every mentor on the panel: a rare look at how a pitch is really judged',
       'One of only four places, offered by invitation to Level Two writers',
       'Live feedback on your synopsis from a mentor matched to your project',
       'Access to the mentors'' live presentations, by video conference',
       'Access to every mentoring and pitching session of the day',
       'Access to the private retreat community, which carries on after the day'
     ])
  ) as v(product_slug, name, slug, description, level, requires_application, benefits)
  join products p on p.slug = v.product_slug
on conflict (slug) do update set
  product_id = excluded.product_id, name = excluded.name, description = excluded.description,
  level = excluded.level, position = excluded.position,
  requires_application = excluded.requires_application, benefits = excluded.benefits;

-- The placeholder 04 created when no retreat page had been captured. Removed
-- only while it is still that placeholder — untouched, with nobody applied.
delete from retreats r
 where r.slug = 'virtual-retreat'
   and r.status = 'draft'
   and r.product_id is null
   and r.description = 'Referenced across the previous storefront; details to be confirmed.'
   and not exists (select 1 from retreat_applications a where a.retreat_id = r.id);
