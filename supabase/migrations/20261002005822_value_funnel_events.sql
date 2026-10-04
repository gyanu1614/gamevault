-- Bundle 2 task E: value page → listing funnel events.
--
-- First-party because Vercel Analytics custom events can't be joined to
-- orders. No personal data by construction: enums, slugs and a listing uuid
-- only — no user id, IP, cookie or free text. Written by POST
-- /api/events/value (service role, IP rate-limited); read only by
-- `pnpm funnel:value`. RLS on with no policies + all grants revoked from
-- anon/authenticated = service role only.

CREATE TABLE IF NOT EXISTS public.value_funnel_events (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  event       text NOT NULL CHECK (event IN ('value_view', 'cta_click', 'fallback_shown', 'listing_opened')),
  surface     text NOT NULL CHECK (surface IN ('value_item', 'calculator', 'item_buy')),
  game_slug   text NOT NULL CHECK (char_length(game_slug) <= 128),
  item_slug   text CHECK (char_length(item_slug) <= 128),
  variant     text CHECK (char_length(variant) <= 128),
  state       text CHECK (state IN ('in_stock', 'other_variants', 'none')),
  listing_id  uuid
);

CREATE INDEX IF NOT EXISTS value_funnel_events_created_idx ON public.value_funnel_events (created_at);
CREATE INDEX IF NOT EXISTS value_funnel_events_listing_idx
  ON public.value_funnel_events (listing_id, created_at) WHERE event = 'listing_opened';

ALTER TABLE public.value_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.value_funnel_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.value_funnel_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.value_funnel_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.value_funnel_events_id_seq TO service_role;

-- One row per day × game: views → clicks → listing opens → paid orders.
-- An order counts when it was PAID within 24 h after a value-surface open of
-- the same listing (each order once, on the day of its first qualifying open).
CREATE OR REPLACE VIEW public.value_funnel_daily
  WITH (security_invoker = true) AS
WITH ev AS (
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, game_slug,
         count(*) FILTER (WHERE event = 'value_view')     AS value_views,
         count(*) FILTER (WHERE event = 'cta_click')      AS cta_clicks,
         count(*) FILTER (WHERE event = 'fallback_shown') AS fallbacks_shown,
         count(*) FILTER (WHERE event = 'listing_opened') AS listings_opened
  FROM public.value_funnel_events
  GROUP BY 1, 2
),
attributed AS (
  SELECT DISTINCT ON (o.id) o.id AS order_id, e.game_slug, (e.created_at AT TIME ZONE 'UTC')::date AS day
  FROM public.value_funnel_events e
  JOIN public.orders o
    ON o.listing_id = e.listing_id
   AND o.paid_at IS NOT NULL
   AND o.paid_at >= e.created_at
   AND o.paid_at <  e.created_at + interval '24 hours'
  WHERE e.event = 'listing_opened'
  ORDER BY o.id, e.created_at
),
ord AS (
  SELECT day, game_slug, count(*) AS orders FROM attributed GROUP BY 1, 2
)
SELECT ev.day, ev.game_slug,
       ev.value_views::int, ev.cta_clicks::int, ev.fallbacks_shown::int, ev.listings_opened::int,
       COALESCE(ord.orders, 0)::int AS orders
FROM ev
LEFT JOIN ord ON ord.day = ev.day AND ord.game_slug = ev.game_slug;

REVOKE ALL ON TABLE public.value_funnel_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.value_funnel_daily TO service_role;
