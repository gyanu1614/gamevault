-- Currency price rules: owner decisions 2026-10-04 (data only, idempotent).
--
-- 1. Grow a Garden: minimum price = $0.00001 per single unit.
--    category_configs.config.price_floor is stored PER LISTING UNIT
--    (quantity_granularity: per unit / per K / per M — the unit
--    listings.price is stored in, see src/lib/currency/price-rules.ts), so
--    the per-unit $0.00001 is scaled to that unit: per K → $0.01, per M → $10.
--    (Prod 2026-10-04: granularity 'thousand', price_floor 1 → 0.01 per K.)
--
-- 2. Fortnite V-Bucks + R6 Siege Credits (bundle currencies): drop the $10
--    per-bundle minimum so normal small bundles can be listed.
--    Both rows still carry the pre-2026-10-04 shape: price_floor 10 (read as
--    the per-bundle minimum while bundle_price_min is absent) and the old
--    form's default price_ceiling 10 (which the pre-release validator still
--    enforces as a cap — together they pinned every bundle at exactly $10).
--    Written as the explicit post-2026-10-04 keys, exactly what
--    priceRulesForSave writes for "no rule": price_floor 0, price_max null,
--    bundle_price_min null, bundle_price_max kept, price_ceiling removed.
--    Both the released and the new validator then see no bundle minimum.
--
-- No functions, no grants. Rows that don't exist (fresh local stack) are
-- skipped; the DO block below checks whatever exists.

-- 1. Grow a Garden minimum (scaled to the config's unit).
UPDATE public.category_configs cc
SET config = jsonb_set(
      cc.config,
      '{price_floor}',
      to_jsonb(trim_scale(
        0.00001::numeric * CASE cc.config->>'quantity_granularity'
          WHEN 'thousand' THEN 1000
          WHEN 'million'  THEN 1000000
          ELSE 1
        END
      ))
    ),
    updated_at = now()
FROM public.games g
WHERE g.id = cc.game_id
  AND g.slug = 'grow-a-garden'
  AND cc.category_type = 'currency'
  AND (cc.config->'price_floor') IS DISTINCT FROM to_jsonb(trim_scale(
        0.00001::numeric * CASE cc.config->>'quantity_granularity'
          WHEN 'thousand' THEN 1000
          WHEN 'million'  THEN 1000000
          ELSE 1
        END
      ));

-- 2. Fortnite + R6 Siege: no per-bundle minimum (and no legacy $10 cap).
UPDATE public.category_configs cc
SET config = (cc.config - 'price_ceiling')
      || jsonb_build_object(
           'price_floor', 0,
           'price_max', NULL,
           'bundle_price_min', NULL,
           'bundle_price_max', COALESCE(cc.config->'bundle_price_max', 'null'::jsonb)
         ),
    updated_at = now()
FROM public.games g
WHERE g.id = cc.game_id
  AND g.slug IN ('fortnite', 'r6-siege', 'rainbow-six-siege')
  AND cc.category_type = 'currency'
  AND (
    cc.config ? 'price_ceiling'
    OR NOT (cc.config ? 'bundle_price_min')
    OR cc.config->'bundle_price_min' <> 'null'::jsonb
    OR COALESCE((cc.config->>'price_floor')::numeric, 0) <> 0
  );

-- Self-check: every existing target row now carries the intended rule.
DO $$
DECLARE
  r record;
  expected numeric;
BEGIN
  FOR r IN
    SELECT g.slug, cc.config
    FROM public.category_configs cc
    JOIN public.games g ON g.id = cc.game_id
    WHERE g.slug = 'grow-a-garden' AND cc.category_type = 'currency'
  LOOP
    expected := 0.00001::numeric * CASE r.config->>'quantity_granularity'
      WHEN 'thousand' THEN 1000 WHEN 'million' THEN 1000000 ELSE 1 END;
    IF (r.config->>'price_floor')::numeric IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'grow-a-garden currency price_floor is %, expected %',
        r.config->>'price_floor', expected;
    END IF;
    IF COALESCE(r.config->>'quantity_granularity', 'unit') = 'unit' THEN
      -- listings.price is numeric(12,4): a per-unit $0.00001 can't be listed.
      RAISE NOTICE 'grow-a-garden is priced per single unit; sellers can only price to $0.0001 — set Unit Size to Thousand';
    END IF;
  END LOOP;

  FOR r IN
    SELECT g.slug, cc.config
    FROM public.category_configs cc
    JOIN public.games g ON g.id = cc.game_id
    WHERE g.slug IN ('fortnite', 'r6-siege', 'rainbow-six-siege') AND cc.category_type = 'currency'
  LOOP
    IF r.config ? 'price_ceiling'
       OR NOT (r.config ? 'bundle_price_min')
       OR r.config->'bundle_price_min' <> 'null'::jsonb
       OR COALESCE((r.config->>'price_floor')::numeric, 0) <> 0 THEN
      RAISE EXCEPTION '% currency config still has a bundle minimum or legacy cap: %', r.slug, r.config;
    END IF;
  END LOOP;
END
$$;
