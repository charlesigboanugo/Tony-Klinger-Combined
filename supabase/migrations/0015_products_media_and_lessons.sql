-- =============================================================================
-- 0015 — Product names, Media storage, lesson descriptions and statuses
-- =============================================================================
--
-- Consolidated 2026-10-15 from migrations 0035, 0036, 0037, 0038, 0039, in their
-- original order (the site was not yet in production). Each section keeps
-- its former number, which older notes and comments still cite.
-- =============================================================================


-- ===========================================================================
-- 0035_product_names_unique  (was migration 0035, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0035 — A live product's name is used once
-- =============================================================================
--
-- Owner, 2026-10-15: two products on sale must not share a name, because the
-- Stripe dashboard shows products by name and two identical names cannot be
-- told apart there. Compared case-insensitively ("Script Clinic" and
-- "script clinic" are the same name).
--
-- Only active and paused products hold their name. An archived product frees
-- it, so a new product can reuse the name of one that has been retired; a
-- draft does not hold it either, and is checked when it goes live.
-- =============================================================================

create unique index products_live_name_key
  on public.products (lower(name))
  where status in ('active', 'paused');


-- ===========================================================================
-- 0036_site_media_documents  (was migration 0036, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0036 — Public documents and M4A audio in site-media
-- =============================================================================
--
-- Owner, 2026-10-15: Media items are uploaded from the admin form, and an audio
-- file or document can be made public ("Anyone can open it") as well as
-- private. Public files go in `site-media`, which until now took images and
-- MP3s only. It now also takes M4A audio, PDFs and Word documents, the same
-- types the private `course-assets` bucket already accepts for them.
--
-- The size limit (50 MB) is unchanged.
-- =============================================================================

update storage.buckets
set allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/avif','image/svg+xml',
      'audio/mpeg','audio/mp4',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'site-media';


-- ===========================================================================
-- 0037_private_media_bucket  (was migration 0037, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0037 — One general private bucket: private-media
-- =============================================================================
--
-- Owner, 2026-10-15: `course-assets` is strictly for course material. A private
-- file uploaded through Admin → Media that is not course material (a private
-- interview, a standalone document) needs a private home of its own.
--
-- `private-media` is that home, named to mirror the public `site-media`: what
-- Media uploads with "Anyone can open it" off. Like every private bucket it has
-- no read policy for customers; a file is reached only through a signed URL
-- the server issues after checking access (lib/storage/signed.ts).
--
-- `documents` ("standalone gated documents", 0005) is removed in its favour, so
-- there is one general private bucket rather than two. It was never used. The
-- delete stops rather than strand files if anything was ever put in it.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('private-media', 'private-media', false, 50 * 1024 * 1024,
     array['audio/mpeg','audio/mp4',
           'application/pdf',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Writes follow the Media screen's own permissions, as `site-media`'s do.
create policy "private media uploads are staff only"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'private-media' and public.has_permission('catalogue.update'));

create policy "private media replacement is staff only"
  on storage.objects for update to authenticated
  using (bucket_id = 'private-media' and public.has_permission('catalogue.update'));

create policy "private media deletion is staff only"
  on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and public.has_permission('catalogue.delete'));

-- Staff may read the private buckets, so admin can preview what it manages.
drop policy if exists "staff read private buckets" on storage.objects;
create policy "staff read private buckets"
  on storage.objects for select to authenticated
  using (bucket_id in ('course-assets', 'private-media') and public.is_staff());

-- --- documents, removed ------------------------------------------------------

drop policy if exists "document uploads are staff only" on storage.objects;
drop policy if exists "document replacement is staff only" on storage.objects;
drop policy if exists "document deletion is staff only" on storage.objects;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'documents') then
    raise exception 'The documents bucket holds files; move them before removing it.';
  end if;
end $$;

-- Storage refuses direct deletes unless asked for explicitly; the check above
-- is what makes this one safe.
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'documents';
-- Consolidated: the guard goes back on for the sections that follow in this file.
set local storage.allow_delete_query = 'false';


-- ===========================================================================
-- 0038_lesson_description  (was migration 0038, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0038 — A short description for each lesson
-- =============================================================================
--
-- Owner, 2026-10-15: each lesson page opens with a one- or two-sentence
-- summary of what the lesson covers ("In this lesson, you will learn …"),
-- as the earlier course app did. The lesson's full text stays in `content`;
-- this is the line under the title.
--
-- Nullable: a lesson without one simply shows none. Blank is refused, so
-- "no description" has one spelling.
-- =============================================================================

alter table public.lessons
  add column description text check (description is null or length(trim(description)) > 0);

comment on column public.lessons.description is
  'One- or two-sentence summary shown under the lesson title.';


-- ===========================================================================
-- 0039_lesson_and_module_status  (was migration 0039, before 2026-10-15)
-- ===========================================================================

-- =============================================================================
-- 0039 — Statuses respected for lessons and modules; held items stay named
-- =============================================================================
--
-- Owner, 2026-10-15.
--
-- 1. A lesson's status was ignored: anyone with the course saw Draft and
--    Archived lessons too. Learners now see Published lessons only. Staff
--    with courses.read still see every lesson (their own policy, unchanged).
--
-- 2. Modules had no status, so a module could not be hidden. They gain one,
--    Published by default so every existing module stays as it is. A lesson
--    in a module that is not Published is hidden with it.
--
-- 3. An event or one-to-one service set back to Draft after people bought it
--    vanished from their account: the ticket page could not read its event,
--    and remaining sessions lost their service's name. Someone who holds a
--    ticket (a booking) for an event, or a place or sessions for a service,
--    can still read that one item. Nobody else can, and it is still off the
--    public site.
-- =============================================================================

-- --- 2. Module status --------------------------------------------------------

alter table public.course_modules
  add column status public.content_status not null default 'published';

drop policy if exists "course_modules: entitled read" on public.course_modules;
create policy "course_modules: entitled read"
  on public.course_modules for select
  using (status = 'published' and public.has_active_entitlement('course', course_id));

-- --- 1. Lesson status --------------------------------------------------------

drop policy if exists "lessons: entitled read" on public.lessons;
create policy "lessons: entitled read"
  on public.lessons for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.course_modules m
      where m.id = lessons.module_id
        and m.status = 'published'
        and public.has_active_entitlement('course', m.course_id)
    )
  );

-- --- 3. Held items stay readable to the people who hold them ----------------

create policy "events: holders read"
  on public.events for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.bookable_type = 'event'
        and b.bookable_id = events.id
        and b.user_id = (select auth.uid())
    )
  );

create policy "private_coaching_services: holders read"
  on public.private_coaching_services for select to authenticated
  using (
    exists (
      select 1 from public.entitlements e
      where e.resource_type = 'private_coaching'
        and e.resource_id = private_coaching_services.id
        and e.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.private_coaching_slots s
      join public.bookings b on b.bookable_type = 'private_coaching' and b.bookable_id = s.id
      where s.service_id = private_coaching_services.id
        and b.user_id = (select auth.uid())
    )
  );
