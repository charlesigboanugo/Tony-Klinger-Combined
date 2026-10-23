import "server-only";

/**
 * Admin resource definitions — note 06 §14, §16, §18.
 *
 * ONE DECLARATION PER MANAGED TABLE, rather than a hand-written list, form and
 * three server actions for each of twenty areas. The pages, forms, validation
 * and audit logging are all generated from these, so a new field is added in
 * one place and appears everywhere — and no area can quietly drift into
 * behaving differently from the rest.
 *
 * PERMISSIONS ARE PART OF THE DECLARATION, not an afterthought in the page:
 * `read` gates the list, `write` gates create and update, `remove` gates
 * deletion, and `publish` — where it exists — is deliberately separate from
 * `write` so editing and publishing can be split where editorial approval is
 * required (note 06 §18).
 *
 * These run through the SERVICE ROLE, because an operator legitimately writes
 * across all customers. That makes the route the only thing standing between a
 * caller and the data, so every generated action re-checks the permission
 * server-side rather than trusting that the page did (note 06 §2, note 08 §61).
 */
export type FieldType =
  | "text"
  | "textarea"
  | "slug"
  | "number"
  | "money"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "tags"
  /**
   * Pick a Media item from cards rather than typing a resource id: images by
   * default, or the kinds named in `mediaKinds` (a recording: video or audio).
   */
  | "media"
  /**
   * Pick a row from another table rather than typing its uuid. A foreign key
   * the operator has to transcribe is a foreign key that gets mistyped, and
   * nothing about the resulting row looks wrong until something else breaks.
   */
  | "reference"
  /**
   * Upload a file to storage; the stored path is saved. What it accepts
   * follows the value of `uploadKind` (Media's type: image, audio, document).
   */
  | "upload";

/** What a recording can be: a Livid video, or an uploaded audio file. */
const RECORDING_KINDS = ["video", "audio"] as const;

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Shown under the input. Use it for the non-obvious, not to restate the label. */
  hint?: string;
  options?: readonly string[];
  /**
   * For a `media` field: the Media types it accepts (owner, 2026-10-15: each
   * picker shows only what that field needs). Images when not given.
   */
  mediaKinds?: readonly string[];
  /** Hidden from the create form — set by the system, not by a person. */
  readOnly?: boolean;
  /**
   * Chosen when the row is created, then shown but locked (owner, 2026-10-14).
   * For what a row IS rather than a setting of it: a product's type, a
   * cohort's level, a price's currency. Changing one later would quietly turn
   * the row into something else under everything already pointing at it.
   */
  fixedOnceCreated?: boolean;
  /**
   * Named clean-up applied on save, e.g. taking the id out of a pasted URL.
   *
   * A NAME rather than a function: this config is handed to a client component,
   * and a function on it would fail to serialise. The name is resolved to the
   * actual transform on the server side of the write.
   */
  /**
   * "code": lower case, spaces to "-", anything else dropped ("Gold Plus" →
   * "gold-plus"), the form a pass tier or cohort level code must take.
   */
  normalise?: "video-id" | "code";
  /**
   * Shown only while another field of the form holds one of these values
   * (owner, 2026-10-14): a product's form shows what its TYPE needs, so a
   * course is not asked for sessions granted or a Group Coaching series.
   * A hidden field is not sent, so saving leaves what it holds alone.
   */
  shownFor?: { field: string; values: readonly string[] };
  /**
   * Not a column of this table: read and saved by the resource's own code
   * (a product's "what it sells", stored on the thing it sells).
   */
  virtual?: boolean;
  /**
   * A `textarea` holding lesson Markdown: shown with a formatting toolbar and
   * a preview laid out as the lesson page lays it out (owner, 2026-10-15).
   */
  markdown?: boolean;
  /** For `upload` fields: the field whose value says what kind of file it takes. */
  uploadKind?: string;
  /**
   * Never drawn as an input: filled by another field's component (an
   * uploaded image's width and height, sent by the upload box).
   */
  hidden?: boolean;
  /** For `reference` fields: where the options come from. */
  references?: {
    /** Table to read. */
    table: string;
    /** Column to show. */
    label: string;
    /** Optional second column, shown after an em dash for disambiguation. */
    context?: string;
    /** Column to order by. */
    orderBy?: string;
    /** Column whose value is stored, when it is not `id` (a pass tier's code). */
    value?: string;
    /**
     * What the row belongs to, shown in brackets after its name: an intake as
     * "Spring intake (Gold Cohort)", a run as "Tuesdays, 4pm (Producing)".
     * Intake and run names repeat across cohorts and series and years; this is
     * what tells them apart (owner, 2026-10-14).
     */
    parent?: {
      relation: string;
      label: string;
      /** Only rows whose parent matches, e.g. retreats entered by interview. */
      where?: { column: string; value: string | boolean };
    };
  };
};

export type ResourceConfig = {
  /** Postgres table name. */
  table: string;
  /** URL segment under /admin. */
  slug: string;
  label: string;
  labelSingular: string;
  description: string;
  permissions: {
    read: string;
    write: string;
    remove?: string;
    publish?: string;
  };
  /** Columns shown in the list, in order. */
  columns: readonly string[];
  fields: readonly Field[];
  /** Column used to order the list. */
  orderBy?: { column: string; ascending?: boolean };
  /**
   * The column holding an image's storage path. A list that names one is shown
   * as tiles, never a table (owner, 2026-10-15), is read in full rather than
   * its first 200 rows, and is shown a page at a time (owner, 2026-10-13).
   */
  gallery?: string;
  /**
   * A `select` field splitting a tiled list into kinds, one switch per option
   * (Images, Videos, Audio…), opening on the first. In place of a List /
   * Images switch (owner, 2026-10-15).
   */
  galleryKind?: string;
  /**
   * The kinds (values of `galleryKind`) whose files can be public or private,
   * given an All / Public / Private switch under the kind switch. Public is a
   * file in a public bucket (owner, 2026-10-15).
   */
  galleryPrivacy?: readonly string[];
  /**
   * The columns the Sort menu offers, when not every listed column is worth
   * sorting by. `created_at` reads "Newest first" / "Oldest first".
   */
  sortColumns?: readonly string[];
  /** The order the list opens in, with no sort chosen and nothing searched. */
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /**
   * A `reference` field to group the list under, one heading per thing it
   * points at: sessions under their series, workshops under their cohort. A
   * list that mixes several series in one run of rows is hard to read (owner,
   * 2026-10-09).
   */
  groupBy?: string;
  /**
   * A `position` left empty on create puts the new row LAST among the rows
   * sharing this column (owner, 2026-10-15): a lesson last in its module, a
   * module last in its course. Lessons added one after another then come out
   * in the order they were added, with nobody typing numbers.
   */
  appendPosition?: string;
  /** Human label for a row, for audit entries and page titles. */
  titleField?: string;
  /**
   * Hide the create action.
   *
   * For tables that are a FIXED SET rather than a growing list — membership
   * tiers are the four cumulative levels, and `tier` is unique, so a fifth row
   * is impossible. Offering a create form that can only ever fail is worse than
   * not offering one.
   */
  createDisabled?: boolean;
  /**
   * Fields filled in on save from another field rather than chosen: a
   * workshop's cohort is its intake's cohort, so the two cannot disagree.
   */
  derive?: Record<string, { from: string; table: string; column: string }>;
  /** Heading for rows whose `groupBy` field is empty, e.g. one-off sessions. */
  groupNoneLabel?: string;
  /**
   * What the groups belong to, so a parent with NO group yet still shows
   * (owner, 2026-10-14): a retreat with no batch, a series with no run, a
   * cohort with no intake, as a heading saying so. `where` limits which
   * parents count, e.g. only retreats entered by interview.
   */
  emptyParents?: {
    table: string;
    label: string;
    /** The groups' table and its column naming the parent. */
    childTable: string;
    childKey: string;
    where?: { column: string; value: string | boolean };
    note: string;
  };
  /**
   * Rows that have FINISHED (owner, 2026-10-14). The list opens on current
   * rows, with a "Past" tab for the rest, and a finished row is read-only:
   * its edit page shows it but cannot save it, and it cannot be deleted. The
   * first of `columns` that has a value decides when it finished.
   * `stillEditable` names fields that legitimately change afterwards, such as
   * the recording added once a session is over.
   */
  past?: {
    columns: readonly string[];
    stillEditable?: readonly string[];
    /**
     * For a row with no dates of its own that finishes when what it belongs
     * to does (a place on an intake, a registration on a run): the related
     * row to read alongside it, e.g. "cohort_intakes(ends_at,starts_at)".
     * `columns` then name its fields as "cohort_intakes.ends_at".
     */
    embed?: string;
    /**
     * List current rows only, with no Past tab (owner, 2026-10-14, for cohort
     * workshops: past ones pile up and are not looked at). Finished rows stay
     * read-only if opened from elsewhere.
     */
    currentOnly?: boolean;
    /**
     * Under Past, start every group folded (owner, 2026-10-14): a place or
     * registration list run for years holds many finished batches.
     */
    foldPast?: boolean;
  };
};

const CONTENT_STATUS = ["draft", "published", "archived"] as const;

const statusField: Field = {
  name: "status",
  label: "Status",
  type: "select",
  options: CONTENT_STATUS,
  required: true,
  hint: "Only published items are visible on the public site.",
};

const publishedAtField: Field = {
  name: "published_at",
  label: "Published at",
  type: "datetime",
  hint: "Left empty until the item is published.",
};

// Which product types each product field applies to (owner, 2026-10-14).
// Sessions are counted for the two coaching types; the option switch is used
// by those and by retreat levels; only Group Coaching names a series.
const COACHING_ONLY_GROUP = { field: "product_type", values: ["group_coaching"] } as const;
const SESSION_TYPES = { field: "product_type", values: ["group_coaching", "private_coaching"] } as const;
const OPTION_TYPES = { field: "product_type", values: ["group_coaching", "private_coaching", "retreat"] } as const;

export const ADMIN_RESOURCES: readonly ResourceConfig[] = [
  {
    table: "products",
    slug: "products",
    label: "Products",
    labelSingular: "Product",
    description:
      "Everything purchasable. A product is the thing sold; its prices are managed separately, because one product may have several.",
    permissions: {
      read: "products.read",
      write: "products.update",
      remove: "products.delete",
    },
    columns: ["name", "product_type", "status", "option_label"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", hint: "Appears in the URL. Changing it breaks existing links." },
      { name: "product_type", label: "Type", type: "select", fixedOnceCreated: true, required: true,
        options: ["membership", "course", "group_coaching", "cohort", "private_coaching", "retreat", "event", "bundle", "other"] },
      // WHAT IT SELLS (owner, 2026-10-15): required for every type that sells
      // one thing, and offering only what has no product yet. Only Group
      // Coaching's is a column here; the rest are stored on the thing itself
      // (`product-links.ts`). Bundles and "other" sell no single thing.
      { name: "sells_tier", label: "Coaching Pass tier", type: "reference", required: true, virtual: true,
        references: { table: "membership_tiers", label: "name" }, shownFor: { field: "product_type", values: ["membership"] },
        hint: "The tier this product sells. Only tiers without a product are listed." },
      { name: "sells_course", label: "Course", type: "reference", required: true, virtual: true,
        references: { table: "courses", label: "title" }, shownFor: { field: "product_type", values: ["course"] },
        hint: "The course this product sells. Only courses without a product are listed." },
      { name: "series_id", label: "Group Coaching series", type: "reference", required: true,
        references: { table: "group_coaching_series", label: "name", orderBy: "name" },
        shownFor: COACHING_ONLY_GROUP,
        hint: "Each series has two products: 1 session, and the series (8 sessions). Sessions granted below says which this is. A series is listed until it has both." },
      { name: "sells_cohort", label: "Cohort", type: "reference", required: true, virtual: true,
        references: { table: "cohorts", label: "name" }, shownFor: { field: "product_type", values: ["cohort"] },
        hint: "The cohort this product sells a place on. Only cohorts without a product are listed." },
      { name: "sells_private", label: "Private coaching", type: "reference", required: true, virtual: true,
        references: { table: "private_coaching_services", label: "name" }, shownFor: { field: "product_type", values: ["private_coaching"] },
        hint: "Each has two products: 1 session, made first, then the pack (Sessions granted below more than 1). Listed until it has both." },
      { name: "sells_retreat", label: "Retreat", type: "reference", required: true, virtual: true,
        references: { table: "retreats", label: "name" }, shownFor: { field: "product_type", values: ["retreat"] },
        hint: "The retreat this product sells a place on. Only retreats without a product are listed." },
      { name: "sells_event", label: "Event", type: "reference", required: true, virtual: true,
        references: { table: "events", label: "name" }, shownFor: { field: "product_type", values: ["event"] },
        hint: "The event this product is the ticket for. Only paid events still to come and without a product are listed." },
      { name: "description", label: "Description", type: "textarea" },
      // Products use their own lifecycle, not the content one: a product is
      // paused rather than unpublished, because an archived product still has
      // to resolve for the orders that reference it.
      { name: "status", label: "Status", type: "select", required: true,
        options: ["draft", "active", "paused", "archived"],
        hint: "Only active products can be purchased." },
      // Packs and options (migration 0012).
      { name: "credits", label: "Sessions granted", type: "number", shownFor: SESSION_TYPES,
        hint: "How many sessions one purchase gives. 1 for a single session, 8 for a pack. Leave empty for anything that is not counted." },
      { name: "valid_months", label: "Use within (months)", type: "number", shownFor: SESSION_TYPES,
        hint: "How long those sessions stay usable after purchase. Leave empty for no time limit." },
      { name: "option_group", label: "Option group", type: "text", shownFor: OPTION_TYPES,
        hint: "Products with the same group are alternatives of one offer, and the site offers a switch between them (e.g. group-coaching, one-to-one, virtual-retreat). Leave empty for a product sold one way." },
      { name: "option_label", label: "Label on the switch", type: "text", shownFor: OPTION_TYPES,
        hint: "Short: \"1 session\", \"8 sessions\", \"Level Two\"." },
      { name: "option_position", label: "Order on the switch", type: "number", shownFor: OPTION_TYPES, hint: "Lower shows first." },
      { name: "stripe_product_id", label: "Stripe product id", type: "text", readOnly: true,
        hint: "Set by the Stripe sync. Inline prices are used until it exists, which loses per-product reporting." },
    ],
  },
  {
    table: "prices",
    slug: "prices",
    label: "Prices",
    labelSingular: "Price",
    description:
      "Amounts are stored in the smallest currency unit — £49.00 is 4900 — so no rounding error can ever enter a total.",
    permissions: {
      read: "products.read",
      write: "products.update",
      remove: "products.delete",
    },
    columns: ["product_id", "amount", "currency", "billing_type", "active"],
    fields: [
      // Chosen by name, which is unique among products on sale (migration
      // 0035); the product's id is what is stored. The status tells a live
      // product from an archived or draft one that may share its name.
      { name: "product_id", label: "Product", type: "reference", required: true,
        references: { table: "products", label: "name", context: "status", orderBy: "name" },
        hint: "The product this price belongs to." },
      { name: "amount", label: "Amount", type: "money", required: true, hint: "In pence. £49.00 is 4900." },
      { name: "currency", label: "Currency", type: "select", fixedOnceCreated: true, options: ["GBP", "USD", "EUR"], required: true },
      { name: "billing_type", label: "Billing", type: "select", fixedOnceCreated: true, options: ["one_time", "recurring"], required: true },
      { name: "interval", label: "Interval", type: "text", hint: "For recurring prices, e.g. month or year." },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    table: "membership_tiers",
    slug: "passes",
    label: "Coaching Passes",
    labelSingular: "Coaching Pass tier",
    description:
      "Each Coaching Pass tier and what it includes: how many Group Coaching series a pass holder may take each year, how many playlists they choose (empty means all), and whether the Q&A and the retreat are included. Rank orders the tiers. A new tier needs a product with a price before it can be sold.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
    },
    // New tiers can be created since migration 0029 (owner, 2026-10-14), each
    // with a NEW code; the database refuses a code already in use.
    columns: ["name", "tier", "series_allowance", "playlist_allowance", "active"],
    titleField: "name",
    fields: [
      { name: "name", label: "Display name", type: "text", required: true,
        hint: "What customers see, e.g. \"Gold Pass\". Renaming changes nothing else." },
      // The tier's CODE (owner, 2026-10-14): typed once, when the tier is
      // created, and locked after. Every rule that tells passes apart (which
      // playlists a tier sees, payments) reads it; order comes from Rank.
      { name: "tier", label: "Tier code", type: "text", required: true, fixedOnceCreated: true, normalise: "code",
        hint: "A short code no other tier uses, e.g. \"diamond\". Lower case; spaces become -. Cannot be changed once created." },
      { name: "rank", label: "Rank", type: "number", required: true,
        hint: "Orders the tiers, lowest first, and decides \"this tier and above\": a playlist for Gold is seen by every tier ranked at or above Gold. Each tier needs its own number." },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "series_allowance", label: "Group Coaching series a year", type: "number",
        hint: "How many series a pass holder may register for in each year of their pass (from the day it started, and each anniversary). Leave EMPTY for no limit." },
      { name: "playlist_allowance", label: "Video playlists", type: "number",
        hint: "How many playlists a pass holder chooses. Leave EMPTY for every playlist their tier may see." },
      { name: "includes_qa", label: "Includes the live Q&A", type: "boolean",
        hint: "Holders of this tier see the Q&A sessions, their joining links and recordings." },
      { name: "includes_retreats", label: "Includes the retreat", type: "boolean",
        hint: "Holders of this tier hold a place at retreats that are open without an interview." },
      // No "Retreat for yearly passes only" switch (removed 2026-10-14, owner): a
      // pass is one payment for twelve months, so nobody pays by the month and
      // the setting had nothing to tell apart. The column stays, set on, which
      // changes nothing while no pass has a monthly price.
      { name: "active", label: "Active", type: "boolean",
        hint: "Only active tiers are offered. Ultimate is switched off until it has a price and a decided offer." },
    ],
  },
  {
    table: "courses",
    slug: "courses",
    label: "Courses",
    labelSingular: "Course",
    description: "Self-paced courses. Modules and lessons are managed within each course.",
    permissions: {
      read: "courses.read",
      write: "courses.update",
      publish: "courses.publish",
    },
    columns: ["title", "status"],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      statusField,
    ],
  },
  {
    table: "group_coaching_series",
    slug: "group-coaching",
    label: "Group coaching",
    labelSingular: "Series",
    description:
      "A series holds sessions. Access to a series and a booked place in a session are different things — buying access does not reserve a seat.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
    },
    columns: ["name", "capacity", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "capacity", label: "Group size", type: "number", required: true,
        hint: "Places in each session of this series. Shown on the series' page, and used for any session created without a capacity of its own. Changing it does not alter sessions already scheduled." },
      statusField,
    ],
  },
  {
    // Migration 0016. Created with their sessions under Series runs; edited here.
    table: "coaching_runs",
    slug: "runs",
    past: { columns: ["ends_at", "starts_at"] },
    label: "Series runs",
    labelSingular: "Run",
    description:
      "One running of a series: its dates, its registration period and its places. Create a run (with its eight sessions) under Series runs → Create a run; change one here. Moving a run's dates does not move its sessions.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
      remove: "coaching.manage",
    },
    createDisabled: true,
    columns: ["label", "series_id", "starts_at", "capacity", "status"],
    titleField: "label",
    orderBy: { column: "starts_at", ascending: false },
    groupBy: "series_id",
    fields: [
      {
        name: "series_id",
        label: "Series",
        type: "reference",
        required: true,
        references: { table: "group_coaching_series", label: "name", orderBy: "name" },
      },
      { name: "label", label: "Name", type: "text", required: true,
        hint: "How customers tell two runs of a series apart: \"Tuesdays, 4pm\"." },
      { name: "pass_opens_at", label: "Pass holders can register from", type: "datetime",
        hint: "Coaching Pass holders register ahead of everyone. Leave empty for seven days before registration opens. It cannot be later than the opening." },
      { name: "registration_opens_at", label: "Registration opens (to everyone)", type: "datetime", required: true },
      { name: "registration_closes_at", label: "Series registration closes", type: "datetime",
        hint: "When the full series stops selling. From then the seats left are sold as single sessions, for the dates still to come. Leave empty to close when the series starts. It cannot be later than the start." },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true,
        hint: "After this the run leaves the public list." },
      { name: "capacity", label: "Places", type: "number", required: true,
        hint: "Registration closes when they are taken. Raising it lets more people register; it does not change the seats in sessions already created." },
      statusField,
    ],
  },
  {
    table: "coaching_registrations",
    slug: "registrations",
    emptyParents: { table: "group_coaching_series", label: "name", childTable: "coaching_runs", childKey: "series_id", note: "No run yet. Create one under Series runs." },
    // Finished with its run (owner, 2026-10-14): Current / Past, and read-only once over.
    past: { columns: ["coaching_runs.ends_at", "coaching_runs.starts_at"], embed: "coaching_runs(ends_at,starts_at)", foldPast: true },
    label: "Series run registrations",
    labelSingular: "Registration",
    description:
      "Who has a place on which run. Deleting a row frees the place; it does not refund or return what was paid, which is done under Entitlements.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
      remove: "coaching.manage",
    },
    createDisabled: true,
    columns: ["run_id", "user_id", "source", "created_at"],
    titleField: "user_id",
    orderBy: { column: "created_at", ascending: false },
    groupBy: "run_id",
    fields: [
      { name: "run_id", label: "Run", type: "reference", readOnly: true,
        references: { table: "coaching_runs", label: "label", orderBy: "starts_at", parent: { relation: "group_coaching_series", label: "name" } } },
      { name: "user_id", label: "Customer email", type: "text", readOnly: true },
      { name: "source", label: "Through", type: "select", options: ["purchase", "membership", "staff"], readOnly: true },
    ],
  },
  {
    table: "cohorts",
    slug: "cohorts",
    label: "Cohorts",
    labelSingular: "Cohort",
    description:
      "The cohorts themselves, one per level (Silver, Gold, Platinum, and any level added since). A cohort stays on the site all year. Each time it runs is an INTAKE (Cohort intakes), which carries the dates and the places and decides whether the cohort can be joined.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
    },
    columns: ["name", "cohort_level", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Display name", type: "text", required: true,
        hint: "What customers see, e.g. \"Gold Cohort\". Renaming changes nothing else." },
      { name: "slug", label: "Slug", type: "slug" },
      // A level CODE since migration 0029 (owner, 2026-10-14): one cohort per
      // level, typed once when the cohort is created and locked after.
      { name: "cohort_level", label: "Level code", type: "text", required: true, fixedOnceCreated: true, normalise: "code",
        hint: "A short code no other cohort uses, e.g. \"diamond\". Cannot be changed once created. A cohort level is not a Coaching Pass tier: holding one never gives the other." },
      { name: "rank", label: "Rank", type: "number", required: true,
        hint: "The order cohorts are shown in, lowest first." },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
    ],
  },
  {
    // Migration 0017. One running of a cohort.
    table: "cohort_intakes",
    slug: "intakes",
    past: { columns: ["ends_at", "starts_at"] },
    label: "Cohort intakes",
    labelSingular: "Intake",
    description:
      "One running of a cohort: its dates, its registration period and its places. A cohort can be joined only while one of its intakes is open for registration — from the day registration opens until the intake starts. To run a cohort again, add an intake; when one is full, add a second beside it. Then add its workshops under Cohort workshops.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
      remove: "cohorts.manage",
    },
    columns: ["label", "cohort_id", "starts_at", "capacity", "status"],
    titleField: "label",
    orderBy: { column: "starts_at", ascending: false },
    groupBy: "cohort_id",
    fields: [
      {
        name: "cohort_id",
        label: "Cohort",
        type: "reference",
        required: true,
        references: { table: "cohorts", label: "name", orderBy: "name" },
      },
      { name: "label", label: "Name", type: "text", required: true,
        hint: "How customers tell intakes apart: \"Spring 2027\"." },
      { name: "registration_opens_at", label: "Registration opens", type: "datetime", required: true,
        hint: "Nobody can join before this." },
      { name: "starts_at", label: "Starts (registration closes)", type: "datetime", required: true,
        hint: "The first workshop. Once it passes the intake shows as in progress and is closed." },
      { name: "ends_at", label: "Ends", type: "datetime", required: true,
        hint: "After this the intake leaves the cohort's page." },
      { name: "capacity", label: "Places", type: "number",
        hint: "Registration closes when they are taken. Leave empty for no limit — the page then makes no claim about size." },
      statusField,
    ],
  },
  {
    table: "cohort_enrolments",
    slug: "cohort-places",
    emptyParents: { table: "cohorts", label: "name", childTable: "cohort_intakes", childKey: "cohort_id", note: "No intake yet. Create one under Cohort intakes." },
    // Finished with its intake (owner, 2026-10-14): Current / Past, and read-only once over.
    past: { columns: ["cohort_intakes.ends_at", "cohort_intakes.starts_at"], embed: "cohort_intakes(ends_at,starts_at)", foldPast: true },
    label: "Cohort intake places",
    labelSingular: "Place",
    description:
      "Who is on which intake. Deleting a row frees the place; it does not refund or return what was paid, which is done under Entitlements.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
      remove: "cohorts.manage",
    },
    createDisabled: true,
    columns: ["intake_id", "user_id", "created_at"],
    titleField: "user_id",
    orderBy: { column: "created_at", ascending: false },
    groupBy: "intake_id",
    fields: [
      { name: "intake_id", label: "Intake", type: "reference", readOnly: true,
        references: { table: "cohort_intakes", label: "label", orderBy: "starts_at", parent: { relation: "cohorts", label: "name" } } },
      { name: "user_id", label: "Customer email", type: "text", readOnly: true },
    ],
  },
  // Live delivery (note 07 §35, §36). A series and a cohort are the
  // programme; these are the dated occurrences inside them. Without these two
  // there was no way to schedule a workshop or session, set its joining link,
  // or attach its recording short of writing SQL.
  {
    table: "cohort_workshops",
    slug: "workshops",
    emptyParents: { table: "cohorts", label: "name", childTable: "cohort_intakes", childKey: "cohort_id", note: "No intake yet. Create one under Cohort intakes." },
    past: { columns: ["ends_at", "starts_at"], stillEditable: ["recording_resource_id"], currentOnly: true },
    label: "Cohort workshops",
    labelSingular: "Workshop",
    description:
      "The dated workshops of an intake. The people on that intake see the joining link from 15 minutes before the start, and the recording afterwards, on the cohort's Academy page.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
      remove: "cohorts.manage",
    },
    columns: ["title", "starts_at", "status"],
    titleField: "title",
    orderBy: { column: "starts_at", ascending: false },
    // By INTAKE (owner, 2026-10-14): each batch runs on its own dates, so its
    // workshops are listed together, "Spring intake (Gold Cohort)".
    groupBy: "intake_id",
    // The cohort follows from the intake, never chosen separately.
    derive: { cohort_id: { from: "intake_id", table: "cohort_intakes", column: "cohort_id" } },
    fields: [
      {
        name: "intake_id",
        label: "Intake",
        type: "reference",
        required: true,
        references: { table: "cohort_intakes", label: "label", orderBy: "starts_at", parent: { relation: "cohorts", label: "name" } },
        hint: "The intake this workshop belongs to, with its cohort in brackets. Only the people on that intake see it, its joining link and its recording.",
      },
      {
        name: "cohort_id",
        label: "Cohort",
        type: "reference",
        readOnly: true,
        references: { table: "cohorts", label: "name", orderBy: "name" },
        hint: "Set from the intake.",
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first when two start together." },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Zoom or similar. Shown only to cohort members, and only from 15 minutes before the start until the end." },
      { name: "recording_resource_id", label: "Recording", type: "media", mediaKinds: RECORDING_KINDS,
        hint: "Add the recording under Media first (a Livid link, or an uploaded file), then pick it here." },
      { name: "status", label: "Status", type: "select", required: true,
        options: ["scheduled", "cancelled", "completed"] },
    ],
  },
  {
    table: "group_coaching_sessions",
    slug: "sessions",
    emptyParents: { table: "group_coaching_series", label: "name", childTable: "coaching_runs", childKey: "series_id", note: "No run yet. Create one under Series runs." },
    past: { columns: ["ends_at", "starts_at"], stillEditable: ["recording_resource_id"], currentOnly: true },
    label: "Coaching sessions",
    labelSingular: "Session",
    description:
      "One dated session of a Group Coaching series. Customers book seats with credits or series access; only people who booked see the joining link, and only they and series holders see the replay.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
      remove: "coaching.manage",
    },
    columns: ["title", "starts_at", "capacity", "status"],
    titleField: "title",
    orderBy: { column: "starts_at", ascending: false },
    // By RUN (owner, 2026-10-14), as cohort workshops are by intake: each run
    // has its own eight sessions, "Tuesdays, 4pm (Producing)".
    groupBy: "run_id",
    groupNoneLabel: "One-off sessions (not part of a run)",
    // The series follows from the run whenever there is one.
    derive: { series_id: { from: "run_id", table: "coaching_runs", column: "series_id" } },
    fields: [
      { name: "run_id", label: "Run", type: "reference",
        references: { table: "coaching_runs", label: "label", orderBy: "starts_at", parent: { relation: "group_coaching_series", label: "name" } },
        hint: "The run this session is part of, with its series in brackets. People registered for the run have a seat in it. Leave empty for a one-off session." },
      {
        name: "series_id",
        label: "Series",
        type: "reference",
        required: true,
        references: { table: "group_coaching_series", label: "name", orderBy: "name" },
        hint: "Filled in from the run when there is one. Choose it only for a one-off session.",
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "capacity", label: "Capacity", type: "number",
        hint: "Seats in this session. Leave empty to use the series' group size." },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Shown only to people who booked, from 15 minutes before the start until the end." },
      { name: "recording_resource_id", label: "Replay", type: "media", mediaKinds: RECORDING_KINDS,
        hint: "Add the recording under Media first, then pick it here." },
      { name: "status", label: "Status", type: "select", required: true,
        options: ["scheduled", "cancelled", "completed"] },
    ],
  },
  {
    table: "retreats",
    slug: "retreats",
    label: "Retreats",
    labelSingular: "Retreat",
    description:
      "Each retreat (or level) is fixed and stays on the site, with its own product and price. Each time it runs is a BATCH (Retreat batches), which carries the dates, places and joining link.",
    permissions: {
      read: "retreats.read",
      write: "retreats.manage",
    },
    columns: ["name", "level", "requires_application", "status"],
    titleField: "name",
    orderBy: { column: "position", ascending: true },
    fields: [
      { name: "name", label: "Display name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      // Locked once created, and used once (migration 0031, owner 2026-10-14):
      // a level is one retreat; running it again is a new batch.
      { name: "level", label: "Level", type: "number", fixedOnceCreated: true,
        hint: "1, 2 or 3 for a retreat that runs at levels; the page then offers a switch between them. Leave empty otherwise. Each level can belong to one retreat only." },
      { name: "position", label: "Position", type: "number", hint: "Lower shows first." },
      { name: "requires_application", label: "By interview", type: "boolean",
        hint: "Only someone with an approved application (Retreat applications) can book. A Coaching Pass that includes the retreat never covers a level entered by interview." },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
    ],
  },
  {
    // Migration 0030 (owner, 2026-10-14). One running of a retreat, as an
    // intake is of a cohort. It carries the joining link, which only people
    // with a place (or a pass that covers it) can read.
    table: "retreat_batches",
    slug: "retreat-batches",
    past: { columns: ["ends_at", "starts_at"] },
    label: "Retreat batches",
    labelSingular: "Retreat batch",
    description:
      "Each time a retreat runs: its dates, registration window, places and joining link. Make as many as wanted, per year or per season. Buying the retreat gives a place on the batch open at the time.",
    permissions: {
      read: "retreats.read",
      write: "retreats.manage",
      remove: "retreats.manage",
    },
    columns: ["label", "starts_at", "capacity", "status"],
    titleField: "label",
    orderBy: { column: "starts_at", ascending: false },
    groupBy: "retreat_id",
    fields: [
      {
        name: "retreat_id",
        label: "Retreat",
        type: "reference",
        required: true,
        fixedOnceCreated: true,
        references: { table: "retreats", label: "name", orderBy: "position" },
      },
      { name: "label", label: "Name of this batch", type: "text", required: true,
        hint: "How customers tell two batches apart, e.g. \"Spring 2027\"." },
      { name: "registration_opens_at", label: "Registration opens", type: "datetime", required: true },
      { name: "registration_closes_at", label: "Registration closes", type: "datetime",
        hint: "Leave empty to close when the batch starts." },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "capacity", label: "Places", type: "number",
        hint: "No more are sold once they are gone. Leave empty for no limit." },
      { name: "join_url", label: "Joining link", type: "text",
        hint: "Shown in the Academy only to people with a place on this batch, from 15 minutes before the start." },
      { name: "joining_notes", label: "Notes for attendees", type: "textarea",
        hint: "Shown with the link: a passcode, what to have ready." },
      statusField,
    ],
  },
  {
    // Migration 0030. Who has a place on which batch, like Cohort places.
    table: "retreat_places",
    slug: "retreat-places",
    emptyParents: { table: "retreats", label: "name", childTable: "retreat_batches", childKey: "retreat_id", note: "No batch yet. Create one under Retreat batches." },
    past: {
      columns: ["retreat_batches.ends_at", "retreat_batches.starts_at"],
      embed: "retreat_batches(ends_at,starts_at)",
      foldPast: true,
    },
    // Named and laid out like Series run registrations and Cohort intake
    // places (owner, 2026-10-14), including how each place was taken.
    label: "Retreat batch places",
    labelSingular: "Place",
    description:
      "Who has a place on which retreat batch. Deleting a row frees the place; it does not refund or return what was paid, which is done under Entitlements. Pass holders whose pass includes the retreat are not listed: they hold no numbered place.",
    permissions: {
      read: "retreats.read",
      write: "retreats.manage",
      remove: "retreats.manage",
    },
    createDisabled: true,
    columns: ["batch_id", "user_id", "source", "created_at"],
    titleField: "user_id",
    orderBy: { column: "created_at", ascending: false },
    groupBy: "batch_id",
    fields: [
      { name: "batch_id", label: "Batch", type: "reference", readOnly: true,
        references: { table: "retreat_batches", label: "label", orderBy: "starts_at", parent: { relation: "retreats", label: "name" } } },
      { name: "user_id", label: "Customer email", type: "text", readOnly: true },
      { name: "source", label: "Through", type: "select", options: ["purchase", "membership", "staff"], readOnly: true },
    ],
  },
  {
    // Migration 0032 (owner, 2026-10-14). Applied for from the retreat page,
    // for one batch; listed by batch, Current / Past, approved or not.
    table: "retreat_applications",
    slug: "retreat-applications",
    emptyParents: { table: "retreats", label: "name", childTable: "retreat_batches", childKey: "retreat_id", where: { column: "requires_application", value: true }, note: "No batch yet. Create one under Retreat batches to take applications." },
    past: {
      columns: ["retreat_batches.ends_at", "retreat_batches.starts_at"],
      embed: "retreat_batches(ends_at,starts_at)",
      foldPast: true,
    },
    label: "Retreat applications",
    labelSingular: "Application",
    description:
      "Applications for retreats entered by interview, made on the retreat's page, by batch. Marking one Approved emails the person and lets them book that batch; nothing else does. The next batch is applied for again.",
    permissions: {
      read: "retreats.read",
      write: "retreats.manage",
      remove: "retreats.manage",
    },
    columns: ["user_id", "status", "created_at"],
    titleField: "user_id",
    orderBy: { column: "created_at", ascending: false },
    groupBy: "batch_id",
    fields: [
      {
        name: "batch_id",
        label: "Batch",
        type: "reference",
        required: true,
        fixedOnceCreated: true,
        // Only batches of retreats entered by interview: no other retreat takes
        // applications, so no other batch is offered or listed here.
        references: {
          table: "retreat_batches",
          label: "label",
          orderBy: "starts_at",
          parent: { relation: "retreats", label: "name", where: { column: "requires_application", value: true } },
        },
        hint: "The batch applied for, with its retreat in brackets. Only retreats entered by interview.",
      },
      { name: "user_id", label: "Customer email", type: "text", required: true, fixedOnceCreated: true,
        hint: "The email address on their account." },
      { name: "status", label: "Status", type: "select", required: true,
        options: ["submitted", "interviewing", "approved", "declined", "withdrawn"],
        hint: "Approved: they are emailed and can book this batch. Declined or withdrawn: they are emailed that it is not going ahead, and can apply again." },
      { name: "staff_note", label: "Note to the applicant", type: "textarea",
        hint: "Optional. Added to the email when you decline or withdraw — write it before, or as, you change the status." },
      { name: "message", label: "What they told us", type: "textarea", readOnly: true },
    ],
  },
  {
    // Migration 0012 — the members' video library.
    table: "playlists",
    slug: "playlists",
    label: "Playlists",
    labelSingular: "Playlist",
    description:
      "The pass holders' video library. A Silver holder chooses one playlist; Gold and above see them all. Add videos under Playlist videos.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
      remove: "memberships.update",
    },
    columns: ["name", "min_tier", "position", "status"],
    titleField: "name",
    orderBy: { column: "position", ascending: true },
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea",
        hint: "Shown to pass holders choosing a playlist, and on the Coaching Pass pages." },
      // The tiers are read from the database (migration 0029), so a tier added
      // later is offered here too. Stored as the tier's code.
      { name: "min_tier", label: "Lowest tier", type: "reference", required: true,
        references: { table: "membership_tiers", label: "name", value: "tier", orderBy: "rank" },
        hint: "The lowest pass tier that sees this playlist; every tier ranked above it sees it too. The lowest tier: any pass holder may hold it (choosing it if their tier picks playlists)." },
      { name: "position", label: "Position", type: "number", hint: "Lower shows first." },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
    ],
  },
  {
    table: "playlist_videos",
    slug: "playlist-videos",
    label: "Playlist videos",
    labelSingular: "Video",
    description:
      "The videos in each playlist. A published video appears to pass holders straight away, newest first, and is marked \"New\" for a fortnight.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
      remove: "memberships.update",
    },
    columns: ["title", "playlist_id", "published_at", "status"],
    titleField: "title",
    orderBy: { column: "created_at", ascending: false },
    groupBy: "playlist_id",
    fields: [
      {
        name: "playlist_id",
        label: "Playlist",
        type: "reference",
        required: true,
        references: { table: "playlists", label: "name", orderBy: "position" },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "video_provider", label: "Video host", type: "select",
        options: ["livid", "vimeo", "youtube"],
        hint: "YouTube cannot be restricted to this site, so a leaked link plays anywhere. Prefer Livid or Vimeo for pass holders' video." },
      { name: "video_id", label: "Video id or URL", type: "text",
        normalise: "video-id",
        hint: "Paste the whole URL if that is what you have — the id is taken from it. The player address is built server-side and never shown to anyone without access." },
      { name: "video_hash", label: "Unlisted hash", type: "text",
        hint: "Vimeo only: the ?h= token an unlisted video needs." },
      { name: "video_duration_seconds", label: "Duration (seconds)", type: "number" },
      { name: "position", label: "Position", type: "number",
        hint: "Only breaks a tie between videos published at the same moment." },
      statusField,
      { name: "published_at", label: "Published at", type: "datetime",
        hint: "Set by itself the first time the video is published. Change it to reorder." },
    ],
  },
  {
    table: "member_qa_sessions",
    slug: "qa-sessions",
    past: { columns: ["ends_at", "starts_at"], stillEditable: ["recording_resource_id"] },
    label: "Q&A sessions",
    labelSingular: "Q&A session",
    description:
      "The live Q&A for pass holders whose tier includes it. They see the joining link from 15 minutes before the start, and the recording afterwards. No booking: every such holder may join.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
      remove: "memberships.update",
    },
    columns: ["title", "starts_at", "status"],
    titleField: "title",
    orderBy: { column: "starts_at", ascending: false },
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Shown to pass holders from 15 minutes before the start until the end." },
      { name: "recording_resource_id", label: "Recording", type: "media", mediaKinds: RECORDING_KINDS,
        hint: "Add the recording under Media first, then pick it here." },
      { name: "status", label: "Status", type: "select", required: true,
        options: ["scheduled", "cancelled", "completed"] },
    ],
  },
  {
    table: "membership_choices",
    slug: "playlist-choices",
    label: "Playlist choices",
    labelSingular: "Choice",
    description:
      "The playlist each pass holder picked, where their tier includes one. Delete a row to let that holder choose again (the access it gave goes with it). Series are not chosen here: see Series run registrations.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
      remove: "memberships.update",
    },
    createDisabled: true,
    columns: ["user_id", "kind", "resource_id", "created_at"],
    titleField: "kind",
    orderBy: { column: "created_at", ascending: false },
    fields: [
      { name: "user_id", label: "Customer email", type: "text", readOnly: true },
      { name: "kind", label: "Kind", type: "select", options: ["playlist"], readOnly: true },
      { name: "resource_id", label: "Playlist id", type: "text", readOnly: true },
    ],
  },
  {
    table: "events",
    slug: "events",
    past: { columns: ["ends_at", "starts_at"] },
    label: "Events",
    labelSingular: "Event",
    description: "Public events. Listed at /events and in the footer.",
    permissions: {
      read: "events.read",
      write: "events.update",
      remove: "events.delete",
    },
    columns: ["name", "starts_at", "format", "location", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
        hint: "The first paragraph is the summary under the title; leave a blank line between paragraphs.",
      },
      { name: "starts_at", label: "Starts", type: "datetime" },
      { name: "ends_at", label: "Ends", type: "datetime" },
      {
        name: "format",
        label: "Format",
        type: "select",
        options: ["in_person", "online", "hybrid"],
        hint: "Online joining links are set on the Check-in screen, where only ticket holders can see them.",
      },
      { name: "location", label: "Place name", type: "text", hint: "Short, public: \"Tyneside Cinema, Newcastle\" or \"Online, on Zoom\"." },
      { name: "venue_address", label: "Venue address", type: "textarea", hint: "Full address for in-person events. Shown with a map link." },
      { name: "capacity", label: "Places", type: "number", hint: "Leave empty for unlimited. When full, visitors can join a waiting list." },
      { name: "is_free", label: "Free to attend", type: "boolean", hint: "Free events are registered on the event page. Paid events need a ticket product: create it from the Product box on this page." },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
    ],
  },
  {
    table: "event_images",
    slug: "event-photos",
    label: "Event photos",
    labelSingular: "Event photo",
    description: "Photographs shown in an event's gallery, in order.",
    permissions: {
      read: "events.read",
      write: "events.update",
      remove: "events.update",
    },
    columns: ["event_id", "position", "caption"],
    titleField: "caption",
    fields: [
      {
        name: "event_id",
        label: "Event",
        type: "reference",
        required: true,
        references: { table: "events", label: "name", orderBy: "starts_at" },
      },
      { name: "resource_id", label: "Photo", type: "media", required: true },
      { name: "position", label: "Position", type: "number", hint: "Lower shows first; the first photo is shown large." },
      { name: "caption", label: "Caption", type: "text" },
    ],
  },
  {
    table: "private_coaching_services",
    slug: "private-coaching",
    label: "Private coaching",
    labelSingular: "Service",
    description: "One-to-one coaching offerings.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
    },
    columns: ["name", "duration_minutes", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "duration_minutes", label: "Duration (minutes)", type: "number" },
      statusField,
    ],
  },
  {
    // Migration 0020. Customers choose one of these and pay; the booking
    // then sits on the slot, so an open slot is simply one nobody holds.
    table: "private_coaching_slots",
    slug: "coaching-slots",
    past: { columns: ["ends_at", "starts_at"] },
    label: "Private coaching times",
    labelSingular: "Time",
    description:
      "Times Tony is available for one-to-one coaching. Customers see open times at least 12 hours ahead, pick one and pay. A time overlapping a booked session of any service is hidden automatically. Cancelling a booked time returns the session to the customer to rebook and emails them.",
    permissions: {
      read: "coaching.read",
      write: "coaching.manage",
      remove: "coaching.manage",
    },
    columns: ["service_id", "starts_at", "ends_at", "status"],
    titleField: "starts_at",
    orderBy: { column: "starts_at", ascending: false },
    groupBy: "service_id",
    fields: [
      {
        name: "service_id",
        label: "Service",
        type: "reference",
        required: true,
        references: { table: "private_coaching_services", label: "name", orderBy: "name" },
      },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime",
        hint: "Leave empty to use the service's length." },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Shown only to the person who booked, from 15 minutes before the start. Can be added later." },
      { name: "status", label: "Status", type: "select", required: true, options: ["open", "cancelled"],
        hint: "Cancel rather than delete a time someone has booked, so they get their session back." },
      { name: "notes", label: "Private notes", type: "textarea", hint: "Staff only." },
    ],
  },
  {
    table: "catalogue_items",
    slug: "catalogue",
    label: "Catalogue",
    labelSingular: "Catalogue item",
    description:
      "Categories say what a work is and do not change; tags decide where it appears and can be edited freely.",
    permissions: {
      read: "catalogue.read",
      write: "catalogue.update",
      remove: "catalogue.delete",
      publish: "catalogue.publish",
    },
    columns: ["title", "category", "status", "published_at"],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "category", label: "Category", type: "select", fixedOnceCreated: true, required: true,
        options: ["books", "films", "audio", "interviews", "stories-from-the-front-line", "podcasts", "watch"] },
      { name: "description", label: "Description", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "body", label: "Body", type: "textarea" },
      { name: "tags", label: "Tags", type: "tags",
        hint: "Comma separated. Give-Get-Go sections read these, e.g. give-get-go:documentaries." },
      { name: "is_external", label: "Hosted elsewhere", type: "boolean",
        hint: "Links straight out instead of opening a detail page here." },
      { name: "external_url", label: "External URL", type: "text",
        hint: "Required when hosted elsewhere." },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first." },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
      publishedAtField,
    ],
  },
  {
    table: "blog_posts",
    slug: "blog",
    label: "Blog",
    labelSingular: "Post",
    description: "Blog posts: write, schedule and publish articles for the site.",
    permissions: {
      read: "blog.read",
      write: "blog.update",
      remove: "blog.delete",
      publish: "blog.publish",
    },
    columns: ["title", "status", "published_at"],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "excerpt", label: "Excerpt", type: "textarea", required: true, hint: "Also what search results and shared links show." },
      { name: "content", label: "Content", type: "textarea", required: true },
      { name: "cover_resource_id", label: "Cover image", type: "media" },
      statusField,
      publishedAtField,
    ],
  },
  {
    table: "resources",
    slug: "media",
    label: "Media",
    labelSingular: "Media item",
    description:
      "Images, audio, documents, videos and links used across the site. Upload an image, audio file or document; for a video, give its Livid link.",
    permissions: {
      read: "catalogue.read",
      write: "catalogue.update",
      remove: "catalogue.delete",
    },
    columns: ["title", "resource_type", "storage_path"],
    titleField: "title",
    gallery: "storage_path",
    galleryKind: "resource_type",
    galleryPrivacy: ["audio", "document"],
    // Newest first (owner, 2026-10-15); a type or a storage path is not an
    // order anyone browses the library in.
    sortColumns: ["title", "created_at"],
    defaultSort: { key: "created_at", dir: "desc" },
    orderBy: { column: "created_at", ascending: false },
    fields: [
      { name: "title", label: "Title", type: "text", required: true,
        hint: "Imported items carry their original filename and the page they appeared on." },
      { name: "resource_type", label: "Type", type: "select", fixedOnceCreated: true, required: true,
        options: ["image", "video", "audio", "document", "link"] },
      // Uploaded, not typed (owner, 2026-10-15): the box that appears follows
      // the type. Video lives on Livid and a link is somewhere else, so those
      // two take a URL instead.
      { name: "storage_path", label: "File", type: "upload", uploadKind: "resource_type", required: true,
        shownFor: { field: "resource_type", values: ["image", "audio", "document"] } },
      { name: "external_url", label: "Link", type: "text", required: true,
        shownFor: { field: "resource_type", values: ["video", "link"] },
        hint: "For a video, its Livid link. For a link, the full address of the page or file." },
      { name: "width", label: "Width", type: "number", hidden: true },
      { name: "height", label: "Height", type: "number", hidden: true },
    ],
  },
  {
    table: "team_members",
    slug: "team",
    label: "Team",
    labelSingular: "Team member",
    description:
      "The people who teach. Shown on /about in `position` order — lowest first.",
    permissions: {
      read: "users.read",
      write: "users.update",
    },
    columns: ["name", "role", "position", "status"],
    titleField: "name",
    orderBy: { column: "position", ascending: true },
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "role", label: "Role", type: "text", hint: "Shown under the name." },
      { name: "bio", label: "Biography", type: "textarea" },
      { name: "photo_resource_id", label: "Photo", type: "media",
        hint: "Only images in public buckets can be shown on the site." },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first." },
      statusField,
    ],
  },
  {
    table: "course_modules",
    slug: "modules",
    label: "Course modules",
    labelSingular: "Module",
    description:
      "The sections a course is divided into. A course needs at least one before it can hold any lessons.",
    permissions: {
      read: "courses.read",
      write: "courses.update",
      remove: "courses.update",
    },
    columns: ["title", "position", "status"],
    titleField: "title",
    orderBy: { column: "position", ascending: true },
    groupBy: "course_id",
    appendPosition: "course_id",
    fields: [
      {
        name: "course_id",
        label: "Course",
        type: "reference",
        required: true,
        references: { table: "courses", label: "title", orderBy: "title" },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first. Leave empty to put it last." },
      // Owner, 2026-10-15: a module that is not Published is hidden from
      // learners with all its lessons; staff still see it.
      { ...statusField, hint: "Only Published modules, and their lessons, are shown to learners." },
    ],
  },
  {
    table: "lessons",
    slug: "lessons",
    label: "Lessons",
    labelSingular: "Lesson",
    description:
      "The teaching itself. A lesson can be video, written material, or both. Video is set by its provider and video id, not a web address, so it is only ever shown to people with access.",
    permissions: {
      read: "courses.read",
      write: "courses.update",
      remove: "courses.update",
      publish: "courses.publish",
    },
    columns: ["title", "position", "video_provider", "status"],
    titleField: "title",
    orderBy: { column: "position", ascending: true },
    groupBy: "module_id",
    appendPosition: "module_id",
    fields: [
      {
        name: "module_id",
        label: "Module",
        type: "reference",
        required: true,
        references: {
          table: "course_modules",
          label: "title",
          orderBy: "position",
        },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug",
        hint: "Appears in the URL. Changing it breaks existing links." },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first. Leave empty to put it last." },
      { name: "description", label: "Description", type: "textarea",
        hint: "A sentence or two shown under the lesson title: what the lesson covers." },
      { name: "content", label: "Written content", type: "textarea", markdown: true,
        hint: "Use the toolbar for headings, lists, links and a video inside the text; Preview shows the lesson as learners see it. Optional if there is video." },
      { name: "video_provider", label: "Video host", type: "select",
        options: ["youtube", "vimeo", "livid"],
        hint: "Leave empty for a lesson with no video. YouTube is interim — an unlisted YouTube URL cannot be domain-restricted, so a leaked one plays anywhere for ever." },
      { name: "video_id", label: "Video id or URL", type: "text",
        normalise: "video-id",
        hint: "Paste the whole URL if that is what you have — the id is taken from it. The player address is rebuilt server-side, so it is never shown to anyone without access." },
      { name: "video_hash", label: "Unlisted hash", type: "text",
        hint: "Vimeo only: the ?h= token an unlisted video needs. Leave empty for YouTube and Livid." },
      { name: "video_duration_seconds", label: "Duration (seconds)", type: "number",
        hint: "Shown under the player. Optional." },
      statusField,
    ],
  },
  {
    table: "testimonials",
    slug: "testimonials",
    label: "Testimonials",
    labelSingular: "Testimonial",
    description:
      "Customer quotes. Several are genuinely anonymous — they came from satisfaction surveys — so an attribution is optional rather than invented.",
    permissions: {
      read: "blog.read",
      write: "blog.update",
      remove: "blog.delete",
    },
    columns: ["quote", "attributed_to", "context", "featured", "status"],
    titleField: "attributed_to",
    orderBy: { column: "position", ascending: true },
    fields: [
      { name: "quote", label: "Quote", type: "textarea", required: true },
      { name: "attributed_to", label: "Attributed to", type: "text",
        hint: "Leave empty for an anonymous quote." },
      { name: "attribution_detail", label: "Attribution detail", type: "text",
        hint: "Publication, role, or the survey it came from." },
      { name: "context", label: "Context", type: "select",
        options: ["general", "coaching", "courses", "cohorts"],
        hint: "Where it is shown. Empty means anywhere." },
      { name: "featured", label: "Featured", type: "boolean",
        hint: "Featured quotes appear on the home page." },
      { name: "position", label: "Position", type: "number" },
      statusField,
    ],
  },
  {
    table: "testimonial_videos",
    slug: "testimonial-videos",
    label: "Testimonial videos",
    labelSingular: "Testimonial video",
    description:
      "Filmed client testimonials, shown on /about/testimonials. A published one with no video shows its cover marked \"Coming soon\" — add the video once it is uploaded to the host.",
    permissions: {
      read: "blog.read",
      write: "blog.update",
      remove: "blog.delete",
    },
    columns: ["attributed_to", "title", "video_provider", "status"],
    titleField: "attributed_to",
    orderBy: { column: "position", ascending: true },
    fields: [
      { name: "attributed_to", label: "Who", type: "text",
        hint: "As the person gave it. Empty only for a compilation of several voices." },
      { name: "title", label: "Line", type: "text",
        hint: "A line from the clip, shown as a quote. Optional." },
      { name: "slug", label: "Slug", type: "slug" },
      { name: "cover_resource_id", label: "Cover", type: "media" },
      { name: "video_provider", label: "Video host", type: "select",
        options: ["livid", "vimeo", "youtube"],
        hint: "Leave empty until the video is uploaded." },
      { name: "video_id", label: "Video id or URL", type: "text",
        normalise: "video-id",
        hint: "Paste the whole URL if that is what you have — the id is taken from it." },
      { name: "video_hash", label: "Unlisted hash", type: "text",
        hint: "Vimeo only: the ?h= token an unlisted video needs." },
      { name: "duration_seconds", label: "Duration (seconds)", type: "number" },
      { name: "context", label: "Context", type: "select",
        options: ["general", "coaching", "courses", "cohorts"] },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first." },
      statusField,
    ],
  },
] as const;

export function resourceBySlug(slug: string): ResourceConfig | undefined {
  return ADMIN_RESOURCES.find((r) => r.slug === slug);
}

/**
 * Whether a row has finished, by the resource's `past` columns: the first
 * that has a value is the moment it ended. A row with none has not.
 */
export function isPast(resource: ResourceConfig, row: Record<string, unknown>, now = Date.now()): boolean {
  if (!resource.past) return false;
  for (const column of resource.past.columns) {
    // "cohort_intakes.ends_at" reads a field of the related row read with it.
    const [first, second] = column.split(".");
    const value = second ? (row[first] as Record<string, unknown> | null)?.[second] : row[column];
    if (value) return new Date(String(value)).getTime() <= now;
  }
  return false;
}

/** Rows split into those still current and those finished, at one moment. */
export function splitByPast<T extends Record<string, unknown>>(
  resource: ResourceConfig,
  rows: readonly T[],
): { current: T[]; past: T[] } {
  const now = Date.now();
  const current: T[] = [];
  const past: T[] = [];
  for (const row of rows) (isPast(resource, row, now) ? past : current).push(row);
  return { current, past };
}

/**
 * Where a dated row is in its life, for the status shown in admin (owner,
 * 2026-10-14): Draft, Scheduled (going ahead, still to come), Running
 * (started, not yet over), Completed (over), or Cancelled. "Published" is
 * kept for things that are not dated, such as a course or a blog post. Display only; the stored
 * status is unchanged. For a resource without `past`, the stored status.
 */
export type Lifecycle = "draft" | "scheduled" | "running" | "completed" | "cancelled";

export function lifecycleOf(
  resource: ResourceConfig,
  row: Record<string, unknown>,
  now = Date.now(),
): string {
  const stored = String(row.status ?? "");
  // Only a row's OWN dates make a lifecycle. A row that finishes with what it
  // belongs to (an application, a place) keeps its own status as it is.
  if (!resource.past || resource.past.embed) return stored;
  if (stored === "draft" || stored === "cancelled") return stored;
  if (isPast(resource, row, now)) return "completed";
  const starts = row.starts_at ? new Date(String(row.starts_at)).getTime() : null;
  return starts !== null && starts <= now ? "running" : "scheduled";
}

/** `lifecycleOf` for many rows at one moment, keyed by row id. */
export function lifecycles(resource: ResourceConfig, rows: readonly Record<string, unknown>[]): Map<string, string> {
  const now = Date.now();
  return new Map(rows.map((row) => [String(row.id), lifecycleOf(resource, row, now)]));
}

/** The Media types a `media` field accepts. */
export function mediaKindsOf(field: Field): readonly string[] {
  return field.mediaKinds ?? ["image"];
}

/** Every Media type the resource's `media` fields accept, for loading the library once. */
export function mediaKindsFor(resource: ResourceConfig): string[] {
  return [...new Set(resource.fields.filter((f) => f.type === "media").flatMap(mediaKindsOf))];
}
