-- V17y — Per-game per-category configuration.
--
-- Stores the editable settings each category type needs (currency
-- pricing rules, account-listing requirements, boosting tiers, etc.)
-- keyed by (game_id, category_type). One table with a JSONB `config`
-- column so the shape can evolve per type without DB churn.
--
-- Read paths:
--   • Buyer-side marketplace pages (currency hero, account form,
--     boosting picker) hydrate from this table.
--   • Seller-side wizard pulls floors/ceilings to validate prices.
--
-- Write path: admin tabbed detail page at /admin/games/[id].

BEGIN;

CREATE TABLE IF NOT EXISTS public.category_configs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_type text NOT NULL CHECK (category_type IN ('currency', 'account', 'service', 'items', 'top_up')),
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, category_type)
);

CREATE INDEX IF NOT EXISTS idx_category_configs_game_type
  ON public.category_configs (game_id, category_type);

-- updated_at autobump
CREATE OR REPLACE FUNCTION public.touch_category_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS category_configs_touch_updated_at ON public.category_configs;
CREATE TRIGGER category_configs_touch_updated_at
  BEFORE UPDATE ON public.category_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_category_configs_updated_at();

-- RLS — public read, admin write.
ALTER TABLE public.category_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "category_configs_public_read" ON public.category_configs;
CREATE POLICY "category_configs_public_read"
  ON public.category_configs
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Admin writes happen via service role (admin server actions). No
-- write policy for anon/authenticated; if we add per-user write later
-- we'll gate it on a profiles.is_admin check here.

COMMENT ON TABLE public.category_configs IS
  'Per (game, category_type) settings. Shape of config jsonb varies by type — see TS types in src/lib/types/category-configs.ts.';

-- ─── Seed: Roblox currency config from the current hardcoded values
--     in src/app/(marketplace)/[gameSlug]/[categorySlug]/_currencyData.ts
--     so the migration is backward-compatible the moment it lands.

INSERT INTO public.category_configs (game_id, category_type, config)
SELECT
  g.id,
  'currency',
  jsonb_build_object(
    'unit_label', 'Robux',
    'glyph', 'R$',
    'tagline', 'In-game currency for Roblox — buy avatar items, game passes, and premium content.',
    'price_floor', 0.0035,
    'price_ceiling', 0.0080,
    'recommended_price', 0.0045,
    'min_quantity', 1000,
    'quantity_step', 100,
    'seller_instructions_placeholder', 'Send us gamepass or in-game item details. Provide your username and platform.',
    'faq', jsonb_build_array(
      jsonb_build_object('q', 'How fast is delivery?', 'a', 'Most orders are delivered automatically within minutes — the average across all Robux sellers is about 8 minutes.'),
      jsonb_build_object('q', 'Is buying Robux safe?', 'a', 'Every trade on GameVault is covered by VaultShield, which holds your payment until you confirm delivery.'),
      jsonb_build_object('q', 'Do I need to share my password?', 'a', 'Never. Delivery is via in-experience gifting or group payouts — only your username is required.'),
      jsonb_build_object('q', 'What payment methods do you accept?', 'a', 'Cards, PayPal, Apple Pay, and major cryptocurrencies.'),
      jsonb_build_object('q', 'What''s your refund policy?', 'a', 'Payments are held in escrow by VaultShield until you confirm delivery — full refund available before then.')
    ),
    'steps', jsonb_build_array(
      jsonb_build_object('n', 1, 'title', 'Pick an offer', 'body', 'Compare verified sellers by price, rating, and delivery speed.'),
      jsonb_build_object('n', 2, 'title', 'Pay securely', 'body', 'Your payment is held by VaultShield escrow until you confirm delivery.'),
      jsonb_build_object('n', 3, 'title', 'Receive your currency', 'body', 'The seller delivers via in-game gifting. Confirm receipt and you''re done.')
    )
  )
FROM public.games g
WHERE g.slug = 'roblox'
ON CONFLICT (game_id, category_type) DO NOTHING;

COMMIT;
