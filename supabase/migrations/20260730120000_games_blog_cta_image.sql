-- Per-game background image for the "Skip the grind" CTA that closes every
-- blog article.
--
-- Why a new column rather than reusing games.cover_url: cover_url is the
-- game's CARD art — portrait-ish, cropped for a tile, and already used across
-- the marketplace. The CTA needs a WIDE, low-contrast banner that text sits on
-- top of. Overloading one column would mean every future crop change to the
-- card silently reflows the article CTA.
--
-- Nullable on purpose: the CTA falls back to cover_url and then to a flat
-- panel, so a game with no banner still renders correctly.
--
-- Recommended asset: 2560 x 640 (4:1), JPG or WebP, under 400 KB.
-- It renders at up to 1280px wide and ~260px tall, so 2560 covers 2x displays.
-- Keep the focal point off-centre-left; the copy sits on the left third and a
-- dark scrim is applied over the whole image.

alter table public.games
  add column if not exists blog_cta_image_url text;

comment on column public.games.blog_cta_image_url is
  'Wide banner behind the end-of-article CTA on /[game]/blog/[slug]. '
  'Recommended 2560x640 (4:1), JPG/WebP, <400KB. Falls back to cover_url.';

notify pgrst, 'reload schema';
