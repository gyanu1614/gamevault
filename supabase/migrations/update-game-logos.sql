-- Update Game Logos
-- Run this in Supabase SQL Editor after adding your logo files to /public/games/

-- Update all game logos
UPDATE games SET image_url = '/games/roblox.png' WHERE slug = 'roblox';
UPDATE games SET image_url = '/games/fortnite.png' WHERE slug = 'fortnite';
UPDATE games SET image_url = '/games/valorant.png' WHERE slug = 'valorant';
UPDATE games SET image_url = '/games/gta-v.png' WHERE slug = 'gta-v';
UPDATE games SET image_url = '/games/minecraft.png' WHERE slug = 'minecraft';
UPDATE games SET image_url = '/games/lol.png' WHERE slug = 'lol';

-- Verify the updates
SELECT id, name, slug, emoji, image_url FROM games ORDER BY name;
