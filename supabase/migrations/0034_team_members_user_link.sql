-- Link a team member to the user account they are.
--
-- `team_members` was an island: name, slug, role, bio, photo — with no
-- connection to `profiles` or `auth.users` at all. So the five people on
-- /about/team existed twice in the system if they also had accounts, and there
-- was no way to say "this user is on the team" or to reach a team member's
-- orders, entitlements or roles from their public entry.
--
-- NULLABLE, deliberately. Two things are being modelled and only one of them
-- requires an account:
--
--   a USER who is also shown publicly   -> user_id set
--   a person shown publicly, no account -> user_id null
--
-- All five existing rows are the second kind — Tony, Louize, Elaine, Jon and
-- Helen were seeded from the old site's copy and have no accounts. Making the
-- column NOT NULL would mean either inventing accounts for them or deleting
-- real published content, so it is optional and the admin links them when an
-- account exists.
--
-- UNIQUE, so one account cannot appear on the team page twice. Note 03 §37 —
-- one person, one address.
--
-- ON DELETE SET NULL rather than CASCADE: deleting an account must not silently
-- remove a published biography from the public site (note 08 §54). The entry
-- stays and simply stops being linked.

alter table public.team_members
  add column if not exists user_id uuid
  references auth.users (id) on delete set null;

create unique index if not exists team_members_user_id_key
  on public.team_members (user_id)
  where user_id is not null;

comment on column public.team_members.user_id is
  'The account this team member is, when they have one. Null for people shown '
  'on the site who do not hold an account. Being a team member is a PUBLIC '
  'presentation choice and is independent of staff roles: a team member need '
  'not be staff, and staff need not appear on the team page (note 06 §11).';

-- NOTHING IS LINKED AUTOMATICALLY.
--
-- An earlier draft of this migration tried to match seeded team members to
-- accounts by email. It could not: `team_members` has no email column, and the
-- join fell back to comparing an address against a display name, which is
-- meaningless. Guessing at identity is the same mistake the catalogue cover
-- work had to undo twice, and the stakes are higher here — a wrong link would
-- attach one person's orders and entitlements to another person's public
-- profile.
--
-- Linking is therefore an explicit act in /admin/users, performed by someone
-- who knows who these people are.
