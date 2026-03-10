/**
 * P4.1 — VaultShield Buyer-Chosen Tiers
 *
 * Adds tier fee columns to orders so we can store:
 *  - The buyer's chosen tier (standard / enhanced / premium)
 *  - The tier fee rate (0% / 2% / 5%)
 *  - The tier fee dollar amount
 *  - The warranty expiry date (48h / 7d / 30d)
 *
 * Note: `vaultshield_level` already exists from 20260206 migration.
 * We keep it but now it reflects buyer's choice, not price-derived auto-assignment.
 */

-- Tier fee rate (0 / 2 / 5)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vaultshield_tier_fee_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- Tier fee dollar amount
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vaultshield_tier_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Warranty expiry — Standard: 48h, Enhanced: 7d, Premium: 30d
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ;

-- Drop the price-based auto-assignment trigger for vaultshield_level
-- (level is now set explicitly by the application based on buyer's choice)
DROP TRIGGER IF EXISTS set_vaultshield_level ON orders;
DROP FUNCTION IF EXISTS fn_set_vaultshield_level();

-- Index for warranty queries (e.g., "find all orders where warranty is still active")
CREATE INDEX IF NOT EXISTS idx_orders_warranty_expires_at
  ON orders (warranty_expires_at)
  WHERE warranty_expires_at IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN orders.vaultshield_level IS
  'Buyer-chosen VaultShield tier (standard / enhanced / premium). Set by application at checkout.';
COMMENT ON COLUMN orders.vaultshield_tier_fee_rate IS
  'Buyer-paid tier upgrade fee rate: 0 for Standard, 2 for Enhanced (+2%), 5 for Premium (+5%).';
COMMENT ON COLUMN orders.vaultshield_tier_fee IS
  'Dollar amount charged for tier upgrade = subtotal * (tier_fee_rate / 100).';
COMMENT ON COLUMN orders.warranty_expires_at IS
  'When the VaultShield warranty expires: +48h (Standard), +7d (Enhanced), +30d (Premium).';
