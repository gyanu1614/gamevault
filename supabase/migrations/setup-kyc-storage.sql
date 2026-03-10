-- Setup KYC Documents Storage Bucket with proper permissions

-- Create the kyc-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can upload kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can read kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can delete kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all KYC documents" ON storage.objects;

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload their KYC documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow admins to delete documents
CREATE POLICY "Admins can delete KYC documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
