-- ============================================================================
-- PAY-014 (P2) — audit pass 6, fix/checkout-p0. Idempotent.
--
-- validatePromoCode read total_used against usage_limit BEFORE the order was
-- created, and promo_usage_record (which holds the promo row lock) never
-- compared against the cap: N concurrent checkouts on a last-use code all
-- validated, all recorded, total_used ran past usage_limit. The cap now binds
-- inside the RPC, under the lock — usage_limit, per_user_limit, is_active and
-- expires_at — and createCheckout AWAITS it (a refused usage cancels the
-- just-created order before any money moves; the discount is never granted).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.promo_usage_record(p_promo_code_id uuid, p_order_id uuid, p_user_id uuid, p_discount_amount numeric)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promo     RECORD;
  v_total     INT;
  v_user_used INT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'promo_usage_record: promo % not found', p_promo_code_id USING ERRCODE = 'no_data_found';
  END IF;
  IF EXISTS (SELECT 1 FROM promo_code_usages WHERE promo_code_id = p_promo_code_id AND order_id = p_order_id) THEN
    RETURN jsonb_build_object('recorded', false, 'total_used', v_promo.total_used);
  END IF;

  -- PAY-014: the caps bind HERE, serialised on the promo row.
  IF NOT v_promo.is_active OR (v_promo.expires_at IS NOT NULL AND v_promo.expires_at < NOW()) THEN
    RAISE EXCEPTION 'promo_usage_record: promo is no longer active' USING ERRCODE = 'check_violation';
  END IF;
  IF v_promo.usage_limit IS NOT NULL AND v_promo.total_used >= v_promo.usage_limit THEN
    RAISE EXCEPTION 'promo_usage_record: usage limit reached (% of %)', v_promo.total_used, v_promo.usage_limit
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_user_id IS NOT NULL AND COALESCE(v_promo.per_user_limit, 0) > 0 THEN
    SELECT count(*) INTO v_user_used FROM promo_code_usages
     WHERE promo_code_id = p_promo_code_id AND user_id = p_user_id;
    IF v_user_used >= v_promo.per_user_limit THEN
      RAISE EXCEPTION 'promo_usage_record: per-user limit reached (% of %)', v_user_used, v_promo.per_user_limit
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO promo_code_usages (promo_code_id, user_id, order_id, discount_amount)
  VALUES (p_promo_code_id, p_user_id, p_order_id, p_discount_amount);
  PERFORM money_fault_hook('promo_usage_record:after_usage');
  UPDATE promo_codes SET total_used = total_used + 1 WHERE id = p_promo_code_id RETURNING total_used INTO v_total;
  RETURN jsonb_build_object('recorded', true, 'total_used', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) TO service_role;
COMMENT ON FUNCTION public.promo_usage_record(uuid, uuid, uuid, numeric) IS
  'DB-016/PAY-014: records one promo usage per (promo, order) and increments total_used atomically under the promo row lock; usage_limit / per_user_limit / active / expiry are enforced here (check_violation). Service-role only.';
