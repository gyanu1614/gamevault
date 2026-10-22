'use server'

/**
 * Admin Values tab (game detail → Values): one hub game's items, counts and
 * catalogue runs. Read-only; the read model is src/lib/values/admin-values.ts.
 */
import { requireRole } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { ADMIN_VALUES_VIEWS, isAdminValuesGame, loadAdminValues, type AdminValuesPage, type AdminValuesView } from '@/lib/values/admin-values'

const ROLES = ['admin', 'super_admin'] as const

export async function getAdminValues(
  gameSlug: string,
  opts: { view: AdminValuesView; q: string; page: number },
): Promise<{ ok: true; data: AdminValuesPage } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  if (!isAdminValuesGame(gameSlug)) return { ok: false, error: 'This game has no values hub.' }
  const view = ADMIN_VALUES_VIEWS.includes(opts.view) ? opts.view : 'all'
  try {
    const data = await loadAdminValues(createServiceRoleClient() as any, gameSlug, { view, q: String(opts.q ?? '').slice(0, 80), page: Number(opts.page) || 1 })
    return { ok: true, data }
  } catch (e) {
    console.error('[admin-values]', (e as Error).message)
    return { ok: false, error: (e as Error).message }
  }
}
