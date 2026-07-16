-- Seller application wizard overhaul (Beta workstream B)
-- Paste into the Supabase SQL editor and run once.
--
-- 1. New columns collected by the rebuilt wizard:
--    - other_games:            free-text games not in the catalog ("Other" option)
--    - profile_picture_path:   storage path of the Store Image in `profile-pictures`
--                              (admin-seller-review.ts already reads this column)
--    - shop_name:              shop name collected at application time
--    - crypto_type:            chosen coin for crypto payouts (BTC/ETH/USDT)
ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS other_games text,
  ADD COLUMN IF NOT EXISTS profile_picture_path text,
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS crypto_type text;

-- 2. KYC documents now upload IMMEDIATELY on pick. Users need to be able to
--    replace/remove their own files before submitting, so allow owner-folder
--    SELECT + DELETE (INSERT policy already exists in setup-kyc-storage.sql).
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own KYC documents" ON storage.objects;
CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
