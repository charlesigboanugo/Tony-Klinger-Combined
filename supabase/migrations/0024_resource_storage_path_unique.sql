-- One resource row per stored object.
--
-- Without this, re-running the image import created a second row for every file
-- — 356 became 712 — because PostgREST's `resolution=ignore-duplicates` needs a
-- unique constraint to conflict against, and there was none.
--
-- The constraint is also correct independently of the import: a storage object
-- lives at exactly one path, and two resources pointing at the same bytes is
-- ambiguity, not a feature. `external_url` is deliberately NOT constrained —
-- the same video can legitimately be referenced by several resources.

-- Collapse any duplicates that already exist, keeping the earliest row so that
-- anything already referencing it by id still resolves.
delete from public.resources r
 where storage_path is not null
   and exists (
     select 1 from public.resources keep
      where keep.storage_path = r.storage_path
        and keep.created_at < r.created_at
   );

-- NOT a partial index. `where storage_path is not null` looks tidier, but a
-- partial unique index cannot be used as an ON CONFLICT target unless the
-- conflict specification repeats the same predicate — which PostgREST does not
-- emit, so every upsert failed with 42P10. The predicate was never needed:
-- NULL is not equal to NULL in a unique index, so any number of rows may
-- legitimately have no storage path.
create unique index resources_storage_path_key
  on public.resources (storage_path);
