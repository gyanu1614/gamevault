-- Lock Order Inserts To The Server. Idempotent.
--
-- Two permissive RLS policies let ANY authenticated user insert arbitrary
-- orders rows (any price, any seller) with the public anon key — bypassing
-- createCheckout's server-side price computation entirely. Order creation now
-- goes through the service-role client only (insertPendingOrder), so client
-- inserts are never legitimate. Money-integrity fix, independent of the
-- purchases kill-switch.

DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "System can insert orders" ON public.orders;
