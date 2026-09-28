-- 0008 — Catalogue links and cover focus, resource dimensions and credits, blog word count, public audio, filmed testimonials, course order and level.
--
-- Consolidated 2026-09-28 from 0010_catalogue_media, 0011_resource_dimensions, 0012_resource_credit, 0013_blog_word_count, 0014_site_media_audio, 0015_testimonial_videos, 0016_course_order_and_level, in their original
-- order. Each section keeps a banner naming its former file, which notes and
-- comments may still cite.

-- ===========================================================================
-- 0010_catalogue_media  (was migration 0010, before 2026-09-28)
-- ===========================================================================

-- 0010 — Outbound links for catalogue works, and the cover crop focus.
--
-- Consolidated 2026-09-23 from migrations 0039, 0040, in their original
-- order. Each section keeps its former number, which older notes and comments
-- still cite.

-- ===========================================================================
-- catalogue item links  (was migration 0039)
-- ===========================================================================

-- Outbound links for a catalogue work — where to buy it, listen to it, or read
-- a review of it.
--
-- WHY NOT `resources`. A resource can already carry an `external_url`, and
-- `catalogue_item_resources` already joins resources to works. But the public
-- read policy on `resources` (migration 0026) admits only rows whose
-- storage_path sits in a public bucket, so an external-URL resource is
-- invisible to an anonymous reader. Widening that policy would also expose
-- external links attached to PAID course material, which lives in the same
-- table. A buy link on a published book is public by nature; a lesson's link
-- is not. So these get their own table, readable exactly when the work is.
--
-- Images stay in `catalogue_item_resources`: they are stored files, and the
-- existing policies already publish them correctly.

create table public.catalogue_item_links (
  id                uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references public.catalogue_items (id) on delete cascade,
  label             text not null,
  url               text not null,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  constraint catalogue_item_links_are_http check (url ~ '^https?://'),
  unique (catalogue_item_id, url)
);

create index catalogue_item_links_item_idx
  on public.catalogue_item_links (catalogue_item_id, position);

alter table public.catalogue_item_links enable row level security;

create policy "catalogue_item_links: public read published"
  on public.catalogue_item_links for select
  using (exists (
    select 1 from public.catalogue_items c
    where c.id = catalogue_item_links.catalogue_item_id
      and c.status = 'published'
  ));

create policy "catalogue_item_links: staff read"
  on public.catalogue_item_links for select
  using (public.has_permission('catalogue.read'));


-- ===========================================================================
-- catalogue cover focus  (was migration 0040)
-- ===========================================================================

-- Which part of a cover to keep when it is cropped to fill a card.
--
-- Catalogue cards now FILL their shared 3:4 frame (object-fit: cover) rather
-- than letterboxing the artwork inside it — letterboxing left visible bands,
-- and a grid of mixed-shape artwork read as uneven. Filling means cropping, and
-- a centred crop cuts the title off artwork whose title sits at one edge: a
-- square jacket loses a quarter of its width, a landscape poster over half.
--
-- The default keeps the TOP, because that is where a jacket or poster prints
-- its title, and on a portrait (the common case) only the bottom is lost. The
-- other values are set per work, after looking at the crop, for the few
-- whose title sits elsewhere.
alter table public.catalogue_items
  add column cover_focus text not null default 'top'
    constraint catalogue_items_cover_focus_valid
      check (cover_focus in ('top', 'center', 'left', 'right'));

comment on column public.catalogue_items.cover_focus is
  'Edge of the cover kept when it is cropped to fill a card: top, center, left or right.';

-- The per-work values are set in seed.sql, not here: migrations run before the
-- seed creates the catalogue, so an update here would match nothing after a
-- reset (the failure migrations 0032 and 0033 already hit).

-- ===========================================================================
-- 0011_resource_dimensions  (was migration 0011, before 2026-09-28)
-- ===========================================================================

-- 0011 — Pixel dimensions on resources.
--
-- The catalogue lays a work out by the SHAPE of its artwork: a portrait poster
-- sits on the wall as a poster, a landscape still spans two columns as a
-- full-bleed tile, and the work's own page shows the artwork uncropped at its
-- true ratio. None of that is possible without knowing the ratio, and reading
-- it by fetching every image at render time would cost a request per cover.
--
-- Recorded once, when the file is uploaded (scripts/import-images.mjs reads it
-- from the file itself). Nullable: a resource that is a link, or one uploaded
-- before this existed, simply has no shape and falls back to the poster frame.

alter table public.resources
  add column width  integer check (width  is null or width  > 0),
  add column height integer check (height is null or height > 0);

comment on column public.resources.width is
  'Pixel width of the stored image, set on upload. Null for links and unknowns.';
comment on column public.resources.height is
  'Pixel height of the stored image, set on upload. Null for links and unknowns.';

-- ===========================================================================
-- 0012_resource_credit  (was migration 0012, before 2026-09-28)
-- ===========================================================================

-- 0012 — A credit line on resources.
--
-- Tony Klinger asked (2026-09-24) that the photographs he supplied carry the
-- credit "Photos courtesy of Danny Clifford Photographer". Images added from
-- elsewhere carry their own licence credit instead (supabase/content/images,
-- CREDITS.md). The credit belongs to the IMAGE, not to the page that shows
-- it, so it is stored here and shown wherever the image is.
--
-- Set on upload by scripts/import-images.mjs. Null means no credit is owed or
-- known, and nothing is shown.

alter table public.resources
  add column credit text check (credit is null or length(trim(credit)) > 0);

comment on column public.resources.credit is
  'Credit line shown with the image, e.g. "Photos courtesy of Danny Clifford Photographer". Set on upload.';

-- ===========================================================================
-- 0013_blog_word_count  (was migration 0013, before 2026-09-28)
-- ===========================================================================

-- 0013 — A stored word count on blog posts (note 08 §28.1).
--
-- The blog index shows each essay's reading time. Computing it in the page
-- would mean selecting `content` for every row of a listing — the ~800KB of
-- article bodies the listing deliberately stopped fetching (src/lib/content/
-- blog.ts, LIST_FIELDS). A generated column keeps the count beside the row,
-- always in step with the body, and costs the listing four bytes a post.
--
-- Whitespace-delimited, which is what a reading-time estimate needs; it is not
-- a linguistic word count and nothing else should treat it as one.

alter table public.blog_posts
  add column if not exists word_count integer not null
  generated always as (
    coalesce(
      array_length(regexp_split_to_array(btrim(coalesce(content, ''), E' \t\r\n'), '\s+'), 1),
      0
    )
  ) stored;

comment on column public.blog_posts.word_count is
  'Whitespace-delimited words in content. Generated; used for reading time on listings.';

-- ===========================================================================
-- 0014_site_media_audio  (was migration 0014, before 2026-09-28)
-- ===========================================================================

-- 0014 — Public audio in site-media (note 08 §60.1).
--
-- Note 08 §60.1 already places public audio — radio interviews, podcast
-- episodes — in the public `site-media` bucket: they are marketing, published
-- so strangers can hear them, exactly as a book cover is. The bucket as
-- created in 0005 never caught up with that decision: it accepted images only,
-- capped at 15 MB. The interview recordings being published now (2026-09-25)
-- are MP3s of up to 44 MB.
--
-- 50 MB matches the private buckets' cap and the storage server's global
-- limit (config.toml). Only `audio/mpeg` is added: every recording is an MP3,
-- and a type nobody uploads is a type nobody should be able to.

update storage.buckets
set file_size_limit = 50 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/avif','image/svg+xml',
      'audio/mpeg'
    ]
where id = 'site-media';

-- ===========================================================================
-- 0015_testimonial_videos  (was migration 0015, before 2026-09-28)
-- ===========================================================================

-- 0015 — Filmed client testimonials (note 07, note 09 §40.1).
--
-- 0006 created `testimonials` for the written quotes and noted that the
-- coaching site ALSO had "a set of filmed client testimonials" — eleven short
-- videos on tonyklingercoaching.com/video-testimonials. Nothing could hold
-- them: a testimonial there is a required `quote`, and these have no
-- transcript. So they get a table of their own rather than a nullable quote,
-- which every text-only renderer (home page, coaching storefront) would then
-- have to guard against.
--
-- VIDEO IS A PROVIDER AND AN ID, NEVER A URL — the same shape as `lessons`
-- (note 07 §34.1), so moving host is a data change. These are public
-- marketing video, so no entitlement gate applies: the embed URL is built for
-- anyone who can read a published row.
--
-- A ROW WITH NO VIDEO YET IS STILL PUBLISHED. The files are Wix uploads that
-- must go to Livid by hand (Livid has no API, note 09 §40.1). Until one has
-- its id, it shows with its cover, marked "Coming soon", and does not play —
-- the rule the owner set for the /watch uploads on 2026-09-26.
--
-- `attributed_to` is nullable for the compilation, which is several voices.

create table public.testimonial_videos (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  -- The line the old site titled the clip with, when it had one
  -- ("You Cannot do it on Your Own"). Null where the title was only a name.
  title            text,
  attributed_to    text,
  context          text check (context in ('coaching', 'courses', 'cohorts', 'general')),
  cover_resource_id uuid references public.resources (id) on delete set null,
  video_provider   text check (video_provider in ('youtube', 'vimeo', 'livid')),
  video_id         text,
  video_hash       text,
  duration_seconds integer check (duration_seconds > 0),
  position         integer not null default 0,
  status           public.content_status not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint testimonial_videos_video_complete
    check ((video_provider is null) = (video_id is null))
);

comment on table public.testimonial_videos is
  'Filmed client testimonials. Video by provider + id (never a URL); a published row without one shows as "Coming soon".';

create trigger testimonial_videos_set_updated_at
  before update on public.testimonial_videos
  for each row execute function public.set_updated_at();

alter table public.testimonial_videos enable row level security;

create policy "published testimonial videos are public"
  on public.testimonial_videos for select
  using (status = 'published');

create policy "staff read every testimonial video"
  on public.testimonial_videos for select to authenticated
  using (public.is_staff());

-- ===========================================================================
-- 0016_course_order_and_level  (was migration 0016, before 2026-09-28)
-- ===========================================================================

-- 0016 — Course display order and level label (note 07 §23).
--
-- The courses were titled by their place in a sequence ("Level One", "Level
-- Two") and listed alphabetically by that title. The owner (2026-09-26) wants
-- each to lead with what it promises — "How to Get Your Movie Made" — and the
-- stronger course listed first. That needs two facts the table did not hold:
--
--   position   curated order on the storefront, lowest first (as on
--              catalogue_items, team_members, testimonials)
--   level      the sequence label, now shown as a small eyebrow instead of
--              being the title. Free text: it is a display label, not a rule —
--              nothing in the data makes one level a prerequisite of another.

alter table public.courses
  add column if not exists position integer not null default 0,
  add column if not exists level text;

comment on column public.courses.position is
  'Storefront order, lowest first.';
comment on column public.courses.level is
  'Display label for the course''s place in the sequence ("Level Two"). Not a prerequisite rule.';
