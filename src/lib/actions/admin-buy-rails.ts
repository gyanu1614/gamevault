'use server'

/**
 * /admin/buy-rails — the per-surface switches for the buy rails / phone bar
 * (growth point 2). Admin-only (the (admin) layout gates the page; each
 * action re-checks the role). The table has no session write policy: writes
 * go through the service role, then every public reader's cache tag is
 * revalidated so pages pick the switch up on their next visit.
 */
import { revalidatePath, revalidateTag } from 'next/cache'

import { requireRole } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { BUY_RAILS_TAG } from '@/lib/buy-rails/tags'
import { parseRailSettings, type RailSettings, type RailSurface } from '@/lib/buy-rails/model'

const ROLES = ['admin', 'super_admin'] as const
const SURFACES: readonly RailSurface[] = ['blog', 'value_item', 'value_list', 'calculator']

export async function getBuyRailSettingsAdmin(): Promise<{ ok: true; data: RailSettings } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  const { data, error } = await (createServiceRoleClient() as any)
    .from('buy_rail_settings')
    .select('blog, value_item, value_list, calculator')
    .eq('id', 1)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: parseRailSettings(data) }
}

export async function setBuyRailSurface(surface: RailSurface, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireRole([...ROLES])
  if (!SURFACES.includes(surface) || typeof on !== 'boolean') return { ok: false, error: 'Unknown setting' }
  const { error } = await (createServiceRoleClient() as any)
    .from('buy_rail_settings')
    .upsert({ id: 1, [surface]: on, updated_by: admin.userId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return { ok: false, error: error.message }
  revalidateTag(BUY_RAILS_TAG)
  revalidatePath('/admin/buy-rails')
  return { ok: true }
}
