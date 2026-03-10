-- ============================================
-- SELLER REGISTRATION & VERIFICATION SYSTEM
-- Phase 1: Multi-step application tables
-- ============================================

-- Seller Applications Table
create table if not exists public.seller_applications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Application status
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'info_requested', 'under_review')) not null,

  -- Step 1: Eligibility & Intent
  is_18_or_older boolean not null,
  seller_type text check (seller_type in ('individual', 'business')) not null,
  primary_games text[] default '{}', -- Array of game IDs (text format)
  expected_monthly_volume text check (expected_monthly_volume in ('under_500', '500_2000', '2000_10000', 'over_10000')),
  referral_code text,

  -- Step 2: Business Information
  full_legal_name text not null,
  display_name text not null,
  country text not null,
  state_province text,
  city text,
  phone_number text not null,
  phone_verified boolean default false,
  alternate_email text,

  -- Business-specific fields
  company_legal_name text,
  business_registration_number text,
  tax_id_vat text,
  company_address text,
  business_type text check (business_type in ('llc', 'corporation', 'sole_proprietorship', 'partnership', 'other')),
  year_established integer,
  business_email text,
  business_phone text,

  -- Step 4: Seller Profile (saved as draft)
  profile_bio text,
  business_hours text,
  timezone text,
  languages_spoken text[] default '{}',
  discord_username text,
  twitter_handle text,
  twitch_channel text,
  youtube_channel text,
  refund_policy text,
  delivery_timeframe text,
  terms_of_service text,

  -- Step 5: Payment & Banking
  payout_method text check (payout_method in ('bank_transfer', 'paypal', 'cryptocurrency')),
  bank_account_holder_name text,
  bank_name text,
  bank_account_number_encrypted text, -- Encrypted
  bank_routing_code text,
  bank_swift_code text,
  bank_iban text,
  paypal_email text,
  crypto_wallet_address text,
  tax_residency_country text,
  w9_submitted boolean default false,
  w8ben_submitted boolean default false,

  -- Step 6: Agreements
  accepted_seller_agreement boolean default false,
  accepted_privacy_policy boolean default false,
  accepted_anti_fraud_policy boolean default false,
  accepted_commission_structure boolean default false,
  accepted_data_processing boolean default false,
  information_accurate_confirmed boolean default false,

  -- Review information
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text,
  admin_notes text,

  -- Fraud detection
  fraud_score integer default 0 check (fraud_score >= 0 and fraud_score <= 100),
  ip_address inet,
  device_fingerprint text,

  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Constraints
  constraint valid_phone check (char_length(phone_number) >= 10),
  constraint valid_display_name check (char_length(display_name) >= 3)
);

-- Enable RLS
alter table public.seller_applications enable row level security;

-- Seller applications policies
create policy "Users can view own applications"
  on seller_applications for select
  using (auth.uid() = user_id);

create policy "Users can create own applications"
  on seller_applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pending applications"
  on seller_applications for update
  using (auth.uid() = user_id and status in ('pending', 'info_requested'));

-- Admins can view all applications (requires admin role check)
create policy "Admins can view all applications"
  on seller_applications for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_tier = 'platinum' -- Temporary admin check
    )
  );

-- Index for performance
create index idx_seller_applications_user_id on seller_applications(user_id);
create index idx_seller_applications_status on seller_applications(status);
create index idx_seller_applications_submitted_at on seller_applications(submitted_at);

-- ============================================
-- KYC DOCUMENTS TABLE
-- ============================================

create table if not exists public.seller_kyc_documents (
  id uuid default uuid_generate_v4() primary key,
  application_id uuid references public.seller_applications(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Document information
  document_type text check (document_type in (
    'id_front',
    'id_back',
    'selfie_with_id',
    'proof_of_address',
    'certificate_of_incorporation',
    'business_license',
    'director_id',
    'bank_statement',
    'w9_form',
    'w8ben_form',
    'other'
  )) not null,

  -- File storage (encrypted in Supabase Storage)
  file_path text not null,
  file_name text not null,
  file_size integer, -- in bytes
  file_type text, -- mime type

  -- Verification
  verified boolean default false,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,

  -- Auto-expiry (90 days after upload)
  uploaded_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '90 days'),

  -- OCR/Extraction results (JSONB for flexibility)
  extracted_data jsonb,

  -- Face matching results (for selfie_with_id)
  face_match_confidence numeric(5, 2), -- 0.00 to 100.00
  liveness_check_passed boolean,

  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.seller_kyc_documents enable row level security;

-- KYC documents policies
create policy "Users can view own documents"
  on seller_kyc_documents for select
  using (auth.uid() = user_id);

create policy "Users can upload own documents"
  on seller_kyc_documents for insert
  with check (auth.uid() = user_id);

create policy "Users cannot update documents after upload"
  on seller_kyc_documents for update
  using (false);

create policy "Users cannot delete documents"
  on seller_kyc_documents for delete
  using (false);

-- Admins can view all documents
create policy "Admins can view all documents"
  on seller_kyc_documents for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_tier = 'platinum' -- Temporary admin check
    )
  );

-- Index for performance
create index idx_kyc_documents_application_id on seller_kyc_documents(application_id);
create index idx_kyc_documents_user_id on seller_kyc_documents(user_id);
create index idx_kyc_documents_expires_at on seller_kyc_documents(expires_at);

-- ============================================
-- VERIFICATION LOGS TABLE
-- ============================================

create table if not exists public.seller_verification_logs (
  id uuid default uuid_generate_v4() primary key,
  application_id uuid references public.seller_applications(id) on delete cascade not null,

  -- Action tracking
  action text check (action in (
    'application_started',
    'step_completed',
    'document_uploaded',
    'phone_verified',
    'email_verified',
    'submitted_for_review',
    'review_started',
    'info_requested',
    'approved',
    'rejected',
    'fraud_flag',
    'admin_note_added',
    'tier_upgraded',
    'tier_downgraded',
    'account_suspended',
    'account_reactivated'
  )) not null,

  -- Who performed the action
  performed_by uuid references public.profiles(id), -- null for system actions
  is_system_action boolean default false,

  -- Additional details (JSONB for flexibility)
  details jsonb,

  -- IP and device tracking
  ip_address inet,
  user_agent text,

  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.seller_verification_logs enable row level security;

-- Verification logs policies
create policy "Users can view own logs"
  on seller_verification_logs for select
  using (
    exists (
      select 1 from seller_applications
      where id = seller_verification_logs.application_id
      and user_id = auth.uid()
    )
  );

create policy "System can create logs"
  on seller_verification_logs for insert
  with check (true);

-- Admins can view all logs
create policy "Admins can view all logs"
  on seller_verification_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_tier = 'platinum' -- Temporary admin check
    )
  );

-- Index for performance
create index idx_verification_logs_application_id on seller_verification_logs(application_id);
create index idx_verification_logs_action on seller_verification_logs(action);
create index idx_verification_logs_created_at on seller_verification_logs(created_at);

-- ============================================
-- SELLER TIER PROGRESSION TRACKING
-- ============================================

create table if not exists public.seller_tier_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  previous_tier text check (previous_tier in ('bronze', 'silver', 'gold', 'platinum')),
  new_tier text check (new_tier in ('bronze', 'silver', 'gold', 'platinum')) not null,

  -- Reason for change
  reason text check (reason in (
    'initial_approval',
    'sales_milestone',
    'rating_achievement',
    'manual_upgrade',
    'manual_downgrade',
    'policy_violation',
    'poor_performance'
  )) not null,

  -- Stats at time of change
  total_sales_at_change integer,
  seller_rating_at_change numeric(3, 2),

  changed_by uuid references public.profiles(id), -- null for system changes
  notes text,

  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.seller_tier_history enable row level security;

-- Tier history policies
create policy "Users can view own tier history"
  on seller_tier_history for select
  using (auth.uid() = user_id);

create policy "System can create tier history"
  on seller_tier_history for insert
  with check (true);

-- Index for performance
create index idx_tier_history_user_id on seller_tier_history(user_id);
create index idx_tier_history_created_at on seller_tier_history(created_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for seller_applications
drop trigger if exists update_seller_applications_updated_at on seller_applications;
create trigger update_seller_applications_updated_at
  before update on seller_applications
  for each row
  execute function update_updated_at_column();

-- Function to create verification log entry
create or replace function log_seller_application_event()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into seller_verification_logs (application_id, action, is_system_action, details)
    values (NEW.id, 'application_started', true, jsonb_build_object('seller_type', NEW.seller_type));
  elsif (TG_OP = 'UPDATE') then
    if (OLD.status != NEW.status) then
      if (NEW.status = 'approved') then
        insert into seller_verification_logs (application_id, action, performed_by, details)
        values (NEW.id, 'approved', NEW.reviewed_by, jsonb_build_object('reviewed_at', NEW.reviewed_at));
      elsif (NEW.status = 'rejected') then
        insert into seller_verification_logs (application_id, action, performed_by, details)
        values (NEW.id, 'rejected', NEW.reviewed_by, jsonb_build_object('reason', NEW.rejection_reason));
      elsif (NEW.status = 'info_requested') then
        insert into seller_verification_logs (application_id, action, performed_by, details)
        values (NEW.id, 'info_requested', NEW.reviewed_by, jsonb_build_object('notes', NEW.admin_notes));
      elsif (NEW.status = 'under_review') then
        insert into seller_verification_logs (application_id, action, performed_by, details)
        values (NEW.id, 'review_started', NEW.reviewed_by, jsonb_build_object('started_at', now()));
      end if;
    end if;

    if (OLD.submitted_at is null and NEW.submitted_at is not null) then
      insert into seller_verification_logs (application_id, action, is_system_action, details)
      values (NEW.id, 'submitted_for_review', true, jsonb_build_object('submitted_at', NEW.submitted_at));
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- Trigger for application events
drop trigger if exists log_seller_application_changes on seller_applications;
create trigger log_seller_application_changes
  after insert or update on seller_applications
  for each row
  execute function log_seller_application_event();

-- Function to log document uploads
create or replace function log_document_upload()
returns trigger as $$
begin
  insert into seller_verification_logs (application_id, action, performed_by, is_system_action, details)
  values (
    NEW.application_id,
    'document_uploaded',
    NEW.user_id,
    false,
    jsonb_build_object('document_type', NEW.document_type, 'file_name', NEW.file_name)
  );

  return NEW;
end;
$$ language plpgsql;

-- Trigger for document uploads
drop trigger if exists log_kyc_document_upload on seller_kyc_documents;
create trigger log_kyc_document_upload
  after insert on seller_kyc_documents
  for each row
  execute function log_document_upload();

-- ============================================
-- STORAGE BUCKETS (Run in Supabase Dashboard)
-- ============================================

-- Create storage bucket for KYC documents
-- insert into storage.buckets (id, name, public)
-- values ('kyc-documents', 'kyc-documents', false);

-- Storage policies for KYC documents
-- create policy "Users can upload own KYC documents"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'kyc-documents' and
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- create policy "Users can view own KYC documents"
--   on storage.objects for select
--   using (
--     bucket_id = 'kyc-documents' and
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- create policy "Admins can view all KYC documents"
--   on storage.objects for select
--   using (
--     bucket_id = 'kyc-documents' and
--     exists (
--       select 1 from public.profiles
--       where id = auth.uid() and seller_tier = 'platinum'
--     )
--   );

-- ============================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- View for pending applications with user info
create or replace view seller_applications_with_users as
select
  sa.*,
  p.username,
  p.full_name,
  p.avatar_url,
  (select count(*) from seller_kyc_documents where application_id = sa.id) as documents_count,
  (select count(*) from seller_kyc_documents where application_id = sa.id and verified = true) as verified_documents_count
from seller_applications sa
join profiles p on sa.user_id = p.id;

-- ============================================
-- COMMENTS
-- ============================================

comment on table seller_applications is 'Stores multi-step seller registration applications';
comment on table seller_kyc_documents is 'Encrypted KYC documents with 90-day auto-expiry';
comment on table seller_verification_logs is 'Audit trail for all seller verification actions';
comment on table seller_tier_history is 'Track seller tier progression over time';
