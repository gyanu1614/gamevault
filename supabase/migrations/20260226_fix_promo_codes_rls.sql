-- Fix promo_codes RLS to use admin_roles table instead of profiles.role
-- Issue: Original policy checks profiles.role but admin system uses admin_roles table

-- Drop the incorrect policy
DROP POLICY IF EXISTS "promo_codes_admin_all" ON promo_codes;

-- Recreate with correct admin check using admin_roles table
CREATE POLICY "promo_codes_admin_all"
  ON promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND is_active = true
    )
  );

-- Also fix promo_code_usages if it has the same issue
DROP POLICY IF EXISTS "promo_code_usages_admin_all" ON promo_code_usages;

CREATE POLICY "promo_code_usages_admin_all"
  ON promo_code_usages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND is_active = true
    )
  );
