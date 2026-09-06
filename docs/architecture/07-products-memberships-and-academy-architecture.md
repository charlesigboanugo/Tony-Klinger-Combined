# Tony Klinger — Products, Memberships & Academy Architecture

**File:** `07-products-memberships-and-academy-architecture.md`

## 1. Purpose

Define how Tony Klinger's commercial products, memberships, courses, Group Coaching, Interactive Cohorts and Academy delivery fit together.

This note establishes:

- Product concepts
- Product types
- Membership tiers
- Cumulative membership benefits
- Group Coaching series and sessions
- Interactive Cohorts
- Courses and learning content
- Entitlements
- Academy access
- Product-to-delivery relationships

Payments and Stripe implementation are covered in the payments/integrations architecture.

The detailed PostgreSQL schema is covered in the database architecture.

---

# 2. Core Product Principle

A product is something the business offers to a customer.

An entitlement is what the customer receives permission to access or use as a result of purchasing or being granted something.

Therefore:

```text
PRODUCT
   ↓
PURCHASE / GRANT
   ↓
ENTITLEMENT
   ↓
DELIVERY / ACCESS
```

Do not hard-code access directly into individual pages.

---

# 3. Product Types

The system should support product types including:

```text
Membership
Course
Group Coaching
Interactive Cohort
Private Coaching
Retreat
Event
Other future products
```

Products should be data-driven where practical.

A product may have:

- Name
- Slug
- Description
- Product type
- Images
- Price
- Availability
- Purchase configuration
- Entitlement configuration
- Delivery configuration
- Booking requirements
- Active/inactive state

---

# 4. Product and Delivery Separation

The public product experience and the delivery experience are different.

For example:

```text
/coaching/courses/example
```

is a public product page.

After purchase:

```text
/academy/courses/example
```

is the authenticated learning experience.

Similarly:

```text
/coaching/group-coaching/filmmaking
```

describes the public Group Coaching offer.

The customer's actual sessions and participation are delivered through the appropriate authenticated experience.

---

# 5. Membership Structure

The membership structure consists of four cumulative levels:

```text
Silver
   ↓
Gold
   ↓
Platinum
   ↓
Ultimate Membership
```

Each higher tier includes the benefits of the preceding tier and adds further benefits.

The system must represent this cumulative relationship explicitly.

Do not treat the four levels as four completely unrelated products.

Membership tiers share three of their names with Interactive Cohort levels. The two are
different things and must be kept apart in naming and in data — see §16.1.

---

# 6. Silver Membership

Silver includes:

- 1 video playlist
- 1 Group Coaching series
- The Group Coaching series contains 8 sessions

Therefore:

```text
Silver
→ 1 series
→ 8 sessions
```

The membership should grant the customer the corresponding entitlements.

---

# 7. Gold Membership

Gold includes everything in Silver plus:

- An additional Group Coaching series
- Gold-level benefits such as the broader playlist/Q&A benefits defined for the offer

Therefore:

```text
Gold
→ Silver benefits
→ 2 Group Coaching series total
→ 16 sessions total
```

The second series is additional to the Silver series.

Gold must not be modelled as replacing Silver.

---

# 8. Platinum Membership

Platinum includes everything in Gold plus:

- All 4 Group Coaching series
- 32 sessions total
- Virtual retreats
- New courses added during membership

Therefore:

```text
Platinum
→ Gold benefits
→ All 4 Group Coaching series
→ 32 sessions total
→ Virtual retreats
→ New courses during active membership
```

The four Group Coaching series are:

- Filmmaking
- Writing
- Producing
- For All Filmmakers

Each contains 8 sessions.

Therefore:

```text
4 × 8 = 32 sessions
```

---

# 9. Ultimate Membership

The highest membership level is named:

**Ultimate Membership**

It includes everything in Platinum plus:

- Unlimited Interactive Cohort access
- New releases
- Masterclasses
- Partner discounts
- Downloadable resources

Therefore:

```text
Ultimate
→ Platinum benefits
→ Unlimited cohort access
→ New releases
→ Masterclasses
→ Partner discounts
→ Downloadable resources
```

Ultimate should not be treated as merely a renamed "Full Membership".

It is the cumulative top membership tier.

**Revised 2026-09-05, at the user's direction — cohort access and Masterclasses both
removed from this list, free course enrolment added:**

```text
Ultimate
→ Platinum benefits
→ Free enrolment in every course
→ New releases
→ Partner discounts
→ Downloadable resources
```

Two separate reasons, not one. Cohorts are a standalone product on their own ladder
(note 07 §16.1) — a cohort level is never a membership benefit, exactly the confusion
§16.1 already exists to prevent, and this was that confusion, just written down before
anyone caught it. Masterclasses no longer exists as a concept at all: R8 was reversed
the same day (note 07 §22), so it could not remain here either. Free course enrolment
replaces both as Ultimate's actual top-tier benefit — every course (Level One, Two,
Three, whatever is added later) included at no extra charge, which is a real,
buildable benefit neither removed item was.

---

# 10. Cumulative Membership Rule

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

Therefore:

```text
Gold ⊃ Silver
Platinum ⊃ Gold
Ultimate ⊃ Platinum
```

A customer's active tier determines the complete set of benefits they receive.

The application should calculate or resolve effective entitlements from the membership definition rather than duplicating all lower-tier benefits manually.

**The listing card's WORDING changed twice on 2026-09-05, at the user's direction; the
second is what shipped.** The access model above is unchanged throughout — Gold still
genuinely includes everything Silver does. `/coaching/memberships`'s cards originally
said so explicitly, both in prose ("Everything in Silver, plus:") and by listing the
inherited tier's benefits again, greyed out, underneath.

The first attempt cut too far: each card was reduced to only `tier.benefits` — what
that tier itself adds, naming no other tier. That reads correctly for Gold, but a
Platinum card listing only "virtual retreats" and hiding the sixteen sessions and full
playlist library it also includes told a customer less than the truth, not more clearly.

**What shipped instead:** each card shows the full CUMULATIVE set — via
`effectiveBenefits()`, which the first attempt had stopped calling — flattened into one
plain list with no per-item marker for which tier introduced which, and no sentence
naming another tier. The instruction behind it: extract the substance, never write
"Everything in X". The tier's own detail page (`/coaching/memberships/[slug]`) still
goes further, grouping the same facts by source tier ("Added at this tier" / "From
Silver") — a labelled breakdown, not the same phrasing, and consistent with §37.1 (a
detail page may say MORE than its card, never less). One dynamic line is also added on
every card with a real price — "One payment — access for a full year" or "Renews
monthly — cancel any time" — read from the same billing-period toggle the price above
it already responds to, since a static "Access for a full year from purchase" was never
true for the monthly option in the first place.

---

# 11. Group Coaching Series

There are four Group Coaching series:

```text
Filmmaking
Writing
Producing
For All Filmmakers
```

Each series contains:

```text
8 sessions
```

Therefore:

```text
4 series × 8 sessions
= 32 sessions
```

A series is the parent programme.

A session is an individual scheduled coaching occurrence within that series.

Do not use "series" and "session" interchangeably.

---

# 12. Group Coaching Membership Entitlements

The membership entitlements are:

```text
Silver
→ 1 series
→ 8 sessions

Gold
→ 2 series
→ 16 sessions

Platinum
→ 4 series
→ 32 sessions

Ultimate
→ inherits Platinum
→ therefore 4 series / 32 sessions
→ plus Ultimate benefits
```

The exact allocation of which series a lower membership receives must be represented in the product/entitlement configuration rather than assumed by the UI.

---

# 13. Group Coaching Sessions

Each Group Coaching series contains 8 sessions.

A session may have:

- Series
- Title/topic
- Date
- Start time
- End time
- Capacity
- Coach
- Meeting information
- Status
- Attendance
- Recording/replay where applicable

Sessions are scheduled delivery units.

They are not separate products merely because they are individually scheduled.

---

# 14. Individual Group Coaching Purchase

The system may support individual Group Coaching purchases where offered.

The customer may purchase:

- An individual session
- An 8-session bundle
- A membership containing relevant Group Coaching access

The resulting entitlement must identify what the customer can use.

The booking system then determines which available session the entitlement can be used for.

---

# 15. Group Coaching Capacity

The existing Group Coaching offering is designed around:

```text
Maximum group size: 8
Session length: 1 hour
```

The booking system should enforce the configured capacity for each scheduled session.

Capacity should be data-driven rather than hard-coded into every component.

---

# 16. Interactive Cohorts

Interactive Cohorts are distinct from Group Coaching.

The cohort model described for the offering includes:

- Silver
- Gold
- Platinum
- 8 workshops
- 3 hours per workshop
- 24 total hours

Conceptually:

```text
Cohort
   ↓
8 workshops
   ↓
3 hours each
   ↓
24 total hours
```

Do not merge the Cohort and Group Coaching models simply because both contain scheduled live sessions.

## 16.1 Cohort Levels vs Membership Tiers

`Silver`, `Gold` and `Platinum` name **two different ladders**:

```text
Membership tier    Silver → Gold → Platinum → Ultimate     (§5–§9, four levels)
Cohort level       Silver, Gold, Platinum                  (§16, three levels)
```

They are unrelated. A customer can hold a Gold **membership** and a Platinum **cohort** at
the same time, because §17 allows cohort access to arrive either from a membership or from
a direct cohort purchase. A bare "Gold" is therefore ambiguous anywhere in the system.

The rules:

- **Two distinct types, never one shared enumeration.** A membership tier and a cohort
  level must be separate types in the database and in TypeScript, so that a value of one can
  never be assigned or compared where the other is expected. Do not model them as a single
  `tier` column reused by both.
- **Identifiers are always qualified.** Where a level appears as a value, it carries its
  ladder: `membership.gold`, `cohort.platinum`. Never a bare `gold`.
- **Entitlement records name their source ladder.** An entitlement derived from membership
  and one derived from a cohort purchase must be distinguishable by inspection, not by
  inference from context (§29).
- **The UI always renders the noun.** "Gold Membership", "Platinum Cohort" — never a bare
  "Gold" or "Platinum" badge whose meaning depends on where it happens to be displayed.
- **Never compare across ladders.** A cohort level is not higher or lower than a membership
  tier. No ordering exists between them.

Membership tiers are cumulative (§10). **Whether cohort levels are cumulative is not
specified by this architecture.** Do not assume they behave like membership tiers; the
cohort offer's level rules must be settled before cohort entitlements are implemented.

---

# 17. Cohort Access

Cohort access is controlled by entitlement.

Ultimate Membership includes:

```text
Unlimited Interactive Cohort access
```

Other customers may obtain cohort access through a separate eligible purchase.

The entitlement system must therefore support both:

```text
Membership-derived cohort access
```

and:

```text
Directly purchased cohort access
```

---

# 18. Courses

Courses are structured learning products.

A course may contain:

```text
Course
   ↓
Modules
   ↓
Lessons
   ↓
Resources
```

The exact content hierarchy can be extended where required.

Courses should be available publicly as products and delivered privately through the Academy when purchased or otherwise entitled.

---

# 19. Course Access

Course access should be entitlement-based.

Conceptually:

```text
Customer
   ↓
Course entitlement
   ↓
Academy
   ↓
Course
   ↓
Lessons / Resources
```

A customer should not gain course access simply because they can guess or directly enter an Academy URL.

---

# 20. Membership Course Benefits

Platinum includes:

```text
New courses added during membership
```

This means the membership entitlement model must be capable of representing ongoing access to qualifying new courses rather than only a fixed list of courses existing on the purchase date.

The exact definition of "new course" should be controlled by product/content configuration.

Do not hard-code a list of course IDs into the Platinum UI.

---

# 21. New Releases

Ultimate includes:

```text
New releases
```

The system should allow qualifying new content/releases to be marked as included in Ultimate membership.

The application should resolve access through entitlements rather than hard-coding Ultimate checks throughout individual pages.

---

# 22. Masterclasses

Ultimate includes:

```text
Masterclasses
```

**R8's routes reversed, 2026-09-05, at the user's direction.** R8 (closed 2026-08-28) made
Masterclasses first-class Academy content with their own routes — `/academy/masterclasses`
and `/academy/masterclasses/[masterclassSlug]` — a `masterclasses` table, `masterclasses.*`
permissions and entitlement-based access, and it was built exactly that way the same day
this note was reversed. The user's reasoning: a masterclass is the same kind of thing as a
course wearing a different label, and did not earn a second, parallel Academy destination.
There is no dedicated masterclass route or navigation item any more; where a masterclass-like
offering exists, it is modelled as a course. `entitlement_resource` keeps its `masterclass`
value (schema, not UI) and the `masterclasses` table, its RLS and its permissions are
untouched — nothing depended on them being unwound, only the delivery route and nav entry
were removed (note 03 §17/§40 amended, note 04 §9 amended, note 08 §27 amended). Recorded
here rather than silently overwriting R8's closed entry, per the standing rule against
resolving a documented decision without saying so.

A future Masterclass may be:

- A standalone product
- Included in Ultimate
- Included in another offer
- Available through another entitlement

The entitlement system must support these possibilities.

---

# 23. Recordings

Where courses, cohorts, Group Coaching or other experiences generate recordings, the recording should be associated with the relevant delivery experience.

Examples:

```text
Course
→ Course recording/resource

Cohort workshop
→ Workshop recording

Group Coaching session
→ Session replay
```

Recordings should inherit appropriate access restrictions from the associated experience unless a specific business rule says otherwise.

A recording is therefore never a separate content hierarchy and has no route of its own. It
is reached through its parent — course, cohort workshop, Group Coaching session or
masterclass — and a customer entitled to the parent is entitled to its recordings.

---

# 24. Downloadable Resources

Ultimate includes downloadable resources.

Resources may belong to:

- Memberships
- Courses
- Cohorts
- Masterclasses
- Coaching sessions
- Other products

Private resources must be protected from unauthorized access.

Do not expose private customer resources through the public `public/` directory.

---

# 25. Partner Discounts

Ultimate includes partner discounts.

A discount entitlement is not the same thing as direct access to a partner's service.

The system should represent the customer's eligibility for the partner discount.

The actual partner redemption process may depend on the partner arrangement.

---

# 26. Virtual Retreats

Platinum includes virtual retreats.

Retreat access should be represented through an entitlement.

Where a retreat requires a booking or registration, the customer may need:

```text
Eligible entitlement
   ↓
Registration / Booking
   ↓
Retreat participation
```

Membership entitlement does not automatically mean that every operational booking step can be skipped.

---

# 27. Private Coaching

Private Coaching is a separate product/service category.

It should support:

- Service definition
- Pricing
- Availability
- Booking
- Payment
- Customer entitlement where applicable

Memberships should only cover Private Coaching where that benefit is explicitly defined.

Do not assume membership automatically includes private coaching.

---

# 28. Entitlement Model

An entitlement represents a customer's right to access or consume something.

Examples:

```text
Course access
Group Coaching series access
Group Coaching session credit
Cohort access
Retreat access
Masterclass access
Downloadable resource access
Partner discount eligibility
```

Entitlements may be:

- Active
- Expired
- Consumed
- Limited
- Unlimited
- Time-bound
- Subscription-dependent

---

# 29. Entitlement Sources

An entitlement may originate from:

```text
Direct purchase
Membership
Bundle
Promotion
Manual administrative grant
Other approved source
```

The source should be identifiable.

A manual administrative grant is a privileged operation. It is performed through
`/admin/entitlements`, requires the `entitlements.grant` permission, records a reason, and
is audited — see note 06 §23.1.

For example:

```text
Gold Membership
   ↓
Group Coaching entitlement
```

or:

```text
Direct 8-session purchase
   ↓
8-session entitlement
```

---

# 30. Entitlement Consumption

Some entitlements represent access without consumption.

Examples:

```text
Course access
Membership content access
Partner discount eligibility
```

Others represent a limited quantity that can be consumed.

Examples:

```text
8-session Group Coaching entitlement
        ↓
Session 1 consumed
        ↓
7 remaining
```

The system must distinguish between unlimited access and consumable credits.

---

# 31. Membership Duration

Membership entitlements should respect the membership's active period.

Conceptually:

```text
Membership starts
      ↓
Benefits active
      ↓
Membership remains active
      ↓
Benefits continue
      ↓
Membership expires/cancels
      ↓
Benefits become inactive according to policy
```

The exact grace-period and cancellation behaviour should be defined by the subscription/payment architecture.

## 31.1 Recurring and lump-sum purchase

Every tier is purchasable two ways — as a recurring subscription, or as a one-time payment
for a fixed year. The benefits and their duration are identical; only renewal differs.

```text
Recurring   renews until cancelled; each paid period extends access
Lump sum    one payment, fixed term, does not renew, lapses at expiry
```

**Access is read from the entitlement in both cases**, never from the subscription, because
a lump-sum member has no subscription to read. The mechanism, the grace-period rule and the
upgrade behaviour are defined in note 09 §16.1.

This does not change the tier model in §5–§10: the four cumulative tiers are unchanged, and
a tier's benefits do not depend on how it was paid for.

---

# 32. Academy Access Rules

Academy access should be derived from entitlements.

Conceptually:

```text
Authenticated user
       ↓
Active entitlements
       ↓
Eligible Academy resources
       ↓
Display/access
```

The Academy should not have a separate manually maintained list of who can access each course.

The entitlement system should be the source of truth.

---

# 33. Academy Dashboard

The Academy dashboard should be personalized.

It may display:

- Active courses
- Current membership
- Upcoming Group Coaching sessions
- Cohorts
- Masterclasses
- Resources
- Recordings
- Progress
- Relevant bookings

Only relevant/entitled content should be presented as available customer content.

---

# 34. Academy Course Experience

A typical course experience is:

```text
/academy/courses
        ↓
Select course
        ↓
/academy/courses/[courseSlug]
        ↓
Course overview
        ↓
Modules
        ↓
Lessons
        ↓
Resources
        ↓
Progress
```

The exact lesson route structure can be refined during implementation.

## 34.1 Lesson video

A lesson row stores a **provider and an id**, never a URL:

```text
video_provider   youtube | vimeo | livid | null
video_id         the host's identifier for the video
video_hash       Vimeo's ?h= token for an unlisted video; null for the others
```

Two things follow from that shape, and both are the reason for it.

**Moving host is a data change.** Note 09 §40.1 puts all video on Livid; the existing
course videos are on YouTube and stay there until they are re-uploaded (R29). Because the
address is composed from the provider and the id rather than stored, switching is
`update lessons set video_provider, video_id` plus one function — not a rewrite of every
row and of whatever code parsed those URLs.

An operator may paste a whole URL into the id field; the id is taken from it. The CMS these
come from stores full URLs, and asking somebody to extract 41 ids by hand is asking for 41
chances to get one wrong.

**The playable address exists only inside an authorised response.** It is built in
`src/lib/academy/video.ts`, which is `server-only`, and only after the lesson row has come
back — and a lesson row is readable solely with a live entitlement to its course
(migration 0004). There is no stored URL for a forgotten `select *` to leak, and the course
OUTLINE carries only a boolean saying a lesson has video, because a table of contents is
rendered for people who may not hold every lesson on it.

This is the mechanism note 09 §40.1 asks for. Its argument applies unchanged to Vimeo:
domain locking stops another site embedding the player and does nothing to stop one of our
own members watching another tier's content, because both are on our domain.

**How far the protection reaches depends on the host, and the hosts are not equal:**

```text
vimeo, livid   can refuse to play except when embedded on our domains, so a URL
               copied out of an entitled member's page is worth little off-site
youtube        cannot. An unlisted URL IS the credential, it never expires, and
               revoking it means deleting and re-uploading the video
```

Withholding does the same work in both cases — it keeps non-members out of the page. What
it cannot do on YouTube is survive a member who passes the address on. That is the weakness
README R29 records as option (b), accepted deliberately as an interim state, and it is the
reason moving to Livid remains worth doing rather than a preference.

**A malformed id degrades to "no video", never to a dead player.** The migrated curriculum
proved the need: one row arrived from the source CMS carrying the literal string `IDHERE`
where an id should be. Formats that can be stated confidently are checked — a YouTube id is
exactly eleven characters of `[A-Za-z0-9_-]`, a Vimeo id is numeric — and anything failing
that renders as written material rather than as a black rectangle that never loads. Content
that looks broken is worse than content that is honestly absent.

**Operational requirement.** On Vimeo and Livid the video must be set to unlisted AND
restricted to our domains. Without that restriction, withholding the URL is the only
protection there is.

The YouTube embed uses `youtube-nocookie.com`: the standard player sets third-party
tracking cookies on a page the customer paid to reach.

## 34.2 Progress

One row per completed lesson (`lesson_progress`), and nothing else:

```text
completed        a row exists
not completed    no row
```

**Not a percentage and not a playback position.** A percentage is the same fact made
vaguer — "eleven of nineteen" is something a person can act on. A playback position has to
be written continuously, goes stale the moment content changes, and answers a question
nobody asked.

Opening a lesson records nothing. Completion is an explicit act with an explicit undo,
because a tracker that advances on a stray click is one nobody trusts.

**"Continue" means the first UNFINISHED lesson**, not the last one opened. Recording "last
opened" would send a returning customer back to something they had already finished merely
because they glanced at it.

Writing progress requires the entitlement, enforced by the insert policy rather than by the
Server Action (migration 0037). A Server Action is a public endpoint: anyone with a session
can post any lesson id to it, and without the policy they could manufacture a completed
course they never had access to.


---

# 35. Academy Cohort Experience

A typical cohort experience is:

```text
/academy/cohorts
        ↓
Select cohort
        ↓
/academy/cohorts/[cohortSlug]
        ↓
Overview
        ↓
Workshop schedule
        ↓
Resources
        ↓
Recordings
        ↓
Participation / progress
```

---

# 36. Academy Group Coaching Experience

A typical Group Coaching experience is:

```text
/academy/coaching
        ↓
Eligible series
        ↓
Series sessions
        ↓
Upcoming session
        ↓
Booking / joining
        ↓
Recording / history
```

The exact interaction depends on whether the customer already has a booking or merely an entitlement.

---

# 37. Product-to-Academy Relationship

The architecture should support:

```text
Public Product
       ↓
Purchase / Membership
       ↓
Entitlement
       ↓
Academy Delivery
```

The public product page should not contain the protected learning content itself.

## 37.1 A detail page must never explain less than its card

**Standing rule.** Every product and coaching offer must state plainly what it
includes — on the listing card *and* on its own page. A detail page that shows
less than the card the visitor clicked is a defect, not a stylistic choice.

The failure is easy to introduce and hard to notice, because each page looks
reasonable on its own. A listing is built with real substance — price, what is
covered, how long it lasts — and the detail route is scaffolded with a title and
a description, on the unstated assumption that the interesting content lives in
the list. The visitor experiences the opposite: they clicked *because* they
wanted more, and got less.

Every product detail page therefore answers, without the visitor going anywhere
else:

```text
What is it            what the offer actually consists of
What is included      sessions, topics, materials, access
What it costs         price, and what the price buys
How long              duration, term, and whether it renews
Who it is for         eligibility, prerequisites, group size
What happens next     the action to take, and what follows it
```

This is note 10 §30's clarity requirement — offer, benefits, price, eligibility,
call to action — stated as an obligation on the **detail** route specifically,
because that is where it keeps being missed.

Where a fact already exists as data, the page reads it rather than restating it
in prose: a series shows its `syllabus`, a membership shows its tier benefits, a
price comes from `prices`. Prose duplicating a stored fact drifts away from it.

---

# 38. Product-to-Booking Relationship

Some products require booking after purchase or entitlement.

For example:

```text
Membership
   ↓
Group Coaching entitlement
   ↓
Available sessions
   ↓
Booking
```

Or:

```text
Private Coaching purchase
   ↓
Private Coaching entitlement
   ↓
Booking
```

The product does not itself represent the booking.

---

# 39. Upgrade Path

Customers may move between membership levels.

The system should support:

```text
Silver
   ↓
Gold
   ↓
Platinum
   ↓
Ultimate
```

An upgrade should result in the customer's effective entitlements being recalculated appropriately.

The system must avoid duplicate or contradictory entitlements when a customer changes membership.

---

# 40. Downgrade / Cancellation

The membership system must also support:

- Downgrade
- Cancellation
- Expiration
- Renewal
- Failed payment

The resulting access must follow the defined membership policy.

Do not simply delete all historical entitlement records when a membership changes.

Historical records may be required for reporting, customer support and financial reconciliation.

---

# 41. Product Availability

Products should support availability states such as:

```text
Draft
Active
Paused
Archived
```

The exact state model can be refined during implementation.

A product being unavailable for new purchase does not necessarily mean existing customers lose access.

For example:

```text
Archived product
→ Existing entitlement remains valid according to its rules.
```

---

# 42. Product Versioning

Where a product changes substantially over time, the architecture should allow the system to distinguish:

```text
Current product definition
```

from:

```text
Existing customer entitlement
```

A customer who purchased an older offer should not unexpectedly receive or lose benefits merely because an administrator changed the current marketing description.

Material entitlement changes should therefore be handled deliberately.

---

# 43. Admin Product Management

Admin users with appropriate permissions should be able to manage:

- Products
- Prices
- Membership tiers
- Benefits
- Course relationships
- Cohort relationships
- Group Coaching series
- Entitlement rules
- Availability

Customer entitlements themselves — reviewing, granting, adjusting and revoking them — are
managed through `/admin/entitlements` under the permissions defined in note 06 §23.1.

The exact Admin routes are defined in the Admin architecture.

---

# 44. Product Data vs UI

Do not hard-code the membership structure into many UI components.

Instead, represent the underlying product and entitlement data centrally.

The UI should render the configured data.

For example:

```text
Membership configuration
        ↓
Entitlement resolution
        ↓
Membership comparison UI
        ↓
Academy access
```

This makes future product changes safer.

---

# 45. Future Product Types

The product architecture must allow additional product types without redesigning the entire system.

Potential future types include:

- Masterclass
- Digital download
- Event
- Workshop
- Bundle
- Subscription
- New coaching formats

A new product type should reuse existing concepts such as:

```text
Product
Price
Order
Entitlement
Delivery
Booking
```

where applicable.

---

# 46. Security

Product ownership and Academy access must never be determined solely by client-side state.

A customer requesting:

```text
/academy/courses/example
```

must be checked server-side for:

```text
Authenticated user
+
Valid course entitlement
```

Likewise, booking a session requires:

```text
Authenticated user
+
Eligible entitlement
+
Valid availability
```

---

# 47. Technology Requirement

Use the latest stable, production-safe versions and current recommended APIs of:

- Next.js
- React
- TypeScript
- Supabase
- Stripe
- Other project dependencies

Do not build the product or Academy architecture around deprecated APIs or old package patterns.

---

# 48. Product & Academy Summary

The complete model is:

```text
                         PRODUCT
                            │
                    ┌───────┴─────────┐
                    │                 │
                  PRICE          DELIVERY RULES
                    │                 │
                    │                 │
                 PURCHASE        ENTITLEMENT
                    │                 │
                    └───────┬─────────┘
                            │
                         CUSTOMER
                            │
                ┌───────────┼───────────┐
                │           │           │
             ACADEMY     BOOKING     RESOURCES
                │
        ┌───────┼────────┐
        │       │        │
     COURSES  COHORTS  COACHING
```

Membership model:

```text
SILVER
  → 1 Group Coaching series
  → 8 sessions

GOLD
  → Everything in Silver
  → 2 series total
  → 16 sessions total

PLATINUM
  → Everything in Gold
  → All 4 series
  → 32 sessions total
  → Virtual retreats
  → New courses during membership

ULTIMATE
  → Everything in Platinum
  → Unlimited cohort access
  → New releases
  → Masterclasses
  → Partner discounts
  → Downloadable resources
```

The fundamental rule is:

```text
PRODUCT ≠ ENTITLEMENT ≠ BOOKING
```

Products define what is offered.

Entitlements define what the customer is allowed to access or consume.

Bookings define specific scheduled participation.

---

# 49. Architectural Principle

The product and Academy architecture should provide:

**Configurable products, cumulative memberships, explicit entitlements, distinct delivery models, and secure access based on what the customer actually owns or has been granted.**

The Academy is the delivery environment.

The Coaching area is primarily the public discovery and commercial environment.

The Account area manages the customer's relationship with the platform.

The Admin area manages the underlying products, content, customers and operations.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-09-04 | §37.1 (new): standing rule — a product or coaching detail page must never explain less than the card that links to it, and must answer what it is, what is included, what it costs, how long it lasts, who it is for and what happens next. Added because the pattern had already appeared: the Group Coaching series detail route rendered only a name and one-line description while its listing card carried the full eight-topic curriculum. |
| 2026-08-28 | §22, §23: Masterclasses confirmed as first-class Academy content with defined routes and entitlement-based access; recordings confirmed as attached to their parent experience with no route or hierarchy of their own. Closes R8. |
| 2026-08-28 | §29, §43: manual entitlement grants pointed at `/admin/entitlements`, with the permission, reason and audit requirements of note 06 §23.1. Supports R18. |
| 2026-08-28 | §5, §16.1 (new): membership tiers and Interactive Cohort levels explicitly separated in naming and data — distinct types, qualified identifiers, source-bearing entitlements, noun-carrying UI labels, no cross-ladder ordering. Records that cohort-level cumulativeness is unspecified and must not be inferred. Closes R17. Numbered 16.1 so that no existing section number changes. |
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1). Box-drawing characters, arrows and symbols restored to `┌ ┴ ┬ ┼ ─ │ ↓ → × ≠ —`; §41 diagram alignment normalized. **One glyph was ambiguous:** the §10 relation `Gold _ Silver` / `Platinum _ Gold` / `Ultimate _ Platinum` was restored as the superset sign `⊃`, which matches the section's cumulative-membership meaning. If the original used `⊇` or another symbol, correct §10. No wording was altered. |
| 2026-09-05 | §34.1, §34.2 (new): lesson video recorded as a (provider, id) pair composed into a URL server-side, so the host can change without a rewrite and the playable address never exists outside an authorised response; and progress recorded as one row per completed lesson, with the entitlement enforced by the insert policy rather than by the Server Action. |
| 2026-09-05 | §34.1: `youtube` added as a lesson video host (migration 0038), per the owner's decision that existing course videos stay on YouTube until they are re-uploaded to Livid. Recorded that the hosts are NOT equivalent — unlisted YouTube cannot be domain-restricted, so withholding the URL keeps non-members out of the page but cannot survive a member passing the address on. The embed uses youtube-nocookie. |
| 2026-09-05 | §34.1: recorded that a malformed video id must degrade to "no video" rather than build an embed URL, after the migrated curriculum arrived with a literal `IDHERE` in one row. |
