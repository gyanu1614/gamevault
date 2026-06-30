-- ============================================================
-- HOTFIX: allow the `refunded` order status transition
-- Created: 2026-06-28
-- Purpose:
--   The escrow state machine (20260217_escrow_state_machine.sql) never
--   included `refunded` in its allowed-transition map. As a result:
--     • A full-refund dispute resolution sets orders.status = 'refunded'
--       (admin-disputes.ts:417) → trigger RAISEs 'Invalid order status
--       transition: disputed → refunded'. The error is swallowed as
--       "non-fatal", so the buyer is refunded but the order is left
--       stuck in `disputed`. State integrity is lost on every full refund.
--     • Cancellation/refund paths (orders.ts:725, order-cancellation.ts:426)
--       set escrow_status='refunded' on active orders with the same hazard.
--
--   This migration widens `is_valid_order_transition` to permit `refunded`
--   from the states that can legitimately reach it, and makes `refunded`
--   terminal (no transitions out). Idempotent: pure CREATE OR REPLACE.
--
--   Allowed transitions AFTER this migration:
--     pending       → paid, cancelled
--     paid          → delivering, delivered, disputed, cancelled, refunded
--     delivering    → delivered, disputed, cancelled, refunded
--     delivered     → completed, disputed, refunded
--     disputed      → completed, cancelled, refunded
--     completed     → (terminal)
--     cancelled     → (terminal)
--     refunded      → (terminal)   ← new terminal state
-- ============================================================

CREATE OR REPLACE FUNCTION is_valid_order_transition(
  old_status TEXT,
  new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Terminal states — no transitions allowed (refunded is now terminal too)
  IF old_status IN ('completed', 'cancelled', 'refunded') THEN
    RETURN FALSE;
  END IF;

  -- Same status — allow (idempotent updates to other columns)
  IF old_status = new_status THEN
    RETURN TRUE;
  END IF;

  RETURN CASE old_status
    WHEN 'pending'    THEN new_status IN ('paid', 'cancelled')
    WHEN 'paid'       THEN new_status IN ('delivering', 'delivered', 'disputed', 'cancelled', 'refunded')
    WHEN 'delivering' THEN new_status IN ('delivered', 'disputed', 'cancelled', 'refunded')
    WHEN 'delivered'  THEN new_status IN ('completed', 'disputed', 'refunded')
    WHEN 'disputed'   THEN new_status IN ('completed', 'cancelled', 'refunded')
    ELSE FALSE
  END;
END;
$$;

COMMENT ON FUNCTION is_valid_order_transition(TEXT, TEXT)
  IS 'Returns TRUE if old_status → new_status is a permitted escrow state machine transition. Includes `refunded` (terminal) as of 20260628.';

-- Note: validate_order_status_transition() already auto-stamps completed_at /
-- cancelled_at. `refunded` orders carry completed_at set by the app
-- (admin-disputes.ts sets completed_at on the same UPDATE), so no trigger
-- change is needed here.
