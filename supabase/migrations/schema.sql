-- GameVault Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS & PROFILES
-- ============================================

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Seller information
  seller_tier text default 'bronze' check (seller_tier in ('bronze', 'silver', 'gold', 'platinum')),
  total_sales integer default 0,
  seller_rating numeric(3, 2) default 0.00 check (seller_rating >= 0 and seller_rating <= 5),
  total_reviews integer default 0,

  -- KYC status
  kyc_status text default 'pending' check (kyc_status in ('pending', 'approved', 'rejected')),
  kyc_submitted_at timestamptz,

  -- Seller payout info
  stripe_account_id text,
  payout_enabled boolean default false,

  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30)
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- ============================================
-- GAMES & CATEGORIES
-- ============================================

create table public.games (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  emoji text,
  image_url text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.games enable row level security;

-- Games policies
create policy "Games are viewable by everyone"
  on games for select
  using (is_active = true or auth.role() = 'service_role');

-- Insert default games
insert into public.games (name, slug, emoji, image_url, is_active) values
  ('Roblox', 'roblox', '🎮', null, true),
  ('Fortnite', 'fortnite', '⚔️', null, true),
  ('Valorant', 'valorant', '🔫', null, true),
  ('GTA V', 'gta-v', '🚗', null, true),
  ('Minecraft', 'minecraft', '⛏️', null, true),
  ('League of Legends', 'lol', '⚡', null, true);

-- Listing categories
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  description text,
  icon text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.categories enable row level security;

-- Categories policies
create policy "Categories are viewable by everyone"
  on categories for select
  using (true);

-- Insert default categories
insert into public.categories (name, slug, icon) values
  ('Accounts', 'accounts', '👤'),
  ('Currency', 'currency', '💰'),
  ('Items', 'items', '🎒'),
  ('Boosting', 'boosting', '🚀'),
  ('Coaching', 'coaching', '🎓');

-- ============================================
-- LISTINGS
-- ============================================

create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  game_id uuid references public.games(id) not null,
  category_id uuid references public.categories(id) not null,

  -- Listing details
  title text not null,
  description text not null,
  price numeric(10, 2) not null check (price > 0),
  currency text default 'USD' not null,

  -- Inventory
  quantity integer default 1 check (quantity >= 0),
  is_unlimited boolean default false,

  -- Status
  status text default 'active' check (status in ('draft', 'active', 'sold', 'archived', 'suspended')),

  -- Images
  images text[] default '{}',

  -- Delivery
  delivery_time text default '1-24 hours',
  delivery_method text default 'manual',

  -- Stats
  views integer default 0,
  sales integer default 0,

  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  constraint title_length check (char_length(title) >= 10 and char_length(title) <= 100)
);

-- Enable RLS
alter table public.listings enable row level security;

-- Listings policies
create policy "Active listings are viewable by everyone"
  on listings for select
  using (status = 'active' or seller_id = auth.uid());

create policy "Sellers can create listings"
  on listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on listings for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete own listings"
  on listings for delete
  using (auth.uid() = seller_id);

-- Indexes for performance
create index listings_game_id_idx on public.listings(game_id);
create index listings_category_id_idx on public.listings(category_id);
create index listings_seller_id_idx on public.listings(seller_id);
create index listings_status_idx on public.listings(status);
create index listings_created_at_idx on public.listings(created_at desc);

-- ============================================
-- ORDERS & TRANSACTIONS
-- ============================================

create table public.orders (
  id uuid default uuid_generate_v4() primary key,

  -- Parties
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  listing_id uuid references public.listings(id) not null,

  -- Order details
  quantity integer default 1 not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price > 0),
  subtotal numeric(10, 2) not null check (subtotal > 0),

  -- Fees (in percentage)
  platform_fee_rate numeric(5, 2) not null check (platform_fee_rate >= 0),
  payment_processing_fee_rate numeric(5, 2) not null check (payment_processing_fee_rate >= 0),

  -- Calculated amounts
  platform_fee numeric(10, 2) not null,
  payment_processing_fee numeric(10, 2) not null,
  total_amount numeric(10, 2) not null check (total_amount > 0),
  seller_payout numeric(10, 2) not null,

  -- Payment info
  stripe_payment_intent_id text unique,
  stripe_transfer_id text,

  -- Status
  status text default 'pending' check (status in (
    'pending',
    'paid',
    'processing',
    'completed',
    'disputed',
    'refunded',
    'cancelled'
  )),

  -- Protection period (30 days)
  protection_until timestamptz,

  -- Delivery info
  delivery_details jsonb,
  delivered_at timestamptz,

  -- Dispute
  dispute_reason text,
  disputed_at timestamptz,

  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  completed_at timestamptz
);

-- Enable RLS
alter table public.orders enable row level security;

-- Orders policies
create policy "Buyers and sellers can view their orders"
  on orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can create orders"
  on orders for insert
  with check (auth.uid() = buyer_id);

create policy "Buyers and sellers can update their orders"
  on orders for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Indexes
create index orders_buyer_id_idx on public.orders(buyer_id);
create index orders_seller_id_idx on public.orders(seller_id);
create index orders_listing_id_idx on public.orders(listing_id);
create index orders_status_idx on public.orders(status);
create index orders_created_at_idx on public.orders(created_at desc);

-- ============================================
-- MESSAGES
-- ============================================

create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,

  -- Last activity
  last_message_at timestamptz default now() not null,

  -- Timestamps
  created_at timestamptz default now() not null,

  -- Ensure one conversation per order
  unique(order_id)
);

-- Enable RLS
alter table public.conversations enable row level security;

-- Conversations policies
create policy "Participants can view conversations"
  on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,

  -- Message content
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  attachments text[] default '{}',

  -- Read status
  is_read boolean default false,
  read_at timestamptz,

  -- Timestamps
  created_at timestamptz default now() not null,

  constraint content_not_empty check (char_length(trim(content)) > 0)
);

-- Enable RLS
alter table public.messages enable row level security;

-- Messages policies
create policy "Conversation participants can view messages"
  on messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );

create policy "Conversation participants can send messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );

-- Indexes
create index messages_conversation_id_idx on public.messages(conversation_id);
create index messages_sender_id_idx on public.messages(sender_id);
create index messages_created_at_idx on public.messages(created_at desc);

-- ============================================
-- REVIEWS
-- ============================================

create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null unique,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewed_user_id uuid references public.profiles(id) on delete cascade not null,

  -- Review details
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text check (char_length(comment) <= 1000),

  -- Review type
  review_type text not null check (review_type in ('buyer_to_seller', 'seller_to_buyer')),

  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Ensure one review per order per direction
  unique(order_id, reviewer_id)
);

-- Enable RLS
alter table public.reviews enable row level security;

-- Reviews policies
create policy "Reviews are viewable by everyone"
  on reviews for select
  using (true);

create policy "Users can create reviews for completed orders"
  on reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.orders
      where orders.id = order_id
      and orders.status = 'completed'
      and (orders.buyer_id = auth.uid() or orders.seller_id = auth.uid())
    )
  );

-- Indexes
create index reviews_reviewed_user_id_idx on public.reviews(reviewed_user_id);
create index reviews_order_id_idx on public.reviews(order_id);
create index reviews_created_at_idx on public.reviews(created_at desc);

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

-- Apply updated_at trigger to tables
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at_column();

create trigger update_listings_updated_at before update on public.listings
  for each row execute function update_updated_at_column();

create trigger update_orders_updated_at before update on public.orders
  for each row execute function update_updated_at_column();

create trigger update_reviews_updated_at before update on public.reviews
  for each row execute function update_updated_at_column();

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update seller stats after review
create or replace function update_seller_rating()
returns trigger as $$
begin
  if new.review_type = 'buyer_to_seller' then
    update public.profiles
    set
      seller_rating = (
        select avg(rating)
        from public.reviews
        where reviewed_user_id = new.reviewed_user_id
        and review_type = 'buyer_to_seller'
      ),
      total_reviews = (
        select count(*)
        from public.reviews
        where reviewed_user_id = new.reviewed_user_id
        and review_type = 'buyer_to_seller'
      )
    where id = new.reviewed_user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to update seller rating
create trigger on_review_created
  after insert on public.reviews
  for each row execute function update_seller_rating();

-- Function to update listing quantity after order
create or replace function update_listing_quantity()
returns trigger as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    update public.listings
    set
      quantity = case
        when is_unlimited then quantity
        else greatest(0, quantity - new.quantity)
      end,
      sales = sales + 1,
      status = case
        when not is_unlimited and quantity - new.quantity <= 0 then 'sold'
        else status
      end
    where id = new.listing_id;

    -- Update seller stats
    update public.profiles
    set total_sales = total_sales + 1
    where id = new.seller_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to update listing after order completion
create trigger on_order_completed
  after update on public.orders
  for each row execute function update_listing_quantity();

-- Function to update conversation last_message_at
create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to update conversation
create trigger on_message_created
  after insert on public.messages
  for each row execute function update_conversation_last_message();
