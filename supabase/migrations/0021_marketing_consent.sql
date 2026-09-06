-- Marketing consent — UK GDPR lawful basis, PECR reg 22.
--
-- TWO DIFFERENT LEGAL BASES, and the difference is why this table exists
-- instead of a single boolean:
--
--   Newsletter   EXPLICIT OPT-IN. No sale involved, so no exemption applies.
--                Someone actively ticked a box, and we must be able to show
--                when, from where, and what they were shown.
--
--   Customers    SOFT OPT-IN. Details obtained in the course of a sale, for our
--                own similar products, with a refusal offered at the time and in
--                every message since. Not "no consent" — consent is presumed
--                only because the refusal was offered and declined.
--
-- Evidence is the whole point. A regulator asking "prove they agreed" is not
-- answered by a row that says `true`, so the wording shown and the page it was
-- shown on are recorded alongside the timestamp.
--
-- TRANSACTIONAL EMAIL IS NOT MARKETING and is deliberately NOT governed by this
-- table: receipts, membership activation, booking confirmations and guest-claim
-- links must keep sending to somebody who has unsubscribed from everything.

create type public.consent_source as enum (
  'newsletter_form',   -- explicit opt-in
  'checkout',          -- soft opt-in, offered at the point of sale
  'account_settings',  -- changed by the customer themselves
  'import'             -- pre-existing, basis recorded in `notes`
);

create table public.marketing_consents (
  id             uuid primary key default gen_random_uuid(),
  -- Keyed on email, not user_id: most newsletter subscribers never create an
  -- account, and a customer who later signs up must not become a second record.
  email          text not null,
  user_id        uuid references auth.users (id) on delete set null,

  source         public.consent_source not null,
  -- The exact wording shown. Consent to wording we cannot reproduce is not
  -- evidence of anything.
  consent_text   text,
  consent_url    text,

  granted_at     timestamptz not null default now(),
  -- Set when the person opts out HERE. An unsubscribe made in Brevo is
  -- authoritative regardless of this column — see the sync notes in
  -- src/lib/email/contacts.ts.
  withdrawn_at   timestamptz,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- One live record per address per source. A second newsletter signup updates
  -- the existing row rather than stacking duplicates.
  unique (email, source)
);

create index marketing_consents_email_idx on public.marketing_consents (lower(email));
create index marketing_consents_user_id_idx on public.marketing_consents (user_id);

create trigger marketing_consents_set_updated_at
  before update on public.marketing_consents
  for each row execute function public.set_updated_at();

alter table public.marketing_consents enable row level security;

-- No client insert or update policy. Consent is recorded by a Server Action
-- that has already verified the submission; an insert policy would let anyone
-- forge a consent record for somebody else's address.
create policy "a person sees their own consent record"
  on public.marketing_consents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff read consent records"
  on public.marketing_consents for select to authenticated
  using (public.has_permission('users.read'));

/**
 * Record an opt-in, or revive one previously withdrawn.
 *
 * Idempotent: submitting the newsletter form twice updates the existing row and
 * refreshes the evidence rather than creating a duplicate.
 */
create or replace function public.record_marketing_consent(
  p_email text,
  p_source public.consent_source,
  p_consent_text text default null,
  p_consent_url text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.marketing_consents
    (email, user_id, source, consent_text, consent_url, granted_at, withdrawn_at)
  values
    (lower(trim(p_email)), p_user_id, p_source, p_consent_text, p_consent_url, now(), null)
  on conflict (email, source) do update
    set granted_at   = now(),
        -- Re-consenting clears a previous withdrawal; this is a fresh opt-in.
        withdrawn_at = null,
        consent_text = coalesce(excluded.consent_text, public.marketing_consents.consent_text),
        consent_url  = coalesce(excluded.consent_url, public.marketing_consents.consent_url),
        user_id      = coalesce(excluded.user_id, public.marketing_consents.user_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_marketing_consent(text, public.consent_source, text, text, uuid)
  from anon, authenticated;

/** Withdraw consent for one address, across every source. */
create or replace function public.withdraw_marketing_consent(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.marketing_consents
     set withdrawn_at = now()
   where email = lower(trim(p_email))
     and withdrawn_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.withdraw_marketing_consent(text) from anon, authenticated;

/**
 * Who currently belongs on the Members list.
 *
 * A VIEW, not a stored list, because membership is dynamic: someone who lapses
 * must drop off, or they receive "your Gold benefits" months after leaving.
 *
 * Customers is deliberately NOT modelled this way. Soft opt-in rests on having
 * BOUGHT, not on currently holding a subscription, so a lapsed member remains a
 * customer and stays on that list.
 */
create or replace view public.active_member_emails as
  select distinct
         u.email,
         s.membership_tier
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
   where s.status = 'active'
     and u.email is not null;
