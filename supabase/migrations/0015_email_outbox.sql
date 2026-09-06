-- 0015 — Email outbox.
-- Architecture: note 09 §42, §43, §47, §56; note 08 §53.
--
-- Email is not the source of truth for anything (note 09 §42): a booking exists
-- whether or not its confirmation was delivered. So sending is decoupled from
-- the business event that caused it.
--
-- The business transaction writes a ROW here and commits. Delivery happens
-- afterwards, and may fail and be retried without touching the order, booking
-- or entitlement that caused it. A provider outage delays receipts; it does not
-- roll back purchases.

create type public.email_status as enum ('pending', 'sent', 'failed', 'cancelled');

create table public.email_messages (
  id              uuid primary key default gen_random_uuid(),
  -- Natural key for the event that caused this message. Unique, so replaying a
  -- webhook cannot send a second copy of the same receipt (note 09 §21, §56).
  idempotency_key text not null unique,
  template        text not null,
  to_email        text not null,
  to_name         text,
  -- Template variables. Never store secrets or full card data here (note 09 §48).
  payload         jsonb not null default '{}'::jsonb,
  status          public.email_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  -- Set once delivery succeeds; a provider message id for later correlation.
  provider_message_id text,
  sent_at         timestamptz,
  -- Retries back off; this is when the sender may next pick it up.
  next_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index email_messages_pending_idx
  on public.email_messages (next_attempt_at)
  where status = 'pending';

create index email_messages_to_email_idx on public.email_messages (to_email);

create trigger email_messages_set_updated_at
  before update on public.email_messages
  for each row execute function public.set_updated_at();

-- Customers do not read the outbox; staff with the communications permission do.
alter table public.email_messages enable row level security;

create policy "email_messages: staff read"
  on public.email_messages for select
  using (public.has_permission('emails.read'));

/**
 * Queue a message, ignoring duplicates.
 *
 * Returns the row id, or null when this idempotency key has already been
 * queued — which is the correct outcome for a redelivered webhook.
 */
create or replace function public.enqueue_email(
  p_idempotency_key text,
  p_template text,
  p_to_email text,
  p_payload jsonb default '{}'::jsonb,
  p_to_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_messages
    (idempotency_key, template, to_email, to_name, payload)
  values
    (p_idempotency_key, p_template, p_to_email, p_to_name, p_payload)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

/** Claim a batch for sending, so two concurrent runs cannot send the same message. */
create or replace function public.claim_email_batch(p_limit integer default 20)
returns setof public.email_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.email_messages m
     set attempts = m.attempts + 1,
         -- Held for a minute so a crashed run does not immediately re-send.
         next_attempt_at = now() + interval '1 minute'
   where m.id in (
     select id from public.email_messages
      where status = 'pending'
        and next_attempt_at <= now()
      order by created_at
      limit p_limit
      -- SKIP LOCKED lets two senders run side by side without either waiting
      -- or duplicating (note 08 §65).
      for update skip locked
   )
  returning m.*;
end;
$$;

create or replace function public.mark_email_sent(p_id uuid, p_provider_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_messages
     set status = 'sent', sent_at = now(), provider_message_id = p_provider_id,
         last_error = null
   where id = p_id;
$$;

/** Record a failure, backing off exponentially and giving up after 5 attempts. */
create or replace function public.mark_email_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_messages
     set status = (case when attempts >= 5 then 'failed' else 'pending' end)::public.email_status,
         last_error = left(p_error, 500),
         next_attempt_at = now() + (interval '5 minutes' * power(2, least(attempts, 5)))
   where id = p_id;
$$;

revoke all on function public.enqueue_email(text, text, text, jsonb, text) from anon, authenticated;
revoke all on function public.claim_email_batch(integer) from anon, authenticated;
revoke all on function public.mark_email_sent(uuid, text) from anon, authenticated;
revoke all on function public.mark_email_failed(uuid, text) from anon, authenticated;
