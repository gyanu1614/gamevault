-- DLT-003 (High) — bring every storage bucket ACL into version control.
--
-- Found by the 2026-09-20 delta audit: a repo-wide search for
-- `storage.objects` / `storage.buckets` across supabase/migrations/ returned
-- ZERO matches, and `SELECT … FROM pg_policy WHERE polrelid =
-- 'storage.objects'::regclass` returned 0 rows on the local stack. Eight
-- buckets are used by the app; every read/write policy existed only in the
-- Supabase dashboard -- unversioned, unreviewable, not reproducible on a fresh
-- project, covered by no test.
--
-- That compounds DLT-004: a restore into a fresh project came back with NO
-- storage ACLs at all, including kyc-documents (passports, IDs) and
-- delivery-evidence (which can carry account credentials).
--
-- IDEMPOTENT AND ADDITIVE. Buckets are created only IF NOT EXISTS; the public
-- flag is set to the intent the code already relies on. No DROP of a bucket or
-- an object, ever -- dropping a bucket would delete live user uploads.
--
-- ── Bucket intent, derived from how the app reads each one ─────────────────
--   kyc-documents      PRIVATE  createSignedUrl (kyc-documents.ts:25,63;
--                               admin-seller-review.ts:1024). Upload path is
--                               `{userId}/…` (seller-application.ts:342).
--   delivery-evidence  PRIVATE  createSignedUrl (storage/delivery-evidence.ts:332,
--                               whose header states "Bucket: delivery-evidence
--                               (private…)"). Upload path is `{orderId}/…`.
--   listing-images     public   getPublicUrl; `{userId}/…` (listings.ts:75).
--   profile-pictures   public   getPublicUrl; `{userId}/…`.
--   category-icons     public   getPublicUrl; admin-managed, `games/` prefix.
--   game-covers        public   getPublicUrl; admin-managed.
--   attribute-icons    public   getPublicUrl; admin-managed.
--   blog-images        public   admin-managed (admin-blog.ts created it at
--                               runtime with { public: true } -- declared here
--                               instead so it is reproducible).
--
-- NOTE (pre-existing inconsistency, deliberately NOT changed here):
-- src/lib/actions/delivery-evidence.ts:73 stores getPublicUrl() for a bucket
-- the canonical storage lib documents as private. With the bucket private that
-- URL does not resolve, so the correct fix is to make that path use
-- createSignedUrl like storage/delivery-evidence.ts does. Tracked separately;
-- changing an app read path is out of scope for an ACL migration.

-- ── 1. Marker ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.storage_policies_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.storage_policies_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_policies_version() TO service_role;

-- ── 2. Buckets ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('kyc-documents',     'kyc-documents',     false),
  ('delivery-evidence', 'delivery-evidence', false),
  ('listing-images',    'listing-images',    true),
  ('profile-pictures',  'profile-pictures',  true),
  ('category-icons',    'category-icons',    true),
  ('game-covers',       'game-covers',       true),
  ('attribute-icons',   'attribute-icons',   true),
  ('blog-images',       'blog-images',       true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ── 3. Policies on storage.objects ─────────────────────────────────────────
-- Every policy is dropped-if-exists then created, so re-running is safe and
-- the file is the single source of truth for what each bucket allows.

-- 3a. PRIVATE: kyc-documents. Owner-or-admin read, owner-only write.
-- Path convention `{userId}/…`, so the first folder segment is the owner.
DROP POLICY IF EXISTS kyc_documents_owner_read ON storage.objects;
CREATE POLICY kyc_documents_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS kyc_documents_owner_write ON storage.objects;
CREATE POLICY kyc_documents_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3b. PRIVATE: delivery-evidence. Path is `{orderId}/…`, so ownership is the
-- order's buyer or seller; admins see everything (dispute handling).
DROP POLICY IF EXISTS delivery_evidence_party_read ON storage.objects;
CREATE POLICY delivery_evidence_party_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.id::text = (storage.foldername(name))[1]
           AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS delivery_evidence_party_write ON storage.objects;
CREATE POLICY delivery_evidence_party_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-evidence'
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id::text = (storage.foldername(name))[1]
         AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- 3c. PUBLIC-READ, OWNER-WRITE: listing-images, profile-pictures.
-- Anyone may read (the objects render on public pages); a signed-in user may
-- only write under their OWN `{userId}/` prefix. This is the control the
-- audit could not confirm existed (AUTH-021/AUTH-033 territory).
DROP POLICY IF EXISTS user_owned_buckets_public_read ON storage.objects;
CREATE POLICY user_owned_buckets_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('listing-images', 'profile-pictures'));

DROP POLICY IF EXISTS user_owned_buckets_owner_write ON storage.objects;
CREATE POLICY user_owned_buckets_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('listing-images', 'profile-pictures')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS user_owned_buckets_owner_update ON storage.objects;
CREATE POLICY user_owned_buckets_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('listing-images', 'profile-pictures')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS user_owned_buckets_owner_delete ON storage.objects;
CREATE POLICY user_owned_buckets_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('listing-images', 'profile-pictures')
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- 3d. PUBLIC-READ, ADMIN-WRITE: the catalogue art buckets.
-- DLT-008: admin upload actions write these through the SESSION client, so
-- until they move to the service role these policies are the only thing
-- stopping an ordinary signed-in user from writing `games/…` directly against
-- the REST API and overwriting a game icon (upsert: true).
DROP POLICY IF EXISTS catalogue_art_public_read ON storage.objects;
CREATE POLICY catalogue_art_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('category-icons', 'game-covers', 'attribute-icons', 'blog-images'));

DROP POLICY IF EXISTS catalogue_art_admin_write ON storage.objects;
CREATE POLICY catalogue_art_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('category-icons', 'game-covers', 'attribute-icons', 'blog-images')
    AND public.is_admin()
  );

DROP POLICY IF EXISTS catalogue_art_admin_update ON storage.objects;
CREATE POLICY catalogue_art_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('category-icons', 'game-covers', 'attribute-icons', 'blog-images')
    AND public.is_admin()
  );

DROP POLICY IF EXISTS catalogue_art_admin_delete ON storage.objects;
CREATE POLICY catalogue_art_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('category-icons', 'game-covers', 'attribute-icons', 'blog-images')
    AND public.is_admin()
  );

-- ── 4. Posture probes for the guard test ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.storage_bucket_posture(p_bucket text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, storage AS $$
  SELECT jsonb_build_object(
    'exists',    EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = p_bucket),
    'is_public', (SELECT b.public FROM storage.buckets b WHERE b.id = p_bucket),
    'policy_count', (
      SELECT count(*)
        FROM pg_policy p
       WHERE p.polrelid = 'storage.objects'::regclass
         AND pg_get_expr(COALESCE(p.polqual, p.polwithcheck), p.polrelid) LIKE '%' || p_bucket || '%'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.storage_bucket_posture(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_bucket_posture(text) TO service_role;

/** Every bucket that exists, so the guard fails when one is added undeclared. */
CREATE OR REPLACE FUNCTION public.storage_declared_buckets()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, storage AS $$
  SELECT COALESCE(array_agg(b.id ORDER BY b.id), ARRAY[]::text[]) FROM storage.buckets b;
$$;
REVOKE ALL ON FUNCTION public.storage_declared_buckets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_declared_buckets() TO service_role;

-- ── 5. Proof — refuse to finish half-applied ───────────────────────────────
DO $$
DECLARE
  v_bad text;
BEGIN
  -- The two private buckets must not be public.
  SELECT string_agg(b.id, ', ') INTO v_bad
    FROM storage.buckets b
   WHERE b.id IN ('kyc-documents', 'delivery-evidence') AND b.public;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'DLT-003: private bucket(s) are marked public: %', v_bad;
  END IF;

  -- Every declared bucket must be referenced by at least one policy.
  SELECT string_agg(x.id, ', ') INTO v_bad
    FROM (VALUES
      ('kyc-documents'),('delivery-evidence'),('listing-images'),('profile-pictures'),
      ('category-icons'),('game-covers'),('attribute-icons'),('blog-images')
    ) AS x(id)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_policy p
      WHERE p.polrelid = 'storage.objects'::regclass
        AND pg_get_expr(COALESCE(p.polqual, p.polwithcheck), p.polrelid) LIKE '%' || x.id || '%'
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'DLT-003: bucket(s) with no storage.objects policy: %', v_bad;
  END IF;

  -- RLS must actually be on, or the policies above are decorative.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
    RAISE EXCEPTION 'DLT-003: RLS is not enabled on storage.objects';
  END IF;
END $$;
