-- =============================================================================
-- 0033 — Staff cancel an event ticket, paid or free
-- =============================================================================
--
-- Owner (Charles), 2026-11-13. A paid ticket cannot be cancelled from the
-- account (0009: giving it up is a refund question, handled by a person), and
-- staff had no way to do it either: only directly in the database. Admin →
-- Check-in now has a Cancel button on each ticket, which calls this.
--
-- One transaction: the booking is cancelled, the reason is written to the
-- audit log, and the holder is emailed. The existing trigger on a cancelled
-- event booking (0009) tells the next person on the waiting list. The Zoom
-- link (0031) is removed by the server straight after.
--
-- A refund is NOT made here: payments are refunded in Stripe (Admin →
-- Payments says so), and the button tells staff that for a paid ticket.
-- =============================================================================

create or replace function public.staff_cancel_event_ticket(p_booking_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_event record;
  v_email text;
  v_reason text := nullif(trim(p_reason), '');
begin
  if not public.has_permission('events.update') then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if v_reason is null then
    return jsonb_build_object('status', 'no_reason');
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and bookable_type = 'event'
  for update;

  if v_booking is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_booking.status = 'cancelled' then
    return jsonb_build_object('status', 'already', 'eventId', v_booking.bookable_id, 'reference', v_booking.reference);
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where id = p_booking_id;

  insert into public.audit_logs (actor_user_id, action, resource_type, resource_id, reason, metadata)
  values (
    auth.uid(), 'event_ticket.cancel', 'bookings', p_booking_id::text, v_reason,
    jsonb_build_object('reference', v_booking.reference, 'event_id', v_booking.bookable_id, 'paid', v_booking.entitlement_id is not null)
  );

  select name, starts_at into v_event from public.events where id = v_booking.bookable_id;
  select email into v_email from auth.users where id = v_booking.user_id;

  if v_email is not null then
    perform public.enqueue_email(
      'event-ticket-cancelled:' || p_booking_id,
      'event_ticket_cancelled',
      v_email,
      jsonb_build_object(
        'reference', v_booking.reference,
        'title', v_event.name,
        'startsAt', v_event.starts_at,
        'paid', v_booking.entitlement_id is not null
      )
    );
  end if;

  return jsonb_build_object('status', 'ok', 'eventId', v_booking.bookable_id, 'reference', v_booking.reference);
end;
$$;

revoke all on function public.staff_cancel_event_ticket(uuid, text) from public, anon;
grant execute on function public.staff_cancel_event_ticket(uuid, text) to authenticated;
