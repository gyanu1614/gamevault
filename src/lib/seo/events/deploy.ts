import type { MetadataRoute } from 'next'

/**
 * The post-deploy step: pages whose date lives in CODE (static copy, legal,
 * methodology and guide pages, /buy landing copy, hub pages dated by research
 * checks) change when a deploy ships, and no runtime trigger sees that. On the
 * first cron run of a new deployment, every such page whose sitemap lastmod is
 * newer than the previous diff is logged to the SEO change log once.
 *
 * Sections whose pages have their own triggers (values-* via the evidence
 * refresh, category pages via listing changes, sell pages via game changes)
 * are left to them.
 */
const CODE_DATED_SECTIONS = new Set(['static', 'hubs'])

const iso = (d: string | Date | undefined): string | null => {
  if (!d) return null
  const t = Date.parse(typeof d === 'string' ? d : d.toISOString())
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export function codeDatedChanges(
  sections: ReadonlyMap<string, MetadataRoute.Sitemap>,
  since: string | null,
  now: string,
): string[] {
  if (!since) return []
  const out: string[] = []
  for (const [section, entries] of sections) {
    for (const e of entries) {
      const codeDated = CODE_DATED_SECTIONS.has(section) || (section === 'buy' && new URL(e.url).pathname.startsWith('/buy/'))
      if (!codeDated) continue
      const at = iso(e.lastModified)
      if (at && at > since && at <= now) out.push(e.url)
    }
  }
  return out
}

type Db = any

/**
 * Run once per deployment (the first seo-indexnow cron after it): diff the
 * code-dated pages, log the changed ones, store the deployment id and the diff
 * time. Returns how many URLs were logged (null: same deployment, nothing done).
 */
export async function runPostDeployStep(
  db: Db,
  deps: {
    deployId: string | undefined
    now: string
    loadSections: () => Promise<ReadonlyMap<string, MetadataRoute.Sitemap>>
    record: (urls: string[], reason: string) => Promise<unknown>
  },
): Promise<number | null> {
  if (!deps.deployId) return null
  const { data: settings, error } = await db.from('seo_settings').select('last_deploy_id, lastmod_diff_at').eq('id', 1).maybeSingle()
  if (error) throw new Error(`seo_settings read: ${error.message}`)
  if (settings?.last_deploy_id === deps.deployId) return null
  const urls = codeDatedChanges(await deps.loadSections(), settings?.lastmod_diff_at ?? null, deps.now)
  if (urls.length > 0) await deps.record(urls, 'deploy-lastmod')
  const { error: we } = await db
    .from('seo_settings')
    .update({ last_deploy_id: deps.deployId, lastmod_diff_at: deps.now, updated_at: deps.now })
    .eq('id', 1)
  if (we) throw new Error(`seo_settings write: ${we.message}`)
  return urls.length
}
