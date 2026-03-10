-- Migration: Add category icon management
-- Purpose: Allow custom icons for categories (emoji or uploaded images)
-- Date: 2026-03-06

-- Add icon-related columns to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_url TEXT, -- URL to uploaded icon image
  ADD COLUMN IF NOT EXISTS icon_type VARCHAR(20) DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'image', 'svg')),
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT DEFAULT '📦', -- Fallback emoji icon
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0; -- For custom ordering

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order, name);

-- Create category-icons storage bucket for uploaded icons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'category-icons',
  'category-icons',
  true, -- Public bucket for icons
  2097152, -- 2MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

-- RLS Policy: Category icons are publicly accessible (read)
CREATE POLICY "Category icons are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'category-icons');

-- RLS Policy: Admins can upload category icons
CREATE POLICY "Admins can upload category icons"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'category-icons'
    AND auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- RLS Policy: Admins can update category icons
CREATE POLICY "Admins can update category icons"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'category-icons'
    AND auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- RLS Policy: Admins can delete category icons
CREATE POLICY "Admins can delete category icons"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'category-icons'
    AND auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Function: Get category with icon URL (handles both emoji and image)
CREATE OR REPLACE FUNCTION get_category_icon(p_category_id uuid)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'type', COALESCE(icon_type, 'emoji'),
    'emoji', COALESCE(icon_emoji, '📦'),
    'url', icon_url,
    'display', CASE
      WHEN icon_type = 'emoji' OR icon_url IS NULL THEN COALESCE(icon_emoji, '📦')
      ELSE icon_url
    END
  )
  FROM public.categories
  WHERE id = p_category_id;
$$;

-- Migrate existing emoji icons from 'icon' column to 'icon_emoji' column (if 'icon' column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'categories'
    AND column_name = 'icon'
  ) THEN
    -- Copy existing icon data to icon_emoji
    UPDATE public.categories
    SET icon_emoji = icon,
        icon_type = 'emoji'
    WHERE icon IS NOT NULL
    AND icon_emoji IS NULL;
  END IF;
END $$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_category_icon(uuid) TO authenticated, anon, service_role;

-- Add comments for documentation
COMMENT ON COLUMN public.categories.icon_url IS
  'URL to custom uploaded icon image. Overrides icon_emoji when icon_type is ''image''.';
COMMENT ON COLUMN public.categories.icon_type IS
  'Type of icon to display: emoji (default), image (uploaded), or svg.';
COMMENT ON COLUMN public.categories.icon_emoji IS
  'Fallback emoji icon. Used when icon_type is ''emoji'' or when icon_url is null.';
COMMENT ON COLUMN public.categories.sort_order IS
  'Custom sort order for categories. Lower numbers appear first. Default 0.';
