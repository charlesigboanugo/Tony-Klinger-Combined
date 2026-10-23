/**
 * Column sorting for admin lists — note 10 §33.1.
 *
 * The sort is in the URL (`?sort=placed&dir=desc`), like the filter tabs and
 * the search box: a sorted list can be shared, bookmarked and reloaded, and it
 * works before the page's scripts have loaded.
 *
 * It orders the rows the page has already read. Admin lists read one bounded
 * page of rows (100 to 200), not the whole table, so a sort arranges what is
 * on the page; it does not reach rows the page never loaded.
 */
export type SortDirection = "asc" | "desc";
export type SortState = { key: string; dir: SortDirection };
export type SortValue = string | number | boolean | null | undefined;

type Params = Record<string, string | string[] | undefined>;

/**
 * How many rows a list reads while a search is active. A list normally reads
 * its latest 200; a search is usually for something older ("this customer's
 * orders"), so it reads as far back as one request allows.
 */
export const SEARCH_DEPTH = 1000;

/** The `?q=` search, trimmed; undefined when empty. */
export function readQuery(params: Params): string | undefined {
  return typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
}

/**
 * The sort asked for in the URL, if it names a column this page can sort by;
 * otherwise `fallback`, the order the page opens in. Anything else in the URL
 * is ignored, never used to build a query.
 */
export function readSort(
  params: Params,
  keys: readonly string[],
  fallback?: SortState,
): SortState | undefined {
  const key = typeof params.sort === "string" ? params.sort : undefined;
  if (!key || !keys.includes(key)) return fallback;
  return { key, dir: params.dir === "desc" ? "desc" : "asc" };
}

const collator = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

/**
 * `rows` in the order `state` asks for, by the value `keys[state.key]` reads
 * from each. Rows with nothing in that column go last in BOTH directions: a
 * blank is not "smallest", and nobody sorting by date wants the undated rows
 * first. Rows that tie keep the order they arrived in.
 */
export function sortRows<T>(
  rows: readonly T[],
  state: SortState | undefined,
  keys: Record<string, (row: T) => SortValue>,
): T[] {
  const read = state ? keys[state.key] : undefined;
  if (!state || !read) return [...rows];
  const flip = state.dir === "desc" ? -1 : 1;
  const blank = (v: SortValue) => v === null || v === undefined || v === "";

  return rows
    .map((row, index) => ({ row, index, value: read(row) }))
    .sort((a, b) => {
      const [x, y] = [a.value, b.value];
      if (blank(x) || blank(y)) return blank(x) === blank(y) ? a.index - b.index : blank(x) ? 1 : -1;
      const order =
        typeof x === "string" || typeof y === "string"
          ? collator.compare(String(x), String(y))
          : Number(x) - Number(y);
      return order === 0 ? a.index - b.index : order * flip;
    })
    .map((entry) => entry.row);
}

/**
 * The rows a search finds, closest matches first.
 *
 * The search is split into words and a row must contain EVERY word somewhere
 * in its `texts`, so "jane gmail" finds Jane at a gmail address and "gold
 * active" finds the active Gold rows. `texts` are everything the row shows
 * that somebody might type, most important first (its name before its other
 * columns).
 *
 * The order is by closeness, used when no column sort was asked for, so the
 * row somebody typed the name of is at the top rather than wherever its date
 * put it. Per word: exact beats "starts with" beats "a word starts with"
 * beats "contains", and a match on the first text outranks the same match
 * further along. Rows that tie keep the order they arrived in.
 */
export function searchRows<T>(
  rows: readonly T[],
  query: string | undefined,
  texts: (row: T) => Array<string | null | undefined>,
): T[] {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];

  const score = (values: string[], word: string) => {
    let best = 0;
    values.forEach((value, position) => {
      if (!value) return;
      const kind =
        value === word
          ? 4
          : value.startsWith(word)
            ? 3
            : value.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(word))
              ? 2
              : value.includes(word)
                ? 1
                : 0;
      if (kind) best = Math.max(best, kind * 10 + (position === 0 ? 10 : 0) - Math.min(position, 9));
    });
    return best;
  };

  const found: Array<{ row: T; index: number; score: number }> = [];
  rows.forEach((row, index) => {
    const values = texts(row).map((text) => (text ?? "").toLowerCase());
    let total = 0;
    for (const word of words) {
      const s = score(values, word);
      if (s === 0) return;
      total += s;
    }
    found.push({ row, index, score: total });
  });

  return found.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.row);
}

/* ─── Narrowing by a column's value ────────────────────────────────────── */

export type FilterOption = { value: string; label: string; count: number };

/** What a filter reads from a row: one value, or several (a person's roles). */
type FilterValue = SortValue | readonly string[];
type FilterReaders<T> = Record<string, (row: T) => FilterValue>;

/** `status` → `is_status`, so a filter never collides with `sort`, `q` or a tab. */
export function filterParam(key: string): string {
  return `is_${key}`;
}

const valuesOf = (value: FilterValue): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : value === null || value === undefined || value === ""
      ? []
      : [String(value)];

/** The filters asked for in the URL, for the columns this page can narrow by. */
export function readFilters(params: Params, keys: readonly string[]): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const key of keys) {
    const value = params[filterParam(key)];
    if (typeof value === "string" && value) filters[key] = value;
  }
  return filters;
}

/** The rows that have every asked-for value. */
export function filterRows<T>(
  rows: readonly T[],
  filters: Record<string, string>,
  readers: FilterReaders<T>,
): T[] {
  const active = Object.entries(filters).filter(([key]) => readers[key]);
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every(([key, value]) => valuesOf(readers[key](row)).includes(value)));
}

/**
 * The values a column holds across `rows`, with how many rows have each, A to
 * Z. `label` turns a stored code into the words the table shows.
 */
export function filterOptions<T>(
  rows: readonly T[],
  read: (row: T) => FilterValue,
  label: (value: string) => string = (value) => value,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) for (const value of valuesOf(read(row))) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

export type FilterDef<T> = {
  key: string;
  /** The column's heading, "Status". */
  name: string;
  read: (row: T) => FilterValue;
  label?: (value: string) => string;
};

/**
 * Everything a page needs to offer filters: the narrowed rows, the active
 * filters as query parameters (to carry on every other link), and one control
 * per column. Each control's choices and counts come from the rows the OTHER
 * filters leave, so a choice always says how many rows it would show.
 */
export function applyFilters<T>(rows: readonly T[], params: Params, defs: ReadonlyArray<FilterDef<T>>) {
  const filters = readFilters(params, defs.map((d) => d.key));
  const readers = Object.fromEntries(defs.map((d) => [d.key, d.read])) as FilterReaders<T>;

  return {
    rows: filterRows(rows, filters, readers),
    active: Object.fromEntries(Object.entries(filters).map(([key, value]) => [filterParam(key), value])),
    controls: defs.map((d) => {
      const others = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== d.key));
      return {
        name: d.name,
        param: filterParam(d.key),
        current: filters[d.key] as string | undefined,
        options: filterOptions(filterRows(rows, others, readers), d.read, d.label),
      };
    }),
  };
}
