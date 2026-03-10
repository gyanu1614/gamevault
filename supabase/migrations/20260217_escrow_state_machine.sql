-- ============================================================
-- P2.2: Database-Enforced Escrow State Machine
-- Created: 2026-02-17
-- Purpose:
--   - Add `version` column to orders for optimistic locking
--     (prevents race conditions on concurrent status updates)
--   - Create `validate_order_status_transition()` trigger function
--     that enforces the allowed state machine transitions
--   - Block invalid transitions at the DB level, not just app level
--
-- Allowed transitions:
--   pending       → paid, cancelled
--   paid          → delivered, disputed, cancelled
--   delivered     → completed, disputed
--   disputed      → completed, cancelled
--   completed     → (terminal — no transitions allowed)
--   cancelled     → (terminal — no transitions allowed)
-- ============================================================

-- ─── Step 0: Ensure completed_at / cancelled_at exist first ──
-- (must exist before trigger function references them)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;

-- ─── Step 1: Add version column for optimistic locking ────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN orders.version
  IS 'Optimistic lock version. Increment on every status change. App must read+write with version check.';

-- ─── Step 2: Define allowed status transitions ────────────────

-- A helper function that returns TRUE if the transition is valid
CREATE OR REPLACE FUNCTION is_valid_order_transition(
  old_status TEXT,
  new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Terminal states — no transitions allowed
  IF old_status IN ('completed', 'cancelled') THEN
    RETURN FALSE;
  END IF;

  -- Same status — allow (idempotent updates to other columns)
  IF old_status = new_status THEN
    RETURN TRUE;
  END IF;

  RETURN CASE old_status
    WHEN 'pending'    THEN new_status IN ('paid', 'cancelled')
    WHEN 'paid'       THEN new_status IN ('delivering', 'delivered', 'disputed', 'cancelled')
    WHEN 'delivering' THEN new_status IN ('delivered', 'disputed', 'cancelled')
    WHEN 'delivered'  THEN new_status IN ('completed', 'disputed')
    WHEN 'disputed'   THEN new_status IN ('completed', 'cancelled')
    ELSE FALSE
  END;
END;
$$;

COMMENT ON FUNCTION is_valid_order_transition(TEXT, TEXT)
  IS 'Returns TRUE if old_status → new_status is a permitted escrow state machine transition.';

-- ─── Step 3: Trigger function that enforces transitions ───────

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    -- Status unchanged — just increment version for other column changes
    NEW.version := OLD.version + 1;
    RETURN NEW;
  END IF;

  -- Validate the transition
  IF NOT is_valid_order_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION
      'Invalid order status transition: % → %. Order ID: %',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Increment version on every status change (optimistic locking)
  NEW.version := OLD.version + 1;

  -- Automatically set timestamps for terminal states
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
  END IF;

  -- Log the status transition to audit_logs
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    performed_by,
    created_at
  ) VALUES (
    'ORDER_STATUS_CHANGE',
    'orders',
    NEW.id::TEXT,
    jsonb_build_object('status', OLD.status, 'version', OLD.version),
    jsonb_build_object('status', NEW.status, 'version', NEW.version),
    auth.uid(),
    NOW()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_order_status_transition()
  IS 'P2.2: Enforces escrow state machine transitions. Blocks invalid status changes at DB level. Auto-increments version.';

-- ─── Step 4: Attach trigger to orders table ───────────────────

DROP TRIGGER IF EXISTS trg_validate_order_status ON orders;

CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE OF status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

COMMENT ON COLUMN orders.completed_at
  IS 'Timestamp when order reached completed state. Set automatically by trigger.';
COMMENT ON COLUMN orders.cancelled_at
  IS 'Timestamp when order reached cancelled state. Set automatically by trigger.';
