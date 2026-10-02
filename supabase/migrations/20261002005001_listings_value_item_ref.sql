-- Bundle 2 (value page → listing): store the listing → value item link.
--
-- Listings had no reference to a value item; value pages and buy pages guessed
-- from free-text titles in the browser. The link is now stored on the row and
-- set by ONE backend function (src/lib/value-listings/link.ts, the pure TS
-- matcher) right after a listing is created or edited. Pages read it.
--
--   value_item_slug   catalogue slug (sab brainrot / adopt_me_pets / values_items)
--   value_variant     SAB mutation slug ('default' = base), Adopt Me potion
--                     key ('neon', 'fly-ride', …), or NULL when the listing
--                     doesn't say
--   value_matched_at  when the matcher last ran; NULL = needs (re)matching,
--                     which is what the nightly reconcile job picks up. Matched
--                     with no item = value_item_slug NULL + value_matched_at set.
--
-- Safety net (trigger below):
--   · an untrusted INSERT cannot claim an item (seller PostgREST inserts are
--     already coerced to pending_approval by AUTH-031; UPDATE is revoked for
--     JWT callers by 20260925204757, so the UPDATE branch is defence in depth)
--   · a change to title / template_data / game / category clears a stale
--     link so a listing never shows on the wrong item page — unless the same
--     trusted statement writes a fresh link (value_matched_at changes)
-- Writing these columns touches no moderation input (title, description,
-- images, template_data, status), so linking never bounces a listing into
-- review, and listings has no updated_at trigger.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS value_item_slug text,
  ADD COLUMN IF NOT EXISTS value_variant text,
  ADD COLUMN IF NOT EXISTS value_matched_at timestamptz;

-- Value pages read live stock per (game, item); the partial index keeps it to
-- the rows that can show.
CREATE INDEX IF NOT EXISTS listings_value_item_active_idx
  ON public.listings (game_id, value_item_slug, value_variant)
  WHERE status = 'active' AND value_item_slug IS NOT NULL;

-- The reconcile job's queue.
CREATE INDEX IF NOT EXISTS listings_value_unmatched_idx
  ON public.listings (created_at)
  WHERE value_matched_at IS NULL;

CREATE OR REPLACE FUNCTION public.listings_value_ref_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trusted boolean := public.guarded_write_allowed();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_trusted THEN
      NEW.value_item_slug := NULL;
      NEW.value_variant := NULL;
      NEW.value_matched_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: an untrusted caller can never move the link.
  IF NOT v_trusted THEN
    NEW.value_item_slug := OLD.value_item_slug;
    NEW.value_variant := OLD.value_variant;
    NEW.value_matched_at := OLD.value_matched_at;
  END IF;

  IF (NEW.title IS DISTINCT FROM OLD.title
      OR NEW.template_data IS DISTINCT FROM OLD.template_data
      OR NEW.game_id IS DISTINCT FROM OLD.game_id
      OR NEW.game_category_id IS DISTINCT FROM OLD.game_category_id)
     AND NOT (v_trusted AND NEW.value_matched_at IS DISTINCT FROM OLD.value_matched_at)
  THEN
    NEW.value_item_slug := NULL;
    NEW.value_variant := NULL;
    NEW.value_matched_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.listings_value_ref_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_listings_value_ref ON public.listings;
CREATE TRIGGER trg_listings_value_ref
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_value_ref_guard();
