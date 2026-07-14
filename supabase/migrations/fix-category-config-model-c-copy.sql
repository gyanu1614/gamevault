-- Model C copy fix for seeded category_configs rows (live DB data).
-- The 20260619/20260620 seeds wrote pre-rebrand, Model A custody copy
-- into config JSONB (steps/FAQ): "GameVault", "VaultShield", "holds
-- your payment until you confirm delivery", "held in escrow by ...",
-- "SafeDrop escrow". Rewrites the affected rows to Model C outcome
-- language. Both brand spellings are handled because the rebrand data
-- pass already renamed VaultShield -> SafeDrop in some rows (live
-- pages show "held in escrow by SafeDrop"). Full sentences are
-- replaced first, then fragments as a safety net, then brand names.
-- Idempotent.

UPDATE public.category_configs
SET config = replace(replace(replace(replace(replace(replace(replace(replace(replace(config::text,
  -- Seeded refund-policy FAQ answer (both brand spellings)
  'Payments are held in escrow by SafeDrop until you confirm delivery — full refund available before then.',
  'Every order is covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery, and you get a full refund if your order never arrives.'),
  'Payments are held in escrow by VaultShield until you confirm delivery — full refund available before then.',
  'Every order is covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery, and you get a full refund if your order never arrives.'),
  -- Seeded how-it-works step copy
  'covered by VaultShield, which holds your payment until you confirm delivery',
  'covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery'),
  'held by SafeDrop escrow until you confirm delivery',
  'covered by SafeDrop Buyer Protection — the seller is paid out only after you confirm delivery'),
  -- Fragment safety net for rows whose surrounding text drifted
  'held in escrow by SafeDrop',
  'covered by SafeDrop Buyer Protection'),
  'held in escrow by VaultShield',
  'covered by SafeDrop Buyer Protection'),
  'SafeDrop escrow', 'SafeDrop Buyer Protection'),
  'VaultShield', 'SafeDrop'),
  'GameVault', 'DropMarket')::jsonb
WHERE config::text ILIKE '%vaultshield%'
   OR config::text ILIKE '%gamevault%'
   OR config::text ILIKE '%escrow%';

-- Verify: should return 0 rows afterwards.
-- SELECT id FROM public.category_configs
-- WHERE config::text ILIKE '%escrow%'
--    OR config::text ILIKE '%vaultshield%'
--    OR config::text ILIKE '%gamevault%';
