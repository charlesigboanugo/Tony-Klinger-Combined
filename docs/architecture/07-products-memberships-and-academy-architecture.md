# Tony Klinger — Products, Memberships & Academy Architecture

**File:** `07-products-memberships-and-academy-architecture.md`

## 1. Purpose

> **Naming, owner 2026-10-09.** What this note calls a membership is sold to customers as a
> **Coaching Pass** (Silver Pass, Gold Pass, Platinum Pass): a year's package of coaching,
> paid once, to use whenever they like within twelve months. "Membership" remains the name
> in the data model, the code and these notes — `membership_tiers`, the `membership` product
> and entitlement types, `my_membership` — and "member" here means a pass holder. Only
> customer-facing words and addresses (`/coaching/passes`, `/academy/pass`, `/account/pass`)
> changed. The owner confirmed the name on 2026-10-10.

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

**Withdrawn from sale 2026-10-08 (owner).** Ultimate was never sold: it has no price, and the
coaching site's own top tier is Platinum ("the premium offer"). Its row and enum value remain,
with `membership_tiers.active = false` (migration 0012), so it is not offered anywhere. The
storefront, the cart and the Academy name three tiers. Re-enabling it is a tick in Admin →
Memberships once it has a price and a decided offer; nothing else needs to change.

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

## 10.1 What each tier includes — confirmed 2026-10-08, migration 0012

The offer below was confirmed with the owner against the coaching site and the owner's own
reply. It replaces the lists in §6–§8 where they differ.

```text
Silver     1 Group Coaching series of the member's choice, each membership year (§12.1)
           1 video playlist of the member's choice (Filmmaking, Writing, Producing)

Gold       2 Group Coaching series of the member's choice, each membership year
           every video playlist, including the Gold-and-above Miscellaneous playlist
           the monthly live Q&A with Tony, and its recordings

Platinum   4 Group Coaching series of the member's choice, each membership year
           every video playlist
           the monthly live Q&A, and its recordings
           free entry to every Virtual Retreat held while a member — levels open
           without an interview only, and YEARLY members only
```

**The retreat is for yearly members (owner, 2026-10-08).** Retreats may run any number of
times a year, and a month of Platinum (£70) costs less than one retreat place (£199.50), so
free entry on a monthly plan would let anyone attend for the price of a month. With
`membership_tiers.retreats_require_yearly` on (the default), only a member paying by the year
holds the retreat entitlement. `subscriptions.billing_interval` records which, from Stripe's
price; `membership_of` resolves `includes_retreats` for the member, not the tier.

With membership sold only as one payment for the year (2026-10-09), every member bought by
the year, so every Platinum member holds the retreat entitlement and the storefront no longer
says "on the yearly plan". The switch stays: it matters again the day a monthly price does.

**The rules are data, not code.** `membership_tiers` carries `series_allowance` and
`playlist_allowance` (a number the member chooses, or null for all), `includes_qa` and
`includes_retreats`. The storefront's "how it works", the Academy's membership page and the
database's entitlement derivation all read those four columns; none of them names a tier.
Changing what a tier includes is an edit in Admin → Memberships.

**`benefits` is now each tier's FULL list**, reversing the "what this tier adds" rule above.
Tiers are cumulative in what they grant but not in how they read: a higher tier supersedes
lines below it (one playlist becomes every playlist, one series becomes two) rather than
adding to them, so a list built by walking the ladder states one benefit twice at different
sizes. Each tier carries its own complete list, shown as stored on the listing card and the
detail page, with no "everything in Silver" line. `effectiveBenefits()` is removed.

**Choices.** A tier's playlists are chosen in the Academy (`/academy/playlists`, their own section since 2026-10-10) through
`choose_playlist`, which enforces the allowance and the playlist's `min_tier` in one
transaction. The choice is a `membership_choices` row; staff delete the row to let a member
choose again. A playlist is chosen once and kept. **A series is not chosen there: it is taken
by registering for a run of it**, counted against the tier's number for the membership year —
§12.1.

**What a member loses on cancelling** (owner, 2026-10-08): everything the membership
included, at the end of the period already paid for. Anything bought separately is unaffected.

**Left off the offer deliberately**, because the coaching site promised them and nobody has
confirmed they still hold: a weekly upload ("new videos added regularly" is what is said), the
first Wednesday at 5pm for the Q&A (the schedule is whatever is entered in Admin → Q&A
sessions), 25% off a 2022 Platinum renewal, and a retreat fee credited against an in-person
retreat.

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


## 12.1 A member's series: a number each membership year — owner, 2026-10-09, migration 0018

**Terms are removed.** The term model of 2026-10-08 (migration 0013: a three-month term, a
series chosen again each term) is withdrawn at the owner's direction, with its table,
functions and admin screen. A series already has a start and an end of its own: the run
(§14.2). A second calendar laid over it was one too many.

```text
Silver     1 series in each membership year
Gold       2 series in each membership year
Platinum   4 series in each membership year
```

**A member takes a series by registering for a run of it**, in the same window as anyone
buying a place: before the run starts, while it has places. Registering gives a seat in all
eight sessions, with nothing to book. It is done from the Academy (Membership, or Group
Coaching), through `register_for_run`, the function a paid place uses.

**The count.** `membership_tiers.series_allowance` is the number a year. The membership year
runs from the day the membership began (`membership_of.starts_at`) and turns over on each
anniversary, monthly and yearly plans alike. What is counted is the member's registrations
made THROUGH THE MEMBERSHIP in the current year (`coaching_registrations.source =
'membership'`; `membership_series_used`, `my_series_allowance`). Taking the same series twice
counts twice. At the limit the answer is `limit_reached`, and the Academy says how many the
plan includes and when the year turns over.

**Pass holders register first** (owner, 2026-10-09, migration 0026). They take seats like
anybody else, from the same seats, with no places held back for them; what they get is a head
start. `coaching_runs.pass_opens_at` is when a run opens to pass holders, ahead of
`registration_opens_at`, when it is "thrown open" to everyone: seven days ahead where the run
sets none (`pass_priority_days()`), and settable for each run in Admin → Series runs. In
that window a place is taken only through a pass.

**Decided the same day, and already how it works:** a pass holder who misses a series'
registration window waits for the next run (or buys single sessions like anyone); a series
not taken in the year never carries over.

**A bought place is used first.** A member who has also paid for a place on that series
(`series_pass`) registers with it, and their yearly number is untouched.

**A place taken through the membership lasts the run** (owner, 2026-10-09, migration 0019,
replacing 0018's "as long as the membership"). A member who registers late in their year
finishes the run they registered for, even where it ends after the year does: they spent one
of their series on it. `registration_stands` decides, for `holds_seat` and `run_seats_taken`
alike. Two exceptions: a membership revoked or refunded takes its places with it; and a
membership held as a SUBSCRIPTION (none is on sale) keeps the 0018 rule, the place lasting
only while it is paid, or a month's payment would buy a whole series.

**No series entitlement is derived.** `sync_membership_entitlements` derives playlists and
the retreat only; a tier's series are held as registrations, not entitlements.

**Settled (owner, 2026-10-09): a membership is a twelve-month bundle, paid once** — §31.1
below and note 09 §16.1. That closes the gap this section used to leave open, where at £15 a
month a Silver member could register for one run (£130 bought outright) and cancel.

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

**Implemented 2026-10-08, migration 0012 — and a defect closed.** One session and the
eight-session pack are session CREDITS (`products.credits` 1 and 8), usable against any
scheduled session of any series; both lapse `products.valid_months` (3) after purchase, and
more can be bought only once every session held is used or has lapsed (note 09 §28.1).
Before 0012 a `group_coaching` product was mapped to a series by `product_id`; no series has
a product, so the entitlement was written with no resource and no quantity, and a £25 session
bought unlimited access to every series for ever. A product with no series of its own now
always grants credits. Booking spends the credit that lapses soonest.

**Sessions belong to the series they were bought for (owner, 2026-10-09; migration 0014),
replacing "usable against any scheduled session of any series" above.**

```text
£25    one session of ONE series. Used on one session, it is spent.
£130   eight sessions of ONE series, to use within three months of purchase.
       Each booking spends one.
```

Each series has its own two products (`group-coaching-single-<series>`,
`group-coaching-x8-<series>`), eight in all, and a product names its series in
`products.series_id`. The entitlement it grants carries that series as `resource_id`;
booking spends it only on that series, the session policy shows only that series' sessions
(`has_session_credits_for`), and "sessions still to use" is asked per series, so holding
Writing sessions does not stop someone buying Producing ones. A null `resource_id` still
means any series: sessions granted by staff, or bought before this rule. The two products
that were good for any series are paused. A series' own page is where its sessions are
bought, which is what ties them to it.

## 14.2 Series runs: dates, registration, and a place bought once — owner, 2026-10-09, migration 0016

A series is not on sale all the time. It RUNS between two dates, and is registered for
before it starts.

```text
A RUN   one running of a series: eight weekly sessions, a start and an end date,
        a registration period before it, and a number of places

  registration open   from registration_opens_at until the run starts —
                      the only time anything can be bought for the series
  in progress         shown, and closed: nobody joins a run under way
  ended               off the page; the next run has its own dates

£130    A PLACE ON THE RUN: a seat in all eight sessions, with no booking
£25     ONE SESSION of the run, which the customer then picks
```

> **Owner, 2026-10-09 (migrations 0021, 0022) — booking belongs to one-to-one alone.**
> Everything else puts the buyer where they paid to be, with nothing to book.
>
> - **One run of a series takes registrations at a time** (0021). Paying for the series,
>   or registering with a Coaching Pass, places the person on it; there is no choosing
>   between two. A second run may be opened only once the first is full or has started —
>   `coaching_runs_one_open` refuses it otherwise — and `place_on_open_run` takes the run
>   that starts soonest, so it never asks. (A seat freed in a full run after a second has
>   opened leaves two with a place for a while; the earlier fills first.)
> - **£25 buys one session FOR A DATE** (0022), chosen on the series page as the buyer
>   pays. **The series is sold first, single sessions after** (0024, 0025), never together,
>   so a single sale cannot take a place off the series. The change-over is
>   `coaching_runs.registration_closes_at`: when registration for the series closes. Left
>   empty it is the start; set earlier in Admin → Series runs, the seats left go on sale as
>   single sessions before the series begins, the first session included. It is never later
>   than the start. `coming_sessions` lists the sessions still to come on a run whose series
>   registration has closed. A Coaching Pass holder registers in the same window as a buyer,
>   so it closes for them at the same moment. The chosen session travels on the order line
>   (`order_items.metadata.session_id`), checkout asks `session_sale_status`, an account is
>   required (a seat is in somebody's name, like a ticket), and fulfilment takes the seat at
>   once (`book_session_for`). It cannot go in the cart. If that session filled between
>   checkout and payment, the session paid for stays on the account to use on another date
>   of the same series within three months; the Academy's "Book a session" remains for that
>   case only.
>
> The lines "£25 ONE SESSION of the run, which the customer then picks", "with two to choose
> between" and "a second can be opened beside it" in this section are superseded by the above.

This supersedes §14's "eight sessions … each booking spends one" for the £130 product: it
buys the run. The buyer is put on the run as they pay (`place_on_open_run`). If no run had a
place at that moment, the place they paid for (`series_pass`) waits in the Academy and is
taken once one does. A place not taken up lapses after three months.

**A full run closes, and a second can then be opened** at another day and time (owner). Both
are listed on the series page, and registration carries on in the second.

**A place is a seat in every session.** `run_seats_taken` counts the people registered plus
the most single bookings any one coming session has, because registering needs a seat in all
of them; a single booking counts everyone registered for its session's run.

**Members register for a run too** (owner, 2026-10-09, migration 0018), in the same window
and for the same seat in all eight sessions, against their tier's number for the membership
year rather than a payment: §12.1.

**In admin**, Series runs lists the runs still to finish with how many are registered, and
creates a run with its sessions from the first session's date (`schedule_series_run`).

**What a series page shows** when nothing is on sale: "Registration opens {date}", "Fully
booked", "In progress" or "Dates to be announced", with the newsletter, in place of the
purchase panel. Checkout and the cart refuse the same way (`coaching_sale_status`: `closed`,
`full`).

## 14.1 Options: one offer sold more than one way

One session or eight; a private session or eight; the Virtual Retreat at Level 1, 2 or 3.
Each way is its own product, and the products of one offer share `products.option_group`,
with `option_label` ("1 session", "8 sessions", "Level 2") and `option_position`.

**The same switch at every step** (owner, 2026-10-08: "easy to select or switch at each
stage"). `OptionSwitch` renders it on the product page (the purchase panel opens on the
choice, and price, per-session figure, validity and buttons follow it), in the cart (the line
is swapped in place, keeping its quantity) and on a buy-now checkout (each option is a link
back to checkout with the other product). A membership's monthly / one-year choice uses the
same control in the cart and at checkout. Nothing is priced in the browser: a switch names a
product or a period, and the server prices it (note 09 §9).

---

# 15. Group Coaching Capacity

The existing Group Coaching offering is designed around:

```text
Maximum group size: 8
Session length: 1 hour
```

The booking system should enforce the configured capacity for each scheduled session.

Capacity should be data-driven rather than hard-coded into every component.

**Capacity is set in admin, and nothing on a page assumes it (owner, 2026-10-08).** A series
has `group_coaching_series.capacity` (default 8): the storefront states it, and a session
created without a capacity of its own takes it. A cohort's `capacity` is likewise whatever is
entered in Admin → Cohorts; a cohort with none set makes no claim about its size, and once
its places are taken checkout refuses the sale (`coaching_sale_status`, note 09 §28.1).

**No dates, no joining (owner, 2026-10-08).** A cohort with no `starts_at` shows "dates to be
announced" and offers the newsletter in place of the buy button; checkout refuses it. One that
has begun cannot be joined either: while it runs it stays on the list marked "in progress",
and once it has ended it leaves the list (note 09 §28.1). Setting the start date in Admin →
Cohorts opens it.

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

**Amended 2026-10-14 (owner; migration 0029). Deliberate deviation from the first rule
above.** The owner asked that new pass tiers and new cohort levels can be created from admin,
each under a new, unique name. That cannot be done with fixed database types, so both ladders
are now **text codes** (`membership_tiers.tier`, `cohorts.cohort_level`): lower case, unique
within their own ladder, chosen when the tier or cohort is created and locked after. The
"separate types" rule is therefore no longer met literally. Its purpose is kept by other means:

- the two codes live in different columns of different tables, and nothing references one
  from the other; a pgTAP test checks each is its own column;
- a pass tier's code is only ever referenced by things about passes (a playlist's lowest
  tier, a subscription) through foreign keys to `membership_tiers.tier`, so a cohort level
  cannot be stored there;
- order never comes from the code: pass tiers by `rank` (already the case everywhere),
  cohorts by a new `rank`.

In TypeScript both are now plain strings. The ladders also stop being fixed at four and
three: the counts in §5–§9 and §16 describe what exists, not a limit. A new tier needs a
product with a price before it can be sold.
- **The UI always renders the noun.** "Gold Membership", "Platinum Cohort" — never a bare
  "Gold" or "Platinum" badge whose meaning depends on where it happens to be displayed.
- **Never compare across ladders.** A cohort level is not higher or lower than a membership
  tier. No ordering exists between them.

Membership tiers are cumulative (§10). **Whether cohort levels are cumulative is not
specified by this architecture.** Do not assume they behave like membership tiers; the
cohort offer's level rules must be settled before cohort entitlements are implemented.

---


## 16.2 Cohort intakes: the cohort stays, each running is an intake — owner, 2026-10-09, migration 0017

Until this, a cohort row WAS one running of it: it carried the dates and the places, and
running a level again meant a new cohort with a new product. The owner's decision reverses
that, on the pattern the series already follow (§14.2):

```text
A COHORT    fixed: Silver, Gold, Platinum — its page, what it delivers, its price.
            On the site all year. A new cohort can still be added.

AN INTAKE   one running of a cohort: its eight workshops, a start and an end date,
            a registration period before it, and its places ("Spring 2027").

  registration open   from registration_opens_at until the intake starts —
                      the only time the cohort can be joined
  in progress         shown, and closed: it is one group, start to finish
  ended               off the page; the next intake has its own dates
```

**The intake decides whether the cohort is open, never the cohort.** `cohorts.starts_at`,
`ends_at` and `capacity` are no longer read. A cohort with no intake says "dates to be
announced"; with one coming, "registration opens {date}".

**The price buys a place on ONE intake.** It is a counted `cohort` entitlement, spent on
joining; the buyer is put on the intake as they pay where the cohort has exactly one open
with a place (`place_on_open_intake`), and chooses in the Academy where there are two. Next
year's intake is a new place. A full intake closes, and a second can be opened beside it.

**A workshop belongs to an intake** (`cohort_workshops.intake_id`) and is seen, with its
joining link and recording, only by the people on that intake — which is what stops last
year's group seeing this year's. `in_cohort` (on any intake of it, past ones included, or
holding standing access) is what the Academy means by being in a cohort; standing access is a
`cohort` entitlement with no quantity, kept for staff grants and places bought before intakes.

This replaces the "No dates, no joining" paragraph of §15 and the instruction, given the same
week, to create a new cohort for each run.

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

**Enforced 2026-09-26 (migration 0019).** `resources` gained a read policy: a row is
readable when it is the `recording_resource_id` of a cohort workshop whose cohort the
caller holds, or of a Group Coaching session the caller booked (`has_booking()`) or whose
series they hold. **Session replays deliberately exclude customers who merely hold unspent
credits** — credits make a session visible and bookable, and a seat never taken is not a
replay owed. An external URL (Livid) is shown as-is; a private-bucket path is signed
server-side for one hour, only after the row came back under RLS
(`src/lib/academy/delivery.ts`).

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

**Set up 2026-10-08, migration 0012 (owner: one day, dates not yet available).** The Virtual
Retreat is one day online and runs at three levels, each its own `retreats` row and product
because each has its own price, places and way in:

```text
Level 1   open to all                 £199.50
Level 2   by interview, six writers   £399.50
Level 3   by invitation, four writers £499.50
```

A level with no `starts_at` is shown as "date to be announced", offers the newsletter, and
cannot be bought; setting the date in admin opens booking. A level entered by interview
(`requires_application`) can be bought only by someone with an approved
`retreat_applications` row, which staff set in Admin → Retreat applications.

A Platinum member holds a place at retreats open without an interview. A membership never
covers a level entered by interview (`has_retreat_access`). The joining link is kept off the
public `retreats` row, in `retreat_access`, and shown in the Academy's Coaching area to people
with a place.

These three prices were, on the coaching site, the prices of these retreat levels. The
migration had attached them to the video courses, which belong to the Online Coaching site
and had only placeholder prices there. The courses keep those prices until the owner supplies
their own; the retreat levels now carry them as well.

---

## 26.1 Retreat batches: the retreat stays, each running is a batch — owner, 2026-10-14, migration 0030

The owner asked that a retreat run "year after year or multiple times a year at will, with
batches", as a cohort runs as intakes (§16.2), and that each batch carry its own joining link.

- **A retreat is fixed** (Level One, Two, Three): always on the site, one product and price,
  its level and whether it is entered by interview. It no longer has dates or places.
  **A level is used once and cannot be changed** (owner, same day; migration 0031): a second
  retreat at a level already in use is refused, and the admin form locks the level once set.
- **A batch is one running** (`retreat_batches`): a name ("Spring 2027"), a registration window,
  dates, places, and its **joining link and notes**. As many as wanted.
- **A place is on one batch** (`retreat_places`, like `cohort_enrolments`), with the purchase
  that paid for it.
- **Buying** still grants a `retreat` entitlement, and now also places the buyer on the
  retreat's open batch, the soonest if more than one is open (`place_on_open_retreat_batch`).
  It is on sale only while a batch is open for registration and has a place; otherwise the sale
  status is full, closed (a batch is coming), past (one is under way) or unscheduled.
  "Already has a place" means a place on a batch that has not finished, so someone who went
  last year can book this year's.
- **A Coaching Pass** that includes the retreat still covers every batch of a retreat open
  without an interview, without taking a numbered place; by-interview retreats still need an
  approved application (§26 as before).
- **The link stays private.** Batch rows are not public: staff read them, and a person reads
  only a batch they have a place on or their pass covers (`has_retreat_batch_access`). The
  public site reads dates through `retreat_batch_dates()`, which leaves the link out. The
  separate `retreat_access` table (and the admin "Retreat links" page) is gone; existing links
  moved onto each retreat's batch.
- **Existing data** moved across unchanged: each retreat that had dates now has one batch with
  them, and each place bought sits on it. The three real levels had no dates, so have no batch
  yet.

Admin: **Retreats**, **Retreat batches** (Current / Past, by retreat) and **Retreat batch
places** (by batch, with the retreat in brackets; Past folded; how each place was taken, as
Series run registrations show it, migration 0033), alongside Retreat applications.

## 26.2 Applying for a by-interview retreat — owner, 2026-10-14, migration 0032

- **Applied for on the retreat's page**, for the batch taking applications (a published batch
  of a by-interview retreat whose registration is open). The form asks about the project
  (required), experience and hopes; signed-out visitors are asked to sign in first.
  `apply_for_retreat` saves it to Retreat applications, and the site owner is emailed
  (`retreat_application_received`, to `CONTACT_NOTIFICATION_EMAIL`). It replaced an "Apply"
  button that went to the contact form.
- **One application per person per batch.** Having applied, the page shows **Awaiting
  approval** (or that the interview is under way) and offers no second application.
- **Approved opens payment.** Staff mark it Approved under Retreat applications; the person is
  emailed (`retreat_application_approved`, once per approval) and the page now shows Book your
  place for that batch. Declined or withdrawn lets them apply again.
- **An approval is for one batch.** The next batch is applied for afresh; this replaces approval
  per retreat, which never expired.
- **Admin:** Retreat applications lists only batches of retreats entered by interview (no other
  retreat takes applications), by batch (retreat in brackets), with Current / Past
  by the batch's end (Past folded) and a Status filter to see approved and not; the dashboard
  shows applications not yet answered.

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

**Implemented 2026-09-27** (note 09 §36, migration 0020), first as choose a time then pay;
since 2026-10-08 a session is paid for first and booked afterwards (below). Confirmed private sessions
appear in the Academy's Coaching area alongside Group Coaching seats ("Private, with Tony",
joining link in the usual window), and a paid session not yet given a time shows there as a
prompt to choose one. Past private sessions are listed in Account → Bookings only; they have
no replays.

**Pay first, then book — for one session and for a pack alike (owner, 2026-10-08),
reversing the "choose an open time, pays" order above.** A session (£150) or a pack of eight
(£1,000) is bought through checkout; the sessions wait in the Academy, to use within six
months, and a time is chosen for each with nothing more to pay. The times open now can be
seen before buying (`/book/private/[service]`, signed in; read-only until a session is
held). Buying needs no account — a guest pays with an email and claims the order to choose
a time (note 05 §29.3). The pack
is a product whose `pack_of` is the single-session product, so it grants sessions of that
product's service.

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

> **Owner, 2026-10-09: membership is sold ONE way, as a single payment for twelve months.**
> It is a bundle, not a subscription: it does not renew, nothing is charged again, and there
> is nothing to cancel. The monthly and yearly subscription prices are retired (inactive, not
> deleted), which reverses the "a year renews like a month" of 2026-10-08. The yearly figures
> are the coaching site's own: Silver £160, Gold £280, Platinum £560. Both mechanisms below
> remain built — a subscription price switched back on in Admin → Prices is sold, granted and
> worded as one — but only the lump sum is on sale. Rules for buying again: note 09 §28.1.

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

**Yearly renews too (owner, 2026-10-08).** The yearly option is now a subscription billed
once a year, renewing until cancelled, at the same figure the one-off year carried. The
one-off yearly prices are retired (`active = false`), not deleted. The lump-sum mechanism
above is kept in the code and the database and is still tested, so a one-off year can be put
back on sale by activating such a price; nothing on sale uses it today. Storefront wording is
taken from the price on sale ("Renews yearly" for a subscription, "does not renew" for a
one-off), so it cannot claim one for the other.

## 31.2 How a membership becomes access — migration 0012

Before 0012 a paid membership was a `subscriptions` row and nothing else: no entitlement
existed, so a member could open and book nothing, and a one-year lump-sum member had no record
of access at all.

```text
membership entitlement    resource_type 'membership', resource_id the tier.
                          One per subscription (source 'membership', source_id the
                          subscription) or per lump-sum order (source 'purchase').
        ↓ sync_membership_entitlements, run by a trigger on that row
derived entitlements      what the tier includes: series (chosen, or all), playlists
                          (chosen, or all), retreats. source 'membership', source_id
                          the membership row, the same expires_at.
```

Every existing check — RLS, booking, the Academy — reads the derived rows unchanged. They are
re-derived on joining, renewing, choosing, lapsing and revocation, and are never deleted.

**Grace period: seven days** (`membership_grace_days()`). A subscriber's entitlement runs to
the end of the paid period plus seven days, while a failed renewal is retried. A member who
cancels keeps access to the end of the period they paid for: Stripe reports the subscription
ended on that date and the entitlement ends then. A lump-sum year has no grace. The seven
days are a suggested default the owner has not yet confirmed.

**Playlists** are the members' video library: `playlists` (public: name, description,
`min_tier`) and `playlist_videos` (members only). A video is addressed by provider and id and
its URL is built server-side for the one being played, as for lessons (§34.1). Delivered at
`/academy/playlists/[slug]`, newest first.

**The live Q&A** is `member_qa_sessions`, readable only by members whose tier includes it.
There is no booking: every such member sees the joining link in the usual window, and the
recording afterwards.

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

**One exception, for seeing only (2026-10-23):** staff holding `academy.view_all` see every
Academy resource without an entitlement (note 06 §23.2). It grants no action: booking,
registering, choosing and recording progress still follow entitlements.

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

**The lesson page's course contents (owner, 2026-10-15).** A bar above the lesson, at every
screen size, holds the back button to the course, the course progress and a "Course
contents" button; it scrolls with the page (the owner did not want it fixed). The button
opens the course outline as an off-canvas sheet that slides down from under the bar, the
lesson area's width rather than the screen's, over the dimmed page; Escape, the dimmed page,
the close button or choosing a lesson close it. This replaced a panel pinned at the right
edge from `xl` and an expanding box inside the page below it. The slide uses the shared
`.dropdown-panel` motion (`dropdown-from-top`, with `.dropdown-scrim`). The written lesson
under the video is a centred reading column.

**Lesson and module order (owner, 2026-10-15).** By `position`, and where two share one, by
when they were created, so tied rows can no longer swap places. Module order comes first,
then lesson order within it (the "continue" lesson on the Academy home had sorted the whole
course by lesson position alone, mixing modules). A lesson or module created in admin with
Position left empty goes last among its siblings (`appendPosition`).

**Lesson description (owner, 2026-10-15).** Under each lesson's title, a sentence or two on
what it covers ("In this lesson, you will learn …"), from `lessons.description` (migration
0038), editable on the admin Lesson form. The lesson's full text stays in `content`.

**Writing a lesson in admin (owner, 2026-10-15).** `content` stays Markdown (safe: the page
builds every element itself; portable; what the imported lessons already are). The admin
"Written content" box is an editor over it: a toolbar writes the codes (bold, italic, two
heading levels, bulleted and numbered lists, quote, link, and "Insert video", which writes
`:Youtube{videoID="…"}` / `:Vimeo{…}` / `:Livid{…}` from a pasted link or id), Ctrl/Cmd+B,
I and K, and Write / Preview / Side by side. The preview is laid out by `LessonBlocks`, the
same component the lesson page uses; only video differs (a labelled placeholder), because
players are built server-side in `LessonBody`. Admin text saves with `\n` line breaks.

**Lesson and module status (owner, 2026-10-15).** Learners see Published lessons in Published
modules only, enforced by RLS (migration 0039), so a Draft or Archived lesson is gone from the
course page, Course contents, previous/next and progress counts, and its address shows "not
found". Staff with `courses.read` still see everything. Deleting a lesson deletes every
learner's progress on it (the only thing that references a lesson); the admin delete box says
so and points to Archived as the way to retire a lesson and keep progress.

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
(migration 0002_security_and_reference_data). There is no stored URL for a forgotten `select *` to leak, and the course
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
Server Action (migration 0007_staff_accounts_and_lesson_video). A Server Action is a public endpoint: anyone with a session
can post any lesson id to it, and without the policy they could manufacture a completed
course they never had access to.

**"Complete and continue" (2026-09-26).** On any lesson but the last, one button records
completion and opens the next lesson. The Server Action accepts a `next` path and redirects
only if it matches `/academy/courses/<slug>/lessons/<slug>`, so it cannot be used as an
open redirect. Completion is still explicit; opening a lesson still records nothing.

## 34.3 Lesson body

Lesson `content` is **Markdown** (the migrated CMS's format), rendered by a small parser in
`src/lib/academy/lesson-markdown.ts`: `##`/`###` headings, `**bold**`, `*italic*`,
numbered and bulleted lists, quotes and http(s)/site-relative links — nothing else, and no
HTML is ever produced (blocks become React elements). It had been printed as plain
paragraphs, so learners read literal `###` and `**`. The old CMS's `:Youtube{videoID="…"}`
directive becomes a second player built by the same `server-only` video module as the main
one, so a malformed id still degrades to nothing (§34.1). The editor rule in Admin is
unchanged: a blank line separates paragraphs.


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

**Built 2026-09-26** as `/academy/cohorts/[cohortSlug]` (note 03 §20): overview, the next
workshop with its joining link, the remaining schedule, recordings (§23) and the cohort's
`benefits`. Participation/progress is not built — there is no attendance data yet.
Workshops are scheduled in Admin → Workshops.

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

**Joining window (2026-09-26).** A session's or workshop's `meeting_url` reaches the page
only from **15 minutes before the start until the end** (`JOIN_OPENS_MINUTES`), and for
Group Coaching **only for a confirmed booking**. Before the window the row says when the
link appears. This is presentation, not a security boundary: the database row is still
readable by anyone RLS lets see the session (including credit holders who haven't booked),
so `meeting_url` should be treated as shareable. Per-attendee links belong with the Zoom
item in `TO-CONNECT.md`. Sessions are scheduled in Admin → Sessions.

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


## 43.1 A product is created for what it sells (owner, 2026-10-15)

The thing sold comes first and its product second. Every product of a type
that sells one thing must name it when it is created, and the choice offers
only what has no product yet, so two products can never sell the same thing:

```text
membership        → a Coaching Pass tier       one product each
course            → a course                    one product each
cohort            → a cohort                    one product each
retreat           → a retreat                   one product each
event             → a paid event still to come  one product each
group_coaching    → a Group Coaching series     TWO: 1 session, and the series
private_coaching  → a one-to-one service        TWO: 1 session (first), then the pack
bundle, other     → nothing single; no choice
```

For the two-product kinds, "Sessions granted" says which of the two a product
is (more than one: the series or the pack), and a second product in the same
role is refused. A one-to-one pack can only be added once the service's
1-session product exists, because the pack is a pack of it.

Where each link is stored is unchanged, because fulfilment reads it there: on
the thing (`product_id`) for tiers, courses, cohorts, retreats, events and a
service's 1-session product; on the product for Group Coaching (`series_id`)
and a one-to-one pack (`pack_of`). The product form's choice writes to those
columns (`src/lib/admin/product-links.ts`). Each of those things' admin pages
shows its product(s) and offers "Create a product for this …", which opens the
product form with the type and the choice filled in. The link is set from the
product side only: those pages no longer have a Product dropdown of their own.

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
| 2026-09-27 | §27: private coaching implemented — choose a time, pay, booking confirmed from the entitlement; delivered in the Academy's Coaching area next to Group Coaching (owner). |
| 2026-10-08 | §9, §10.1 (new), §14, §14.1 (new), §15, §26, §27, §31.2 (new): the coaching offer as confirmed with the owner. Memberships now grant access (membership entitlement → derived series, playlists, retreat); tier allowances are data; `benefits` is each tier's full list; Ultimate withdrawn from sale; playlists and the members' Q&A built; group and private coaching sold as one session or a pack through product options, with a switch at every step; the group-session defect (£25 bought every series) closed; the Virtual Retreat set up at three levels with no date; capacities set in admin. Migrations 0011, 0012. |
| 2026-10-08 | §10.1, §12.1 (new): Group Coaching runs in terms of about three months — eight weekly sessions of every series, starting again each term — and a member whose tier includes a number of series chooses them each term (owner). `coaching_terms`; a series choice carries a term and is read by `member_holds_session` rather than derived into an entitlement; admin gains Coaching terms and Schedule a series. Yearly membership is a renewing subscription; the retreat is for yearly Platinum members; cohorts, retreats and events are listed while upcoming or in progress and dropped once ended. Migration 0013. |
| 2026-10-09 | §14: Group Coaching sessions are for the series they were bought on — £25 for one session of a series, £130 for eight of it within three months (owner). Each series has its own two products, `products.series_id` names the series, and booking, visibility and the buy-again check all follow it. §27: private coaching is paid for first and booked afterwards, for one session as for a pack. Migration 0014. |
| 2026-10-09 | §14.2 (new): Group Coaching series run between dates and are registered for before they start. `coaching_runs`, `coaching_registrations`; £130 buys a place on a run (a seat in all eight sessions, no booking), £25 one session of it; both sold only while a run is open for registration; a full run closes and a second may be opened. Members unchanged. Migrations 0015, 0016. |
| 2026-10-09 | §16.2 (new): cohort intakes. A cohort is fixed and each running of it is an intake with its own dates, registration period, places and workshops; the intake decides whether the cohort can be joined; the price buys a place on one intake. `cohort_intakes`, `cohort_enrolments`, `cohort_workshops.intake_id`. Migration 0017. |
| 2026-10-14 | §16.1: AMENDED (owner; migration 0029). Pass tiers and cohort levels are text codes, so new ones can be created from admin under a new unique name; this deliberately departs from "two distinct types", whose purpose is kept by separate tables, foreign keys and rank-based order. |
| 2026-10-14 | §26.1 (new): retreat batches (migration 0030). A retreat is fixed; each running is a batch with its own dates, places and joining link; places are on a batch; buying places the buyer on the open batch. `retreat_access` removed. |
| 2026-10-14 | §26.1: a retreat level is unique (migration 0031) and locked once set in admin. |
| 2026-10-14 | §26.2 (new): online applications for by-interview retreats, per batch (migration 0032); awaiting approval, approval email, approval for one batch only. |
| 2026-10-15 | §34: lesson page course contents moved to a sticky top bar at every size, opening as an off-canvas sheet from the top; the right-edge panel and the in-page disclosure removed. |
| 2026-10-15 | §34: lesson bar scrolls with the page; sheet is the lesson area's width; lesson text centred. Order ties broken by creation time; module order respected in the "continue" lesson; empty Position in admin puts a lesson/module last. |
| 2026-10-15 | §34: lesson pages show the lesson description under the title. |
| 2026-10-15 | §34: admin lesson editor (toolbar + preview over Markdown); lesson layout split into shared `LessonBlocks` with server-only video in `LessonBody`. |
| 2026-10-15 | §34: lesson and module statuses respected for learners; lesson delete wording made accurate. |
