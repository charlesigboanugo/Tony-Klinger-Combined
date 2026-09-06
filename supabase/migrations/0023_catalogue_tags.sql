-- Catalogue tags — curation without new categories.
--
-- Closes reconciliation item R25 (note 08 §28.2.1, note 11 Resolution).
--
-- `category` classifies: it says what a work IS, one value from a fixed set of
-- seven media types, and it never changes. `tags` curate: they say which
-- collections a work APPEARS IN, many values from an open set, edited whenever
-- an editor re-curates a collection.
--
-- This exists because Give-Get-Go's three sections are subsets, not categories.
-- Note 11 calls Publishing "the Give-Get-Go Books publishing imprint" — a
-- subset of `books`, not all of it — and Films is the same. So mapping a
-- section onto a whole category would have been wrong even for the sections
-- that appeared to fit, and Documentaries had no category at all.
--
-- A documentary is a FILM. It keeps its canonical home at
-- /catalogue/films/[slug] and appears under Give-Get-Go by tag. It is not an
-- eighth category: the seven are media types, and admitting one genre among
-- them would invite every other genre to follow.

alter table public.catalogue_items
  add column if not exists tags text[] not null default '{}';

comment on column public.catalogue_items.tags is
  'Curation labels. `category` says what the work is; a tag says which curated '
  'collection it appears in. Give-Get-Go sections are views filtered by the '
  'give-get-go:* tags (note 08 §28.2.1).';

-- GIN supports the containment/overlap operators (@>, &&) that tag filtering
-- uses. A btree index cannot answer those.
create index if not exists catalogue_items_tags_idx
  on public.catalogue_items using gin (tags);

-- Tags are normalised on write rather than rejected.
--
-- The hazard is silent, not loud: ' films' and 'films' would become two
-- different collections, and a trailing space is invisible in an admin form.
-- Rejecting the write would surface as an error an editor cannot see the cause
-- of; trimming it makes the mistake impossible instead. Duplicates are dropped
-- for the same reason — a tag applied twice is the same collection once.
--
-- Order is preserved so an editor's intent survives; only blanks and repeats
-- are removed.
create or replace function public.normalise_catalogue_tags()
returns trigger
language plpgsql
as $$
begin
  select coalesce(array_agg(distinct_tag order by first_position), '{}')
    into new.tags
  from (
    select btrim(t) as distinct_tag, min(ordinality) as first_position
    from unnest(new.tags) with ordinality as u(t, ordinality)
    where btrim(t) <> ''
    group by btrim(t)
  ) as cleaned;

  return new;
end;
$$;

comment on function public.normalise_catalogue_tags() is
  'Trims whitespace, drops blanks and de-duplicates catalogue tags on write so '
  'that two spellings of one tag cannot silently become two collections.';

drop trigger if exists normalise_catalogue_tags on public.catalogue_items;

create trigger normalise_catalogue_tags
  before insert or update of tags on public.catalogue_items
  for each row
  execute function public.normalise_catalogue_tags();

-- Backstop invariant. The trigger guarantees this, but the constraint states it
-- so a future path that bypasses the trigger cannot quietly reintroduce blanks.
-- `array_position` is used rather than a subquery: CHECK constraints cannot
-- contain subqueries.
alter table public.catalogue_items
  drop constraint if exists catalogue_tags_have_no_blank_entries;

alter table public.catalogue_items
  add constraint catalogue_tags_have_no_blank_entries
    check (array_position(tags, '') is null);
