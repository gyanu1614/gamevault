-- Blog / content CMS — moves the file-based BLOG_POSTS into the database so
-- content can be authored and managed from the admin panel without code
-- deploys, and so posts can live under nested per-game URLs
-- (/[game]/blogs/[slug]). Mirrors the existing BlogPost shape and extends it
-- with a post type (value/seller/guide), publish status, and SEO fields.

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),

  -- URL + identity. slug is unique WITHIN a game (a game can have its own
  -- "trading-values-explained"); primary_game_slug scopes the nested URL.
  slug                text        not null,
  title               text        not null,
  excerpt             text        not null default '',
  author              text        not null default 'DropMarket Team',
  read_minutes        integer     not null default 5,

  -- Content type drives the template + which section it lists under.
  --   'guide'  — general how-to / explainer
  --   'value'  — "[Game] Value List" data-rich value guide
  --   'seller' — "How to sell [Game] items" seller-acquisition guide
  post_type           text        not null default 'guide'
                      check (post_type in ('guide', 'value', 'seller')),

  -- Publish workflow. Only 'published' posts are served publicly.
  status              text        not null default 'draft'
                      check (status in ('draft', 'published', 'archived')),

  -- Game scoping. primary_game_slug owns the nested URL (/[game]/blogs/[slug]);
  -- game_slugs is the full tag set for cross-surfacing (rails on other pages).
  -- A post with no primary game is a general/site-wide post (legacy /blog).
  primary_game_slug   text,
  game_slugs          text[]      not null default '{}',

  -- Media.
  cover_url           text,

  -- Body — array of paragraph/section strings (matches the file-based shape).
  -- Kept as jsonb so richer block structures can be added later without a
  -- migration (headings, tables, embedded value widgets).
  body                jsonb       not null default '[]'::jsonb,

  -- SEO overrides (fall back to title/excerpt when null).
  seo_title           text,
  seo_description     text,

  -- Timestamps. published_at is the display/sort date (editable so imported
  -- posts keep their original date); created/updated are audit.
  published_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- slug must be unique within a game scope (null game = global scope).
  unique (primary_game_slug, slug)
);

-- Fast public lookups: published posts for a game, newest first.
create index if not exists blog_posts_game_published_idx
  on public.blog_posts (primary_game_slug, status, published_at desc);

-- Tag-based cross-surfacing (rails: "posts tagged with this game").
create index if not exists blog_posts_game_slugs_gin
  on public.blog_posts using gin (game_slugs);

-- keep updated_at fresh on every write.
create or replace function public.blog_posts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch
  before update on public.blog_posts
  for each row execute function public.blog_posts_touch_updated_at();

-- RLS: public can read only PUBLISHED posts; all writes go through the
-- service-role admin actions (which bypass RLS), matching the categories/
-- game-wizard admin pattern.
alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read
  on public.blog_posts
  for select
  using (status = 'published');
