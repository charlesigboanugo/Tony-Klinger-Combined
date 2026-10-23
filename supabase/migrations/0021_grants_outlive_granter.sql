-- =============================================================================
-- 0021 — Access a staff member gave outlives their account
-- =============================================================================
--
-- Found in the end-to-end test, 2026-10-23. `entitlements.granted_by` is
-- `on delete set null`, but the check `entitlements_admin_grants_have_a_reason`
-- insisted every admin grant keep a non-null `granted_by`. Deleting an account
-- that had ever given access therefore failed in the database: the delete
-- tried to blank the name and the check refused it. Any former admin (roles
-- removed, account to be closed) could never be deleted.
--
-- Who gave access is required WHEN it is given, not for ever. The check now
-- asks only for the reason, which belongs to the grant itself; a trigger
-- requires `granted_by` on INSERT, so a grant can still never be made without
-- naming who made it. The audit log keeps the action, its reason and when it
-- happened after the account is gone (note 06 §31).
-- =============================================================================

alter table public.entitlements
  drop constraint if exists entitlements_admin_grants_have_a_reason;

alter table public.entitlements
  add constraint entitlements_admin_grants_have_a_reason check (
    source_type <> 'admin_grant'
      or (grant_reason is not null and length(trim(grant_reason)) > 0)
  );

create or replace function public.admin_grants_name_the_granter()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = 'admin_grant' and new.granted_by is null then
    raise exception 'an admin grant must name who made it'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists entitlements_admin_grants_name_the_granter on public.entitlements;
create trigger entitlements_admin_grants_name_the_granter
  before insert on public.entitlements
  for each row execute function public.admin_grants_name_the_granter();
