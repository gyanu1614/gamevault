-- Migration: Create listing_templates table for game-specific dynamic fields
-- Date: 2026-02-06
-- Purpose: Define dynamic form fields for different game/category combinations

-- Create listing_templates table
CREATE TABLE IF NOT EXISTS public.listing_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(game_id, category_id)
);

-- Create indexes for performance
CREATE INDEX idx_listing_templates_game_id ON public.listing_templates(game_id);
CREATE INDEX idx_listing_templates_category_id ON public.listing_templates(category_id);
CREATE INDEX idx_listing_templates_game_category ON public.listing_templates(game_id, category_id);
CREATE INDEX idx_listing_templates_active ON public.listing_templates(is_active) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE public.listing_templates IS 'Defines dynamic form fields for different game/category combinations';
COMMENT ON COLUMN public.listing_templates.fields IS 'Array of field definitions as JSON objects with name, type, label, required, options, etc.';

-- Enable Row Level Security
ALTER TABLE public.listing_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Everyone can view active templates
CREATE POLICY "Anyone can view active listing templates"
  ON public.listing_templates
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage listing templates"
  ON public.listing_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_listing_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_listing_template_timestamp_trigger ON public.listing_templates;
CREATE TRIGGER update_listing_template_timestamp_trigger
  BEFORE UPDATE ON public.listing_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_template_timestamp();

-- Grant permissions
GRANT SELECT ON public.listing_templates TO authenticated, anon;
GRANT ALL ON public.listing_templates TO service_role;

-- Insert default templates for popular games

-- Roblox Accounts Template
INSERT INTO public.listing_templates (game_id, category_id, template_name, fields)
SELECT
  g.id,
  c.id,
  'Roblox Account Template',
  '[
    {
      "name": "account_level",
      "type": "number",
      "label": "Account Level",
      "required": true,
      "min": 1,
      "max": 500,
      "placeholder": "e.g. 150"
    },
    {
      "name": "robux_amount",
      "type": "number",
      "label": "Robux Amount",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 5000"
    },
    {
      "name": "premium_active",
      "type": "boolean",
      "label": "Premium Membership Active",
      "required": false,
      "defaultValue": false
    },
    {
      "name": "limiteds_count",
      "type": "number",
      "label": "Number of Limited Items",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 10"
    },
    {
      "name": "rap_value",
      "type": "number",
      "label": "RAP Value (Recent Average Price)",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 50000"
    },
    {
      "name": "account_age",
      "type": "select",
      "label": "Account Age",
      "required": false,
      "options": [
        {"value": "0-6months", "label": "0-6 months"},
        {"value": "6-12months", "label": "6-12 months"},
        {"value": "1-2years", "label": "1-2 years"},
        {"value": "2-5years", "label": "2-5 years"},
        {"value": "5+years", "label": "5+ years"}
      ]
    },
    {
      "name": "notable_items",
      "type": "textarea",
      "label": "Notable Items/Badges",
      "required": false,
      "maxLength": 500,
      "placeholder": "List rare items, badges, or achievements"
    }
  ]'::jsonb
FROM public.games g, public.categories c
WHERE g.slug = 'roblox' AND c.slug = 'accounts'
ON CONFLICT (game_id, category_id) DO NOTHING;

-- Valorant Accounts Template
INSERT INTO public.listing_templates (game_id, category_id, template_name, fields)
SELECT
  g.id,
  c.id,
  'Valorant Account Template',
  '[
    {
      "name": "current_rank",
      "type": "select",
      "label": "Current Rank",
      "required": true,
      "options": [
        {"value": "iron", "label": "Iron"},
        {"value": "bronze", "label": "Bronze"},
        {"value": "silver", "label": "Silver"},
        {"value": "gold", "label": "Gold"},
        {"value": "platinum", "label": "Platinum"},
        {"value": "diamond", "label": "Diamond"},
        {"value": "immortal", "label": "Immortal"},
        {"value": "radiant", "label": "Radiant"}
      ]
    },
    {
      "name": "peak_rank",
      "type": "select",
      "label": "Peak Rank",
      "required": false,
      "options": [
        {"value": "iron", "label": "Iron"},
        {"value": "bronze", "label": "Bronze"},
        {"value": "silver", "label": "Silver"},
        {"value": "gold", "label": "Gold"},
        {"value": "platinum", "label": "Platinum"},
        {"value": "diamond", "label": "Diamond"},
        {"value": "immortal", "label": "Immortal"},
        {"value": "radiant", "label": "Radiant"}
      ]
    },
    {
      "name": "region",
      "type": "select",
      "label": "Account Region",
      "required": true,
      "options": [
        {"value": "na", "label": "North America"},
        {"value": "eu", "label": "Europe"},
        {"value": "asia", "label": "Asia Pacific"},
        {"value": "latam", "label": "Latin America"},
        {"value": "br", "label": "Brazil"},
        {"value": "kr", "label": "Korea"}
      ]
    },
    {
      "name": "agents_unlocked",
      "type": "number",
      "label": "Agents Unlocked",
      "required": false,
      "min": 0,
      "max": 30,
      "placeholder": "e.g. 25"
    },
    {
      "name": "skins_count",
      "type": "number",
      "label": "Number of Skins",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 50"
    },
    {
      "name": "valorant_points",
      "type": "number",
      "label": "Valorant Points (VP)",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 2000"
    },
    {
      "name": "radianite_points",
      "type": "number",
      "label": "Radianite Points",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 100"
    },
    {
      "name": "notable_skins",
      "type": "textarea",
      "label": "Notable Skins (Premium/Exclusive)",
      "required": false,
      "maxLength": 500,
      "placeholder": "e.g. Prime Vandal, Elderflame Operator, etc."
    }
  ]'::jsonb
FROM public.games g, public.categories c
WHERE g.slug = 'valorant' AND c.slug = 'accounts'
ON CONFLICT (game_id, category_id) DO NOTHING;

-- Fortnite Accounts Template
INSERT INTO public.listing_templates (game_id, category_id, template_name, fields)
SELECT
  g.id,
  c.id,
  'Fortnite Account Template',
  '[
    {
      "name": "account_level",
      "type": "number",
      "label": "Account Level",
      "required": false,
      "min": 1,
      "placeholder": "e.g. 350"
    },
    {
      "name": "skins_count",
      "type": "number",
      "label": "Number of Skins",
      "required": true,
      "min": 0,
      "placeholder": "e.g. 150"
    },
    {
      "name": "vbucks_amount",
      "type": "number",
      "label": "V-Bucks Amount",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 5000"
    },
    {
      "name": "rare_skins",
      "type": "textarea",
      "label": "Rare/OG Skins",
      "required": false,
      "maxLength": 500,
      "placeholder": "e.g. Renegade Raider, Skull Trooper, Ghoul Trooper, etc."
    },
    {
      "name": "emotes_count",
      "type": "number",
      "label": "Number of Emotes",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 100"
    },
    {
      "name": "pickaxes_count",
      "type": "number",
      "label": "Number of Pickaxes",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 80"
    },
    {
      "name": "stw_access",
      "type": "boolean",
      "label": "Save the World Access",
      "required": false,
      "defaultValue": false
    }
  ]'::jsonb
FROM public.games g, public.categories c
WHERE g.slug = 'fortnite' AND c.slug = 'accounts'
ON CONFLICT (game_id, category_id) DO NOTHING;

-- League of Legends Accounts Template
INSERT INTO public.listing_templates (game_id, category_id, template_name, fields)
SELECT
  g.id,
  c.id,
  'League of Legends Account Template',
  '[
    {
      "name": "summoner_level",
      "type": "number",
      "label": "Summoner Level",
      "required": true,
      "min": 1,
      "placeholder": "e.g. 300"
    },
    {
      "name": "current_rank",
      "type": "select",
      "label": "Current Rank",
      "required": false,
      "options": [
        {"value": "iron", "label": "Iron"},
        {"value": "bronze", "label": "Bronze"},
        {"value": "silver", "label": "Silver"},
        {"value": "gold", "label": "Gold"},
        {"value": "platinum", "label": "Platinum"},
        {"value": "diamond", "label": "Diamond"},
        {"value": "master", "label": "Master"},
        {"value": "grandmaster", "label": "Grandmaster"},
        {"value": "challenger", "label": "Challenger"}
      ]
    },
    {
      "name": "region",
      "type": "select",
      "label": "Server Region",
      "required": true,
      "options": [
        {"value": "na", "label": "North America"},
        {"value": "euw", "label": "Europe West"},
        {"value": "eune", "label": "Europe Nordic & East"},
        {"value": "kr", "label": "Korea"},
        {"value": "br", "label": "Brazil"},
        {"value": "lan", "label": "Latin America North"},
        {"value": "las", "label": "Latin America South"},
        {"value": "oce", "label": "Oceania"},
        {"value": "tr", "label": "Turkey"},
        {"value": "ru", "label": "Russia"},
        {"value": "jp", "label": "Japan"}
      ]
    },
    {
      "name": "champions_owned",
      "type": "number",
      "label": "Champions Owned",
      "required": false,
      "min": 0,
      "max": 170,
      "placeholder": "e.g. 150"
    },
    {
      "name": "skins_count",
      "type": "number",
      "label": "Number of Skins",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 200"
    },
    {
      "name": "blue_essence",
      "type": "number",
      "label": "Blue Essence Amount",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 50000"
    },
    {
      "name": "rp_amount",
      "type": "number",
      "label": "Riot Points (RP)",
      "required": false,
      "min": 0,
      "placeholder": "e.g. 5000"
    },
    {
      "name": "rare_skins",
      "type": "textarea",
      "label": "Rare/Prestige Skins",
      "required": false,
      "maxLength": 500,
      "placeholder": "e.g. Championship Riven, PAX TF, Prestige skins, etc."
    }
  ]'::jsonb
FROM public.games g, public.categories c
WHERE g.slug = 'league-of-legends' AND c.slug = 'accounts'
ON CONFLICT (game_id, category_id) DO NOTHING;
