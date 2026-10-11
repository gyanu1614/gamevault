-- ============================================================================
-- Phase 1 · Step 4 — bulk listing importer: batches, rows, aliases
--
-- A batch is a paste / CSV upload that becomes listings. The ROWS table is the
-- audit trail and the review file at once: every input row is stored, matched
-- or not, so nothing a supplier sent is ever silently dropped. Applying a batch
-- writes listings through the app's shared create seam (src/lib/listings/
-- create.ts) — these tables never become a second listing-creation path.
--
-- Posture (DLT-005/006): the default TABLES privilege is closed as of
-- 20260921005842, so these tables are born with no anon/authenticated grant.
-- RLS is enabled with ZERO policies — deny-all for every JWT caller, the
-- service role bypasses it. The explicit REVOKE matches the sibling
-- crawl-internal tables and keeps the posture guard green without an
-- allow-list entry. Admin access goes through server actions that call
-- requireAdmin() and use the service-role client.
--
-- No counters are stored on the batch beyond the immutable input row count:
-- matched / applied / failed are counted from listing_import_rows on read, so
-- they cannot drift from the rows they describe.
-- ============================================================================

-- ── 1. Batches ──────────────────────────────────────────────────────────────
create table if not exists public.listing_import_batches (
  id                uuid primary key default gen_random_uuid(),
  -- The store the listings belong to. Not the admin: an admin imports ON
  -- BEHALF OF a seller account, and the listing's seller_id is this one.
  seller_id         uuid not null references public.profiles(id) on delete cascade,
  game_id           uuid not null references public.games(id) on delete cascade,
  -- The enabled (game, category) pair every row lands in (AUTH-010 is checked
  -- in the app against game_categories before a batch can be applied).
  game_category_id  uuid not null references public.game_categories(id) on delete restrict,
  -- Where the rows came from. 'discord' is reserved for the later bot ingest.
  source            text not null default 'paste',
  status            text not null default 'draft',
  -- 'auto'     resolve each price from the game's market table − undercut_pct
  -- 'explicit' every row carries its own price
  pricing_mode      text not null default 'auto',
  undercut_pct      numeric(5, 2) not null default 0,
  -- Opt-in to pricing from DERIVED values (Adopt Me's seeded launch numbers,
  -- SAB's public estimates). Off by default: "never invent a price" is the rule,
  -- and an estimate is not an observed one.
  allow_estimated   boolean not null default false,
  -- Bumped when a game's title/description template changes, so a re-import
  -- can tell "same item, new copy" from "nothing to do".
  template_version  integer not null default 1,
  -- A human label for the batch list ("Adopt Me restock, 29 Sep").
  label             text,
  -- The admin who created it (audit; distinct from seller_id above).
  created_by        uuid not null references public.profiles(id) on delete restrict,
  -- Immutable: how many rows the input had. Everything else is counted.
  row_count         integer not null default 0,
  applied_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint listing_import_batches_source_check
    check (source in ('csv', 'paste', 'discord')),
  constraint listing_import_batches_status_check
    check (status in ('draft', 'previewed', 'applied', 'paused', 'removed')),
  constraint listing_import_batches_pricing_mode_check
    check (pricing_mode in ('auto', 'explicit')),
  constraint listing_import_batches_undercut_check
    check (undercut_pct >= 0 and undercut_pct <= 90),
  constraint listing_import_batches_row_count_check
    check (row_count >= 0)
);

create index if not exists listing_import_batches_seller_idx
  on public.listing_import_batches (seller_id, created_at desc);
create index if not exists listing_import_batches_game_idx
  on public.listing_import_batches (game_id, created_at desc);

-- ── 2. Rows — the audit trail AND the review file ───────────────────────────
create table if not exists public.listing_import_rows (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.listing_import_batches(id) on delete cascade,
  -- 1-based line number in the input, so an error points at what the owner
  -- pasted.
  row_no         integer not null,
  -- The input row verbatim. Never re-parsed from a re-upload: this is the
  -- evidence of what was actually submitted.
  raw            jsonb not null default '{}'::jsonb,
  -- matched    → resolved to exactly one catalogue item (and variant)
  -- ambiguous  → several candidates scored alike; NEVER auto-matched
  -- unmatched  → no candidate cleared the bar; candidates hold the top 3
  -- rejected   → matched, but cannot become a listing (e.g. no market price)
  match_status   text not null default 'unmatched',
  -- The catalogue item's stable slug. Half of the idempotency key, and what
  -- listings.import_item_ref stores.
  item_ref       text,
  item_name      text,
  -- NULL when the game has no variant axis (Steal An Egg eggs).
  variant_ref    text,
  variant_label  text,
  quantity       integer,
  price_mode     text,
  -- What the input asked for (NULL in auto mode).
  price_input    numeric(12, 4),
  -- What the preview resolved and the apply wrote.
  resolved_price numeric(12, 4),
  -- The market price the auto rule started from, kept so a stale batch can be
  -- explained without re-reading the price table.
  market_price   numeric(12, 4),
  image_url      text,
  -- The copy the preview showed. Stored so the preview an admin approved and the
  -- listing that gets written cannot differ, and so a reviewer reads the real
  -- title rather than a re-render of it.
  title          text,
  description    text,
  -- The game's filter attributes (Trait, Item Type…) resolved against the live
  -- attribute template, keyed by attribute slug. Written to
  -- listings.template_data on apply. Without it an imported listing is HIDDEN
  -- the moment a buyer filters, not merely unfiltered.
  template_data  jsonb not null default '{}'::jsonb,
  -- Up to 3 scored candidates for a reviewer to pick from.
  candidates     jsonb not null default '[]'::jsonb,
  -- Set on apply. ON DELETE SET NULL: deleting a listing must not erase the
  -- record that the import created one.
  listing_id     uuid references public.listings(id) on delete set null,
  -- What apply did: created a listing, updated an existing one, or nothing.
  action         text,
  -- The user-facing reason this row did not become a listing.
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint listing_import_rows_batch_row_key unique (batch_id, row_no),
  constraint listing_import_rows_row_no_check check (row_no >= 1),
  constraint listing_import_rows_match_status_check
    check (match_status in ('matched', 'ambiguous', 'unmatched', 'rejected')),
  constraint listing_import_rows_price_mode_check
    check (price_mode is null or price_mode in ('auto', 'explicit')),
  constraint listing_import_rows_action_check
    check (action is null or action in ('created', 'updated', 'skipped', 'failed')),
  -- A matched row must name what it matched: the apply step keys on it.
  constraint listing_import_rows_matched_has_ref_check
    check (match_status <> 'matched' or item_ref is not null)
);

create index if not exists listing_import_rows_batch_idx
  on public.listing_import_rows (batch_id, row_no);
create index if not exists listing_import_rows_review_idx
  on public.listing_import_rows (batch_id, match_status);
create index if not exists listing_import_rows_listing_idx
  on public.listing_import_rows (listing_id) where listing_id is not null;

-- ── 3. Import-only aliases ──────────────────────────────────────────────────
-- Each game already has its own alias mechanism for MARKET titles
-- (sab_brainrot_aliases, values_item_aliases). This is for the spellings a
-- SUPPLIER uses in a stock list, which are a different vocabulary and must not
-- pollute the pricing matchers. A reviewer teaching the importer one spelling
-- writes a row here and every later batch matches it.
create table if not exists public.listing_import_aliases (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  alias       text not null,
  item_ref    text not null,
  variant_ref text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint listing_import_aliases_alias_check check (length(trim(alias)) > 0)
);

-- Case-insensitive uniqueness: "Shadow Dragon" and "shadow dragon" are one
-- alias. A table constraint cannot hold an expression, so this is an index.
create unique index if not exists listing_import_aliases_game_alias_key
  on public.listing_import_aliases (game_id, lower(trim(alias)));

-- ── 4. listings: which import owns a row ────────────────────────────────────
alter table public.listings
  add column if not exists import_batch_id uuid
    references public.listing_import_batches(id) on delete set null,
  -- The catalogue item + variant this listing represents. Denormalised onto
  -- the listing (not read through the rows table) because it is the
  -- idempotency key a re-import looks up, and that lookup must be one index
  -- hit on listings.
  add column if not exists import_item_ref text,
  add column if not exists import_variant text;

create index if not exists listings_import_batch_idx
  on public.listings (import_batch_id) where import_batch_id is not null;

-- Idempotency: ONE listing per (seller, game, item, variant) among rows the
-- importer owns, for good. Re-importing the same stock list updates price and
-- quantity instead of creating duplicates; re-importing a removed (archived)
-- or sold-out row brings the SAME listing back, URL and all.
--   · partial on import_item_ref only — hand-made listings are untouched
--   · NO status in the predicate, on purpose. Order and refund triggers move
--     a listing between statuses (update_listing_quantity: archived/active →
--     sold, sold → active on a stock return) but never touch these four
--     columns. A status-filtered index would let such a trigger move a row
--     INTO the index next to its re-imported twin, and the unique violation
--     would fail the order completion or refund itself (reproduced locally
--     2026-10-10: release_with_reserve on an archived imported listing).
--   · coalesce(variant,'') so "no variant" is one slot rather than many NULLs
create unique index if not exists listings_import_identity_key
  on public.listings (seller_id, game_id, import_item_ref, coalesce(import_variant, ''))
  where import_item_ref is not null;

-- ── 5. updated_at ───────────────────────────────────────────────────────────
create or replace function public.listing_import_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.listing_import_touch_updated_at() from public, anon, authenticated;

drop trigger if exists trg_listing_import_batches_touch on public.listing_import_batches;
create trigger trg_listing_import_batches_touch before update on public.listing_import_batches
  for each row execute function public.listing_import_touch_updated_at();

drop trigger if exists trg_listing_import_rows_touch on public.listing_import_rows;
create trigger trg_listing_import_rows_touch before update on public.listing_import_rows
  for each row execute function public.listing_import_touch_updated_at();

-- ── 6. Posture: RLS on, zero policies, no JWT grant ────────────────────────
alter table public.listing_import_batches enable row level security;
alter table public.listing_import_rows    enable row level security;
alter table public.listing_import_aliases enable row level security;

revoke all on table public.listing_import_batches from public, anon, authenticated;
revoke all on table public.listing_import_rows    from public, anon, authenticated;
revoke all on table public.listing_import_aliases from public, anon, authenticated;

comment on table public.listing_import_batches is
  'Step 4 bulk importer: one paste/CSV run. Service-role only; admin reaches it through requireAdmin() server actions.';
comment on table public.listing_import_rows is
  'Step 4 bulk importer: every input row, matched or not. The audit trail and the reviewer''s work list.';
comment on table public.listing_import_aliases is
  'Step 4 bulk importer: supplier spellings → catalogue item. Separate from each game''s market-title aliases on purpose.';
comment on column public.listings.import_item_ref is
  'Catalogue item slug when this listing was created by the bulk importer. With (seller_id, game_id, import_variant) it is the re-import idempotency key.';
