# Tony Klinger — Supabase Database & Data Architecture

**File:** `08-supabase-database-and-data-architecture.md`

## 1. Purpose

Define the data architecture for the Tony Klinger platform using Supabase PostgreSQL.

This note establishes:

- Core entities
- Relationships
- User/profile data
- Products and pricing
- Memberships
- Entitlements
- Courses and Academy content
- Group Coaching series and sessions
- Cohorts
- Events
- Retreats
- Bookings
- Orders and order items
- Payments/subscriptions at the data level
- Resources and recordings
- Roles and permissions
- Audit records
- Database constraints
- Row Level Security
- Policies
- Triggers
- Data lifecycle and cleanup

The detailed Stripe implementation belongs in the Payments & Integrations Architecture.

This note defines the database model, not the React UI.

---

# 2. Database Platform

Use **Supabase PostgreSQL** as the primary application database.

The database is the source of truth for persistent application data.

Conceptually:

```text
Next.js Application
        ↓
Supabase
        ↓
PostgreSQL
```

The database should not depend on frontend state to maintain business integrity.

---

# 3. Database Creation and Management

The Supabase project/database is created through the Supabase platform.

The application schema should then be managed through SQL migrations.

Conceptually:

```text
Supabase Project
      ↓
PostgreSQL Database
      ↓
SQL Migrations
      ↓
Tables / Columns / Constraints / Policies / Functions
```

Supabase CLI should be used to manage migrations and keep the database schema reproducible.

Do not manually make undocumented production schema changes where a migration should exist.

---

# 4. Migration Principle

Database changes should be represented as migration files.

Examples:

```text
supabase/
└── migrations/
    ├── 0001_initial_schema.sql
    ├── 0002_auth_profile.sql
    ├── 0003_products.sql
    └── ...
```

The exact migration numbering and filenames may differ.

The important requirement is that the schema can be recreated and evolved from version-controlled migrations.

**Consolidated 2026-09-23, before first deployment.** Forty migrations became ten, each
a run of the originals in their original order, so the resulting schema is identical
(verified by `pg_dump` diff). Every section keeps a banner naming its former number,
which older notes and change-log rows still cite:

| Now | Formerly |
|-----|----------|
| `0001_core_schema` | 0001–0003 |
| `0002_security_and_reference_data` | 0004–0007 |
| `0003_commerce_and_bookings` | 0008–0012 |
| `0004_operations` | 0013–0018 (0014 folded into 0013) |
| `0005_storage_contact_and_consent` | 0019–0022 (0022 folded into 0021) |
| `0006_public_content` | 0023–0028 |
| `0007_benefits_and_covers` | 0029–0031, 0033, 0034 (0032 removed) |
| `0008_staff_accounts` | 0035–0036 |
| `0009_lesson_video_and_progress` | 0037–0038 (0038 folded into 0037) |
| `0010_catalogue_media` | 0039–0040 |

**Consolidated again 2026-09-28, before first deployment.** The twenty-two files that
existed by then became ten, again as adjacent runs in their original order; the rebuilt
`public` schema, storage policies and buckets match the previous build (`pg_dump` diff),
and every section carries a banner naming its former file:

| Now | Formerly (2026-09-23 numbering) |
|-----|----------|
| `0001`–`0005` | unchanged |
| `0006_public_content_and_benefits` | `0006_public_content`, `0007_benefits_and_covers` |
| `0007_staff_accounts_and_lesson_video` | `0008_staff_accounts`, `0009_lesson_video_and_progress` |
| `0008_catalogue_and_site_media` | `0010_catalogue_media` – `0016_course_order_and_level` |
| `0009_events_and_academy_delivery` | `0017`–`0019` |
| `0010_coaching_billing_and_account_security` | `0020`–`0022` |

Bare migration numbers above 0005 in older notes, comments and change-log rows refer to
the numbering in force when they were written.

Once deployed, migrations are append-only again: never rewritten, only added to.

---

# 5. Core Entity Model

The platform's principal data entities are:

```text
User
Profile
Role
Permission

Product
Price
Membership
Membership Tier
Entitlement

Course
Module
Lesson
Resource
Masterclass

Blog Post
Catalogue Item

Group Coaching Series
Group Coaching Session

Cohort
Cohort Workshop

Retreat
Event

Booking
Order
Order Item
Payment
Subscription

Notification
Email Contact / Communication State
Email Outbox Message
Audit Log
```

Additional entities may be introduced when a real requirement justifies them.

---

# 6. Supabase Auth User

Authentication identity is owned by Supabase Auth.

The application should reference the authenticated user through the Supabase Auth user ID.

Conceptually:

```text
auth.users.id
       ↓
profiles.user_id
```

Do not create a second independent authentication-user table that duplicates Supabase's identity system.

Application tables should reference the stable Auth user ID.

---

# 7. Profiles

Create an application profile table associated with the Auth user.

Conceptually:

```text
profiles
--------
user_id
first_name
last_name
display_name
avatar_url
status
welcomed_at
created_at
updated_at
```

`welcomed_at` records the first successful sign-in and is what makes the welcome
happen exactly once (note 05 §7.3). It is claimed by `claim_welcome()`, which tests
and sets it in a single statement so concurrent sign-ins cannot both claim it.

The exact fields may evolve.

The profile table must not contain:

- Passwords
- Authentication secrets
- Supabase service-role credentials

Authentication credentials remain managed by Supabase Auth.

---

# 8. User-Owned Data

Customer-owned records should reference the user.

Examples:

```text
orders.user_id
bookings.user_id
entitlements.user_id
profiles.user_id
notifications.user_id
```

Where appropriate, use foreign keys to maintain referential integrity.

---

# 9. Products

Products represent things the business sells or offers.

Conceptually:

```text
products
--------
id
name
slug
description
product_type
status
metadata
created_at
updated_at
```

Possible `product_type` values include:

```text
membership
course
group_coaching
cohort
private_coaching
retreat
event
masterclass
bundle
other
```

The final implementation may use an enum, lookup table or validated text field.

---

# 10. Product Status

Products should support lifecycle states.

Baseline:

```text
draft
active
paused
archived
```

A product becoming archived should not automatically revoke existing customer entitlements.

Product availability and customer access are separate concerns.

---

# 11. Prices

Prices should be represented separately from products where practical.

Conceptually:

```text
prices
------
id
product_id
currency
amount
billing_type
interval
active
created_at
updated_at
```

Possible billing types:

```text
one_time
recurring
```

Possible recurring intervals:

```text
month
year
```

The final schema should support the actual Stripe price relationships.

---

# 12. Membership Products

Memberships are products with a membership-specific configuration.

The membership hierarchy is:

```text
Silver
   ↓
Gold
   ↓
Platinum
   ↓
Ultimate
```

Membership tiers must be distinguishable from Interactive Cohort levels.

Do not use an ambiguous generic `tier` field without identifying which product family it belongs to.

---

# 13. Membership Tier Naming

Use clear domain terminology.

For example:

```text
membership_tier
```

for:

```text
Silver
Gold
Platinum
Ultimate
```

For Interactive Cohorts, use terminology such as:

```text
cohort_level
```

for:

```text
Silver
Gold
Platinum
```

This prevents:

```text
Gold membership
```

from being confused with:

```text
Gold cohort level
```

The underlying database relationships must also make this distinction explicit.

---

# 14. Membership Configuration

Membership configuration should be data-driven.

Conceptually:

```text
membership_tiers
----------------
id
name
slug
level
description
active
```

The exact table structure may instead be implemented through products plus a membership configuration table.

The important requirement is that membership benefits are not hard-coded throughout application components.

---

# 15. Membership Benefits

Benefits should be represented through entitlement rules or an equivalent configuration.

Conceptually:

```text
Membership Tier
      ↓
Benefit / Entitlement Rule
      ↓
Customer Entitlement
```

For example:

```text
Gold
 ↓
Group Coaching Series access
 ↓
Customer entitlement
```

This makes cumulative benefits manageable.

---

# 16. Cumulative Membership Model

The membership hierarchy is:

```text
Silver
→ 1 Group Coaching series
→ 8 sessions

Gold
→ Everything in Silver
→ 2 series total
→ 16 sessions total

Platinum
→ Everything in Gold
→ All 4 series
→ 32 sessions total
→ Virtual retreats
→ New courses during membership

Ultimate
→ Everything in Platinum
→ Unlimited cohort access
→ New releases
→ Masterclasses
→ Partner discounts
→ Downloadable resources
```

The database should represent this as cumulative entitlement logic rather than four unrelated benefit lists.

---

# 17. Entitlements

Entitlements are a central part of the data model.

Conceptually:

```text
entitlements
------------
id
user_id
entitlement_type
resource_type
resource_id
source_type
source_id
status
starts_at
expires_at
quantity
quantity_used
created_at
updated_at
```

The exact fields may differ.

The table must be capable of representing both access entitlements and consumable entitlements.

---

# 18. Entitlement Sources

Supported entitlement sources include:

```text
purchase
membership
bundle
promotion
admin_grant
other
```

The source should be traceable.

For example:

```text
user
 ↓
Gold membership
 ↓
membership-derived entitlement
```

or:

```text
user
 ↓
direct purchase
 ↓
purchase-derived entitlement
```

---

# 19. Entitlement Types

The entitlement model should support resources such as:

```text
course
group_coaching_series
group_coaching_session
cohort
retreat
masterclass
resource
release
partner_discount
```

The exact representation may use explicit foreign keys or a carefully controlled polymorphic resource model.

Avoid an unrestricted polymorphic design if it compromises referential integrity.

---

# 20. Entitlement Quantity

Entitlements can be:

```text
unlimited
```

or:

```text
limited
```

For a limited entitlement:

```text
quantity = 8
quantity_used = 0
```

After one valid consumption:

```text
quantity_used = 1
```

The remaining quantity is:

```text
7
```

Consumption must be performed transactionally to prevent double-use caused by concurrent requests.

---

# 21. Entitlement Dates

Entitlements may have:

```text
starts_at
expires_at
```

For membership-derived access, these dates should normally follow the relevant membership period.

For permanent purchases, `expires_at` may be null where the business rules allow lifetime access.

The application must define expiration behaviour deliberately.

---

# 22. Courses

Course content should be represented separately from the commercial product definition.

Conceptually:

```text
products
   ↓
course
   ↓
modules
   ↓
lessons
   ↓
resources
```

A course can therefore have a commercial product while its actual learning content remains in the Academy model.

---

# 23. Course Entity

Conceptually:

```text
courses
-------
id
product_id
title
slug
description
level        display label for its place in a sequence ("Level Two"); not a prerequisite
position     storefront order, lowest first
status
created_at
updated_at
```

A course is **titled by what it teaches**, not by its level (owner, 2026-09-26). The level
is a small label (`level`, migration 0016), and the storefront order is curated
(`position`), not alphabetical. The product that sells a course carries the same name, so
the cart and the order snapshot say what was bought.

A course may be linked to a product if it is commercially sold.

Not every internal learning object necessarily needs to be a separately purchasable product.

---

# 24. Course Modules

Conceptually:

```text
course_modules
-------------
id
course_id
title
description
position
```

Modules provide structure within a course.

Use an explicit ordering field rather than relying on database insertion order.

---

# 25. Lessons

Conceptually:

```text
lessons
-------
id
module_id
title
slug
content
position
status
created_at
updated_at
```

`content` is **structured rich-text JSON** (a ProseMirror/Tiptap-shaped document: a node
tree, not a string), stored as `jsonb`. It is not Markdown and not raw HTML.

The deciding requirement is that **a lesson can contain a video partway through its body**,
independently of the lesson's main video. Markdown has no node type for that — an embed
has to be smuggled in as raw HTML or a bespoke shortcode, which then has to be parsed by
hand and cannot be validated. In a node tree a video is a first-class node with its own
attributes, placed anywhere in the document, and the renderer walks it like any other node.

Raw HTML is rejected for a different reason: lesson bodies are authored through Admin, and
storing HTML means either trusting that input or sanitising it on every render. A
constrained node tree can only express the node types the schema allows.

**A video node stores a reference, never a URL:**

```text
{ "type": "video", "attrs": { "resourceId": "…" } }
```

The renderer resolves that reference **server-side**, through the same
`has_active_entitlement()` check that gates the lesson's main video (note 09 §40.1). An
inline video is therefore gated exactly as the primary one is, and no playable URL ever
reaches the browser of a viewer who is not entitled. Storing a URL in the node would defeat
this, because the document itself is delivered to the client.

**Imported Markdown is converted, not stored.** The predecessor platform's export holds
`markdown_content`; migrating it means parsing to the node tree once, at import, not
carrying Markdown alongside JSON. Two representations of the same field would drift.

Lessons should be protected by Academy entitlement checks.

---

# 26. Resources

Resources may belong to courses, lessons, sessions, cohorts, retreats or other experiences.

Conceptually:

```text
resources
---------
id
title
resource_type
storage_path
external_url
created_at
updated_at
```

Private files should use protected storage/access mechanisms.

`storage_path` is a **bucket-relative key**, not a URL — see §60.1. Which bucket it
refers to follows from whether the resource is gated: `course-assets` for material
attached to Academy content, `documents` for standalone gated files.

Do not expose protected Academy resources through a publicly accessible static directory.

**Recording read policy (migration 0019, 2026-09-26):** a resource row is also readable
when it is the recording of a workshop or session the caller may open — note 07 §23 has the
exact rule. A private-bucket path read this way is still only a key; the object needs a
server-minted signed URL.

---

# 27. Masterclasses

Masterclasses are an Ultimate Membership benefit.

They should be representable as Academy-delivered content or experiences.

A masterclass may be:

```text
membership included
```

or:

```text
standalone product
```

depending on the commercial configuration.

Access should be resolved through entitlements.

Conceptually:

```text
masterclasses
-------------
id
product_id
title
slug
description
status
starts_at
ends_at
meeting_url
recording_resource_id
created_at
updated_at
```

`product_id` is present only where the masterclass is separately purchasable. A masterclass
included in Ultimate Membership is reached through a membership-derived entitlement.

**Delivery routes reversed, 2026-09-05 (note 07 §22, note 03 §17).** `/academy/masterclasses`
and `/academy/masterclasses/[masterclassSlug]` no longer exist — Masterclasses folds into
Courses conceptually rather than keeping a parallel Academy destination, at the user's
direction. The table, its RLS and its permissions are unchanged; only the route and nav
entry were removed.

---

# 28. New Releases

The database should allow qualifying new releases to be associated with membership entitlement rules.

The system should not require developers to manually add a new course ID to several unrelated application checks every time a new release is created.

Content/product configuration should determine whether a release qualifies for a membership benefit.

---

# 28.1 Blog

The public blog at `/blog` and `/blog/[slug]` (note 03 §6) is a first-class managed content
domain with its own Admin area at `/admin/blog`.

Conceptually:

```text
blog_posts
----------
id
title
slug
excerpt
content
status
published_at
author_user_id
cover_resource_id
word_count          generated (migration 0013)
created_at
updated_at
```

`word_count` is a stored generated column — whitespace-delimited words in `content` — so
listings can show reading time without selecting article bodies. It is never written by
the application.

The imported archive has `author_user_id` empty on every row. Until it is populated, the
author of a post is Tony Klinger unless the body closes with a "Written by …" line, which
is how the archive's guest pieces record their author (`postAuthor()`,
`src/lib/content/blog.ts`). The imported `published_at` values are republication dates on
the predecessor site, not dates of writing: they order the essays but are shown nowhere,
not even in metadata (owner, 2026-09-25).

Status values:

```text
draft
published
archived
```

Only `published` posts with a `published_at` in the past are publicly visible. Draft and
archived posts must not be reachable by guessing a slug — publication state is enforced
server-side and in RLS, not by omitting a link.

`blog.publish` is a distinct permission from `blog.update` (note 06 §18), so editing and
publishing can be separated where editorial approval is required.

Additional media beyond the cover image is associated through `resources` (§26).

---

# 28.2 Catalogue

The Catalogue at `/catalogue` is a first-class managed content domain with its own Admin
area at `/admin/catalogue`.

Conceptually:

```text
catalogue_items
---------------
id
category
title
slug
description
body
status
published_at
is_external
external_url
cover_resource_id
tags
position
created_at
updated_at
```

`category` is drawn from the fixed set defined in note 03 §7:

```text
books
films
audio
interviews
stories-from-the-front-line
podcasts
watch
```

The seven categories are values, not tables. Adding a work never means adding a table.

**Individual works are rows, not categories.** The Havana Chronicles, Solo2Darwin and
Lights, Chutzpah, Action!! are `catalogue_items` within the appropriate category, reached at
`/catalogue/[category]/[slug]`.

**External works are represented, not rebuilt.** Where a work lives on an external platform,
`is_external` is true and `external_url` carries the destination. The catalogue entry still
exists as a row so it can be listed, ordered and described, but the application links out
rather than reproducing the content.

`slug` is unique within a category. `status` follows the same draft/published/archived model
as the blog, with the same rule that unpublished items are not reachable by slug.

## 28.2.1 Tags — curation without new categories

`catalogue_items` carries a `tags text[]` column with a GIN index. Tags are a **curation**
mechanism, not a second taxonomy: `category` says what a work *is*, a tag says which
curated collection it *appears in*.

The distinction matters because the two answer different questions and change at different
rates. A work's category is a fact about its medium and never changes; its tags are an
editorial choice an administrator revises whenever a collection is re-curated.

```text
category   what the work IS        one value, fixed set of seven (note 03 §7)
tags       where it APPEARS       many values, open set, admin-editable
```

**This is what Give-Get-Go's sections are built from** (note 11; one page since
2026-09-25, each section an anchor on `/give-get-go`). Each section is a
view over `catalogue_items` filtered by tag:

```text
give-get-go:publishing     → Give-Get-Go Publishing
give-get-go:films          → Give-Get-Go Films
give-get-go:documentaries  → Give-Get-Go Documentaries
```

**Curation is required for all three sections, not just Documentaries.** Note 11 describes
Give-Get-Go Publishing as "the Give-Get-Go Books publishing imprint" — a subset of Tony's
books, not all of them. The same is true of Films. So no section maps cleanly onto a whole
category, and a category-to-section mapping would have been wrong even where it looked
right. Tags solve all three uniformly.

**A documentary is a film.** It lives in the `films` category, at its canonical URL
`/catalogue/films/[slug]`, and appears under Give-Get-Go Documentaries by tag. It is not an
eighth category: the seven categories are media types, and a documentary is a genre of
film. Adding it alongside them would invite drama, comedy and every other genre to follow,
and would reopen the R9 decision for no gain.

**A work's page exists only when it has body copy.** Without `body`, everything the work
holds (title, description, cover) is already on its card, so the card is not a link and
`/catalogue/[category]/[slug]` returns 404. An external work links to its external home.
The single decision point is `workHref()`; the page appears as soon as text is added.

**One item, one canonical home, many views.** An item is never duplicated to appear in a
collection. Tags add views over the single row; they never create a second copy of it.

Media and resource relationships use an explicit join so an item can carry several assets:

```text
catalogue_item_resources
------------------------
catalogue_item_id
resource_id
position
```

`resources.width` and `height` (migration 0011) record each stored image's pixel size. `scripts/import-images.mjs` reads them from the file on upload, and they're null for links. The catalogue lays each work out by the shape of its cover (note 10 §42.1).

The cover (`catalogue_items.cover_resource_id`) is shown on cards and at the head of the
work's page; `catalogue_item_resources` holds any further images, shown as a gallery on the
work's own page only.

**Hosted recordings use the same join** (2026-09-25). An interview or podcast episode we
host is a `resources` row with `resource_type = 'audio'` and a `site-media` path, joined
through `catalogue_item_resources` in play order — so a recording in two parts is two
rows, with no new table. `getCatalogueItemExtras()` splits the join by `resource_type`:
images to the gallery, audio to the work page's player (`AudioPlayer`, note 10 §42.1).
The files are uploaded and attached by `scripts/import-audio.mjs` from an explicit
work-to-file map; SQL cannot upload files, and nothing unused is uploaded. Artwork fills its frame everywhere it appears; `catalogue_items.cover_focus`
(`top` by default, or `center`, `left`, `right`) is the edge the crop keeps, so a title
printed at one edge of the artwork is not cut away (migration 0008_catalogue_and_site_media).

Outbound links — where to buy, listen or read a review — are a separate table:

```text
catalogue_item_links
--------------------
catalogue_item_id
label
url          (http/https only)
position
```

They are not `resources` rows with an `external_url`. The public read policy on `resources`
admits only files in a public bucket, and widening it to external URLs would also publish
the external links attached to paid course material in the same table. A link on a
published work is public exactly when the work is: `catalogue_item_links` is readable when
its item is `published`, and by staff holding `catalogue.read` (migration 0008_catalogue_and_site_media).

---

# 28.3 Testimonial Videos

Filmed client testimonials — the eleven clips on the coaching site's
/video-testimonials page (migration 0015).

```text
testimonial_videos
id
slug              unique
title             a line from the clip, shown as a quote; null where the old site titled it by name only
attributed_to     null only for a compilation of several voices
context           as testimonials.context
cover_resource_id → resources
video_provider    youtube | vimeo | livid | null
video_id          set exactly when video_provider is
video_hash        Vimeo unlisted token
duration_seconds
position
status
```

A table of its own, not a nullable `quote` on `testimonials`: every text renderer (home,
coaching storefront) would otherwise have to guard against a testimonial with no words.

Video is a provider and an id, never a URL, exactly as on `lessons` (§25, note 07 §34.1),
so a move of host is a data change. **These are public marketing video, so there is no
entitlement gate**: the embed URL is built for any reader of a published row, and passing it
through client props (the click-to-play facade) is acceptable here and never for lesson video.

**A published row with no video is valid** and shows its cover marked "Coming soon", not
playable — the rule the owner set for the /watch uploads on 2026-09-26. The files are Wix
uploads that go to Livid by hand (note 09 §40.1); `supabase/content/11_testimonial_videos.sql`
maps each row to its file. Public read of published rows; staff read all. Edited through
Admin → Testimonial videos.

---

# 29. Group Coaching Series

The four Group Coaching series are:

```text
Filmmaking
Writing
Producing
For All Filmmakers
```

Conceptually:

```text
group_coaching_series
---------------------
id
name
slug
description
status
created_at
updated_at
```

Each series contains 8 sessions.

---

# 30. Group Coaching Sessions

Conceptually:

```text
group_coaching_sessions
-----------------------
id
series_id
title
starts_at
ends_at
capacity
coach_id
meeting_url
recording_resource_id
status
created_at
updated_at
```

The exact fields may evolve.

The session belongs to a series.

Do not duplicate the series definition into every session.

**Read access (migration 0019, 2026-09-26).** Besides series entitlement and unspent credits
(0003), a session is readable by anyone holding a `confirmed` or `completed` booking of it
(`has_booking(bookable_type, id)`, security definer). Without this, spending your last
credit on a booking hid the session you had just booked: its title vanished from
`/account/bookings` and the Academy had no row for its joining link or replay.

---

# 31. Group Coaching Session Capacity

The baseline Group Coaching capacity is:

```text
8 participants
```

and session length is:

```text
1 hour
```

Capacity should be stored/configured as data.

The booking system should enforce the capacity transactionally.

---

# 32. Cohorts

Interactive Cohorts are distinct from Group Coaching.

Conceptually:

```text
cohorts
-------
id
product_id
name
slug
description
cohort_level
status
starts_at
ends_at
created_at
updated_at
```

The cohort level may be:

```text
Silver
Gold
Platinum
```

This is explicitly a **cohort level**, not a membership tier.

---

# 33. Cohort Workshops

The cohort model supports:

```text
8 workshops
×
3 hours
=
24 total hours
```

Conceptually:

```text
cohort_workshops
----------------
id
cohort_id
title
starts_at
ends_at
position
meeting_url
recording_resource_id
status
```

---

# 34. Retreats

Retreats should have their own data model where they have distinct operational requirements.

Conceptually:

```text
retreats
--------
id
product_id
name
slug
description
starts_at
ends_at
status
capacity
```

The exact fields depend on the final retreat workflow.

---

# 35. Events

Events are first-class public offerings.

Conceptually:

```text
events
------
id
product_id
name
slug
description
starts_at
ends_at
location
capacity
price/product relationship
status
```

Public route:

```text
/events
/events/[slug]
```

Administrative route:

```text
/admin/events
```

Events may require:

- Registration
- Booking
- Payment
- Capacity management

The exact relationship to bookings/orders should be defined by the event type.

**Implemented (migration 0017, 2026-09-26).**

- `events.cover_resource_id` → `resources` (ON DELETE SET NULL, FK
  `events_cover_resource_id_fkey`), public-bucket images only, as the coaching covers.
- `event_images` (`event_id`, `resource_id`, `position`, `caption`): the photographs from
  an event, in order. Cascades with its event. RLS: readable when the event is published,
  or by staff with `events.read`; written by staff with `events.update`.
- `event_places_taken(event_id)`: security-definer count of live bookings, callable by
  anyone, so a page can show places left without exposing anyone's booking.
- `register_for_event(event_id)`: security-definer, authenticated only. Free, published,
  dated, future events only; locks the event row; enforces capacity and one live place per
  person; inserts `bookings` with `bookable_type = 'event'`. Returns a status
  (`ok`, `full`, `already_booked`, `past`, `unscheduled`, `paid`, `not_found`,
  `not_authenticated`) and never raises.

**Tickets, waitlist and check-in (migration 0018, 2026-09-26).**

- `events.format` (`event_format`: `in_person`, `online`, `hybrid`) and `events.venue_address`.
- `event_access` (`event_id` PK, `join_url`, `joining_notes`): private joining details.
  RLS: read by a user holding a live booking on the event, or staff (`events.read`);
  written by `events.update`.
- `bookings.reference` (unique, set by trigger for every `event` booking) and
  `bookings.checked_in_at`.
- `event_waitlist` (`event_id`, `user_id`, `notified_at`), one row per person per event.
  RLS: own rows, or staff. Written only through `join_event_waitlist` /
  `leave_event_waitlist`; `my_waitlist_position` reads a place in the queue.
- Triggers: `bookings` insert (event) → reference, ticket email (`event_ticket`), leave the
  waitlist; `bookings` status → cancelled (event) → email the next waiting person
  (`event_place_available`); `entitlements` insert (`event`, active) → issue the booking,
  linked by `entitlement_id`, which is how a paid ticket is recognised.
- `cancel_booking` now refuses a paid event ticket (`paid_ticket`).
- Staff functions: `event_attendees(event_id)` (`events.read`),
  `check_in_ticket(reference, undo)` (`events.update`). Service role only:
  `event_reminders_due(kind)`.
- `event_sale_status(product_id)` is public: checkout's guard before taking payment. A race
  on the last place can still sell one over capacity; the ticket is issued rather than a
  paying customer refused.

---

# 36. Private Coaching

Private Coaching services may be represented as products/services and linked to booking availability.

The database should distinguish:

```text
service definition
```

from:

```text
individual booking
```

The service itself is not the booking.

**Implemented 2026-09-27 (migration 0020):**

```text
private_coaching_slots        service_id → private_coaching_services, starts_at, ends_at
                              (defaults to start + service length), meeting_url (private),
                              status open|cancelled, notes
bookings.order_id             the order paying for a held booking
bookings.hold_expires_at      pending private coaching bookings only
entitlement_resource          + 'private_coaching' (resource_id = the service;
                              quantity = sessions bought, spent per booking)
```

A slot's booking is `bookings` with `bookable_type = 'private_coaching'` and
`bookable_id = slot id`. RLS: slots are staff-read/manage and readable by the person holding
a confirmed or completed booking of them (`has_booking`); customers otherwise see only times,
through `private_coaching_availability`. Functions: `hold_private_coaching_slot`,
`private_coaching_time_taken`, `release_private_coaching_hold`; `grant_entitlements_for_order`
and `cancel_booking` replaced to cover the new type. Triggers: an entitlement insert confirms
the held booking; cancelling a slot cancels its booking and returns the session.

---

# 37. Bookings

Bookings represent scheduled customer participation.

Conceptually:

```text
bookings
--------
id
user_id
bookable_type
bookable_id
starts_at
ends_at
status
created_at
updated_at
```

The final schema should choose a referentially safe representation for bookable resources.

Bookings must be associated with the authenticated customer.

---

# 38. Booking Status

Baseline states may include:

```text
pending
confirmed
cancelled
completed
no_show
```

The exact state machine should be refined in the booking architecture/implementation.

Status changes should be auditable where appropriate.

---

# 39. Orders

Orders represent commercial purchases.

Conceptually:

```text
orders
------
id
user_id
status
currency
subtotal
discount_total
total
external_reference
created_at
updated_at
```

Orders must preserve the commercial transaction history.

Do not use current product prices to reconstruct an old order.

---

# 40. Order Items

An order may contain multiple products.

Conceptually:

```text
order_items
-----------
id
order_id
product_id
price_id
product_name_snapshot
unit_amount
quantity
total_amount
metadata
```

Store appropriate purchase-time snapshots so historical orders remain understandable if the product later changes.

---

# 41. Guest Checkout

The platform supports both:

```text
Guest checkout
```

and:

```text
Signed-in checkout
```

A guest may complete a purchase without having an existing account.

Therefore the database must be able to represent a purchase before the final customer account linkage is complete.

Conceptually:

```text
Guest checkout
      ↓
Order
      ↓
Guest contact information
      ↓
Payment
      ↓
Account creation/linking
      ↓
Customer entitlement
```

The final guest-order linking mechanism must be secure.

Do not trust a browser-supplied user ID to claim an order.

---

# 42. Guest Order Linking

A guest purchase may later be linked to an authenticated account.

The linking process must verify sufficient ownership evidence.

Potential mechanisms include:

- Secure signed claim token
- Verified checkout email
- Authenticated account creation from the checkout flow
- Trusted payment/order reference
- Manual support intervention for exceptional cases

The final implementation should avoid allowing a different authenticated user to claim another customer's purchase merely by knowing an order ID or email address.

---

# 43. Payments

Payment records should be represented separately from orders where appropriate.

Conceptually:

```text
payments
--------
id
order_id
provider
provider_payment_id
amount
currency
status
paid_at
created_at
updated_at
```

Stripe remains the payment provider in the planned architecture.

The detailed Stripe event and webhook model belongs in the Payments & Integrations Architecture.

---

# 44. Subscriptions

Recurring memberships require subscription data.

Conceptually:

```text
subscriptions
-------------
id
user_id
product_id
price_id
provider
provider_subscription_id
status
current_period_start
current_period_end
cancel_at
created_at
updated_at
```

The exact schema should follow the final Stripe integration.

Subscription status should not be inferred merely from the existence of an order.


**Billing self-service (2026-09-27, migration 0021):**

```text
billing_customers        user_id (pk) → stripe_customer_id (unique). One Stripe
                         Customer per account; service-role writes only, owner
                         and staff (orders.read) read.
invoices                 one row per Stripe subscription invoice — first payment
                         and every renewal: number, status, amounts, hosted page,
                         PDF, period, paid_at; subscription_id, order_id (first
                         invoice only), provider_subscription_id and
                         membership_tier kept on the row because invoice events
                         can arrive before the subscription event.
payments.receipt_url     Stripe's hosted receipt for a one-off payment.
orders.checkout_mode     'payment' | 'subscription'; a subscription order is
                         receipted by its invoice and not listed twice.
subscriptions.cancel_at_period_end
                         "cancelled, access runs to the end of the paid period".
```

Card details are never stored: the billing page reads the card summary live from Stripe.

---

# 45. Membership Customer Record

A customer's current membership state should be represented in a way that can be derived reliably from the subscription/product data.

The system should support:

```text
active
past_due
cancelled
expired
```

and other relevant states.

Membership status should ultimately determine the applicable entitlement rules.

---

# 46. Roles

Roles should be represented in the database.

Conceptually:

```text
roles
-----
id
name
description
```

Potential roles include:

```text
owner
admin
content_manager
course_manager
coaching_manager
booking_manager
finance_manager
communications_manager
support_manager
```

Not all specialist roles must exist initially.

---

# 47. User Roles

A user-role relationship should be represented separately.

Conceptually:

```text
user_roles
----------
user_id
role_id
created_at
```

This supports multiple roles per user.

Role assignment must be performed through a trusted server-side operation.

---

# 48. Permissions

Permissions should be represented centrally.

Conceptually:

```text
permissions
-----------
id
name
description
```

Examples:

```text
users.read
users.update
users.delete

courses.read
courses.create
courses.update
courses.publish

orders.read
payments.read

bookings.read
bookings.manage

entitlements.read
entitlements.grant
entitlements.adjust
entitlements.revoke
```

The exact permission set is governed by Architecture Note 6 and may expand.

---

# 49. Role Permissions

Conceptually:

```text
role_permissions
----------------
role_id
permission_id
```

This allows roles to inherit defined permissions.

The application should not duplicate the permission matrix in multiple unrelated places.

---

# 50. Manual Entitlement Administration

Manual entitlement grants are high-privilege operations.

The Admin architecture must provide an entitlement management area.

Baseline route:

```text
/admin/entitlements
```

Required permissions include at least:

```text
entitlements.read
entitlements.grant
entitlements.adjust
entitlements.revoke
```

`entitlements.adjust` is deliberately distinct from `grant` and `revoke`: changing a
consumable entitlement's remaining quantity or its expiry is a different operation from
creating or ending one, and it is the operation most likely to be delegated to support
staff. Keeping it separate allows quantity and expiry corrections to be authorized —
and audited — without also handing out the ability to create or destroy entitlements.
See note 06 §23.1.

These operations must be auditable.

Manual grants must identify:

- Customer
- Entitlement
- Source
- Acting administrator
- Reason
- Created time
- Expiration/quantity where relevant

---

# 51. Audit Logs

Administrative actions should be recorded.

Conceptually:

```text
audit_logs
----------
id
actor_user_id
action
resource_type
resource_id
metadata
created_at
```

Examples:

```text
role_changed
entitlement_granted
entitlement_revoked
order_adjusted
refund_processed
user_deactivated
content_published
```

Do not store passwords, API secrets or other sensitive credentials in audit metadata.

---

# 52. Notifications

Customer notifications may be represented as persistent application records.

Conceptually:

```text
notifications
-------------
id
user_id
type
title
body
read_at
created_at
```

Email delivery state may be maintained separately where required.

---

# 53. Communication / Email State

The application may maintain customer communication state required for integration with Brevo.

Examples:

- Contact identifier
- Subscription/list state
- Suppression/unsubscribe state
- Synchronization status

Brevo remains an external communication system.

API credentials must never be stored in normal user-accessible database records.

---

# 54. Referential Integrity

Use PostgreSQL foreign keys wherever relationships are known and should be enforced.

Examples:

```text
courses.product_id
course_modules.course_id
lessons.module_id
group_coaching_sessions.series_id
bookings.user_id
order_items.order_id
order_items.product_id
user_roles.user_id
user_roles.role_id
```

Use appropriate `ON DELETE` behaviour.

Do not use cascading deletion indiscriminately.

---

# 55. Historical Data

Historical commercial and operational records should normally be preserved.

Examples:

```text
orders
payments
subscriptions
historical bookings
audit logs
```

Deleting a current customer account must not automatically destroy records that are required for:

- Financial reconciliation
- Legal retention
- Reporting
- Customer support
- Auditability

Where necessary, personal information may be anonymized while retaining required historical records.

---

# 56. Account Deletion and Cleanup

Account deletion should follow a deliberate lifecycle.

Conceptually:

```text
Account deletion request
        ↓
Determine records to delete
        ↓
Determine records to anonymize
        ↓
Determine records to retain
        ↓
Clean dependent application data
        ↓
Synchronize external systems
        ↓
Delete/deactivate Auth identity
```

Do not implement this as a blind `CASCADE` across every table.

---

# 57. Database Triggers

Use PostgreSQL triggers only where they provide a clear database-level guarantee.

Appropriate examples may include:

- Creating a profile when an Auth user is created
- Maintaining simple timestamps
- Enforcing controlled database-side lifecycle behaviour

Avoid putting large amounts of business logic into triggers when the logic is easier to understand and test in application/service code.

---

# 58. Background Cleanup

Some cleanup is not directly triggered by a UI action.

Background cleanup targets **genuinely abandoned temporary data only**:

```text
Abandoned checkout sessions that never resulted in payment
Expired single-use tokens (claim, verification, password recovery)
Orphaned temporary upload or draft data
Email synchronization state no longer required
Other scheduled maintenance on temporary records
```

The following are **never deleted by background cleanup**:

```text
Paid orders — claimed or unclaimed
Order items, payments, subscriptions
Entitlement records — active or expired
Historical bookings
Audit logs
```

Two rules govern this.

**A paid order is never temporary data.** An unclaimed guest order is a completed purchase
awaiting account linkage, not an abandoned cart — see note 05 §29.2 and §41–§42 above. It
has no expiry. A cleanup job must therefore distinguish a checkout session that never
resulted in payment, which may be removed, from an order that did, which may not. If the
two are not distinguishable in the schema, that is a schema defect to fix before any
cleanup job is written.

**Expired entitlements are a status transition, not a deletion.** When an entitlement
lapses, its `status` becomes expired and the row is retained. Historical entitlement
records are required for reconciliation, support and reporting — see note 07 §40 and §55
above. No scheduled job deletes them.

These operations should be handled by scheduled/server-side jobs or database mechanisms appropriate to the task.

Do not rely on a user visiting a page to trigger essential cleanup.

The scheduler is **Vercel Cron**, invoking secured Next.js Route Handlers under
`/api/cron/[job]` — see note 01 §18 and note 09 §44. The job's logic lives in `src/lib` and
the route is a thin authenticated entry point. Supabase Cron is not used as a competing
scheduler, and no job is implemented in two places.

---

# 59. Row Level Security

Supabase RLS must be enabled for appropriate application tables.

Customer-owned records should normally use policies based on:

```text
auth.uid()
```

Conceptually:

```text
Current authenticated user
        ↓
auth.uid()
        ↓
RLS policy
        ↓
Permitted rows
```

Examples include:

```text
profiles
orders
bookings
entitlements
notifications
```

The exact policy must match the ownership model of each table.

---

# 60. RLS and Admin Access

Admin access must also be represented in the RLS design.

The database must not assume that:

```text
/admin/...
```

means the database request is trusted.

Administrative queries should have a deliberate authorization mechanism.

Where privileged service-role operations are required, they must remain server-side and be tightly controlled.


**Customer views filter to the caller as well (2026-09-27).** Staff hold "read all"
policies on `bookings`, `entitlements`, `orders`, `subscriptions` and `profiles` so Admin
can work, which means RLS alone returns EVERY customer's rows to a staff session. A
"my …" query in Account or Academy (`myBookings`, `myEntitlements`, `myOrders`,
`myCourses`, `sessionCredits`, `getTicket`, and so on) therefore also adds
`.eq("user_id", <caller>)` from `getAuthContext()`. Found when a staff account's own Account
and Academy were shown to list other customers' bookings, access and orders. Staff could not
act on those rows, because the booking and cancellation functions check ownership. RLS
remains the security boundary; the filter is what makes the view correct.
---

# 61. RLS and Service Role

The Supabase service-role key bypasses RLS.

Therefore:

```text
Service role
→ Server only
→ Never browser
→ Never committed to source control
```

Use normal authenticated database access with RLS wherever practical.

Do not use service-role access merely because writing an RLS policy is inconvenient.

---

# 60.1 Storage Buckets and Asset Access

RLS protects tables. Storage objects are governed separately, by policies on
`storage.objects` plus a per-**bucket** `public` flag.

**Buckets are split by who may read them, not by file type.** `public` is a
bucket-wide boolean — there is no such thing as a bucket that is private "where
required" — so the bucket a file goes in *is* its access rule. It is also the only
property that cannot be changed later without moving every object and rewriting every
stored path; file organisation can be fixed with a path change, access cannot.

```text
avatars         public    profile photos
site-media      public    all marketing media — imagery for books, films, blog,
                          events, retreats, coaching, team, testimonials and course
                          thumbnails; and public audio (interviews, podcasts)
course-assets   private   material attached to Academy content, entitlement-gated
documents       private   standalone gated documents, not tied to a course
```

Course thumbnails sit in the **public** bucket deliberately. They are marketing —
shown to people deciding whether to buy. Behind a signed URL each one costs a server
round trip, cannot be CDN-cached and expires, for an image whose purpose is to be seen
by strangers.

**Public audio lives here too.** Audio is not video. An MP3 needs no transcoding and no
adaptive bitrate, and these files average ~13 MB, so none of the properties that forced
video onto an external host (note 09 §40.1) apply to it. A radio interview or a podcast
episode is marketing in exactly the way a book cover is — published so that strangers
can hear it — so it takes the public bucket and the CDN rather than a signed URL. No
audio-specific external service is introduced and the integration boundary recorded in
note 01 §17–§18 and note 09 §40 is unchanged.

**Gated audio mirrors documents, not this.** A masterclass or course recording is
entitlement-gated content that happens to be audio. It goes in `course-assets` where it
is attached to Academy content and `documents` where it stands alone, and it is reached
the way every other private asset is — a short-lived signed URL minted after
`has_active_entitlement()` (§60.2). **A file's format never decides its bucket; who may
read it does.**

Where a recording already lives on a radio station's or a podcast platform's own site,
the catalogue entry links out instead, using `is_external` and `external_url` (§28.2).
Hosting our own copy is a choice per item, not a requirement.

**Implemented 2026-09-25 (migration 0014).** The bucket as created in 0005 had not caught
up with this rule: it accepted images only, capped at 15 MB. 0014 adds `audio/mpeg` and
raises the cap to 50 MB (the largest interview is 44 MB), matching the private buckets.
The Content-Security-Policy gained `media-src 'self' <supabase>` in `proxy.ts`; without it
`<audio>` falls back to `default-src 'self'` and every player is refused.

**Paths use ids, never slugs**: `books/{book_id}/cover.jpg`. Storage has no rename, so
a slug edited for SEO would strand every object beneath it and repairing it means
copy-then-delete on each. Ids do not change. Avatars are the special case —
`avatars/{user_id}/…` — because the first path segment is what the policy matches on;
a flat bucket cannot express "your own avatar".

**The database stores the path, never a URL.** A stored URL carries the project host
and is wrong the moment local, preview and production differ. The host comes from the
environment and the URL is built at render.

### 60.1.1 Cover assignment cannot live in a migration

**Defect found and fixed 2026-09-06.** `pnpm images:import` (`scripts/import-images.mjs`)
uploads the real imported files and is deliberately NOT part of the seed — it is slow,
and it also runs cover-assignment logic that needs a human-verified list, not something
to fire blindly on every reset. But the former migration 0033 tried to assign `courses` and
`private_coaching_services` covers itself, matching on the exact hash-prefixed
`storage_path` the import script produces.

That can never work on a genuinely fresh `db reset`: migrations run BEFORE
`images:import` is ever invoked, so at the moment the migration's `UPDATE ... FROM
(values ...) JOIN resources ON storage_path = ...` executes, `resources` is empty and
the join matches nothing. The `WHERE cover_resource_id IS NULL` guard meant to make it
idempotent instead made the failure silent — "0 rows matched" and "already assigned"
look identical from outside the statement. Confirmed directly: a clean `db reset`
followed by `pnpm images:import` left `courses.cover_resource_id` null for all three
levels and `private_coaching_services` null for Advanced One-to-One, every time,
despite the exact right files being present in the bucket immediately afterward. The
hash prefix is content-derived (SHA-256, truncated) and therefore deterministic, so
this was never a matching problem — purely a sequencing one.

**Fixed by moving the assignment into the script**, at the point after upload where
`resources` genuinely has rows — the same place catalogue covers and team-member
photos were already being assigned correctly, by the same kind of filename lookup.
The inert copy in the migration was removed when the migrations were consolidated
(2026-09-23), along with the same kind of dead assignment from the former 0032.

**The general rule this establishes:** any one-time data assignment that depends on
`resources` rows created by `images:import` must live in that script, never in a
migration — a migration's position in the reset sequence is fixed, and it is always
before the point this data exists.

## 60.1.2 Where Data Lives, and How Production Gets It

Three kinds of data, one home each:

| Kind | Home | Reaches production by |
|------|------|-----------------------|
| Structure and reference data: tables, policies, buckets, roles, permissions, tiers | `supabase/migrations/` | `supabase db push` |
| Real content: products, prices, curriculum, lesson video, catalogue, blog, coaching, team, testimonials | `supabase/content/*.sql` | `pnpm content:setup --env <file>`, once |
| Migrated image library: all ~380 images from the three source sites | `current-website/*/site-files/` (AVIF, gitignored) | the same command, which then runs `import-images.mjs` |
| Images added from outside the old sites (openly licensed, credited) | `supabase/content/images/` (committed; licences in its `CREDITS.md`) | the same command |
| Static photos the client supplied for page design (hero, About) | `public/images/` (AVIF). The photographer is recorded per file in `src/lib/site/photo-credits.ts`; pages render `<PhotoCredit>`, which words the line by count ("Photo courtesy of…" for one, "Photos…" for several) and places it as a caption under a framed photo or as a corner overlay when the photo is a background. The 29 files present on 2026-09-24 are credited to Danny Clifford. A file added later has no credit until the client names the photographer. | deployed with the app |
| Local fixtures: test accounts, their roles and entitlements, placeholder rows, RLS test rows | `supabase/seed.sql` | never |

**Design images vs content images (2026-09-24, owner's rule).** An image the design
depends on, whose crop, focal point and treatment the layout was built around (the home
hero, the About portrait), lives in `public/images/` and is referenced from code. This holds
even when the same photo is also in the migrated media library. The two copies do different
jobs: the `public/` copy changes only when the design does, so an admin edit to the library
can't break a layout. Everything the owner should be able to swap (covers, galleries, team
photos) stays in Storage and is managed from the admin. A duplicated photo needs its credit in
both places: `src/lib/site/photo-credits.ts` for the `public/` copy and `resources.credit` for
the library copy. If the owner later wants to change a design image himself, it is no longer
a design image and moves to the library.

**Old-site image credits follow the old sites (2026-09-26, owner).** `resources.credit`
carries "Photos courtesy of Danny Clifford Photographer" only where tonydklinger.com or
the coaching site credited Danny Clifford: beside the portraits of Tony from one shoot
(the camera-named `Z91_…`/`Z92_…` files, matched by `CLIFFORD_SHOOT` in
`scripts/import-images.mjs`). Every other old-site image — jackets, posters, stills,
logos — has no credit unless a specific one is known (`SOURCE_CREDIT_OVERRIDES`). This
replaces the earlier default of crediting every old-site image to him.

Locally, `supabase db reset` loads `content/*.sql` and then `seed.sql` (config.toml
`[db.seed]`), followed by `pnpm images:import` and `pnpm audio:import`. `content:setup` runs all content files
in one transaction and refuses a second run without `--force`, because some rows
(prices) have no natural key to deduplicate on. The whole image library goes to
production, not only the images a page shows, so any of it can be assigned later from
admin. `--only-used` exists for a lean upload when one is wanted.

Content is not placed in migrations. The former migrations 0032 and 0033 did this and
never took effect on a fresh reset (§60.1.1); both data parts have since been removed.

## 60.2 Reaching a Private Asset

Private buckets have **no read policy** for `anon` or `authenticated`. The only route
in is a short-lived signed URL, minted server-side after the entitlement has been
checked with `has_active_entitlement()` — the same function the Academy pages and the
RLS policies use, so there is one authorization source rather than two that can drift.

```text
Request for a gated file
        ↓
has_active_entitlement(resource_type, resource_id)   ← the control
        ↓  only if true
Signed URL, ~10 minutes, minted with the service role
```

Signing uses the service role, which does not consult storage policies. That is
precisely why the missing read policy is a genuine backstop rather than the control:
if a URL is ever signed without the check, or a session token is stolen, the object
remains unreachable through the ordinary API and the bucket cannot be listed.

Gated assets are never passed through the image optimiser. Doing so would cache
entitlement-gated content on a public CDN, keyed by a URL whose token expires — so the
cached copy would outlive the permission that produced it.

Buckets additionally declare MIME allowlists and size limits, enforced by Storage
itself, so a bad upload is refused before the bytes are paid for. That is a backstop,
not a substitute for validating in the upload handler: the caller controls the
`Content-Type` header it sends.

**Video is not stored here.** Object storage does not transcode or serve adaptive
bitrate; all video is hosted externally (note 09 §40.1).

---

# 61.1 Function Execute Privileges

RLS protects **tables**. It does not protect **functions**, and a `SECURITY DEFINER`
function runs with its owner's rights — so an exposed one is a hole straight through
every policy in this note.

PostgreSQL grants `EXECUTE` on every new function to `PUBLIC` by default. That default
is the whole problem, because withdrawing it looks easy and usually is not:

```text
revoke all on function public.enqueue_email(...) from anon, authenticated;   ← does NOTHING
revoke all on function public.enqueue_email(...) from public;                ← the real grant
```

Neither `anon` nor `authenticated` ever holds a direct grant. Both inherit the privilege
through `PUBLIC`, and revoking from a role does not remove what that role inherits. The
first form runs without error, reports success, and changes nothing.

**This was live in this project and is recorded here so it is not repeated.** Every
`SECURITY DEFINER` function in the schema was callable over PostgREST by anyone holding
the anon key — a key that ships in the browser bundle and is not a secret. Confirmed
against a running stack, an anonymous caller could:

```text
POST /rest/v1/rpc/enqueue_email        → queue mail to any address, from our verified sender
POST /rest/v1/rpc/claim_email_batch    → read the outbox, including guest-claim links,
                                          which are credentials for another customer's order
POST /rest/v1/rpc/fulfil_order         → grant entitlements with no payment
POST /rest/v1/rpc/expire_lapsed_...    → expire every customer's access
```

The rule:

- Revoke `EXECUTE` from `PUBLIC` — not from `anon` or `authenticated`, which is a no-op.
- Grant it back per function, to the narrowest role that needs it.
- Set `alter default privileges ... revoke execute on functions from public`, so a
  function added later is closed rather than open.

Three tiers, and every function must sit in exactly one:

```text
anon + authenticated   RLS predicates only — has_permission, is_staff,
                       has_active_entitlement and the like. LOAD-BEARING: policy
                       expressions are evaluated with the querying role's privileges,
                       so revoking these breaks every read in the application.
                       Safe: each is scoped to auth.uid() and answers yes/no about
                       the caller's own access. None takes an instruction.

authenticated          Operations that derive the actor from auth.uid() rather than
                       from an argument — claim_welcome, claim_order,
                       book_group_session, cancel_booking, and the admin_* operations.
                       The admin ones are reachable but not permitted: each calls
                       assert_admin_action(), so the grant is not the control.

no grant               Everything called only by trusted server code holding the
                       service key — order fulfilment, the outbox, the cron jobs.
```

Trigger functions need no grant: `EXECUTE` on a trigger function is checked when the
trigger is **created**, not each time it fires.

Because the failing form is silent, this must be asserted by test rather than reviewed by
eye. The database test suite checks both directions — that privileged functions are
unreachable by `anon`, and that the RLS predicates remain reachable — since over-revoking
breaks the application as thoroughly as under-revoking exposes it.

---

# 62. Data Validation

Database constraints should enforce fundamental invariants.

Examples:

- Required fields are `NOT NULL`
- Unique slugs are `UNIQUE`
- Amounts cannot be invalid negative values where prohibited
- Quantities cannot be negative
- Foreign keys reference valid records
- Status values are controlled
- Timestamps are valid

Application validation should complement database constraints.

---

# 63. Unique Constraints

Use uniqueness where business identity requires it.

Examples:

```text
products.slug
courses.slug
events.slug
cohorts.slug
group_coaching_series.slug
masterclasses.slug
blog_posts.slug
catalogue_items.slug (unique within category)
```

Do not assume uniqueness based solely on application code.

---

# 64. Transactional Operations

Operations that modify multiple related records should use database transactions where appropriate.

Examples:

```text
Consume entitlement
 + create booking

Complete order
 + create entitlement

Upgrade membership
 + update subscription state
 + recalculate entitlements
```

This prevents partially completed business operations.

---

# 65. Concurrency

The database must protect against concurrent requests.

Important examples:

```text
Two customers booking the last available seat
Two requests consuming the same session credit
Two webhook events updating the same subscription
Two processes claiming the same guest order
```

Use appropriate:

- Transactions
- Unique constraints
- Row locking
- Idempotency
- Database constraints

where required.

---

# 66. Indexing

Indexes should be created for frequently queried relationships and lookup fields.

Likely examples include:

```text
profiles.user_id
orders.user_id
orders.status
order_items.order_id
entitlements.user_id
entitlements.status
bookings.user_id
bookings.starts_at
group_coaching_sessions.series_id
lessons.module_id
blog_posts.status
blog_posts.published_at
catalogue_items.category
catalogue_items.status
user_roles.user_id
role_permissions.role_id
```

Indexes should be driven by actual query patterns rather than added indiscriminately.

---

# 67. Timestamps

Important tables should generally include:

```text
created_at
updated_at
```

Time-sensitive entities should also use explicit business timestamps such as:

```text
starts_at
ends_at
expires_at
paid_at
current_period_start
current_period_end
```

Store timestamps in a consistent timezone-aware PostgreSQL type.

---

# 68. Soft Deletion

Use soft deletion where historical integrity or recovery requires it.

For example:

```text
deleted_at
```

may be appropriate for selected records.

Do not automatically add soft deletion to every table.

Use it when there is a genuine lifecycle requirement.

---

# 69. Database Source of Truth

The database should be authoritative for persistent business state.

Examples:

```text
Membership status
Order status
Entitlement status
Booking status
Course availability
User roles
Permissions
```

The browser must not be treated as the source of truth for any of these.

---

# 70. Schema and Application Types

TypeScript types should be generated or maintained from the database schema in a reliable manner.

The application should avoid manually maintaining large duplicate representations of the database schema where generation is available.

The final implementation should use the current recommended Supabase type-generation workflow.

---

# 71. SQL as the Schema Definition

Tables, columns, indexes, constraints, RLS policies, functions and triggers should be reproducible through SQL migrations.

The conceptual workflow is:

```text
Architecture
    ↓
SQL migration
    ↓
Supabase PostgreSQL
    ↓
Generated application types
    ↓
Next.js application
```

The application should not depend on manually recreating database structures through the Supabase dashboard.

---

# 72. Schema Expansion

The database architecture is extensible.

New entities may be added for:

- New product types
- New Academy content
- New event types
- New integrations
- New reporting requirements
- New operational workflows

However, every new table should have a clear business purpose and relationship to the existing model.

Avoid creating tables merely because a frontend component exists.

---

# 73. Entity Relationship Summary

The core relationship model is:

```text
AUTH USER
   │
   ├── Profile
   ├── Roles
   ├── Orders
   ├── Membership / Subscription
   ├── Entitlements
   ├── Bookings
   ├── Notifications
   └── Audit Actions
            │
            ↓
          PRODUCT
            │
       ┌────┼───────────┐
       │    │           │
    Course  Membership  Service
       │       │
       ↓       ↓
    Academy  Entitlements
       │       │
       └───┬───┘
           ↓
    Customer Access
```

Learning model:

```text
Course
  ↓
Modules
  ↓
Lessons
  ↓
Resources
```

Group Coaching:

```text
Series
  ↓
8 Sessions
  ↓
Bookings / Attendance / Recordings
```

Cohort:

```text
Cohort
  ↓
8 Workshops
  ↓
24 total hours
```

Commerce:

```text
Product
  ↓
Price
  ↓
Order
  ↓
Order Items
  ↓
Payment
  ↓
Entitlement
```

---

# 74. Architecture Principle

The Supabase database should provide:

**A normalized, relational, secure and reproducible source of truth for identity, products, memberships, entitlements, Academy content, bookings, commerce, roles and operational data.**

The database must enforce important business invariants rather than relying entirely on Next.js code.

The schema should be managed through version-controlled SQL migrations, protected with appropriate RLS policies, and designed so that future products and workflows can be added without rebuilding the foundation.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | §5, §28.1 (new), §28.2 (new), §63, §66: Blog and Catalogue added as first-class content domains — `blog_posts` and `catalogue_items` with draft/published/archived status, publication enforced server-side and in RLS, seven fixed catalogue categories as values rather than tables, individual works as rows, external works represented by `is_external`/`external_url`, and media via `catalogue_item_resources`. Supports R15 and R9. |
| 2026-08-28 | §5, §27, §63: `masterclasses` table added, with `product_id` only where separately purchasable and `recording_resource_id` for its recording. Supports R8. |
| 2026-08-28 | §58: scheduler named — Vercel Cron invoking secured Route Handlers under `/api/cron/[job]`, logic in `src/lib`, Supabase Cron not used. Supports R22. |
| 2026-08-28 | §58 rewritten: background cleanup now targets genuinely abandoned temporary data only, with an explicit never-delete list. Paid orders — claimed or unclaimed — are never temporary data, and expired entitlements are a status transition rather than a deletion. Closes R20. |
| 2026-08-28 | §48, §50: `entitlements.adjust` added alongside `read`/`grant`/`revoke`, with a note on why quantity and expiry changes are kept distinct from creating or ending an entitlement. Aligns with note 06 §23.1. Closes R19. |
| 2026-08-28 | §54, §63, §66: table names corrected to the forms defined in §23, §24, §25, §30 and §35 — `courses.product_id` (was `course.course_product_id`), `course_modules.course_id`, `lessons.module_id`, `group_coaching_sessions.series_id` (was `session.series_id` / `sessions.series_id`), and plural table names in the §63 uniqueness list. Closes R21. |
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1). Box-drawing characters, arrows and symbols restored to `├── └── │ ┌ ┼ ┬ ─ ↓ → × —`; §73 diagram alignment normalized. No wording was altered. |
| 2026-08-31 | §5: Email Outbox Message added to the core entity list — `email_messages`, the queue that decouples sending from the business event that caused it (note 09 §42.1). |
| 2026-09-02 | §22: `profiles.welcomed_at` and `status` recorded; `welcomed_at` is claimed atomically by `claim_welcome()` (migration 0017) and is what makes the welcome happen once (note 05 §7.3). |
| 2026-09-02 | §61.1 (new). **Implementation finding, security:** RLS protects tables but not functions, and every `SECURITY DEFINER` function in the schema was callable by anyone holding the anon key. The earlier `revoke ... from anon, authenticated` statements were no-ops — both roles inherit `EXECUTE` through `PUBLIC`, and revoking from a role does not remove what it inherits. Verified against a running stack: an anonymous caller could queue mail from our verified sender, read guest-claim credentials out of the outbox, fulfil orders without payment and expire everyone's access. Fixed in migration 0018 by revoking from `PUBLIC` and granting back in three tiers, and locked in by database tests asserting both directions. |
| 2026-09-03 | §60.1: **R26 closed.** `site-media` widened from "all marketing imagery" to carry public audio as well — the Wix export's 22 radio and podcast recordings (289 MB) had no defined home, and `audio` and `podcasts` are two of the seven canonical Catalogue categories. Audio has none of the properties that forced video onto an external host: no transcoding, no adaptive bitrate, ~13 MB average. Gated audio takes the private-bucket plus signed-URL path instead, with the rule stated explicitly that a file's format never decides its bucket — who may read it does. No new external service, so the integration boundary is unchanged. |
| 2026-09-02 | §60.1, §60.2 (new): storage bucket model recorded — four buckets split by who may read them rather than by file type, since `public` is a per-bucket flag and is the one property that cannot be refactored later. Paths use ids not slugs (Storage has no rename); the database stores the path, never a URL. Private assets are reachable only through a short-lived signed URL minted after `has_active_entitlement()`, with the absent read policy as the backstop. §26: `resources.storage_path` clarified as a bucket-relative key. Implemented in migration 0019. |
| 2026-09-05 | `lessons` gained `video_provider`, `video_id`, `video_hash` and `video_duration_seconds`, with a check constraint so a provider without an id is impossible. A provider and an id rather than a URL: the playable address is composed server-side after the entitlement check, so none is stored to leak, and changing host is a data change (note 07 §34.1). New `lesson_progress` (user_id, lesson_id, completed_at) with RLS — own rows only for read and delete, and an insert policy requiring a live entitlement to the lesson's course, so progress cannot be manufactured for content the caller cannot see. |
| 2026-09-25 | §28.1: `blog_posts.word_count` added as a stored generated column (migration 0013) for reading time on listings. Recorded that imported posts have no `author_user_id` (authorship read from a closing "Written by …" line, else Tony) and that imported `published_at` values are republication dates. |
| 2026-09-25 | §28.2, §60.1, §60.1.2: hosted recordings attached to catalogue works as `resources` (`resource_type 'audio'`) through `catalogue_item_resources`; migration 0014 lets `site-media` hold `audio/mpeg` up to 50 MB, implementing the §60.1 rule; `scripts/import-audio.mjs` (`pnpm audio:import`) uploads and attaches them and runs as the last step of `content:setup`. |
| 2026-09-25 | §60.1: `resources.credit` for old-site images is no longer always the supplied photographer credit — `scripts/import-images.mjs` takes a per-file override (`SOURCE_CREDIT_OVERRIDES`), null where the maker is unknown, so show artwork and publicity photos are not credited to Danny Clifford. Third-party show artwork used as covers is recorded, as not openly licensed, in `supabase/content/images/CREDITS.md`. |
| 2026-09-26 | §28.3 (new): `testimonial_videos` (migration 0015) for the coaching site's filmed testimonials — video by provider + id as on `lessons`, public with no entitlement gate, and a published row without a video shown as "Coming soon". Covers assigned by `scripts/import-images.mjs` (`TESTIMONIAL_VIDEO_COVERS`). |
| 2026-09-26 | §23: `courses.level` and `courses.position` (migration 0016). Courses are titled by their promise ("How to Get Your Movie Made"), with the level as a label and a curated order; the selling products were renamed to match. |
| 2026-09-27 | §36: `private_coaching_slots`, `bookings.order_id` and `bookings.hold_expires_at`, and the `private_coaching` entitlement type (migration 0020), with the hold, availability and release functions and the confirm/cancel triggers. |
| 2026-09-27 | §60: customer-facing "my …" queries also filter by the caller's id, because staff read-all policies made a staff account's own Account and Academy list every customer's bookings, access and orders. |
| 2026-09-27 | §44: `billing_customers`, `invoices`, `payments.receipt_url`, `orders.checkout_mode`, `subscriptions.cancel_at_period_end` (migration 0021) for receipts, invoice history and self-service cancellation. |
| 2026-09-27 | Migration 0022: SECURITY DEFINER functions over `auth.mfa_factors` / `auth.sessions`, each scoped to `auth.uid()` — `my_security_keys()`, `my_sessions()`, `sign_out_my_session(uuid)`, `authorise_security_key_removal(uuid)` (writes `audit_logs`, enqueues `security_key_removed`). Executable by `authenticated` only. Note 05 §11.2. |
