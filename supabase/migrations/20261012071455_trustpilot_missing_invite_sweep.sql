-- Trustpilot invites: a safety sweep for completed orders with no invite row.
--
-- Since 20261011081050 the trigger can no longer fail loudly: an error
-- inside it is a WARNING and the completion commits WITHOUT an invite row.
-- The buyer-confirm and auto-release paths write the row themselves through
-- lib/trustpilot/invite.ts, but dispute/admin completions rely on the trigger
-- alone. So the daily cron also asks for recently completed orders that have
-- no row and runs them through the same seam, which records the outcome
-- (a dispute completion is recorded as skipped, nothing is emailed). Window is
-- chosen by the caller (3 days), so an old order never gets a late receipt.
--
-- trustpilot_settings.invites_tracked_since = when this migration ran: the
-- sweep never reaches back past it, so an order the OLD code already BCC'd
-- on its receipt cannot be swept and invited twice right after the deploy.
-- Not granted to anon/authenticated (only review_count is).

ALTER TABLE public.trustpilot_settings
  ADD COLUMN IF NOT EXISTS invites_tracked_since timestamptz NOT NULL DEFAULT now();

-- Service-role only (default posture from 20260913100000, restated).

CREATE OR REPLACE FUNCTION public.trustpilot_orders_missing_invite(p_since timestamptz, p_limit integer)
RETURNS TABLE (order_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
    FROM public.orders o
   WHERE o.status = 'completed'
     AND o.completed_at >= greatest(
           p_since,
           coalesce((SELECT s.invites_tracked_since FROM public.trustpilot_settings s WHERE s.id = 1), 'infinity'::timestamptz)
         )
     AND NOT EXISTS (SELECT 1 FROM public.trustpilot_invitations t WHERE t.order_id = o.id)
   ORDER BY o.completed_at
   LIMIT greatest(p_limit, 0);
$$;

REVOKE ALL ON FUNCTION public.trustpilot_orders_missing_invite(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trustpilot_orders_missing_invite(timestamptz, integer) TO service_role;
