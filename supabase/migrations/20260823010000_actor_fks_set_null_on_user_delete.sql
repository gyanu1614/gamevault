-- Make user deletion work cleanly (GDPR "delete my account" + admin/dashboard).
--
-- PROBLEM: deleting an auth user cascades to profiles → all the user's OWNED
-- data (listings, orders, applications, kyc docs, notifications, reviews,
-- messages, conversations, wallet — all already ON DELETE CASCADE). But 24 FKs
-- record who *acted on* a record (approved_by, reviewed_by, verified_by,
-- resolved_by, performed_by, …) and default to NO ACTION, so if the user being
-- deleted performed any of those actions, Postgres blocks the delete with
-- "Database error deleting user". (Both the Supabase dashboard and the app's own
-- GDPR flow call auth.admin.deleteUser, so both hit this wall.)
--
-- FIX: change every actor/participant FK to ON DELETE SET NULL. The record
-- SURVIVES (we keep the listing / application / dispute / audit log); only the
-- reference to the deleted user is cleared. All 24 columns are nullable, so this
-- is valid. Owned-data FKs are left as CASCADE (unchanged) — the user's own rows
-- still get removed.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS then re-ADD, so it can run repeatedly.

DO $$
DECLARE
  fk record;
  fks constant text[][] := ARRAY[
    -- table,                       column,               constraint name
    ['admin_activity_log',          'admin_id',           'admin_activity_log_admin_id_fkey'],
    ['admin_roles',                 'granted_by',         'admin_roles_granted_by_fkey'],
    ['dispute_messages',            'sender_id',          'dispute_messages_sender_id_fkey'],
    ['dispute_resolutions',         'resolved_by',        'dispute_resolutions_resolved_by_fkey'],
    ['disputes',                    'assigned_to',        'disputes_assigned_to_fkey'],
    ['disputes',                    'buyer_id',           'disputes_buyer_id_fkey'],
    ['disputes',                    'escalated_by',       'disputes_escalated_by_fkey'],
    ['disputes',                    'resolved_by',        'disputes_resolved_by_fkey'],
    ['disputes',                    'seller_id',          'disputes_seller_id_fkey'],
    ['fraud_flags',                 'resolved_by',        'fraud_flags_resolved_by_fkey'],
    ['gdpr_requests',               'processed_by',       'gdpr_requests_processed_by_fkey'],
    ['inform_disclosures',          'certified_by',       'inform_disclosures_certified_by_fkey'],
    ['listings',                    'approved_by',        'listings_approved_by_fkey'],
    ['listings',                    'rejected_by',        'listings_rejected_by_fkey'],
    ['order_cancellation_requests', 'admin_id',           'order_cancellation_requests_admin_id_fkey'],
    ['order_cancellation_requests', 'buyer_id',           'order_cancellation_requests_buyer_id_fkey'],
    ['profiles',                    'seller_restricted_by','profiles_seller_restricted_by_fkey'],
    ['seller_applications',         'rejected_by',        'seller_applications_rejected_by_fkey'],
    ['seller_applications',         'reviewed_by',        'seller_applications_reviewed_by_fkey'],
    ['seller_kyc_documents',        'verified_by',        'seller_kyc_documents_verified_by_fkey'],
    ['seller_restrictions',         'restricted_by',      'seller_restrictions_restricted_by_fkey'],
    ['seller_tier_history',         'changed_by',         'seller_tier_history_changed_by_fkey'],
    ['seller_verification_logs',    'performed_by',       'seller_verification_logs_performed_by_fkey'],
    ['withdrawal_requests',         'processed_by',       'withdrawal_requests_processed_by_fkey']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(fks, 1) LOOP
    -- Only touch tables/columns that actually exist (defensive across envs).
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = fks[i][1] AND column_name = fks[i][2]
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', fks[i][1], fks[i][3]);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
        fks[i][1], fks[i][3], fks[i][2]
      );
    END IF;
  END LOOP;
END $$;
