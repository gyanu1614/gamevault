-- Storage Buckets Setup
-- Run this after setting up the main schema

-- Create buckets for file uploads
insert into storage.buckets (id, name, public)
values
  ('listing-images', 'listing-images', true),
  ('avatars', 'avatars', true),
  ('message-attachments', 'message-attachments', false),
  ('delivery-evidence', 'delivery-evidence', false);

-- ============================================
-- LISTING IMAGES BUCKET POLICIES
-- ============================================

-- Allow public viewing of listing images
create policy "Public can view listing images"
  on storage.objects for select
  using (bucket_id = 'listing-images');

-- Allow authenticated users to upload listing images
create policy "Authenticated users can upload listing images"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
  );

-- Allow users to update their own listing images
create policy "Users can update own listing images"
  on storage.objects for update
  using (
    bucket_id = 'listing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own listing images
create policy "Users can delete own listing images"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- AVATARS BUCKET POLICIES
-- ============================================

-- Allow public viewing of avatars
create policy "Public can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Allow users to upload their own avatar
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own avatar
create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own avatar
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- MESSAGE ATTACHMENTS BUCKET POLICIES
-- ============================================

-- Allow conversation participants to view attachments
create policy "Conversation participants can view attachments"
  on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Allow conversation participants to upload attachments
create policy "Conversation participants can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ============================================
-- DELIVERY EVIDENCE BUCKET POLICIES
-- ============================================

-- Allow order participants (buyer and seller) to view delivery evidence
create policy "Order participants can view delivery evidence"
  on storage.objects for select
  using (
    bucket_id = 'delivery-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

-- Allow sellers to upload delivery evidence for their orders
create policy "Sellers can upload delivery evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'delivery-evidence'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
      and o.seller_id = auth.uid()
    )
  );

-- Allow sellers to delete their delivery evidence
create policy "Sellers can delete delivery evidence"
  on storage.objects for delete
  using (
    bucket_id = 'delivery-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
      and o.seller_id = auth.uid()
    )
  );
