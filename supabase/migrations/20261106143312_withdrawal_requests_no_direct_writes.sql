-- Security review of the payout wait, 2026-11-06.
--
-- 1. Any signed-in user could write a row straight into withdrawal_requests through the
--    API: any amount, any address, any status, skipping withdrawal_request and every check
--    in it. The row reached the admin queue looking normal, and withdrawal_payout only
--    refused it after staff had sent the money. Nothing in the app writes this table with a
--    session, so sellers lose nothing. Checked on live 2026-11-06: 3 rows ever, every one
--    with its hold, so it was never used.
--
-- 2. A request keeps the address it was made with. So someone with a stolen login could
--    save their own address, ask straight away (allowed since 20261106093010), and the
--    owner putting their address back would change nothing on that request. Now a real
--    change to payout details cancels a waiting request and returns the money, in the same
--    transaction.

DROP POLICY IF EXISTS "Users can create withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can cancel pending withdrawal requests" ON public.withdrawal_requests;
REVOKE ALL ON TABLE public.withdrawal_requests FROM anon;
-- SELECT and UPDATE stay for the two kinds of row a session can still reach: its own to read,
-- and staff's "Admins can manage" policy, which needs admin_roles. A seller's UPDATE matches no row.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.withdrawal_requests FROM authenticated;

CREATE OR REPLACE FUNCTION public.seller_payout_details_set(p_seller_id uuid, p_kind text, p_coin text DEFAULT NULL::text, p_chain text DEFAULT NULL::text, p_address_enc text DEFAULT NULL::text, p_address_hash text DEFAULT NULL::text, p_email_enc text DEFAULT NULL::text, p_email_hash text DEFAULT NULL::text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row       RECORD;
  v_changed   BOOLEAN := false;
  v_freeze    INT;
  v_open      RECORD;      -- new
  v_cancelled INT := 0;    -- new
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_kind NOT IN ('crypto', 'payoneer') THEN
    RAISE EXCEPTION 'seller_payout_details_set: kind must be crypto or payoneer' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO seller_payout_details (seller_id) VALUES (p_seller_id) ON CONFLICT (seller_id) DO NOTHING;
  SELECT * INTO v_row FROM seller_payout_details WHERE seller_id = p_seller_id FOR UPDATE;

  IF p_kind = 'crypto' THEN
    IF COALESCE(length(p_address_enc), 0) = 0 OR COALESCE(length(p_address_hash), 0) = 0 OR p_coin IS NULL OR p_chain IS NULL THEN
      RAISE EXCEPTION 'seller_payout_details_set: coin, chain, encrypted address and hash are required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := v_row.crypto_address_hash IS DISTINCT FROM p_address_hash OR v_row.crypto_coin IS DISTINCT FROM lower(p_coin) OR v_row.crypto_chain IS DISTINCT FROM lower(p_chain);
    IF v_changed THEN
      UPDATE seller_payout_details
         SET crypto_coin = lower(p_coin), crypto_chain = lower(p_chain),
             crypto_address_enc = p_address_enc, crypto_address_hash = p_address_hash, crypto_address_plain = NULL,
             details_changed_at = now(), updated_at = now()
       WHERE seller_id = p_seller_id;
    END IF;
  ELSE
    IF COALESCE(length(p_email_enc), 0) = 0 OR COALESCE(length(p_email_hash), 0) = 0 THEN
      RAISE EXCEPTION 'seller_payout_details_set: encrypted email and hash are required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := v_row.payoneer_email_hash IS DISTINCT FROM p_email_hash;
    IF v_changed THEN
      BEGIN
        UPDATE seller_payout_details
           SET payoneer_email_enc = p_email_enc, payoneer_email_hash = p_email_hash, payoneer_email_plain = NULL,
               details_changed_at = now(), updated_at = now()
         WHERE seller_id = p_seller_id;
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('saved', false, 'reason', 'email_in_use');
      END;
    END IF;
  END IF;

  -- new: a waiting request still holds the old address, so a real change cancels it. Any
  -- kind of change, because the owner fixing one method must not leave a request open on
  -- another. An approved request is already with staff and stays.
  IF v_changed THEN
    FOR v_open IN
      SELECT id, amount FROM withdrawal_requests WHERE user_id = p_seller_id AND status = 'pending' FOR UPDATE
    LOOP
      PERFORM withdrawal_cancel(v_open.id, p_seller_id);
      PERFORM money_fault_hook('seller_payout_details_set:after_cancel');
      PERFORM notify_once(p_seller_id, 'withdrawal_cancelled', 'Withdrawal Cancelled',
        'You changed your payout details, so your $' || to_char(v_open.amount, 'FM999999990.00') || ' withdrawal was cancelled. The money is back in your balance.',
        '/account/wallet', 'withdrawal:' || v_open.id::text || ':cancelled_details');
      v_cancelled := v_cancelled + 1;
    END LOOP;
  END IF;

  SELECT payout_details_freeze_hours INTO v_freeze FROM platform_fee_settings WHERE id;
  SELECT * INTO v_row FROM seller_payout_details WHERE seller_id = p_seller_id;
  RETURN jsonb_build_object(
    'saved', true, 'changed', v_changed, 'cancelled_requests', v_cancelled,
    'freeze_until', CASE WHEN v_row.details_changed_at IS NULL THEN NULL ELSE v_row.details_changed_at + make_interval(hours => COALESCE(v_freeze, 24)) END,
    'details', jsonb_build_object('crypto_coin', v_row.crypto_coin, 'crypto_chain', v_row.crypto_chain,
                                  'crypto_address_enc', v_row.crypto_address_enc, 'payoneer_email_enc', v_row.payoneer_email_enc,
                                  'details_changed_at', v_row.details_changed_at));
END;
$$;
REVOKE ALL ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text, text, text) TO service_role;
