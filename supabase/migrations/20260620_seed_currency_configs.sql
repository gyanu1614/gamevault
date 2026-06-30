-- V19/P1 — Seed default currency configs for every active currency
-- category across the catalog.
--
-- Background: the buyer-facing /[gameSlug]/[categorySlug] page reads
-- `category_configs` to render the rich Robux-style currency layout.
-- When a row is missing the page falls back to a sparse default, which
-- is why Robux looks rich and (say) V-Bucks / Path of Exile look bare.
--
-- This migration inserts a sensible-default row for every (game,
-- "currency") pair where one is missing. `ON CONFLICT DO NOTHING`
-- preserves the manually-tuned Roblox row from the previous migration
-- and any rows admin has since edited.
--
-- The `unit_label` is best-guessed per game from a small mapping; the
-- admin can edit it from /admin/games/[id] -> Currency tab once this
-- lands. Anything unknown falls back to "units" — visibly generic so
-- the admin knows to set it.

BEGIN;

WITH currency_games AS (
  -- Every active game that has at least one active category whose
  -- canonical type is "currency". We do NOT scope by category slug
  -- because slug naming varies (buy-robux, buy-vbucks, currency,
  -- robux, …); the metadata->>type is the single source of truth.
  SELECT DISTINCT g.id AS game_id, g.slug AS game_slug, g.name AS game_name
  FROM public.games g
  JOIN public.categories c ON c.game_id = g.id
  WHERE g.is_active = true
    AND c.is_active = true
    AND c.metadata->>'type' = 'currency'
),
unit_map AS (
  -- Per-game unit label. Extend this whenever a new currency game
  -- ships; the admin form is the long-term source of truth, this is
  -- just a sensible default at seed time.
  SELECT * FROM (VALUES
    ('roblox',        'Robux',     'R$'),
    ('fortnite',      'V-Bucks',   'V'),
    ('valorant',      'VP',        'VP'),
    ('league-of-legends', 'RP',     'RP'),
    ('genshin-impact','Crystals',  '◆'),
    ('apex-legends',  'Coins',     'AC'),
    ('rocket-league', 'Credits',   'C'),
    ('csgo',          'Keys',      '🔑'),
    ('cs2',           'Keys',      '🔑'),
    ('path-of-exile', 'Orbs',      'O'),
    ('poe',           'Orbs',      'O'),
    ('escape-from-tarkov', 'Roubles', '₽'),
    ('warframe',      'Platinum',  'P')
  ) AS t(slug, unit_label, glyph)
)

INSERT INTO public.category_configs (game_id, category_type, config)
SELECT
  cg.game_id,
  'currency',
  jsonb_build_object(
    'unit_label', COALESCE(um.unit_label, 'units'),
    'glyph',      COALESCE(um.glyph, '$'),
    'tagline',    'In-game currency for ' || cg.game_name || ' — fast delivery from verified sellers.',
    -- Price floor / ceiling deliberately permissive at seed time; the
    -- admin tightens per game once they know their market.
    'price_floor',        0.001,
    'price_ceiling',      10,
    'recommended_price',  0.01,
    -- Conservative quantity step + minimum. The unit label drives
    -- whether 100 means "100 Robux" or "100 Orbs"; the admin can dial.
    'min_quantity',  100,
    'quantity_step', 100,
    'seller_instructions_placeholder',
      'Describe how you''ll deliver the ' || COALESCE(um.unit_label, 'currency')
      || ' — username/platform required, group payout link, in-game trade method, etc.',
    -- FAQ + steps reuse the proven Robux copy with the unit swapped in
    -- so every page reads coherently from day one. Admin can rewrite.
    'faq', jsonb_build_array(
      jsonb_build_object('q', 'How fast is delivery?', 'a',
        'Most orders are delivered within minutes — most sellers complete in under an hour, and the top sellers average under 10 minutes.'),
      jsonb_build_object('q', 'Is buying ' || COALESCE(um.unit_label, 'currency') || ' safe?', 'a',
        'Every trade on GameVault is covered by VaultShield, which holds your payment until you confirm delivery.'),
      jsonb_build_object('q', 'Do I need to share my password?', 'a',
        'Never. Delivery happens via the game''s own trade/gift system — only your username/handle is required.'),
      jsonb_build_object('q', 'What payment methods do you accept?', 'a',
        'Cards, PayPal, Apple Pay, and major cryptocurrencies.'),
      jsonb_build_object('q', 'What''s your refund policy?', 'a',
        'Payments are held in escrow by VaultShield until you confirm delivery — full refund available before then.')
    ),
    'steps', jsonb_build_array(
      jsonb_build_object('n', 1, 'title', 'Pick an offer', 'body',
        'Compare verified sellers by price, rating, and delivery speed.'),
      jsonb_build_object('n', 2, 'title', 'Pay securely',  'body',
        'Your payment is held by VaultShield escrow until you confirm delivery.'),
      jsonb_build_object('n', 3, 'title', 'Receive your ' || COALESCE(um.unit_label, 'currency'), 'body',
        'The seller delivers via the game''s own transfer method. Confirm receipt and you''re done.')
    )
  )
FROM currency_games cg
LEFT JOIN unit_map um ON um.slug = cg.game_slug
ON CONFLICT (game_id, category_type) DO NOTHING;

COMMIT;
