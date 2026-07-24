-- SAB marketplace ingestion, parsing, aggregation, and publishing pipeline.
--
-- Requires these existing objects:
--   public.sab_brainrots
--   public.sab_mutations
--   public.sab_market_watchlist
--   public.sab_external_market_observations
--   public.sab_brainrot_market_catalog
--   public.sab_trade_price_catalog
--   public.sab_import_runs

-- ============================================================
-- Sources
-- ============================================================

create table if not exists public.sab_market_sources (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  name text not null,
  base_url text,

  collection_method text not null check (
    collection_method in (
      'official_api',
      'approved_feed',
      'csv_import',
      'manual',
      'scraper'
    )
  ),

  status text not null default 'planned' check (
    status in (
      'active',
      'planned',
      'paused',
      'disabled'
    )
  ),

  source_weight numeric(5, 2) not null default 1.00
    check (source_weight > 0),

  supports_active_listings boolean not null default true,
  supports_completed_sales boolean not null default false,

  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sab_market_sources
enable row level security;

revoke all
on public.sab_market_sources
from anon, authenticated;

insert into public.sab_market_sources (
  slug,
  name,
  base_url,
  collection_method,
  status,
  source_weight,
  supports_active_listings,
  supports_completed_sales
)
values
  (
    'ebay',
    'eBay',
    'https://www.ebay.com',
    'official_api',
    'planned',
    1.00,
    true,
    true
  ),
  (
    'eldorado',
    'Eldorado.gg',
    'https://www.eldorado.gg',
    'approved_feed',
    'planned',
    1.00,
    true,
    false
  ),
  (
    'zeusx',
    'ZeusX',
    'https://www.zeusx.com',
    'approved_feed',
    'planned',
    1.00,
    true,
    false
  ),
  (
    'u7buy',
    'U7BUY',
    'https://www.u7buy.com',
    'approved_feed',
    'planned',
    1.00,
    true,
    false
  ),
  (
    'g2g',
    'G2G',
    'https://www.g2g.com',
    'approved_feed',
    'planned',
    1.00,
    true,
    false
  )
on conflict (slug)
do update set
  name = excluded.name,
  base_url = excluded.base_url,
  collection_method = excluded.collection_method,
  source_weight = excluded.source_weight,
  supports_active_listings =
    excluded.supports_active_listings,
  supports_completed_sales =
    excluded.supports_completed_sales,
  updated_at = now();

-- ============================================================
-- Raw marketplace listings
-- ============================================================

create table if not exists public.sab_market_raw_listings (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.sab_market_sources(id)
    on delete cascade,

  external_listing_id text not null,
  listing_url text,

  listing_type text not null check (
    listing_type in (
      'active_listing',
      'completed_sale'
    )
  ),

  listing_status text not null default 'unknown' check (
    listing_status in (
      'active',
      'sold',
      'ended',
      'removed',
      'unknown'
    )
  ),

  title text not null,
  description text,

  currency text not null default 'USD',

  listed_price numeric(12, 2),
  shipping_price numeric(12, 2) not null default 0,

  quantity integer not null default 1
    check (quantity > 0),

  total_price_usd numeric(12, 2) not null
    check (total_price_usd > 0),

  unit_price_usd numeric(12, 2)
    generated always as (
      total_price_usd / nullif(quantity, 0)
    ) stored,

  seller_name text,
  seller_id text,

  listed_at timestamptz,
  ended_at timestamptz,
  observed_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),

  brainrot_id uuid
    references public.sab_brainrots(id)
    on delete set null,

  mutation_id uuid
    references public.sab_mutations(id)
    on delete set null,

  parse_status text not null default 'pending' check (
    parse_status in (
      'pending',
      'matched',
      'unmatched',
      'ambiguous',
      'rejected'
    )
  ),

  parser_confidence numeric(4, 3)
    check (
      parser_confidence is null
      or parser_confidence between 0 and 1
    ),

  is_bundle boolean not null default false,
  is_account_listing boolean not null default false,
  is_inventory_listing boolean not null default false,
  is_duplicate boolean not null default false,
  is_outlier boolean not null default false,

  rejection_reason text,
  raw_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, external_listing_id)
);

create index if not exists
  sab_market_raw_listings_source_idx
on public.sab_market_raw_listings (
  source_id,
  fetched_at desc
);

create index if not exists
  sab_market_raw_listings_variant_idx
on public.sab_market_raw_listings (
  brainrot_id,
  mutation_id,
  listing_type,
  listing_status,
  observed_at desc
)
where parse_status = 'matched';

create index if not exists
  sab_market_raw_listings_pending_idx
on public.sab_market_raw_listings (
  parse_status,
  fetched_at desc
)
where parse_status <> 'matched';

create index if not exists
  sab_market_raw_listings_price_idx
on public.sab_market_raw_listings (
  unit_price_usd
)
where parse_status = 'matched'
  and is_bundle = false
  and is_account_listing = false
  and is_inventory_listing = false
  and is_duplicate = false
  and is_outlier = false;

alter table public.sab_market_raw_listings
enable row level security;

revoke all
on public.sab_market_raw_listings
from anon, authenticated;

-- ============================================================
-- Text normalization
-- ============================================================

create or replace function public.sab_normalize_market_text(
  input_text text
)
returns text
language sql
immutable
strict
as $$
  select trim(
    regexp_replace(
      lower(input_text),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

-- ============================================================
-- Aliases
-- ============================================================

create table if not exists public.sab_brainrot_aliases (
  id uuid primary key default gen_random_uuid(),

  brainrot_id uuid not null
    references public.sab_brainrots(id)
    on delete cascade,

  alias text not null,

  normalized_alias text generated always as (
    public.sab_normalize_market_text(alias)
  ) stored,

  priority smallint not null default 50
    check (priority between 1 and 100),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (brainrot_id, normalized_alias)
);

create index if not exists
  sab_brainrot_aliases_lookup_idx
on public.sab_brainrot_aliases (
  normalized_alias,
  priority desc
)
where is_active = true;

create table if not exists public.sab_mutation_aliases (
  id uuid primary key default gen_random_uuid(),

  mutation_id uuid not null
    references public.sab_mutations(id)
    on delete cascade,

  alias text not null,

  normalized_alias text generated always as (
    public.sab_normalize_market_text(alias)
  ) stored,

  priority smallint not null default 50
    check (priority between 1 and 100),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (mutation_id, normalized_alias)
);

create index if not exists
  sab_mutation_aliases_lookup_idx
on public.sab_mutation_aliases (
  normalized_alias,
  priority desc
)
where is_active = true;

alter table public.sab_brainrot_aliases
enable row level security;

alter table public.sab_mutation_aliases
enable row level security;

revoke all
on public.sab_brainrot_aliases,
   public.sab_mutation_aliases
from anon, authenticated;

insert into public.sab_brainrot_aliases (
  brainrot_id,
  alias,
  priority
)
select
  id,
  name,
  100
from public.sab_brainrots
on conflict (brainrot_id, normalized_alias)
do nothing;

insert into public.sab_brainrot_aliases (
  brainrot_id,
  alias,
  priority
)
select
  id,
  replace(slug, '-', ' '),
  90
from public.sab_brainrots
on conflict (brainrot_id, normalized_alias)
do nothing;

insert into public.sab_mutation_aliases (
  mutation_id,
  alias,
  priority
)
select
  id,
  name,
  100
from public.sab_mutations
on conflict (mutation_id, normalized_alias)
do nothing;

insert into public.sab_mutation_aliases (
  mutation_id,
  alias,
  priority
)
select
  id,
  replace(slug, '-', ' '),
  90
from public.sab_mutations
on conflict (mutation_id, normalized_alias)
do nothing;

insert into public.sab_mutation_aliases (
  mutation_id,
  alias,
  priority
)
select
  mutation.id,
  aliases.alias,
  80
from public.sab_mutations mutation
cross join (
  values
    ('normal'),
    ('base'),
    ('no mutation'),
    ('unmutated')
) aliases(alias)
where mutation.slug = 'default'
on conflict (mutation_id, normalized_alias)
do nothing;

-- ============================================================
-- Rejection patterns
-- ============================================================

create table if not exists
  public.sab_market_rejection_patterns (
    id uuid primary key default gen_random_uuid(),

    category text not null check (
      category in (
        'bundle',
        'account',
        'inventory',
        'ambiguous_mutation',
        'service',
        'unrelated'
      )
    ),

    pattern text not null,

    normalized_pattern text generated always as (
      public.sab_normalize_market_text(pattern)
    ) stored,

    reason text not null,
    priority smallint not null default 50,
    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    unique (category, normalized_pattern)
  );

alter table public.sab_market_rejection_patterns
enable row level security;

revoke all
on public.sab_market_rejection_patterns
from anon, authenticated;

insert into public.sab_market_rejection_patterns (
  category,
  pattern,
  reason,
  priority
)
values
  (
    'bundle',
    'bundle',
    'Listing contains multiple items',
    100
  ),
  (
    'bundle',
    'item pack',
    'Listing contains multiple items',
    100
  ),
  (
    'bundle',
    'multiple brainrots',
    'Listing contains multiple Brainrots',
    100
  ),
  (
    'bundle',
    'assorted brainrots',
    'Listing contains assorted items',
    100
  ),
  (
    'bundle',
    'all mutations',
    'Listing contains multiple mutations',
    100
  ),
  (
    'bundle',
    'random brainrot',
    'Exact Brainrot is unknown',
    100
  ),
  (
    'bundle',
    'choose any brainrot',
    'Exact Brainrot is unknown',
    100
  ),
  (
    'account',
    'roblox account',
    'Account listing rather than an item',
    100
  ),
  (
    'account',
    'starter account',
    'Account listing rather than an item',
    100
  ),
  (
    'account',
    'account included',
    'Account listing rather than an item',
    100
  ),
  (
    'inventory',
    'full inventory',
    'Inventory listing rather than one item',
    100
  ),
  (
    'inventory',
    'whole inventory',
    'Inventory listing rather than one item',
    100
  ),
  (
    'inventory',
    'entire inventory',
    'Inventory listing rather than one item',
    100
  ),
  (
    'ambiguous_mutation',
    'random mutation',
    'Exact mutation is unknown',
    100
  ),
  (
    'ambiguous_mutation',
    'any mutation',
    'Exact mutation is unknown',
    100
  ),
  (
    'ambiguous_mutation',
    'mutation of choice',
    'Exact mutation is unknown',
    100
  ),
  (
    'ambiguous_mutation',
    'choose mutation',
    'Exact mutation is unknown',
    100
  ),
  (
    'service',
    'farming service',
    'Service listing rather than an item',
    100
  ),
  (
    'service',
    'boosting service',
    'Service listing rather than an item',
    100
  ),
  (
    'service',
    'farm service',
    'Service listing rather than an item',
    100
  )
on conflict (category, normalized_pattern)
do nothing;

-- ============================================================
-- Marketplace-title parser
-- ============================================================

create or replace function public.sab_parse_market_title(
  input_text text
)
returns table (
  normalized_text text,
  brainrot_id uuid,
  brainrot_name text,
  brainrot_slug text,
  mutation_id uuid,
  mutation_name text,
  mutation_slug text,
  parse_status text,
  parser_confidence numeric,
  matched_brainrot_alias text,
  matched_mutation_alias text,
  rejection_category text,
  rejection_reason text
)
language plpgsql
stable
as $$
declare
  v_normalized text;
  v_remaining text;

  v_rejection_category text;
  v_rejection_reason text;

  v_brainrot_id uuid;
  v_brainrot_alias text;
  v_brainrot_alias_length integer;
  v_brainrot_priority integer;
  v_brainrot_ties integer;
  v_brainrot_name text;
  v_brainrot_slug text;

  v_mutation_id uuid;
  v_mutation_alias text;
  v_mutation_alias_length integer;
  v_mutation_priority integer;
  v_mutation_ties integer;
  v_mutation_name text;
  v_mutation_slug text;

  v_confidence numeric;
begin
  v_normalized :=
    public.sab_normalize_market_text(
      coalesce(input_text, '')
    );

  if v_normalized = '' then
    return query
    select
      v_normalized,
      null::uuid,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      'rejected'::text,
      0.000::numeric,
      null::text,
      null::text,
      'unrelated'::text,
      'Listing title is empty'::text;

    return;
  end if;

  select
    rejection.category,
    rejection.reason
  into
    v_rejection_category,
    v_rejection_reason
  from public.sab_market_rejection_patterns rejection
  where rejection.is_active = true
    and (
      ' ' || v_normalized || ' '
      like
      '% ' || rejection.normalized_pattern || ' %'
    )
  order by
    rejection.priority desc,
    length(rejection.normalized_pattern) desc
  limit 1;

  if v_rejection_category is not null then
    return query
    select
      v_normalized,
      null::uuid,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      'rejected'::text,
      0.000::numeric,
      null::text,
      null::text,
      v_rejection_category,
      v_rejection_reason;

    return;
  end if;

  with per_brainrot as (
    select distinct on (alias.brainrot_id)
      alias.brainrot_id,
      alias.normalized_alias,
      length(alias.normalized_alias) as alias_length,
      alias.priority
    from public.sab_brainrot_aliases alias
    where alias.is_active = true
      and (
        ' ' || v_normalized || ' '
        like
        '% ' || alias.normalized_alias || ' %'
      )
    order by
      alias.brainrot_id,
      length(alias.normalized_alias) desc,
      alias.priority desc
  )
  select
    candidate.brainrot_id,
    candidate.normalized_alias,
    candidate.alias_length,
    candidate.priority
  into
    v_brainrot_id,
    v_brainrot_alias,
    v_brainrot_alias_length,
    v_brainrot_priority
  from per_brainrot candidate
  order by
    candidate.alias_length desc,
    candidate.priority desc
  limit 1;

  if v_brainrot_id is null then
    return query
    select
      v_normalized,
      null::uuid,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      'unmatched'::text,
      0.000::numeric,
      null::text,
      null::text,
      null::text,
      'No Brainrot name was recognized'::text;

    return;
  end if;

  with per_brainrot as (
    select distinct on (alias.brainrot_id)
      alias.brainrot_id,
      length(alias.normalized_alias) as alias_length,
      alias.priority
    from public.sab_brainrot_aliases alias
    where alias.is_active = true
      and (
        ' ' || v_normalized || ' '
        like
        '% ' || alias.normalized_alias || ' %'
      )
    order by
      alias.brainrot_id,
      length(alias.normalized_alias) desc,
      alias.priority desc
  )
  select count(*)
  into v_brainrot_ties
  from per_brainrot candidate
  where candidate.alias_length =
      v_brainrot_alias_length
    and candidate.priority =
      v_brainrot_priority;

  if v_brainrot_ties > 1 then
    return query
    select
      v_normalized,
      null::uuid,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      'ambiguous'::text,
      0.300::numeric,
      v_brainrot_alias,
      null::text,
      null::text,
      'Multiple Brainrots matched equally'::text;

    return;
  end if;

  select
    brainrot.name,
    brainrot.slug
  into
    v_brainrot_name,
    v_brainrot_slug
  from public.sab_brainrots brainrot
  where brainrot.id = v_brainrot_id;

  v_remaining :=
    public.sab_normalize_market_text(
      replace(
        ' ' || v_normalized || ' ',
        ' ' || v_brainrot_alias || ' ',
        ' '
      )
    );

  with per_mutation as (
    select distinct on (alias.mutation_id)
      alias.mutation_id,
      alias.normalized_alias,
      length(alias.normalized_alias) as alias_length,
      alias.priority
    from public.sab_mutation_aliases alias
    where alias.is_active = true
      and (
        ' ' || v_remaining || ' '
        like
        '% ' || alias.normalized_alias || ' %'
      )
    order by
      alias.mutation_id,
      length(alias.normalized_alias) desc,
      alias.priority desc
  )
  select
    candidate.mutation_id,
    candidate.normalized_alias,
    candidate.alias_length,
    candidate.priority
  into
    v_mutation_id,
    v_mutation_alias,
    v_mutation_alias_length,
    v_mutation_priority
  from per_mutation candidate
  order by
    candidate.alias_length desc,
    candidate.priority desc
  limit 1;

  if v_mutation_id is not null then
    with per_mutation as (
      select distinct on (alias.mutation_id)
        alias.mutation_id,
        length(alias.normalized_alias) as alias_length,
        alias.priority
      from public.sab_mutation_aliases alias
      where alias.is_active = true
        and (
          ' ' || v_remaining || ' '
          like
          '% ' || alias.normalized_alias || ' %'
        )
      order by
        alias.mutation_id,
        length(alias.normalized_alias) desc,
        alias.priority desc
    )
    select count(*)
    into v_mutation_ties
    from per_mutation candidate
    where candidate.alias_length =
        v_mutation_alias_length
      and candidate.priority =
        v_mutation_priority;

    if v_mutation_ties > 1 then
      return query
      select
        v_normalized,
        v_brainrot_id,
        v_brainrot_name,
        v_brainrot_slug,
        null::uuid,
        null::text,
        null::text,
        'ambiguous'::text,
        0.500::numeric,
        v_brainrot_alias,
        null::text,
        'ambiguous_mutation'::text,
        'Multiple mutations matched equally'::text;

      return;
    end if;

    v_confidence := 0.980;
  else
    select
      mutation.id,
      mutation.name,
      mutation.slug
    into
      v_mutation_id,
      v_mutation_name,
      v_mutation_slug
    from public.sab_mutations mutation
    where mutation.slug = 'default'
    limit 1;

    v_mutation_alias := null;
    v_confidence := 0.900;
  end if;

  if v_mutation_name is null then
    select
      mutation.name,
      mutation.slug
    into
      v_mutation_name,
      v_mutation_slug
    from public.sab_mutations mutation
    where mutation.id = v_mutation_id;
  end if;

  return query
  select
    v_normalized,
    v_brainrot_id,
    v_brainrot_name,
    v_brainrot_slug,
    v_mutation_id,
    v_mutation_name,
    v_mutation_slug,
    'matched'::text,
    v_confidence,
    v_brainrot_alias,
    v_mutation_alias,
    null::text,
    null::text;
end;
$$;

-- ============================================================
-- Automatic parser trigger
-- ============================================================

create or replace function
  public.sab_parse_raw_listing_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parsed record;
begin
  select *
  into parsed
  from public.sab_parse_market_title(new.title)
  limit 1;

  new.brainrot_id := parsed.brainrot_id;
  new.mutation_id := parsed.mutation_id;
  new.parse_status := parsed.parse_status;
  new.parser_confidence := parsed.parser_confidence;
  new.rejection_reason := parsed.rejection_reason;

  new.is_bundle := coalesce(
    parsed.rejection_category = 'bundle',
    false
  );

  new.is_account_listing := coalesce(
    parsed.rejection_category = 'account',
    false
  );

  new.is_inventory_listing := coalesce(
    parsed.rejection_category = 'inventory',
    false
  );

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  sab_parse_raw_listing_before_write
on public.sab_market_raw_listings;

create trigger sab_parse_raw_listing_before_write
before insert or update of title
on public.sab_market_raw_listings
for each row
execute function
  public.sab_parse_raw_listing_trigger();

create or replace function
  public.sab_reparse_market_listings(
    p_limit integer default 500
  )
returns table (
  processed_count bigint,
  matched_count bigint,
  rejected_count bigint,
  ambiguous_count bigint,
  unmatched_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with targets as (
    select listing.id
    from public.sab_market_raw_listings listing
    order by listing.fetched_at desc
    limit greatest(
      1,
      least(coalesce(p_limit, 500), 5000)
    )
  ),
  reparsed as (
    update public.sab_market_raw_listings listing
    set title = listing.title
    where listing.id in (
      select target.id
      from targets target
    )
    returning listing.parse_status
  )
  select
    count(*)::bigint,
    count(*) filter (
      where parse_status = 'matched'
    )::bigint,
    count(*) filter (
      where parse_status = 'rejected'
    )::bigint,
    count(*) filter (
      where parse_status = 'ambiguous'
    )::bigint,
    count(*) filter (
      where parse_status = 'unmatched'
    )::bigint
  from reparsed;
end;
$$;

revoke all
on function public.sab_reparse_market_listings(integer)
from public, anon, authenticated;

grant execute
on function public.sab_reparse_market_listings(integer)
to service_role;

-- ============================================================
-- Valid listing candidates
-- ============================================================

create or replace view
  public.sab_market_listing_candidates
with (security_invoker = true)
as
select
  listing.id,
  listing.source_id,
  source.slug as source_slug,
  source.name as source_name,
  source.source_weight,

  listing.external_listing_id,
  listing.listing_type,
  listing.listing_status,

  listing.brainrot_id,
  listing.mutation_id,

  listing.unit_price_usd,
  listing.observed_at,
  listing.fetched_at,

  coalesce(
    watchlist.minimum_cash_value_usd,
    1.00
  ) as minimum_cash_value_usd

from public.sab_market_raw_listings listing

join public.sab_market_sources source
  on source.id = listing.source_id

left join public.sab_market_watchlist watchlist
  on watchlist.brainrot_id = listing.brainrot_id
 and watchlist.mutation_id = listing.mutation_id

where listing.parse_status = 'matched'
  and listing.brainrot_id is not null
  and listing.mutation_id is not null

  and coalesce(
    listing.parser_confidence,
    0
  ) >= 0.900

  and listing.is_bundle = false
  and listing.is_account_listing = false
  and listing.is_inventory_listing = false
  and listing.is_duplicate = false
  and listing.is_outlier = false

  and listing.currency = 'USD'

  and listing.unit_price_usd >= coalesce(
    watchlist.minimum_cash_value_usd,
    1.00
  )

  and source.status <> 'disabled'

  and (
    (
      listing.listing_type = 'completed_sale'
      and listing.listing_status in (
        'sold',
        'ended'
      )
      and coalesce(
        listing.ended_at,
        listing.observed_at
      ) >= now() - interval '180 days'
    )
    or
    (
      listing.listing_type = 'active_listing'
      and listing.listing_status = 'active'
      and listing.observed_at
        >= now() - interval '30 days'
    )
  );

-- ============================================================
-- Computed outlier filtering
-- ============================================================

create or replace view
  public.sab_market_clean_listing_evidence
with (security_invoker = true)
as
with bounds as (
  select
    source_id,
    brainrot_id,
    mutation_id,
    listing_type,

    count(*) as evidence_count,

    percentile_cont(0.25)
      within group (
        order by unit_price_usd
      ) as q1_usd,

    percentile_cont(0.50)
      within group (
        order by unit_price_usd
      ) as median_usd,

    percentile_cont(0.75)
      within group (
        order by unit_price_usd
      ) as q3_usd

  from public.sab_market_listing_candidates

  group by
    source_id,
    brainrot_id,
    mutation_id,
    listing_type
)

select
  candidate.*,
  bounds.evidence_count,
  bounds.q1_usd,
  bounds.median_usd,
  bounds.q3_usd

from public.sab_market_listing_candidates candidate

join bounds
  on bounds.source_id = candidate.source_id
 and bounds.brainrot_id = candidate.brainrot_id
 and bounds.mutation_id = candidate.mutation_id
 and bounds.listing_type = candidate.listing_type

where
  bounds.evidence_count < 4

  or candidate.unit_price_usd between
    greatest(
      0.01,
      bounds.q1_usd
      - 1.5 * greatest(
          bounds.q3_usd - bounds.q1_usd,
          bounds.median_usd * 0.15
        )
    )
    and
    bounds.q3_usd
    + 1.5 * greatest(
        bounds.q3_usd - bounds.q1_usd,
        bounds.median_usd * 0.15
      );

-- ============================================================
-- One estimate per marketplace
-- ============================================================

create or replace view
  public.sab_market_source_variant_estimates
with (security_invoker = true)
as
with ranked as (
  select
    evidence.*,

    case evidence.listing_type
      when 'completed_sale' then 1
      when 'active_listing' then 2
      else 9
    end as evidence_rank,

    min(
      case evidence.listing_type
        when 'completed_sale' then 1
        when 'active_listing' then 2
        else 9
      end
    ) over (
      partition by
        evidence.source_id,
        evidence.brainrot_id,
        evidence.mutation_id
    ) as best_evidence_rank

  from public.sab_market_clean_listing_evidence
    evidence
),
best_evidence as (
  select *
  from ranked
  where evidence_rank = best_evidence_rank
)

select
  source_id,
  source_slug,
  source_name,
  source_weight,

  brainrot_id,
  mutation_id,

  case min(evidence_rank)
    when 1 then 'completed_sale'
    when 2 then 'active_listing'
    else 'unknown'
  end as evidence_type,

  percentile_cont(0.50)
    within group (
      order by unit_price_usd
    )::numeric(12, 2) as median_usd,

  percentile_cont(0.25)
    within group (
      order by unit_price_usd
    )::numeric(12, 2) as low_usd,

  percentile_cont(0.75)
    within group (
      order by unit_price_usd
    )::numeric(12, 2) as high_usd,

  count(*)::integer as sample_count,
  max(observed_at) as latest_observed_at

from best_evidence

group by
  source_id,
  source_slug,
  source_name,
  source_weight,
  brainrot_id,
  mutation_id;

-- ============================================================
-- Combined multi-market estimate
-- ============================================================

create or replace view
  public.sab_market_variant_price_estimates
with (security_invoker = true)
as
with summary as (
  select
    brainrot_id,
    mutation_id,

    percentile_cont(0.50)
      within group (
        order by median_usd
      )::numeric(12, 2) as estimate_usd,

    min(low_usd)::numeric(12, 2) as low_usd,
    max(high_usd)::numeric(12, 2) as high_usd,

    count(*)::integer as source_count,

    sum(sample_count)::integer
      as total_sample_count,

    coalesce(
      sum(sample_count) filter (
        where evidence_type = 'completed_sale'
      ),
      0
    )::integer as completed_sale_sample_count,

    coalesce(
      sum(sample_count) filter (
        where evidence_type = 'active_listing'
      ),
      0
    )::integer as active_listing_sample_count,

    min(median_usd)::numeric(12, 2)
      as minimum_source_median_usd,

    max(median_usd)::numeric(12, 2)
      as maximum_source_median_usd,

    max(latest_observed_at)
      as latest_observed_at,

    string_agg(
      source_name,
      ', '
      order by source_name
    ) as sources_used

  from public.sab_market_source_variant_estimates

  group by
    brainrot_id,
    mutation_id
),
scored as (
  select
    summary.*,

    (
      maximum_source_median_usd
      / nullif(minimum_source_median_usd, 0)
    )::numeric(10, 3)
      as source_spread_ratio

  from summary
)

select
  brainrot_id,
  mutation_id,

  estimate_usd,
  low_usd,
  high_usd,

  source_count,
  total_sample_count,
  completed_sale_sample_count,
  active_listing_sample_count,

  source_spread_ratio,
  sources_used,
  latest_observed_at,

  case
    when completed_sale_sample_count >= 3
      and source_count >= 2
      then 'high'

    when source_count >= 3
      and total_sample_count >= 6
      and source_spread_ratio <= 1.350
      then 'high'

    when completed_sale_sample_count >= 1
      then 'medium'

    when source_count >= 2
      and total_sample_count >= 3
      and source_spread_ratio <= 1.500
      then 'medium'

    when total_sample_count >= 3
      then 'low'

    when source_count >= 2
      and source_spread_ratio <= 1.750
      then 'low'

    else 'insufficient'
  end as confidence_label,

  (
    estimate_usd >= 1.00
    and (
      completed_sale_sample_count >= 1
      or total_sample_count >= 3
      or (
        source_count >= 2
        and source_spread_ratio <= 1.750
      )
    )
  ) as is_trade_ready

from scored;

-- ============================================================
-- Publish aggregate estimates
-- ============================================================

create or replace function
  public.sab_publish_market_estimates()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  published_count bigint;
begin
  insert into public.sab_external_market_observations (
    brainrot_id,
    mutation_id,

    observation_type,

    source_name,
    source_reference,

    currency,

    price_usd,
    price_low_usd,
    price_high_usd,

    sample_size,
    confidence_score,

    observed_at,
    expires_at,

    is_verified,
    is_active,

    notes
  )
  select
    estimate.brainrot_id,
    estimate.mutation_id,

    'market_range',

    'Automated multi-market estimate',

    'auto-multi-market:'
      || estimate.brainrot_id::text
      || ':'
      || estimate.mutation_id::text,

    'USD',

    estimate.estimate_usd,
    estimate.low_usd,
    estimate.high_usd,

    estimate.total_sample_count,

    case estimate.confidence_label
      when 'high' then 0.850
      when 'medium' then 0.700
      when 'low' then 0.550
      else 0.400
    end,

    estimate.latest_observed_at,
    now() + interval '48 hours',

    false,
    true,

    format(
      'Automated estimate from %s marketplace(s) and %s valid listing(s): %s',
      estimate.source_count,
      estimate.total_sample_count,
      estimate.sources_used
    )

  from public.sab_market_variant_price_estimates
    estimate

  where estimate.is_trade_ready = true
    and estimate.estimate_usd >= 1.00

  on conflict (
    source_name,
    source_reference
  )
  where source_reference is not null

  do update set
    observation_type =
      excluded.observation_type,

    price_usd =
      excluded.price_usd,

    price_low_usd =
      excluded.price_low_usd,

    price_high_usd =
      excluded.price_high_usd,

    sample_size =
      excluded.sample_size,

    confidence_score =
      excluded.confidence_score,

    observed_at =
      excluded.observed_at,

    expires_at =
      excluded.expires_at,

    is_active = true,

    notes =
      excluded.notes,

    updated_at = now();

  get diagnostics published_count = row_count;

  return published_count;
end;
$$;

revoke all
on function public.sab_publish_market_estimates()
from public, anon, authenticated;

grant execute
on function public.sab_publish_market_estimates()
to service_role;

-- ============================================================
-- Source-agnostic JSON importer
-- ============================================================

create or replace function
  public.sab_import_market_listings(
    p_source_slug text,
    p_listings jsonb
  )
returns table (
  import_run_id uuid,
  source_slug text,
  records_seen integer,
  records_inserted integer,
  records_updated integer,
  records_flagged integer,
  error_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_source_name text;
  v_run_id uuid;

  v_item jsonb;
  v_external_listing_id text;
  v_title text;
  v_listing_url text;
  v_listing_type text;
  v_listing_status text;
  v_currency text;

  v_listed_price numeric;
  v_shipping_price numeric;
  v_total_price_usd numeric;
  v_quantity integer;

  v_observed_at timestamptz;
  v_existing boolean;
  v_parse_status text;

  v_seen integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_flagged integer := 0;
  v_error_count integer := 0;

  v_errors jsonb := '[]'::jsonb;
begin
  if p_listings is null
    or jsonb_typeof(p_listings) <> 'array'
  then
    raise exception
      'p_listings must be a JSON array';
  end if;

  select
    source.id,
    source.name
  into
    v_source_id,
    v_source_name
  from public.sab_market_sources source
  where source.slug =
    lower(trim(p_source_slug))
  limit 1;

  if v_source_id is null then
    raise exception
      'Unknown marketplace source: %',
      p_source_slug;
  end if;

  insert into public.sab_import_runs (
    source_name,
    status,
    details
  )
  values (
    v_source_name,
    'running',
    jsonb_build_object(
      'source_slug',
      lower(trim(p_source_slug)),
      'requested_count',
      jsonb_array_length(p_listings),
      'import_type',
      'market_listing_json'
    )
  )
  returning id into v_run_id;

  begin
    for v_item in
      select value
      from jsonb_array_elements(p_listings)
    loop
      v_seen := v_seen + 1;

      begin
        v_external_listing_id :=
          nullif(
            trim(
              v_item
              ->> 'external_listing_id'
            ),
            ''
          );

        v_title :=
          nullif(
            trim(v_item ->> 'title'),
            ''
          );

        v_listing_url :=
          nullif(
            trim(v_item ->> 'listing_url'),
            ''
          );

        if v_external_listing_id is null then
          raise exception
            'external_listing_id is required';
        end if;

        if v_title is null then
          raise exception
            'title is required';
        end if;

        v_listing_type := coalesce(
          nullif(
            trim(v_item ->> 'listing_type'),
            ''
          ),
          'active_listing'
        );

        v_listing_status := coalesce(
          nullif(
            trim(v_item ->> 'listing_status'),
            ''
          ),
          case
            when v_listing_type =
              'completed_sale'
              then 'sold'
            else 'active'
          end
        );

        v_currency := upper(
          coalesce(
            nullif(
              trim(v_item ->> 'currency'),
              ''
            ),
            'USD'
          )
        );

        v_listed_price := nullif(
          trim(v_item ->> 'listed_price'),
          ''
        )::numeric;

        v_shipping_price := coalesce(
          nullif(
            trim(
              v_item ->> 'shipping_price'
            ),
            ''
          )::numeric,
          0
        );

        v_quantity := greatest(
          1,
          coalesce(
            nullif(
              trim(v_item ->> 'quantity'),
              ''
            )::integer,
            1
          )
        );

        v_total_price_usd := coalesce(
          nullif(
            trim(
              v_item
              ->> 'total_price_usd'
            ),
            ''
          )::numeric,
          coalesce(v_listed_price, 0)
            + coalesce(
                v_shipping_price,
                0
              )
        );

        if v_total_price_usd <= 0 then
          raise exception
            'total_price_usd must be greater than zero';
        end if;

        v_observed_at := coalesce(
          nullif(
            trim(v_item ->> 'observed_at'),
            ''
          )::timestamptz,
          now()
        );

        select exists (
          select 1
          from public.sab_market_raw_listings
            listing
          where listing.source_id =
              v_source_id
            and listing.external_listing_id =
              v_external_listing_id
        )
        into v_existing;

        insert into
          public.sab_market_raw_listings (
            source_id,
            external_listing_id,
            listing_url,

            listing_type,
            listing_status,

            title,

            currency,
            listed_price,
            shipping_price,
            quantity,
            total_price_usd,

            observed_at,
            fetched_at,

            raw_payload
          )
        values (
          v_source_id,
          v_external_listing_id,
          v_listing_url,

          v_listing_type,
          v_listing_status,

          v_title,

          v_currency,
          v_listed_price,
          v_shipping_price,
          v_quantity,
          v_total_price_usd,

          v_observed_at,
          now(),

          v_item
        )

        on conflict (
          source_id,
          external_listing_id
        )
        do update set
          listing_url =
            excluded.listing_url,

          listing_type =
            excluded.listing_type,

          listing_status =
            excluded.listing_status,

          title =
            excluded.title,

          currency =
            excluded.currency,

          listed_price =
            excluded.listed_price,

          shipping_price =
            excluded.shipping_price,

          quantity =
            excluded.quantity,

          total_price_usd =
            excluded.total_price_usd,

          observed_at =
            excluded.observed_at,

          fetched_at = now(),

          raw_payload =
            excluded.raw_payload,

          updated_at = now()

        returning parse_status
        into v_parse_status;

        if v_existing then
          v_updated := v_updated + 1;
        else
          v_inserted := v_inserted + 1;
        end if;

        if coalesce(
          v_parse_status,
          'unmatched'
        ) <> 'matched'
        then
          v_flagged := v_flagged + 1;
        end if;

      exception
        when others then
          v_error_count :=
            v_error_count + 1;

          v_flagged :=
            v_flagged + 1;

          v_errors :=
            v_errors
            || jsonb_build_array(
              jsonb_build_object(
                'row_number',
                v_seen,

                'external_listing_id',
                v_item
                  ->> 'external_listing_id',

                'error',
                sqlerrm
              )
            );
      end;
    end loop;

    update public.sab_import_runs
    set
      status = 'completed',
      pages_seen = 1,

      records_inserted =
        v_inserted,

      records_updated =
        v_updated,

      records_flagged =
        v_flagged,

      details =
        details
        || jsonb_build_object(
          'records_seen',
          v_seen,

          'error_count',
          v_error_count,

          'errors',
          v_errors
        ),

      completed_at = now()

    where id = v_run_id;

  exception
    when others then
      update public.sab_import_runs
      set
        status = 'failed',
        error_message = sqlerrm,

        details =
          details
          || jsonb_build_object(
            'records_seen',
            v_seen,

            'error_count',
            v_error_count,

            'errors',
            v_errors
          ),

        completed_at = now()

      where id = v_run_id;

      raise;
  end;

  return query
  select
    v_run_id,
    lower(trim(p_source_slug)),
    v_seen,
    v_inserted,
    v_updated,
    v_flagged,
    v_error_count;
end;
$$;

revoke all
on function public.sab_import_market_listings(
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.sab_import_market_listings(
  text,
  jsonb
)
to service_role;

-- ============================================================
-- Preserve confidence from automated aggregate observations
-- ============================================================

create or replace view
  public.sab_external_variant_price_estimates
with (security_invoker = true)
as
with normalized as (
  select
    observation.*,

    case observation.observation_type
      when 'manual_override' then 0
      when 'completed_sale' then 1
      when 'market_range' then 2
      when 'active_listing' then 3
      when 'manual_estimate' then 4
      else 9
    end as evidence_rank,

    coalesce(
      observation.price_usd,
      (
        observation.price_low_usd
        + observation.price_high_usd
      ) / 2,
      observation.price_low_usd,
      observation.price_high_usd
    ) as point_price_usd,

    coalesce(
      observation.price_low_usd,
      observation.price_usd,
      observation.price_high_usd
    ) as effective_low_usd,

    coalesce(
      observation.price_high_usd,
      observation.price_usd,
      observation.price_low_usd
    ) as effective_high_usd

  from public.sab_external_market_observations
    observation

  where observation.is_active = true

    and (
      observation.expires_at is null
      or observation.expires_at > now()
    )

    and (
      observation.observation_type =
        'manual_override'

      or (
        observation.observation_type =
          'completed_sale'
        and observation.observed_at
          >= now() - interval '180 days'
      )

      or (
        observation.observation_type =
          'market_range'
        and observation.observed_at
          >= now() - interval '60 days'
      )

      or (
        observation.observation_type =
          'active_listing'
        and observation.observed_at
          >= now() - interval '30 days'
      )

      or (
        observation.observation_type =
          'manual_estimate'
        and observation.observed_at
          >= now() - interval '30 days'
      )
    )
),
ranked as (
  select
    normalized.*,

    min(normalized.evidence_rank) over (
      partition by
        normalized.brainrot_id,
        normalized.mutation_id
    ) as best_evidence_rank

  from normalized
),
best_evidence as (
  select *
  from ranked
  where evidence_rank = best_evidence_rank
)

select
  brainrot_id,
  mutation_id,

  percentile_cont(0.5)
    within group (
      order by
        point_price_usd::double precision
    )::numeric(12, 2)
      as estimate_usd,

  percentile_cont(0.5)
    within group (
      order by
        effective_low_usd::double precision
    )::numeric(12, 2)
      as low_usd,

  percentile_cont(0.5)
    within group (
      order by
        effective_high_usd::double precision
    )::numeric(12, 2)
      as high_usd,

  min(best_evidence_rank)
    as evidence_rank,

  case min(best_evidence_rank)
    when 0 then 'manual_override'
    when 1 then 'completed_sale'
    when 2 then 'market_range'
    when 3 then 'active_listing'
    when 4 then 'manual_estimate'
    else 'unknown'
  end as source_type,

  string_agg(
    distinct source_name,
    ', '
    order by source_name
  ) as source_names,

  count(*)::integer
    as observation_count,

  coalesce(
    sum(sample_size),
    0
  )::integer
    as total_sample_size,

  count(
    distinct source_name
  )::integer
    as source_count,

  avg(
    confidence_score
  )::numeric(4, 3)
    as average_confidence_score,

  max(observed_at)
    as latest_observed_at,

  case
    when min(best_evidence_rank) = 0
      then 'reviewed'

    when min(best_evidence_rank) = 1
      and coalesce(
        sum(sample_size),
        0
      ) >= 3
      and count(
        distinct source_name
      ) >= 2
      then 'high'

    when avg(confidence_score) >= 0.800
      and coalesce(
        sum(sample_size),
        0
      ) >= 6
      and count(
        distinct source_name
      ) >= 2
      then 'high'

    when min(best_evidence_rank) = 1
      then 'medium'

    when avg(confidence_score) >= 0.650
      and coalesce(
        sum(sample_size),
        0
      ) >= 3
      then 'medium'

    when count(
      distinct source_name
    ) >= 2
      then 'medium'

    else 'low'
  end as confidence_label

from best_evidence

group by
  brainrot_id,
  mutation_id;
