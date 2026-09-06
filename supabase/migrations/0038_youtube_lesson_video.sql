-- YouTube joins vimeo and livid as a lesson video host.
--
-- The predecessor CMS holds all 41 course lesson videos as YouTube URLs, and
-- they stay there until they are re-uploaded to Livid (R29, owner's decision
-- 2026-09-05). Adding the provider is what makes "later" cost nothing: the row
-- names a host and an id, so the move is an update of two columns.
--
-- ============================================================================
-- WHAT YOUTUBE CANNOT DO, RECORDED SO IT IS NOT DISCOVERED LATER
-- ============================================================================
--
-- Withholding the URL server-side is a real control and this platform does it:
-- a lesson row is unreadable without a live entitlement, and the playable
-- address is composed only after that row comes back. But the guarantee stops
-- at the first person who copies the URL out of their own page.
--
--   Vimeo / Livid  can refuse to play except when embedded on our domains, so
--                  a leaked URL is worth little off-site.
--   YouTube        has NO domain restriction for unlisted video. The URL is
--                  the credential, it never expires, and it cannot be revoked
--                  except by taking the video down and re-uploading it.
--
-- That is the weakness README R29 option (b) names, and it is being accepted
-- deliberately as an interim state rather than overlooked. It is the reason the
-- move to Livid remains worth doing, and the reason this comment exists.

alter table public.lessons
  drop constraint if exists lessons_video_is_complete;

alter table public.lessons
  add constraint lessons_video_is_complete check (
    (video_provider is null and video_id is null)
    or (video_provider in ('vimeo', 'livid', 'youtube') and video_id is not null)
  );

comment on column public.lessons.video_provider is
  'vimeo, livid or youtube. Null for a lesson that is written material only. '
  'The playable URL is composed server-side after the entitlement check and is '
  'never stored, so moving provider is a data change (note 07 §34.1). YouTube '
  'is interim: unlisted YouTube cannot be domain-restricted, so a leaked URL '
  'plays anywhere for ever (R29).';
