-- Model C copy fix for seeded category_configs rows (live DB data).
-- The 20260619 seed wrote pre-rebrand, Model A custody copy into
-- config JSONB (steps/FAQ): "GameVault", "VaultShield", "holds your
-- payment until you confirm delivery", "SafeDrop escrow". Rewrites the
-- affected rows to Model C outcome language. Idempotent.

UPDATE public.category_configs
SET config = replace(replace(replace(replace(replace(config::text,
  'covered by VaultShield, which holds your payment until you confirm delivery',
  'covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery'),
  'held by SafeDrop escrow until you confirm delivery',
  'covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery'),
  'SafeDrop escrow', 'SafeDrop Buyer Protection'),
  'VaultShield', 'SafeDrop'),
  'GameVault', 'DropMarket')::jsonb
WHERE config::text ILIKE '%vaultshield%'
   OR config::text ILIKE '%gamevault%'
   OR config::text ILIKE '%escrow%';
