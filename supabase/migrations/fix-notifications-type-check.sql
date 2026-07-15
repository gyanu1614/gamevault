-- notifications.type CHECK constraint fix (2026-07-14).
--
-- The launch-era constraint only allowed 8 values:
--   new_order, order_delivered, order_completed, new_message,
--   review_received, payout_completed, dispute_opened, system
-- Every notification type added since is silently rejected at insert
-- (comms blocks deliberately swallow errors), which was verified against
-- the live DB. Affected: dispute_resolved, seller_restricted/banned/
-- unrestricted, new_seller_application, fraud_alert_*, inform_*, and the
-- 2026-07-14 email arc (order_refunded, order_cancelled, chargeback_opened,
-- listing_approved/rejected/changes_requested, withdrawal_approved/rejected).
--
-- Types are app-defined labels that evolve with every feature; the CHECK
-- adds no real integrity, so drop it rather than chase it forever.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
