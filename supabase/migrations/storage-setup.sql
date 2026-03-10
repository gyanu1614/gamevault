-- ============================================
-- SUPABASE STORAGE BUCKETS SETUP
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Create KYC Documents Bucket (Private, Encrypted)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false, -- Private bucket
  10485760, -- 10MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'] -- Allowed file types
);

-- 2. Create Profile Pictures Bucket (Public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true, -- Public bucket
  5242880, -- 5MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] -- Allowed file types
);

-- ============================================
-- STORAGE POLICIES FOR KYC DOCUMENTS
-- ============================================

-- Users can upload their own KYC documents
create policy "Users can upload own KYC documents"
  on storage.objects for insert
  with check (
    bucket_id = 'kyc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own KYC documents
create policy "Users can view own KYC documents"
  on storage.objects for select
  using (
    bucket_id = 'kyc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own KYC documents (for replacing files)
create policy "Users can update own KYC documents"
  on storage.objects for update
  using (
    bucket_id = 'kyc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own KYC documents (for re-upload)
create policy "Users can delete own KYC documents"
  on storage.objects for delete
  using (
    bucket_id = 'kyc-documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can view all KYC documents
create policy "Admins can view all KYC documents"
  on storage.objects for select
  using (
    bucket_id = 'kyc-documents' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_tier = 'platinum' -- Admin check
    )
  );

-- ============================================
-- STORAGE POLICIES FOR PROFILE PICTURES
-- ============================================

-- Anyone can view profile pictures (public bucket)
create policy "Anyone can view profile pictures"
  on storage.objects for select
  using (bucket_id = 'profile-pictures');

-- Users can upload their own profile pictures
create policy "Users can upload own profile pictures"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-pictures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own profile pictures
create policy "Users can update own profile pictures"
  on storage.objects for update
  using (
    bucket_id = 'profile-pictures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own profile pictures
create policy "Users can delete own profile pictures"
  on storage.objects for delete
  using (
    bucket_id = 'profile-pictures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
