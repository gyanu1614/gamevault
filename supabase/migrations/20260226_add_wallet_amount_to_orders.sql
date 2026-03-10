-- Add wallet_amount_used column to orders table
-- This tracks how much wallet balance was used for each order

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS wallet_amount_used NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (wallet_amount_used >= 0);

COMMENT ON COLUMN public.orders.wallet_amount_used IS 'Amount of wallet balance used for this order (reduces Stripe charge)';
