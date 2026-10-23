-- =============================================================================
-- 0020 — Admins grant and revoke roles, except owner
-- =============================================================================
--
-- Owner, 2026-10-23: "it would be nice if admin can grant any role except
-- owner". `roles.manage` was owner-only (0002 left it out of the admin role
-- with `settings.update`), so an admin could not even give someone the Academy
-- viewer role (0019). Note 06 §13, §34.
--
-- The owner stays out of an admin's reach without any change to
-- `admin_set_role`: it already refuses to grant OR revoke the `owner` role for
-- anyone who is not an owner. Every grant and revoke still needs a reason, the
-- operator's second factor (`assert_admin_action`), and is written to the
-- audit log.
--
-- `settings.update` stays owner-only.
-- =============================================================================

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  join public.permissions p on p.name = 'roles.manage'
 where r.name = 'admin'
on conflict do nothing;
