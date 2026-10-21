import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const yml = readFileSync(join(process.cwd(), '.github/workflows/seo-hourly.yml'), 'utf8')
const gscStep = yml.slice(yml.indexOf('- name: Google URL Inspection batch'))

// 2026-10-20 usage audit (A8): every seo-gsc call loads the whole sitemap input
// and every stored inspection from Supabase (~1-2.5 MB), 24 times a day. One
// batch inspects ~150 pages and the sitemap is ~1,000, so 8 batches a day
// cover it; the other 16 hourly runs found nothing to inspect but still paid
// the full load. IndexNow delivery stays hourly (it reads only due rows).
describe('seo-hourly cadence', () => {
  it('runs the Google inspection batch only every 3rd UTC hour on a schedule', () => {
    expect(gscStep).toMatch(/date -u \+%H/)
    expect(gscStep).toMatch(/% 3/)
    // A manual run always inspects.
    expect(gscStep).toMatch(/workflow_dispatch/)
  })

  it('keeps the IndexNow delivery step unconditional', () => {
    const indexNow = yml.slice(yml.indexOf('- name: Deliver the SEO change log to IndexNow'), yml.indexOf('- name: Google URL Inspection batch'))
    expect(indexNow).not.toMatch(/% 3/)
  })
})
