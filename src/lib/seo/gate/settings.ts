import type { SeoGateMode } from '@/lib/games/indexability'

/**
 * seo_settings (one row) and seo_index_overrides. Every read FAILS OPEN: a
 * failed read means report mode and no overrides, so a database hiccup can
 * never noindex the site.
 */
type Db = any

/** Tag on every public read of the gate config; the /admin/seo toggle revalidates it. */
export const SEO_GATE_TAG = 'seo:gate'

export interface GateConfig {
  mode: SeoGateMode
  plannedEnforceOn: string | null
  enforcedSince: string | null
  /** path → the owner's verdict. */
  overrides: Map<string, 'index' | 'noindex'>
}

export const REPORT_ONLY: GateConfig = { mode: 'report', plannedEnforceOn: null, enforcedSince: null, overrides: new Map() }

export async function readGateMode(db: Db): Promise<SeoGateMode> {
  try {
    const { data, error } = await db.from('seo_settings').select('gate_mode').eq('id', 1).maybeSingle()
    return !error && data?.gate_mode === 'enforce' ? 'enforce' : 'report'
  } catch {
    return 'report'
  }
}

export async function readGateConfig(db: Db): Promise<GateConfig> {
  try {
    const [settings, overrides] = await Promise.all([
      db.from('seo_settings').select('gate_mode, planned_enforce_on, enforced_since').eq('id', 1).maybeSingle(),
      db.from('seo_index_overrides').select('path, verdict').order('path').limit(1000),
    ])
    if (settings.error || overrides.error) return REPORT_ONLY
    return {
      mode: settings.data?.gate_mode === 'enforce' ? 'enforce' : 'report',
      plannedEnforceOn: settings.data?.planned_enforce_on ?? null,
      enforcedSince: settings.data?.enforced_since ?? null,
      overrides: new Map(((overrides.data ?? []) as { path: string; verdict: 'index' | 'noindex' }[]).map((o) => [o.path, o.verdict])),
    }
  } catch {
    return REPORT_ONLY
  }
}
