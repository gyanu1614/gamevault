-- Fee Structure Implementation Spec (12 Jul 2026) — DB side. Idempotent.
--
-- 1) Auto-release trigger: the app now computes the per-category
--    protection window (lib/fees protectionWindowHours) and supplies
--    auto_release_at when marking delivered. The trigger keeps the 48h
--    interval ONLY as a fallback when the app didn't provide one, so it
--    no longer clobbers category windows (accounts 5/7/14 days etc.).

CREATE OR REPLACE FUNCTION set_vaultshield_level_and_evidence()
RETURNS TRIGGER AS $$
BEGIN
  -- Value-tier + evidence rules (unchanged)
  IF NEW.subtotal >= 500 THEN
    NEW.vaultshield_level = 'premium';
    NEW.delivery_evidence_required = true;
  ELSIF NEW.subtotal >= 100 THEN
    NEW.vaultshield_level = 'enhanced';
    NEW.delivery_evidence_required = true;
  ELSE
    NEW.vaultshield_level = 'standard';
    NEW.delivery_evidence_required = false;
  END IF;

  -- Auto-release timer on transition to delivered: honour the app-supplied
  -- per-category window; fall back to 48h only when none was provided.
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    NEW.seller_marked_delivered_at = now();
    IF NEW.auto_release_at IS NULL THEN
      NEW.auto_release_at = now() + interval '48 hours';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Withdrawal fees per spec §3: fiat 1.5% + $2, crypto 3% + $10,
--    $100 minimum on the requested amount before fees.
UPDATE public.withdrawal_methods
SET fee_percentage = 1.5, fee_fixed = 2.00, min_withdrawal = 100.00
WHERE method_type = 'fiat';

UPDATE public.withdrawal_methods
SET fee_percentage = 3.0, fee_fixed = 10.00, min_withdrawal = 100.00
WHERE method_type = 'crypto';
