// Sample schedule: cohorts, retreats and an event in each state the site
// treats differently, so the behaviour can be seen without waiting for real
// dates — and test accounts holding each product.
//
//   pnpm dev:samples                 # local: create them, or refresh their dates
//   pnpm dev:samples --remove        # local: take them all away again
//   pnpm samples:test                # the TEST deployment (owner, 2026-10-23)
//   pnpm samples:test --remove
//
// TWO PLACES ONLY, and never production. With no --env it is the local
// database (127.0.0.1:54322). With --env it reads SUPABASE_DB_URL from that
// file and refuses to run unless the address is the test Supabase project
// (scripts/lib/targets.mjs) — so pointing it at production stops before it
// connects. Every row is named "Sample – …" (or is a sample account on
// @test.local), which is how --remove finds them.
//
// THE TEST SITE IS PUBLIC, so there the accounts do not get password123: the
// env file must hold SAMPLE_ACCOUNT_PASSWORD, which is given only to the
// people testing. Clean-ups that would touch anything not made by this script
// (the email queue, sessions on no run) run locally only.
//
// Dates are set relative to NOW each time it runs. "In progress" rows are given
// a few days to run, so they stay in that state for a while; run it again to
// push every date forward.
//
//   state            cohort intake             retreat batch                 event
//   open to join     Silver (two intakes)      Level One (November)          (the existing sample events)
//   by interview     —                         Level Two (November)          —
//   fully booked     Platinum (12 of 12)       —                             —
//   in progress      Gold (Autumn)             Level Three                   Sample – running now
//   opens later      Gold (Spring)             —                             —
//   ended            —                         Level One (October)           (the existing Aug festival Q&A)
//
// ONLY THE REAL PRODUCTS (owner, 2026-10-23): samples add DATES — intakes,
// batches, runs, sessions — to the cohorts, retreat levels and series Tony
// sells, never products of their own, so a site holding samples shows exactly
// the real catalogue. (Earlier versions made sample retreats and sample series
// with their own products; those are cleared here.)
//
// Group Coaching (migration 0016): a run on each real series, one per state —
// Filmmaking open, Writing closed with single sessions on sale, Producing in
// progress and full, For All Filmmakers not open to everyone yet.
import postgres from "postgres";

import { target } from "./lib/targets.mjs";

// Local, or the TEST project only (scripts/lib/targets.mjs); never production.
const argv = process.argv.slice(2);
const { local, envFile, env, dbUrl, ssl } = target(argv);
const check = argv.includes("--check");
const PASSWORD = local ? "password123" : env.SAMPLE_ACCOUNT_PASSWORD;
if (!local && !check && (!PASSWORD || PASSWORD === "password123" || PASSWORD.length < 8)) {
  console.error(`${envFile} needs SAMPLE_ACCOUNT_PASSWORD (8+ characters, not password123): the test site is public.`);
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, onnotice: () => {}, ...(ssl ? { ssl } : {}) });
const remove = argv.includes("--remove");
console.log(local ? "Target: local database" : "Target: TEST project");

// --check: connect and count what is there, change nothing.
if (check) {
  try {
    const [c] = await sql`
      select (select max(version) from supabase_migrations.schema_migrations) as latest_migration,
             (select count(*) from public.products)::int as products,
             (select count(*) from auth.users where email like '%@test.local')::int as test_accounts,
             to_regclass('public.cohort_intakes') is not null and to_regclass('public.retreat_batches') is not null as schema_ready`;
    console.log(c);
    if (!c.schema_ready) console.log("The schema is behind: run `supabase db push --linked` before adding samples.");
  } finally {
    await sql.end();
  }
  process.exit(0);
}
/** Marks the sessions this script scheduled, so --remove takes those and no others. */
const SAMPLE_LINK = "https://example.com/sample-term";

try {
  if (remove) {
    await sql.begin(async (tx) => {
      // Entitlements and bookings are polymorphic (no foreign key), so they go first, by id.
      await tx`delete from entitlements where resource_type = 'cohort' and resource_id in (select id from cohorts where slug like 'sample-%')`;
      await tx`delete from entitlements where resource_type = 'retreat' and resource_id in (select id from retreats where slug like 'sample-%')`;
      await tx`delete from bookings where bookable_type = 'event' and bookable_id in (select id from events where slug like 'sample-%')`;
      await tx`delete from entitlements where resource_type = 'event' and resource_id in (select id from events where slug like 'sample-%')`;
      await tx`delete from event_waitlist where event_id in (select id from events where slug like 'sample-%')`;
      await tx`delete from bookings where bookable_type = 'group_coaching_session'
               and bookable_id in (select id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK})`;
      await tx`delete from coaching_runs where id in (
                 select distinct run_id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK} and run_id is not null)`; // and its registrations
      await tx`delete from group_coaching_sessions where meeting_url = ${SAMPLE_LINK}`;
      await tx`delete from cohort_intakes where label like 'Sample –%'`; // and the places on them
      await tx`delete from cohorts where slug like 'sample-%'`;
      await tx`delete from retreats where slug like 'sample-%'`;
      await tx`delete from retreat_batches where label like 'Sample –%'`; // and their places and applications
      await tx`delete from events where slug like 'sample-%'`;
      await tx`delete from products where slug like 'sample-cohort-%' or slug like 'sample-retreat-%'
                                       or slug like 'group-coaching-%-sample-series-%'`;
      // The ticket product, unless someone outside the samples has bought it.
      await tx`delete from products where slug = 'sample-online-talk-ticket'
               and not exists (select 1 from order_items oi where oi.product_id = products.id)`;
      await tx`delete from entitlements where resource_type in ('series_pass', 'group_coaching_session')
               and resource_id in (select id from group_coaching_series where slug like 'sample-series-%')`;
      await tx`delete from group_coaching_series where slug like 'sample-series-%'`;
      await tx`delete from playlist_videos where title like 'Sample –%'`;
      await tx`delete from member_qa_sessions where title like 'Sample –%'`;
      await tx`delete from cohort_workshops where title like 'Sample –%'`;
      // The test accounts, with everything they hold.
      // Every account this script makes: only-*, combo-*, seat-*, and the named few.
      const TEST = (
        await tx`select email from auth.users
                 where email like 'only-%@test.local' or email like 'combo-%@test.local'
                    or email like 'seat-%@test.local'
                    or email in ('fresh@test.local', 'renewing@test.local', 'lastmonths@test.local',
                                 'silver@test.local', 'platinum@test.local', 'series@test.local',
                                 'onetoone@test.local', 'courses@test.local', 'mixed@test.local')`
      ).map((r) => r.email);
      for (const t of ["bookings", "coaching_registrations", "cohort_enrolments", "membership_choices", "entitlements"]) {
        await tx`delete from ${tx(t)} where user_id in (select id from auth.users where email = any(${TEST}))`;
      }
      await tx`delete from payments where order_id in (select id from orders where user_id in (select id from auth.users where email = any(${TEST})))`;
      await tx`delete from orders where user_id in (select id from auth.users where email = any(${TEST}))`;
      await tx`delete from auth.users where email = any(${TEST})`;
      await tx`delete from bookings where bookable_type = 'private_coaching'
               and bookable_id in (select id from private_coaching_slots where notes = 'sample (local)')`;
      await tx`delete from private_coaching_slots where notes = 'sample (local)'`;
    });
    console.log("Sample intakes, retreat batches, series runs and the running event removed.");
  } else {
    await sql.begin(async (tx) => {
      // An account that signs in with PASSWORD (password123 locally). Made once,
      // then kept; its password is set again each run, so changing it here
      // reaches every sample account.
      const account = async (email, name) => {
        await tx`
          insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change,
            email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
          select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', ${email},
                 crypt(${PASSWORD}, gen_salt('bf')), now(), now(), now(),
                 '{"provider":"email","providers":["email"]}', ${tx.json({ display_name: name })}, '', '', '', '', '', '', '', ''
          where not exists (select 1 from auth.users where email = ${email})`;
        const [u] = await tx`select id from auth.users where email = ${email}`;
        await tx`update auth.users set encrypted_password = crypt(${PASSWORD}, gen_salt('bf')) where id = ${u.id}`;
        await tx`
          insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
          select gen_random_uuid(), ${u.id}, ${u.id}::text, ${tx.json({ sub: u.id, email })}, 'email', now(), now(), now()
          where not exists (select 1 from auth.identities where user_id = ${u.id})`;
        return u;
      };

      // ---- The seed's accounts, on the test site ---------------------------
      // seed.sql (loaded by a reset) makes six @test.local accounts with
      // password123. On the public test site they get the testers' password
      // instead (owner, 2026-10-24); locally they keep password123.
      if (!local) {
        await tx`update auth.users set encrypted_password = crypt(${PASSWORD}, gen_salt('bf'))
                 where email in ('owner@test.local', 'admin@test.local', 'support@test.local',
                                 'gold@test.local', 'expired@test.local', 'nobody@test.local')`;
      }

      // ---- People in the seats -------------------------------------------
      // A sample that is fully booked is full the way a real one is: its usual
      // number of places, each taken by a person (owner, 2026-10-13) — not one
      // place with one person in it. These accounts only hold those places.
      for (let i = 1; i <= 12; i++) {
        await account(`seat-${String(i).padStart(2, "0")}@test.local`, `Sample Member ${i}`);
      }

      // ---- Cohort intakes (migration 0017) -------------------------------
      // The cohorts are fixed; each running is an intake. One of each state,
      // on the real cohorts. Re-made each time, so a test place on a sample
      // intake goes with it. (Earlier versions of this script made whole sample
      // COHORTS instead; those are cleared here too.)
      await tx`delete from entitlements where resource_type = 'cohort' and resource_id in (select id from cohorts where slug like 'sample-%')`;
      await tx`delete from cohorts where slug like 'sample-%'`;
      await tx`delete from products where slug like 'sample-cohort-%'`;
      await tx`delete from cohort_intakes where label like 'Sample –%'`;

      const intakes = [
        // cohort, label, registration opens, starts, ends, places
        ["cohort-silver", "Sample – Spring intake", "-2 days", "21 days", "77 days", 12],
        ["cohort-silver", "Sample – Spring intake, evenings", "-2 days", "23 days", "79 days", 12],
        ["cohort-gold", "Sample – Autumn intake", "-40 days", "-14 days", "42 days", 12],
        ["cohort-gold", "Sample – Spring intake", "10 days", "45 days", "100 days", 12],
        ["cohort-platinum", "Sample – Spring intake", "-2 days", "28 days", "84 days", 12],
      ];
      for (const [slug, label, opens, starts, ends, capacity] of intakes) {
        await tx`
          insert into cohort_intakes (cohort_id, label, registration_opens_at, starts_at, ends_at, capacity, status)
          select id, ${label}, now() + ${opens}::interval, now() + ${starts}::interval, now() + ${ends}::interval, ${capacity}, 'published'
          from cohorts where slug = ${slug}`;
      }
      // All twelve of Platinum's places are taken, so it shows as fully booked.
      // Put there directly (as staff would), not bought.
      await tx`
        insert into cohort_enrolments (user_id, intake_id)
        select u.id, i.id from auth.users u, cohort_intakes i join cohorts c on c.id = i.cohort_id
        where u.email like 'seat-%@test.local' and c.slug = 'cohort-platinum' and i.label = 'Sample – Spring intake'`;

      // ---- Retreats: batches on the real levels --------------------------
      // The retreat levels are fixed; each running is a BATCH (migration 0030).
      // Level One is open to all; Two and Three are by interview. Removing the
      // samples leaves the levels with no batch: "date to be announced".
      // Sample retreats of their own, from earlier versions, go first.
      await tx`delete from entitlements where resource_type = 'retreat' and resource_id in (select id from retreats where slug like 'sample-%')`;
      await tx`delete from retreats where slug like 'sample-%'`; // and their batches
      await tx`delete from products where slug like 'sample-retreat-%'`;
      await tx`delete from retreat_batches where label like 'Sample –%'`; // and their places and applications

      const batches = [
        // retreat level, label, starts, ends, places
        ["virtual-retreat-level-1", "Sample – October", "-20 days", "-19 days -17 hours", null], // ended
        ["virtual-retreat-level-1", "Sample – November", "30 days", "30 days 7 hours", null], // open for booking
        ["virtual-retreat-level-2", "Sample – November", "30 days", "30 days 7 hours", 6], // by interview
        ["virtual-retreat-level-3", "Sample – This week", "-3 hours", "3 days", 6], // in progress
      ];
      for (const [slug, label, starts, ends, capacity] of batches) {
        await tx`
          insert into retreat_batches
            (retreat_id, label, registration_opens_at, starts_at, ends_at, capacity, join_url, status)
          select id, ${label}, now() + ${starts}::interval - interval '40 days',
                 now() + ${starts}::interval, now() + ${ends}::interval, ${capacity}, ${SAMPLE_LINK}, 'published'
          from retreats where slug = ${slug}`;
      }

      // ---- Group Coaching: series runs ------------------------------------
      // Series runs (migration 0016) on the four real series, one state each:
      //   Filmmaking          registration open
      //   Writing             series registration closed early: single sessions on sale
      //   Producing           in progress, every place taken: closed (below)
      //   For All Filmmakers  not open to everyone yet; open early to pass holders
      // Re-made each time, so anyone registered on a sample run is taken off it.
      await tx`delete from bookings where bookable_type = 'group_coaching_session'
               and bookable_id in (select id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK})`;
      await tx`delete from coaching_runs where id in (
                 select distinct run_id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK} and run_id is not null)`;
      await tx`delete from group_coaching_sessions where meeting_url = ${SAMPLE_LINK}`;

      const runs = [
        // series slug, first session, registration opens, label
        ["filmmaking", "14 days 16 hours", "-1 day", null],
        ["writing", "15 days 16 hours", "-1 day", null],
        ["producing", "-14 days 16 hours", "-40 days", null],
        // Opens to everyone in five days, so it is in the pass holders' early
        // window now (seven days ahead, migration 0026).
        ["for-all-filmmakers", "45 days 16 hours", "5 days", null],
      ];
      for (const [slug, first, opens, label] of runs) {
        await tx`select schedule_series_run(
          (select id from group_coaching_series where slug = ${slug}),
          date_trunc('day', now()) + ${first}::interval,
          now() + ${opens}::interval,
          8, 60, ${SAMPLE_LINK}, ${label}, null)`;
      }

      // Writing: registration for the series has closed ahead of its start,
      // so its sessions are sold singly (migration 0025).
      await tx`update coaching_runs set registration_closes_at = now() - interval '1 hour'
               where series_id = (select id from group_coaching_series where slug = 'writing')
                 and id in (select distinct run_id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK})`;

      // ---- Producing: in progress and full --------------------------------
      // Every one of its eight places is taken, so nothing is left to buy and
      // the series shows as closed. Sample series of their own, from earlier
      // versions, go first, with anything held on them.
      await tx`delete from entitlements where resource_type in ('series_pass', 'group_coaching_session')
               and resource_id in (select id from group_coaching_series where slug like 'sample-series-%')`;
      await tx`delete from products where slug like 'group-coaching-%-sample-series-%'`;
      await tx`delete from group_coaching_series where slug like 'sample-series-%'`; // and their runs
      await tx`
        insert into coaching_registrations (user_id, run_id, source)
        select u.id, r.id, 'staff'
        from auth.users u,
             (select id from coaching_runs
               where series_id = (select id from group_coaching_series where slug = 'producing')
                 and id in (select distinct run_id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK})
               limit 1) r
        where u.email like 'seat-%@test.local'
        order by u.email limit (select capacity from group_coaching_series where slug = 'producing')
        on conflict do nothing`;

      // ---- Coaching Pass content: playlist videos and Q&A dates ----------
      // So a pass holder's Academy is not empty. No video file is attached:
      // each shows as a title in its playlist. All can be deleted in admin
      // (Playlist videos, Q&A sessions), or with --remove.
      await tx`delete from playlist_videos where title like 'Sample –%'`;
      const videos = {
        filmmaking: ["Finding your first paid job", "What a producer looks for in a director", "Reading a budget"],
        writing: ["Writing a logline that sells", "From treatment to first draft"],
        producing: ["Raising the first money", "Choosing your partners", "Selling the finished film"],
        miscellaneous: ["A conversation about staying in the business", "Your questions answered"],
      };
      for (const [slug, titles] of Object.entries(videos)) {
        let position = 10;
        for (const [i, title] of titles.entries()) {
          await tx`
            insert into playlist_videos (playlist_id, title, description, video_duration_seconds, position, status, published_at)
            select id, ${`Sample – ${title}`}, 'Local sample. No video is attached.', ${(12 + i * 7) * 60}, ${position},
                   'published', now() - ${`${i * 9 + 2} days`}::interval
            from playlists where slug = ${slug}`;
          position += 10;
        }
      }

      await tx`delete from member_qa_sessions where title like 'Sample –%'`;
      await tx`
        insert into member_qa_sessions (title, description, starts_at, ends_at, meeting_url, status)
        values
          ('Sample – Q&A with Tony', 'Local sample. Send your questions in beforehand.',
           date_trunc('day', now()) + interval '12 days 18 hours', date_trunc('day', now()) + interval '12 days 19 hours',
           ${SAMPLE_LINK}, 'scheduled'),
          ('Sample – Q&A with Tony', 'Local sample.',
           date_trunc('day', now()) + interval '42 days 18 hours', date_trunc('day', now()) + interval '42 days 19 hours',
           ${SAMPLE_LINK}, 'scheduled'),
          ('Sample – Q&A with Tony (last month)', 'Local sample. A past Q&A: its recording would be here.',
           date_trunc('day', now()) - interval '18 days 6 hours', date_trunc('day', now()) - interval '18 days 5 hours',
           null, 'completed')`;

      // ---- Fresh, not stale: what earlier samples left behind ------------
      // Group sessions that belong to no run (sessions are a run's now),
      // with the bookings on them; cohort workshops on no intake; coaching
      // slots in the past; and the queue of emails nothing will send.
      if (local) {
        await tx`delete from bookings where bookable_type = 'group_coaching_session'
                 and bookable_id in (select id from group_coaching_sessions where run_id is null)`;
        await tx`delete from group_coaching_sessions where run_id is null`;
      }
      await tx`delete from cohort_workshops where title like 'Sample —%' or title like 'Sample –%'`;
      await tx`delete from bookings where bookable_type = 'private_coaching'
               and bookable_id in (select id from private_coaching_slots where notes = 'sample (local)')`;
      await tx`delete from private_coaching_slots where notes = 'sample (local)'`;
      // Locally the queue only ever holds what samples made; on the test site
      // it may hold real messages, so it is left alone there.
      if (local) await tx`delete from email_messages where status = 'pending'`;

      // Eight weekly workshops on the Gold cohort's intake that is under way:
      // two done, six to come.
      const topics = ["Finding your story", "Pitching to producers", "Budgets that get approved", "Casting on a shoestring",
                      "Shooting to a schedule", "The edit", "Festivals and distribution", "What comes next"];
      for (const [i, topic] of topics.entries()) {
        await tx`
          insert into cohort_workshops (cohort_id, intake_id, title, starts_at, ends_at, position, meeting_url, status)
          select i.cohort_id, i.id, ${`Sample – ${topic}`},
                 same_uk_time(date_trunc('day', i.starts_at) + interval '13 hours', ${i}),
                 same_uk_time(date_trunc('day', i.starts_at) + interval '16 hours', ${i}),
                 ${(i + 1) * 10}, ${SAMPLE_LINK},
                 case when same_uk_time(date_trunc('day', i.starts_at) + interval '16 hours', ${i}) < now() then 'completed' else 'scheduled' end
          from cohort_intakes i join cohorts c on c.id = i.cohort_id
          where c.slug = 'cohort-gold' and i.label = 'Sample – Autumn intake'`;
      }

      // One-to-one times to choose from: weekday afternoons over the next fortnight.
      await tx`
        insert into private_coaching_slots (service_id, starts_at, ends_at, status, notes)
        select s.id, t, t + make_interval(mins => s.duration_minutes), 'open', 'sample (local)'
        from private_coaching_services s,
             generate_series(date_trunc('day', now()) + interval '3 days 14 hours',
                             date_trunc('day', now()) + interval '16 days 14 hours', interval '1 day') t
        where s.slug = 'advanced-one-to-one' and extract(isodow from t) < 6`;

      // ---- Events ----------------------------------------------------------
      // Events are one-off listings, not a fixed catalogue, so samples may be
      // whole events (owner, 2026-10-23). These five were first made by hand in
      // the local database (2026-09-26) and were lost to a reset; they are made
      // here now, dated from today, so any reset or the test site can have them.
      //   past                Festival Q&A
      //   free, places left   Screening and Q&A (80 places)
      //   paid ticket         Online talk (£15, product sample-online-talk-ticket)
      //   free, fully booked  Film society evening (2 places, both taken)
      //   happening now       Festival weekend
      const [ticket] = await tx`
        insert into products (name, slug, product_type, description, status)
        values ('Sample – Online talk ticket', 'sample-online-talk-ticket', 'event', 'Local sample. A ticket for the sample online talk.', 'active')
        on conflict (slug) do update set status = 'active'
        returning id`;
      await tx`
        insert into prices (product_id, currency, amount, billing_type, active)
        select ${ticket.id}, 'GBP', 1500, 'one_time', true
        where not exists (select 1 from prices where product_id = ${ticket.id} and active)`;
      const day = (offset, time) => tx`(date_trunc('day', now()) + ${offset}::interval + ${time}::interval)`;
      const sampleEvents = [
        // slug, name, description, day, start, end, location, format, free, capacity, product
        ["sample-festival-qa", "Sample – Festival Q&A", "A Q&A at a film festival after a screening.",
          "-57 days", "19 hours", "21 hours", "Sample Festival, Brighton", "in_person", true, null, null],
        ["sample-screening-qa", "Sample – Screening and Q&A with Tony", "A screening followed by a conversation with Tony and questions from the audience.",
          "14 days", "19 hours", "22 hours", "Sample cinema, London", "in_person", true, 80, null],
        ["sample-online-talk", "Sample – How to get your film made (online talk)", "An hour online with Tony on getting a film financed and made.",
          "18 days", "18 hours 30 minutes", "19 hours 30 minutes", "Online, on Zoom", "online", false, null, ticket.id],
        ["sample-film-society", "Sample – Film society evening", "A small evening with a local film society. Two places only.",
          "43 days", "19 hours", "21 hours", "Sample film society, Bristol", "in_person", true, 2, null],
        ["sample-running-now", "Sample – Festival weekend (running now)", "Started yesterday and runs for two more days: stays on the programme, marked as happening now.",
          "-1 day", "0 hours", "72 hours", "Online, on Zoom", "online", true, null, null],
      ];
      for (const [slug, name, description, offset, start, end, location, format, free, capacity, productId] of sampleEvents) {
        await tx`
          insert into events (name, slug, description, starts_at, ends_at, location, format, is_free, capacity, product_id, status)
          values (${name}, ${slug}, ${description}, ${day(offset, start)}, ${day(offset, end)}, ${location}, ${format},
                  ${free}, ${capacity}, ${productId}, 'published')
          on conflict (slug) do update set
            name = excluded.name, description = excluded.description, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
            location = excluded.location, format = excluded.format, is_free = excluded.is_free, capacity = excluded.capacity,
            product_id = excluded.product_id, status = 'published'`;
      }
      // The film society's two places, each taken by a person.
      await tx`delete from bookings where bookable_type = 'event' and bookable_id = (select id from events where slug = 'sample-film-society')`;
      for (const seat of ["seat-11@test.local", "seat-12@test.local"]) {
        const [u] = await tx`select id from auth.users where email = ${seat}`;
        await tx`select set_config('request.jwt.claim.sub', ${u.id}, true)`;
        await tx`select register_for_event((select id from events where slug = 'sample-film-society'))`;
      }
      await tx`select set_config('request.jwt.claim.sub', '', true)`;

      // ---- The Gold test account's own purchases and bookings ------------
      // Made the way a customer makes them — an order, fulfilled, then the
      // booking function — so what the account shows is what the site does:
      //   two one-to-one sessions bought: one booked, one still to schedule
      //   one Group Coaching session bought for a date (Writing, sold singly)
      //   a free event place, with its ticket
      //   both series of its Gold Pass still to take
      const [gold] = await tx`select id from auth.users where email = 'gold@test.local'`;
      if (gold) {
        await tx`delete from bookings where user_id = ${gold.id}
                 and bookable_type in ('private_coaching', 'group_coaching_session', 'event')`;
        await tx`delete from entitlements where user_id = ${gold.id}
                 and resource_type in ('private_coaching', 'group_coaching_session', 'event')`;
        await tx`delete from payments where order_id in (select id from orders where user_id = ${gold.id})`;
        await tx`delete from orders where user_id = ${gold.id}`;

        const buy = async (slug, metadata = {}) => {
          const [order] = await tx`
            insert into orders (user_id, status, currency, subtotal, discount_total, total)
            select ${gold.id}, 'pending', 'GBP', pr.amount, 0, pr.amount
            from products p join prices pr on pr.product_id = p.id and pr.active where p.slug = ${slug}
            returning id, total`;
          await tx`
            insert into order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount, metadata)
            select ${order.id}, p.id, pr.id, p.name, pr.amount, 1, pr.amount, ${tx.json(metadata)}
            from products p join prices pr on pr.product_id = p.id and pr.active where p.slug = ${slug}`;
          await tx`select fulfil_order(${order.id}, ${`pi_sample_${order.id}`}, ${order.total})`;
        };

        // Sessions are bought one of each per order, so two orders for two.
        await buy("one-to-one-single");
        await tx`select set_config('request.jwt.claim.sub', ${gold.id}, true)`;
        await tx`select hold_private_coaching_slot(
          (select id from private_coaching_slots where notes = 'sample (local)' and status = 'open' order by starts_at offset 2 limit 1), 15)`;
        await buy("one-to-one-single");

        const [session] = await tx`
          select cs.id from coming_sessions((select id from group_coaching_series where slug = 'writing')) cs
          where cs.places_left > 0 order by cs.starts_at offset 1 limit 1`;
        if (session) await buy("group-coaching-single-writing", { session_id: session.id });

        // (The film society evening is the "fully booked" sample; this one has places.)
        await tx`select register_for_event((select id from events where slug = 'sample-screening-qa'))`;
        await tx`select set_config('request.jwt.claim.sub', '', true)`;
        // Its two series are left untaken, to register for by hand (owner, 2026-10-10).
      }

      // ---- Test accounts ---------------------------------------------------
      // Owner, 2026-10-10: an account holding ONE product, for every product,
      // then accounts holding combinations — to test each from whenever wanted.
      // All sign in with PASSWORD. Each is wiped and rebuilt here, so running
      // this again puts every one back to its starting point. Built the way a
      // customer builds it (an order, fulfilled; then the site's own
      // functions), so what an account shows is what the site would do.
      const buyFor = async (userId, slug, metadata = {}) => {
        const [order] = await tx`
          insert into orders (user_id, status, currency, subtotal, discount_total, total)
          select ${userId}, 'pending', 'GBP', pr.amount, 0, pr.amount
          from products p join prices pr on pr.product_id = p.id and pr.active where p.slug = ${slug}
          returning id, total`;
        if (!order) throw new Error(`No product to buy: ${slug}`);
        await tx`
          insert into order_items (order_id, product_id, price_id, product_name_snapshot, unit_amount, quantity, total_amount, metadata)
          select ${order.id}, p.id, pr.id, p.name, pr.amount, 1, pr.amount, ${tx.json(metadata)}
          from products p join prices pr on pr.product_id = p.id and pr.active where p.slug = ${slug}`;
        await tx`select fulfil_order(${order.id}, ${`pi_sample_${order.id}`}, ${order.total})`;
      };
      const as = async (userId, run) => {
        await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
        await run();
        await tx`select set_config('request.jwt.claim.sub', '', true)`;
      };
      // What can be bought, each as a step taking the account's id.
      const buy = {
        silver: (u) => buyFor(u, "membership-silver"),
        gold: (u) => buyFor(u, "membership-gold"),
        platinum: (u) => buyFor(u, "membership-platinum"),
        // The Filmmaking series is the one open to everyone, so the buyer is put on its run.
        series: (u) => buyFor(u, "group-coaching-x8-filmmaking"),
        // One session of Writing, whose series registration has closed so its
        // sessions are sold singly: bought for a date.
        session: async (u) => {
          const [dated] = await tx`
            select cs.id from coming_sessions((select id from group_coaching_series where slug = 'writing')) cs
            where cs.places_left > 0 order by cs.starts_at offset 2 limit 1`;
          if (dated) await buyFor(u, "group-coaching-single-writing", { session_id: dated.id });
        },
        oneToOne: (u) => buyFor(u, "one-to-one-single"),
        oneToOnePack: (u) => buyFor(u, "one-to-one-x8"),
        courseOne: (u) => buyFor(u, "course-level-one"),
        courseTwo: (u) => buyFor(u, "course-level-two"),
        cohortSilver: (u) => buyFor(u, "cohort-silver"),
        cohortGold: (u) => buyFor(u, "cohort-gold"),
        cohortPlatinum: (u) => buyFor(u, "cohort-platinum"),
        // Level One's November batch, the one open for booking.
        retreat: (u) => buyFor(u, "retreat-level-1"),
        ticket: (u) => buyFor(u, "sample-online-talk-ticket"),
        freeEvent: (u) => as(u, () => tx`select register_for_event((select id from events where slug = 'sample-screening-qa'))`),
      };
      // A pass moved so that its year ends in `endsIn`.
      const endPass = (u, endsIn) => tx`
        update entitlements set starts_at = now() + ${endsIn}::interval - interval '1 year', expires_at = now() + ${endsIn}::interval
        where user_id = ${u} and resource_type = 'membership'`;

      const TEST_ACCOUNTS = [
        // Nothing at all: a first purchase, or a cart of several things.
        ["fresh@test.local", "Nothing Bought", []],

        // ONE PRODUCT EACH.
        ["only-silver@test.local", "Only Silver Pass", [buy.silver]],
        ["only-gold@test.local", "Only Gold Pass", [buy.gold]],
        ["only-platinum@test.local", "Only Platinum Pass", [buy.platinum]],
        ["only-series@test.local", "Only A Series", [buy.series]],
        ["only-session@test.local", "Only A Single Session", [buy.session]],
        ["only-onetoone@test.local", "Only One To One Session", [buy.oneToOne]],
        ["only-onetoone8@test.local", "Only One To One Pack", [buy.oneToOnePack]],
        ["only-course1@test.local", "Only Course One", [buy.courseOne]],
        ["only-course2@test.local", "Only Course Two", [buy.courseTwo]],
        ["only-cohort-silver@test.local", "Only Silver Cohort", [buy.cohortSilver]],
        ["only-cohort-gold@test.local", "Only Gold Cohort", [buy.cohortGold]],
        ["only-cohort-platinum@test.local", "Only Platinum Cohort", [buy.cohortPlatinum]],
        ["only-retreat@test.local", "Only A Retreat", [buy.retreat]],
        ["only-ticket@test.local", "Only A Paid Ticket", [buy.ticket]],
        ["only-freeevent@test.local", "Only A Free Event Place", [buy.freeEvent]],

        // COMBINATIONS. Several of one kind first, then kinds together.
        ["combo-courses@test.local", "Both Courses", [buy.courseOne, buy.courseTwo]],
        ["combo-onetoone@test.local", "One To One Session And Pack", [buy.oneToOne, buy.oneToOnePack]],
        ["combo-cohorts@test.local", "Two Cohorts", [buy.cohortSilver, buy.cohortGold]],
        ["combo-series-session@test.local", "Series And A Single Session", [buy.series, buy.session]],
        ["combo-pass-series@test.local", "Silver Pass And A Bought Series", [buy.silver, buy.series]],
        ["combo-pass-onetoone@test.local", "Gold Pass And One To One Pack", [buy.gold, buy.oneToOnePack]],
        ["combo-pass-course-cohort@test.local", "Gold Pass Course And Cohort", [buy.gold, buy.courseOne, buy.cohortSilver]],
        ["combo-course-cohort-retreat@test.local", "Course Cohort And Retreat", [buy.courseTwo, buy.cohortSilver, buy.retreat]],
        ["combo-events@test.local", "Paid Ticket And Free Place", [buy.ticket, buy.freeEvent]],
        ["combo-everything@test.local", "One Of Everything", [
          buy.platinum, buy.series, buy.session, buy.oneToOnePack, buy.courseOne, buy.courseTwo,
          buy.cohortSilver, buy.retreat, buy.ticket, buy.freeEvent,
        ]],

        // PASSES AT A PARTICULAR MOMENT.
        // Ending in twenty days: it can be renewed, or another tier bought for next year.
        ["renewing@test.local", "Pass Ending Soon", [buy.gold, (u) => endPass(u, "20 days")]],
        // Three months left: too late to upgrade, too early to renew.
        ["lastmonths@test.local", "Pass In Its Last Months", [buy.silver, (u) => endPass(u, "3 months")]],
      ];

      // Accounts an earlier version of this script made under other names.
      const RETIRED = ["silver", "platinum", "series", "onetoone", "courses", "mixed"].map((n) => `${n}@test.local`);
      for (const t of ["bookings", "coaching_registrations", "cohort_enrolments", "membership_choices", "entitlements"]) {
        await tx`delete from ${tx(t)} where user_id in (select id from auth.users where email = any(${RETIRED}))`;
      }
      await tx`delete from payments where order_id in (select id from orders where user_id in (select id from auth.users where email = any(${RETIRED})))`;
      await tx`delete from orders where user_id in (select id from auth.users where email = any(${RETIRED}))`;
      await tx`delete from auth.users where email = any(${RETIRED})`;

      for (const [email, name, steps] of TEST_ACCOUNTS) {
        const u = await account(email, name);
        // Back to nothing, whatever was tested on it last time; then its products.
        await tx`delete from bookings where user_id = ${u.id}`;
        await tx`delete from coaching_registrations where user_id = ${u.id}`;
        await tx`delete from cohort_enrolments where user_id = ${u.id}`;
        await tx`delete from membership_choices where user_id = ${u.id}`;
        await tx`delete from entitlements where user_id = ${u.id}`;
        await tx`delete from payments where order_id in (select id from orders where user_id = ${u.id})`;
        await tx`delete from orders where user_id = ${u.id}`;
        for (const step of steps) await step(u.id);
      }

    });

    const rows = await sql`
      select 'intake' as kind, c.name || ' · ' || i.label as name, i.starts_at, i.ends_at
        from cohort_intakes i join cohorts c on c.id = i.cohort_id where i.label like 'Sample –%'
      union all select 'retreat', r.name || ' · ' || b.label, b.starts_at, b.ends_at
        from retreat_batches b join retreats r on r.id = b.retreat_id where b.label like 'Sample –%'
      union all select 'event', name, starts_at, ends_at from events where slug like 'sample-%'
      order by 1, 3`;
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
    for (const r of rows) console.log(`${r.kind.padEnd(8)} ${day(r.starts_at)} → ${day(r.ends_at)}  ${r.name}`);
    const [{ n }] = await sql`select count(*)::int as n from group_coaching_sessions where meeting_url = ${SAMPLE_LINK}`;
    const runRows = await sql`
      select g.name, r.label, r.registration_opens_at, r.registration_closes_at, r.starts_at from coaching_runs r
      join group_coaching_series g on g.id = r.series_id
      where r.id in (select distinct run_id from group_coaching_sessions where meeting_url = ${SAMPLE_LINK})
      order by g.name, r.starts_at`;
    for (const r of runRows) {
      const now = Date.now();
      const state = +new Date(r.starts_at) <= now ? "in progress"
        : +new Date(r.registration_opens_at) > now ? "registration not open yet"
        : r.registration_closes_at && +new Date(r.registration_closes_at) <= now ? "registration closed, single sessions on sale"
        : "registration open";
      console.log(`run      ${day(r.starts_at)}  ${r.name} · ${r.label}: ${state}`);
    }
    console.log(`         ${n} weekly sessions across those runs`);
    console.log("\nSee them at /coaching/group-coaching, /coaching/cohorts, /coaching/retreats, /events and (signed in) /academy.");
    console.log(`
Test accounts (password: ${local ? "password123" : "SAMPLE_ACCOUNT_PASSWORD from " + envFile}). Each is put back to this by running the script again.

  Nothing bought
    fresh@test.local

  One product each
    only-silver@test.local            Silver Pass
    only-gold@test.local              Gold Pass
    only-platinum@test.local          Platinum Pass
    only-series@test.local            the Filmmaking series (£130)
    only-session@test.local           one Writing session (£25), for a date
    only-onetoone@test.local          one one-to-one session
    only-onetoone8@test.local         the pack of eight one-to-one sessions
    only-course1@test.local           The Basics of Movie Production
    only-course2@test.local           How to Get Your Movie Made
    only-cohort-silver@test.local     Silver cohort place (two intakes open: choose one)
    only-cohort-gold@test.local       Gold cohort place (next intake not open yet: waits)
    only-cohort-platinum@test.local   Platinum cohort place (intake full: waits)
    only-retreat@test.local           a place on Virtual Retreat Level One (November)
    only-ticket@test.local            a paid event ticket
    only-freeevent@test.local         a free event place

  Combinations
    combo-courses@test.local                 both courses
    combo-onetoone@test.local                one session + the pack of eight
    combo-cohorts@test.local                 Silver and Gold cohort places
    combo-series-session@test.local          a series + a single session of another
    combo-pass-series@test.local             Silver Pass + a series bought as well
    combo-pass-onetoone@test.local           Gold Pass + the one-to-one pack
    combo-pass-course-cohort@test.local      Gold Pass + a course + a cohort place
    combo-course-cohort-retreat@test.local   a course + a cohort place + a retreat
    combo-events@test.local                  a paid ticket + a free place
    combo-everything@test.local              one of everything, with a Platinum Pass

  Passes at a particular moment
    renewing@test.local               Gold Pass ending in 20 days
    lastmonths@test.local             Silver Pass with 3 months left

  gold@test.local (the seed account) has a Gold Pass with extras; see the notes above.

  seat-01 … seat-12@test.local hold the places on the fully booked samples
  (Producing's 8, the Platinum intake's 12). Nothing to test on them.
`);
    console.log(local ? "Remove with: pnpm dev:samples --remove" : "Remove with: pnpm samples:test --remove");
  }
} finally {
  await sql.end();
}
