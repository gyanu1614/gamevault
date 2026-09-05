-- Lock Moderation RPCs To Moderators. Idempotent.
--
-- approve_listing / reject_listing / request_listing_changes are SECURITY
-- DEFINER and were granted to anon + authenticated with NO internal check —
-- any logged-in user could call them directly and approve their own listing,
-- bypassing the server-action role gate entirely. This adds an in-function
-- guard (service_role, or an active admin/super_admin/moderator), revokes
-- anon, and gives change-requests real attribution columns (the old function
-- accepted admin_id and silently dropped it).

-- Guard helper: raises unless the caller is service_role or an active moderator.
CREATE OR REPLACE FUNCTION public.assert_moderator() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'super_admin', 'moderator')
  ) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'forbidden: moderator role required';
END;
$$;

-- Change-request attribution (was accepted as a parameter and discarded).
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS changes_requested_by uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.approve_listing(listing_id uuid, admin_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seller_id_var uuid;
BEGIN
  PERFORM public.assert_moderator();

  SELECT seller_id INTO seller_id_var
  FROM public.listings
  WHERE id = listing_id;

  UPDATE public.listings
  SET
    status = 'active',
    approved_by = admin_id,
    approved_at = now(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_listing(listing_id uuid, admin_id uuid, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.assert_moderator();

  UPDATE public.listings
  SET
    status = 'rejected',
    rejected_by = admin_id,
    rejected_at = now(),
    rejection_reason = reason,
    approved_by = NULL,
    approved_at = NULL
  WHERE id = listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_listing_changes(listing_id uuid, admin_id uuid, changes text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.assert_moderator();

  UPDATE public.listings
  SET
    status = 'changes_requested',
    moderation_notes = changes,
    changes_requested_by = admin_id,
    changes_requested_at = now(),
    approved_by = NULL,
    approved_at = NULL,
    updated_at = now()
  WHERE id = listing_id;
END;
$$;

-- anon has no business moderating anything.
REVOKE EXECUTE ON FUNCTION public.approve_listing(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_listing(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_listing_changes(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_moderator() FROM anon;
