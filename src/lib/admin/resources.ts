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
  /** Pick an image from the media library rather than typing a resource id. */
  | "media"
  /**
   * Pick a row from another table rather than typing its uuid.
   *
   * `prices.product_id` predates this and is still a plain text field, which
   * means creating a price requires going and finding a uuid first. A foreign
   * key the operator has to transcribe is a foreign key that gets mistyped, and
   * nothing about the resulting row looks wrong until something else breaks.
   */
  | "reference";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Shown under the input. Use it for the non-obvious, not to restate the label. */
  hint?: string;
  options?: readonly string[];
  /** Hidden from the create form — set by the system, not by a person. */
  readOnly?: boolean;
  /**
   * Named clean-up applied on save, e.g. taking the id out of a pasted URL.
   *
   * A NAME rather than a function: this config is handed to a client component,
   * and a function on it would fail to serialise. The name is resolved to the
   * actual transform on the server side of the write.
   */
  normalise?: "video-id";
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
    columns: ["name", "product_type", "status", "stripe_product_id"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", required: true, hint: "Appears in the URL. Changing it breaks existing links." },
      { name: "product_type", label: "Type", type: "select", required: true,
        options: ["membership", "course", "group_coaching", "cohort", "private_coaching", "retreat", "event", "masterclass", "bundle", "other"] },
      { name: "description", label: "Description", type: "textarea" },
      // Products use their own lifecycle, not the content one: a product is
      // paused rather than unpublished, because an archived product still has
      // to resolve for the orders that reference it.
      { name: "status", label: "Status", type: "select", required: true,
        options: ["draft", "active", "paused", "archived"],
        hint: "Only active products can be purchased." },
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
      { name: "product_id", label: "Product", type: "text", required: true, hint: "The product this price belongs to." },
      { name: "amount", label: "Amount", type: "money", required: true, hint: "In pence. £49.00 is 4900." },
      { name: "currency", label: "Currency", type: "select", options: ["GBP", "USD", "EUR"], required: true },
      { name: "billing_type", label: "Billing", type: "select", options: ["one_time", "recurring"], required: true },
      { name: "interval", label: "Interval", type: "text", hint: "For recurring prices, e.g. month or year." },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    table: "membership_tiers",
    slug: "memberships",
    label: "Membership tiers",
    labelSingular: "Membership tier",
    description:
      "Tiers are CUMULATIVE: each includes everything beneath it. Rank decides that order, so it is the field to be careful with.",
    permissions: {
      read: "memberships.read",
      write: "memberships.update",
    },
    // Four tiers, `tier` unique: the set is fixed, so these are edited not created.
    createDisabled: true,
    columns: ["name", "tier", "rank", "active"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "tier", label: "Tier", type: "select", required: true,
        options: ["silver", "gold", "platinum", "ultimate"] },
      { name: "rank", label: "Rank", type: "number", required: true,
        hint: "Higher rank includes every lower tier. Silver 1 through Ultimate 4." },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "active", label: "Active", type: "boolean" },
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
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      statusField,
    ],
  },
  {
    table: "masterclasses",
    slug: "masterclasses",
    label: "Masterclasses",
    labelSingular: "Masterclass",
    description: "First-class Academy content with entitlement-based access (note 03 §17).",
    permissions: {
      read: "masterclasses.read",
      write: "masterclasses.update",
      publish: "masterclasses.publish",
    },
    columns: ["title", "status", "starts_at"],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "starts_at", label: "Starts", type: "datetime" },
      { name: "ends_at", label: "Ends", type: "datetime" },
      { name: "meeting_url", label: "Meeting URL", type: "text" },
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
    columns: ["name", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      statusField,
    ],
  },
  {
    table: "cohorts",
    slug: "cohorts",
    label: "Cohorts",
    labelSingular: "Cohort",
    description: "Interactive cohorts run to a schedule with a fixed group.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
    },
    columns: ["name", "cohort_level", "starts_at", "capacity"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "cohort_level", label: "Cohort level", type: "select", options: ["silver", "gold", "platinum"],
        hint: "A cohort level, NOT a membership tier — deliberately separate concepts (R17)." },
      { name: "description", label: "Description", type: "textarea" },
      { name: "starts_at", label: "Starts", type: "datetime" },
      { name: "ends_at", label: "Ends", type: "datetime" },
      { name: "capacity", label: "Capacity", type: "number", hint: "Places available. Leave empty for unlimited." },
      statusField,
    ],
  },
  // Live delivery (note 07 §35, §36). A series and a cohort are the
  // programme; these are the dated occurrences inside them. Without these two
  // there was no way to schedule a workshop or session, set its joining link,
  // or attach its recording short of writing SQL.
  {
    table: "cohort_workshops",
    slug: "workshops",
    label: "Cohort workshops",
    labelSingular: "Workshop",
    description:
      "The dated workshops a cohort runs. Members see the joining link from 15 minutes before the start, and the recording afterwards, on the cohort's Academy page.",
    permissions: {
      read: "cohorts.read",
      write: "cohorts.manage",
      remove: "cohorts.manage",
    },
    columns: ["title", "starts_at", "status"],
    titleField: "title",
    orderBy: { column: "starts_at", ascending: false },
    fields: [
      {
        name: "cohort_id",
        label: "Cohort",
        type: "reference",
        required: true,
        references: { table: "cohorts", label: "name", orderBy: "name" },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first when two start together." },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Zoom or similar. Shown only to cohort members, and only from 15 minutes before the start until the end." },
      { name: "recording_resource_id", label: "Recording", type: "reference",
        references: { table: "resources", label: "title", context: "resource_type", orderBy: "title" },
        hint: "Add the recording under Media first (a Livid link, or a file in course-assets), then pick it here." },
      { name: "status", label: "Status", type: "select", required: true,
        options: ["scheduled", "cancelled", "completed"] },
    ],
  },
  {
    table: "group_coaching_sessions",
    slug: "sessions",
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
    fields: [
      {
        name: "series_id",
        label: "Series",
        type: "reference",
        required: true,
        references: { table: "group_coaching_series", label: "name", orderBy: "name" },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true, hint: "Seats available. Eight by default." },
      { name: "meeting_url", label: "Joining link", type: "text",
        hint: "Shown only to people who booked, from 15 minutes before the start until the end." },
      { name: "recording_resource_id", label: "Replay", type: "reference",
        references: { table: "resources", label: "title", context: "resource_type", orderBy: "title" },
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
    description: "Retreats are application-based rather than instant purchases.",
    permissions: {
      read: "retreats.read",
      write: "retreats.manage",
    },
    columns: ["name", "starts_at", "capacity", "status"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "starts_at", label: "Starts", type: "date" },
      { name: "ends_at", label: "Ends", type: "date" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "requires_application", label: "Requires application", type: "boolean",
        hint: "Retreats are application-based rather than instant purchases." },
      statusField,
    ],
  },
  {
    table: "events",
    slug: "events",
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
      { name: "slug", label: "Slug", type: "slug", required: true },
      {
        name: "description",
        label: "Description",
        type: "textarea",
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
      { name: "is_free", label: "Free to attend", type: "boolean", hint: "Free events are registered on the event page. Paid events need a ticket product below." },
      {
        name: "product_id",
        label: "Ticket product",
        type: "reference",
        hint: "For paid events: a product of type \"event\" with a one-off price. Buying it issues the ticket.",
        references: { table: "products", label: "name", context: "slug", orderBy: "name" },
      },
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
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "duration_minutes", label: "Duration (minutes)", type: "number" },
      {
        name: "product_id",
        label: "Product",
        type: "reference",
        references: { table: "products", label: "name", context: "product_type", orderBy: "name" },
        hint: "The product whose price is charged for one session. Without one, the service can't be booked online.",
      },
      statusField,
    ],
  },
  {
    // Migration 0020. Customers choose one of these and pay; the booking
    // then sits on the slot, so an open slot is simply one nobody holds.
    table: "private_coaching_slots",
    slug: "coaching-slots",
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
      "Categories classify what a work IS and never change; tags curate where it APPEARS and are edited freely (R25).",
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
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "category", label: "Category", type: "select", required: true,
        options: ["books", "films", "audio", "interviews", "stories-from-the-front-line", "podcasts", "watch"] },
      { name: "description", label: "Description", type: "textarea" },
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
    description: "Blog is a first-class managed content domain (R15).",
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
      { name: "slug", label: "Slug", type: "slug", required: true },
      { name: "excerpt", label: "Excerpt", type: "textarea" },
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
      "Images and files in storage. `storage_path` is a bucket-relative key, never a full URL — the host differs between local and production, and a stored URL would break on deploy.",
    permissions: {
      read: "catalogue.read",
      write: "catalogue.update",
      remove: "catalogue.delete",
    },
    columns: ["title", "resource_type", "storage_path"],
    titleField: "title",
    orderBy: { column: "title", ascending: true },
    fields: [
      { name: "title", label: "Title", type: "text", required: true,
        hint: "Imported items carry their original filename and the page they appeared on." },
      { name: "resource_type", label: "Type", type: "select", required: true,
        options: ["image", "video", "audio", "document", "link"] },
      { name: "storage_path", label: "Storage path", type: "text",
        hint: "Bucket-relative, e.g. site-media/ab12cd34-cover.avif" },
      { name: "external_url", label: "External URL", type: "text",
        hint: "For material hosted elsewhere. One of this or the storage path is required." },
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
      { name: "slug", label: "Slug", type: "slug", required: true },
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
    columns: ["title", "position"],
    titleField: "title",
    orderBy: { column: "position", ascending: true },
    fields: [
      {
        name: "course_id",
        label: "Course",
        type: "reference",
        required: true,
        references: { table: "courses", label: "title", orderBy: "title" },
      },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first." },
    ],
  },
  {
    table: "lessons",
    slug: "lessons",
    label: "Lessons",
    labelSingular: "Lesson",
    description:
      "The teaching itself. A lesson can be video, written material, or both — and video is addressed by provider and id, never by URL (note 07 §R29).",
    permissions: {
      read: "courses.read",
      write: "courses.update",
      remove: "courses.update",
      publish: "courses.publish",
    },
    columns: ["title", "position", "video_provider", "status"],
    titleField: "title",
    orderBy: { column: "position", ascending: true },
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
      { name: "slug", label: "Slug", type: "slug", required: true,
        hint: "Appears in the URL. Changing it breaks existing links." },
      { name: "position", label: "Position", type: "number", hint: "Lower sorts first." },
      { name: "content", label: "Written content", type: "textarea",
        hint: "Blank paragraphs separate paragraphs. Optional if there is video." },
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
      { name: "slug", label: "Slug", type: "slug", required: true },
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
