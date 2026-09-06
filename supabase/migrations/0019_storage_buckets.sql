-- Storage buckets and their access rules — note 02 §37, note 08 §26.
--
-- WHAT BELONGS HERE, AND WHAT DOES NOT
--
--   Next.js public/     Static design assets — logo, icons, decorative art.
--                       Shipped with the build, changed only by a deploy.
--   Supabase Storage    Dynamic, admin-uploaded assets — anything an
--                       administrator adds or replaces without a deploy.
--   Livid               All video. Streaming needs transcoding and adaptive
--                       bitrate, which object storage does not do.
--
-- BUCKETS ARE SPLIT BY WHO MAY READ THEM, NOT BY FILE TYPE.
--
-- `public` is a per-BUCKET flag, not a per-object one: there is no such thing as
-- a bucket that is private "where required". A file's access rule is therefore
-- decided by which bucket it goes in, and that is the one property that cannot
-- be refactored later without moving every object and rewriting every stored
-- path. File type can be reorganised with a path change; access cannot.
--
--   avatars        public    profile photos
--   site-media     public    all marketing imagery — books, films, blog, events,
--                            retreats, coaching, team, testimonials, AND course
--                            thumbnails
--   course-assets  private   material attached to Academy content, gated by
--                            entitlement to that content
--   documents      private   standalone gated documents, not tied to a course
--
-- Course thumbnails are in the PUBLIC bucket deliberately. They are marketing:
-- they appear on the storefront to people deciding whether to buy. Behind a
-- signed URL every thumbnail costs a server round trip, defeats CDN caching and
-- expires — for an image whose whole purpose is to be seen by strangers.
--
-- PATHS USE IDS, NOT SLUGS: `books/{book_id}/cover.jpg`.
-- Storage has no rename. A slug edited for SEO would strand every object
-- beneath it, and fixing that means copy-then-delete on each one. Ids never
-- change. The slug belongs in the URL, not in the storage key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',       'avatars',       true,   5 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp','image/avif']),
  ('site-media',    'site-media',    true,  15 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('course-assets', 'course-assets', false, 50 * 1024 * 1024,
     array['application/pdf','image/jpeg','image/png','image/webp',
           'application/zip','audio/mpeg','audio/mp4',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('documents',     'documents',     false, 50 * 1024 * 1024,
     array['application/pdf','application/zip',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- MIME types and size limits are enforced by Storage itself, so a bad upload is
-- refused at the edge rather than after the bytes have been paid for. They are
-- not a substitute for validating in the upload handler — a caller controls the
-- Content-Type header it sends — but they are the backstop that holds when the
-- handler is wrong.

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
--
-- Creating a bucket grants nothing and denies nothing. Without policies,
-- `storage.objects` has RLS enabled and no policy, so every non-service call
-- fails — which looks like a broken feature, not a security setting.
--
-- Reads of a PUBLIC bucket do not consult these policies at all: the
-- /object/public/ endpoint serves them anonymously by design. The policies
-- below therefore govern WRITES to public buckets, and everything about
-- private ones.
-- ---------------------------------------------------------------------------

-- --- avatars ---------------------------------------------------------------
-- Scoped by path: the first folder is the owner's user id, which is what makes
-- "your own avatar" expressible as a policy at all. A flat bucket could not
-- distinguish one person's file from another's.

create policy "avatars are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "a user writes only their own avatar folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user replaces only their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user deletes only their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --- site-media ------------------------------------------------------------
-- Readable by the world, writable only by staff who manage content.

create policy "site media is readable by anyone"
  on storage.objects for select
  using (bucket_id = 'site-media');

create policy "content managers write site media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (public.has_permission('products.update') or public.has_permission('blog.update'))
  );

create policy "content managers replace site media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-media'
    and (public.has_permission('products.update') or public.has_permission('blog.update'))
  );

create policy "content managers delete site media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-media'
    and public.has_permission('products.delete')
  );

-- --- course-assets and documents -------------------------------------------
-- No read policy for anon or authenticated, deliberately.
--
-- Gated files are reached through a SHORT-LIVED SIGNED URL minted server-side,
-- after the application has checked the entitlement using the same
-- has_active_entitlement() the Academy pages use — one authorization source,
-- not two that can drift apart. Signing happens with the service role, which
-- does not consult these policies.
--
-- So the absence of a read policy here is the backstop: if a signed URL is ever
-- issued without the check, or a session token is stolen, the object is still
-- unreachable through the ordinary API. A customer cannot list the bucket, and
-- cannot fetch a path they happen to guess.

create policy "course asset uploads are staff only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-assets'
    and (public.has_permission('courses.update') or public.has_permission('masterclasses.update'))
  );

create policy "course asset replacement is staff only"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'course-assets'
    and (public.has_permission('courses.update') or public.has_permission('masterclasses.update'))
  );

create policy "course asset deletion is staff only"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-assets'
    and public.has_permission('courses.update')
  );

create policy "document uploads are staff only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_permission('products.update')
  );

create policy "document replacement is staff only"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('products.update')
  );

create policy "document deletion is staff only"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('products.delete')
  );

-- Staff reads of the private buckets, so the admin interface can list and
-- preview what it manages without minting a signed URL for its own upload form.
create policy "staff read private buckets"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('course-assets', 'documents')
    and public.is_staff()
  );
