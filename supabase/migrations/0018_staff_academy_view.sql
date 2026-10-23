-- =============================================================================
-- 0018 — Staff view of the Academy
-- =============================================================================
--
-- Owner, 2026-10-23. Some staff need to see everything the Academy delivers
-- (every course and lesson, cohort workshops, Group Coaching sessions, the
-- members' Q&A, playlists and retreats) without buying it, and without being
-- able to do what a customer does with it: book, register, take a place, use up
-- a session or join a live session as an attendee. Note 06 §23.2.
--
-- SEEING IS A PERMISSION; DOING STILL NEEDS A PURCHASE. This migration adds
-- one permission, `academy.view_all`, and a read policy on each table that
-- holds delivered content. It deliberately does NOT touch the helpers that
-- decide access for actions (`has_active_entitlement`, `has_booking`,
-- `in_cohort`, `can_view_playlist`, `has_member_benefit`,
-- `has_retreat_batch_access`, the run and intake functions): those keep
-- answering "has this person bought it", so every booking, registration,
-- choice and progress write is refused for a staff member who has not, exactly
-- as for anyone else. No entitlements are created for staff, so reports,
-- reminder emails and seat counts never see them.
--
-- Held by: owner, admin, course_manager, coaching_manager, support_manager.
-- Not by content, booking, finance or communications managers, whose work does
-- not need the paid content. Recordings need no policy here: `resources` is
-- already readable by every staff role ("resources: staff read").
-- =============================================================================

insert into public.permissions (name, description) values
  ('academy.view_all', 'See everything in the Academy without buying it (view only)')
on conflict (name) do nothing;

-- Granted by name: the owner's blanket grant in 0002 covers only the
-- permissions that existed then.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  join public.permissions p on p.name = 'academy.view_all'
 where r.name in ('owner', 'admin', 'course_manager', 'coaching_manager', 'support_manager')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Read policies, one per table of delivered content
-- ---------------------------------------------------------------------------

create policy "course_modules: academy staff view"
  on public.course_modules for select using (public.has_permission('academy.view_all'));

create policy "lessons: academy staff view"
  on public.lessons for select using (public.has_permission('academy.view_all'));

create policy "cohort_workshops: academy staff view"
  on public.cohort_workshops for select using (public.has_permission('academy.view_all'));

create policy "gc_sessions: academy staff view"
  on public.group_coaching_sessions for select using (public.has_permission('academy.view_all'));

create policy "member_qa_sessions: academy staff view"
  on public.member_qa_sessions for select using (public.has_permission('academy.view_all'));

create policy "playlist_videos: academy staff view"
  on public.playlist_videos for select using (public.has_permission('academy.view_all'));

create policy "retreat_batches: academy staff view"
  on public.retreat_batches for select using (public.has_permission('academy.view_all'));
