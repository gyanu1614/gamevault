-- Local stack only (pnpm test:reset): the games with a content hub. On prod
-- migration 20261013173019 set these; locally the games are seeded AFTER the
-- migrations run, so the same list is applied here.
UPDATE public.games
   SET content_hub_enabled = true
 WHERE slug IN ('murder-mystery-2', 'steal-a-brainrot', 'adopt-me', 'steal-an-egg');
