-- Queue alerts reach moderators (plan 2, phase 1).
--
-- The new-listing, resubmitted-listing and report alerts ask for the permission listings.moderate,
-- which had no rows in role_permissions, so only admins were told. Moderators who work the queue
-- heard nothing. Giving the permission rows makes the existing alerts reach them.

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('super_admin', 'listings.moderate'),
  ('admin', 'listings.moderate'),
  ('moderator', 'listings.moderate')
ON CONFLICT (role, permission) DO NOTHING;
