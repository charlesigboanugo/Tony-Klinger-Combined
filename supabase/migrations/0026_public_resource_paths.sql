-- Let anyone read the PATH of an object that lives in a public bucket.
--
-- `resources` was staff-read only, which is right for the table as a whole: it
-- also holds paths into `course-assets` and `documents`, and knowing the key of
-- a gated worksheet is a small but real leak.
--
-- But it meant a public page could not resolve the photo for a team member or
-- the cover for a catalogue item — the embedded join returned null and the
-- image silently did not render, which is exactly what happened.
--
-- Paths in `site-media` and `avatars` are safe to expose because THE OBJECTS
-- THEMSELVES ARE ALREADY PUBLIC: those buckets are `public = true`, so anyone
-- can fetch the file without authenticating. Publishing the key of a file that
-- needs no key reveals nothing.
--
-- The private buckets are deliberately excluded. Reaching one of those still
-- requires a signed URL minted after an entitlement check (note 08 §26).

create policy "resource paths in public buckets are readable"
  on public.resources for select
  using (
    storage_path is not null
    and (
      storage_path like 'site-media/%'
      or storage_path like 'avatars/%'
    )
  );
