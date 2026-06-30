-- V21/P7.ae — Offline Mode (store pause), proper boolean column.
--
-- When a seller flips Offline Mode on, ALL their offers are taken down
-- (hidden from buyers + not purchasable) until they toggle back. Their
-- listings are preserved, just not visible. This is distinct from the
-- auto-managed `is_online` presence dot (which flips on activity) and
-- from `status_message` (free-text status).
--
-- Replaces the interim `status_message = '__store_paused__'` sentinel
-- the app used before this column existed.

ALTER TABLE seller_presence
  ADD COLUMN IF NOT EXISTS store_paused boolean NOT NULL DEFAULT false;

-- Partial index: the buyer-side "exclude paused sellers" lookup only ever
-- reads WHERE store_paused = true, and the paused set is tiny relative to
-- all sellers. A partial index keeps that read O(paused-count) and the
-- index itself near-empty, so it costs almost nothing to maintain.
CREATE INDEX IF NOT EXISTS seller_presence_store_paused_idx
  ON seller_presence (seller_id)
  WHERE store_paused = true;

-- Backfill: migrate any sellers paused via the old text sentinel to the
-- new boolean, then clear the sentinel so status_message is clean again.
UPDATE seller_presence
  SET store_paused = true
  WHERE status_message = '__store_paused__';

UPDATE seller_presence
  SET status_message = NULL
  WHERE status_message = '__store_paused__';
