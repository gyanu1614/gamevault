import { describe, it, expect } from 'vitest'
import { MAX_REPORT_AGE_DAYS, REPORT_TOOL, REPORT_VERSION, applyRows, planApply, sha256 } from '../../../scripts/lib/adoptme-image-apply.mjs'

// The live picture swap (pnpm adoptme:images:upgrade --apply) is never run to
// test it: every refusal is proven here, on the pure check and a fake client.
const NOW = Date.parse('2026-10-27T12:00:00Z')
const webp = Buffer.from('fake webp bytes')
const row = (slug: string, source_kind: string, extra: Record<string, unknown> = {}) => ({
  slug,
  action: 'upgrade',
  source_kind,
  current_url: `https://fetch-images.b-cdn.net/images/pets/${slug}.png`,
  out_file: `normalised/${slug}.webp`,
  out_sha256: sha256(webp),
  ...extra,
})
const report = (rows: unknown[], generatedAt = '2026-10-27T10:00:00Z') => ({ tool: REPORT_TOOL, version: REPORT_VERSION, dryRun: true, generatedAt, rows })
const files = (f: string) => (f.startsWith('normalised/') ? webp : null)
const prod = { env: 'prod', yes: true, reportPath: '/tmp/run/report.json' }

describe('adoptme image apply: what --apply may do', () => {
  it('needs an explicit env, --yes for prod, and a --report', () => {
    const ok = report([row('owl', 'wiki')])
    expect(() => planApply({ reportPath: 'r.json' }, ok, files, NOW)).toThrow('--apply needs --env=local or --env=prod')
    expect(() => planApply({ env: 'production', yes: true, reportPath: 'r.json' }, ok, files, NOW)).toThrow('--env=local or --env=prod')
    expect(() => planApply({ env: 'prod', reportPath: 'r.json' }, ok, files, NOW)).toThrow('--apply --env=prod needs --yes')
    expect(() => planApply({ env: 'prod', yes: true }, ok, files, NOW)).toThrow('--apply needs --report')
    expect(planApply({ env: 'local', reportPath: 'r.json' }, ok, files, NOW).rows).toHaveLength(1)
  })

  it('only takes a recent dry-run report of this script, with the exact files it lists', () => {
    expect(() => planApply(prod, null, files, NOW)).toThrow('is not a dry-run report of this script')
    expect(() => planApply(prod, [row('owl', 'wiki')], files, NOW)).toThrow('is not a dry-run report')
    expect(() => planApply(prod, { ...report([]), dryRun: false }, files, NOW)).toThrow('is not a dry-run report')
    expect(() => planApply(prod, { ...report([]), version: 1 }, files, NOW)).toThrow('is not a dry-run report')
    const old = new Date(NOW - (MAX_REPORT_AGE_DAYS + 1) * 86_400_000).toISOString()
    expect(() => planApply(prod, report([row('owl', 'wiki')], old), files, NOW)).toThrow('8 days old: run the dry run again')
    expect(() => planApply(prod, report([row('owl', 'wiki')], 'soon'), files, NOW)).toThrow('has no valid generatedAt')
    expect(() => planApply(prod, report([row('owl', 'wiki')], '2026-11-30T00:00:00Z'), files, NOW)).toThrow('has no valid generatedAt')
    expect(() => planApply(prod, report([row('owl', 'wiki', { out_sha256: 'edited' })]), files, NOW)).toThrow('normalised/owl.webp is missing or not the file the report lists')
    expect(() => planApply(prod, report([row('owl', 'wiki', { out_file: 'gone/owl.webp' })]), files, NOW)).toThrow('missing or not the file')
  })

  it('uploads wiki pictures under wiki/hd and leaves other sources out unless asked, outside wiki/', () => {
    const rows = [row('owl', 'wiki'), row('boohoo', 'wiki-copy'), row('parrot', 'adoptmevalues', { action: 'low-res' }), { slug: 'nothing', action: 'no-picture' }]
    const plan = planApply(prod, report(rows), files, NOW)
    expect(plan.rows.map((r: { upload_path: string }) => r.upload_path)).toEqual(['wiki/hd/owl.webp', 'wiki/hd/boohoo.webp'])
    expect(plan.skipped).toEqual(['parrot (adoptmevalues picture)'])
    const all = planApply({ ...prod, includeThirdParty: true }, report(rows), files, NOW)
    expect(all.rows.map((r: { upload_path: string }) => r.upload_path)).toEqual(['wiki/hd/owl.webp', 'wiki/hd/boohoo.webp', 'hd/parrot.webp'])
  })
})

/** A fake client that records calls; `current` is each slug's image_url in the "DB". */
function fakeDb(current: Record<string, string | null>) {
  const calls: string[] = []
  const query = (kind: string, patch?: Record<string, unknown>) => {
    const where: Record<string, unknown> = {}
    const q = {
      eq: (col: string, v: unknown) => ((where[col] = v), q),
      is: (col: string, v: unknown) => ((where[col] = v), q),
      run: () => {
        const slug = (where.slug ?? Object.keys(current).find((s) => `id-${s}` === where.id)) as string
        const hit = slug in current && current[slug] === where.image_url
        calls.push(`${kind} ${slug} image_url=${String(where.image_url)} ${hit ? 'hit' : 'miss'}`)
        if (hit && patch) current[slug] = patch.image_url as string
        return hit ? { id: `id-${slug}` } : null
      },
      maybeSingle: async () => ({ data: q.run(), error: null }),
      select: async () => {
        const r = q.run()
        return { data: r ? [r] : [], error: null }
      },
    }
    return q
  }
  const db = {
    from: () => ({ select: () => query('select'), update: (patch: Record<string, unknown>) => query('update', patch) }),
    storage: { from: (bucket: string) => ({ upload: async (p: string) => (calls.push(`upload ${bucket}/${p}`), { error: null }) }) },
  }
  return { db, calls, current }
}

describe('adoptme image apply: the guarded write', () => {
  it('uploads and repoints only pets whose image_url is still what the dry run saw', async () => {
    const { db, calls, current } = fakeDb({ owl: 'https://fetch-images.b-cdn.net/images/pets/owl.png', crow: 'https://x/edited-by-admin.webp', fresh: null })
    const rows = [
      { ...row('owl', 'wiki'), upload_path: 'wiki/hd/owl.webp', bytes: webp },
      { ...row('crow', 'wiki'), upload_path: 'wiki/hd/crow.webp', bytes: webp },
      { ...row('fresh', 'wiki', { current_url: null }), upload_path: 'wiki/hd/fresh.webp', bytes: webp },
    ]
    const out = await applyRows({ db, bucket: 'adopt-me-pets', publicPrefix: 'https://x/public/adopt-me-pets/', rows })
    expect(out).toEqual({ pointed: ['owl', 'fresh'], changed: ['crow'] })
    expect(calls.filter((c) => c.startsWith('upload'))).toEqual(['upload adopt-me-pets/wiki/hd/owl.webp', 'upload adopt-me-pets/wiki/hd/fresh.webp'])
    expect(calls).toContain('update owl image_url=https://fetch-images.b-cdn.net/images/pets/owl.png hit')
    expect(calls).toContain('select crow image_url=https://fetch-images.b-cdn.net/images/pets/crow.png miss')
    expect(current).toEqual({ owl: 'https://x/public/adopt-me-pets/wiki/hd/owl.webp', crow: 'https://x/edited-by-admin.webp', fresh: 'https://x/public/adopt-me-pets/wiki/hd/fresh.webp' })
  })
})
