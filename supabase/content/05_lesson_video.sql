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
-- Lesson video ids.

-- ---------------------------------------------------------------------------
-- Lesson video, from the predecessor platform's own CMS export
-- ---------------------------------------------------------------------------
--
-- Source: current-website/tonyklingeronlinecoaching.com/cms-exports/
--         course_content_rows.json — `course_content.video_file_url`, the rows
--         the live site plays today.
--
-- IT LIVES HERE, NOT IN A MIGRATION, because the lessons themselves do. A
-- migration runs before this file on `supabase db reset`, so an UPDATE there
-- matches nothing and silently leaves every lesson without video — which is
-- exactly what happened on the first attempt.
--
-- HOW THE MATCH WAS MADE, AND WHY IT IS NOT A GUESS. Every source row carries a
-- `module_id` such as `movie_adv_lesson2_developing_an_idea`; the lesson slugs
-- above were derived from those same ids when the curriculum was imported, by
-- dropping the `lessonN_` ordinal and turning underscores into hyphens. The
-- mapping is mechanical, and it was verified before being written:
--
--   42 export rows
--   41 matched a lesson AND carried a video
--    1 row has no video in the source at all (movie_basic_course_intro)
--    0 unmatched in either direction
--   41 distinct ids — none reused, so no lesson shows another lesson's video
--
--   movie_basic     -> level-one   (20 lessons, 19 with video)
--   movie_advanced  -> level-two   (22 lessons, 22 with video)
--
-- The one lesson without video keeps none. Nothing is invented to fill the gap;
-- it renders as written material, which is what it is.
--
-- IDS, NOT URLS. The source stores `https://www.youtube.com/watch?v=<id>`; we
-- keep the host and the id apart (note 07 §34.1), so the playable address is
-- composed server-side after the entitlement check and moving to Livid later is
-- an update of these same two columns.
--
-- These are unlisted YouTube videos, which cannot be domain-restricted: the URL
-- is the credential and cannot be revoked short of re-uploading. Withholding it
-- keeps non-members out of the lesson; it cannot stop a member passing the
-- address on. That is the interim position recorded in README R29.

update public.lessons l
   set video_provider = 'youtube',
       video_id = v.video_id
  from (values
    ('level-one', 'be-versatile', 'xDpVZu6CVJk'),
    ('level-one', 'breaking-into-the-film-industry', 'ep6L3uA31Jc'),
    ('level-one', 'creating-an-impressive-portfolio', '2bLeTCx5J7U'),
    ('level-one', 'education-training', 'llKFtRU8tgw'),
    ('level-one', 'find-a-mentor', '0anKFFhOTsE'),
    ('level-one', 'internships', 'ZsBWWolYY-Q'),
    ('level-one', 'join-unions-and-associations', 'nVgRMHGYgcQ'),
    ('level-one', 'market-yourself', 'jBk4IrhZlQY'),
    ('level-one', 'move-to-industry-hubs', '2RmqOLpxAz8'),
    ('level-one', 'movie-basic-congratulations', 'T4dFsJznqx4'),
    ('level-one', 'movie-basic-welcome-video', 'hXTDKSPNK8w'),
    ('level-one', 'networking', 'Z0iig6zHq8A'),
    ('level-one', 'persistence-and-resilience', 's3abWrmsbYU'),
    ('level-one', 'specialization', 'pvaKZbkQ4uw'),
    ('level-one', 'starting-small-in-the-industry', 'e7fKGSzsNkE'),
    ('level-one', 'stay-current', 'Lrv3KK5v_Hk'),
    ('level-one', 'stay-positive-and-patient', 'KGm6b-A2nOE'),
    ('level-one', 'utilize-online-platforms', '8RQcvfBNcI4'),
    -- 'work-on-personal-projects' is deliberately ABSENT from this list, not
    -- included with a null id. The source CMS holds the literal string
    -- 'IDHERE' for it, not a real video id, and this UPDATE sets
    -- `video_provider = 'youtube'` unconditionally for every row it touches —
    -- pairing that with a null `video_id` violates `lessons_video_is_complete`
    -- (migration 0007_staff_accounts_and_lesson_video), which refuses a provider with no id. Leaving the
    -- row untouched keeps both columns at their default null/null, so the
    -- lesson renders as written material, which is true, instead of a dead
    -- player, which looks like our failure. Give it a real id under
    -- Admin -> Lessons when the video exists.
    ('level-two', 'agents', 'bKRJp1Ecvb8'),
    ('level-two', 'being-professional', 'kFt68DtA2Xk'),
    ('level-two', 'career-from-creativity', '6oAHE9Jetp0'),
    ('level-two', 'casting-actors', 'Yb-PMBxhbqM'),
    ('level-two', 'common-issues-in-writing', 'cWHuKwrOaFg'),
    ('level-two', 'competition', 'CbRH4s3qSns'),
    ('level-two', 'compromising-your-creative-vision', 'RSxWZH3OBw0'),
    ('level-two', 'contracts', 'PRX63RP4GRw'),
    ('level-two', 'developing-an-idea', 'Kz5rmkYS97g'),
    ('level-two', 'financing-your-film', 'bdDMY2Z9HL0'),
    ('level-two', 'general-advice-for-creators', 'aaxUBJK8s8Q'),
    ('level-two', 'making-your-movie', 'MXkUZOshmbk'),
    ('level-two', 'movie-adv-congratulations', 'HYqbkxqJ9l8'),
    ('level-two', 'movie-adv-welcome-how-to-get-your-movie-made', 'iRpA-uO6MYA'),
    ('level-two', 'negotiations', 'u6gsd8hnLqE'),
    ('level-two', 'reasons-for-writing', 'yjMeK6yu3X4'),
    ('level-two', 'selling-your-story', '6tOmrIWURro'),
    ('level-two', 'sharing-ideas', '4i00qvBalP4'),
    ('level-two', 'the-perfect-pitch', 'okmUrELExMQ'),
    ('level-two', 'the-right-role-for-you', 'WHdGaeOENw8'),
    ('level-two', 'understanding-the-market', 'dEVNiTQ80QQ'),
    ('level-two', 'who-should-i-work-with', 'PbV9zZx4nOU')
  ) as v(course_slug, lesson_slug, video_id),
       public.course_modules m,
       public.courses c
 where m.id = l.module_id
   and c.id = m.course_id
   and c.slug = v.course_slug
   and l.slug = v.lesson_slug;
