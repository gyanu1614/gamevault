import { describe, it, expect } from 'vitest'
import { alertsFor, pickInspectionTargets, sectionOfPath, sectionStats, DAILY_INSPECTION_CAP, type InspectionRow } from './check'

const S = 'https://dropmarket.gg'

describe('sectionOfPath', () => {
  it('maps a URL to its sitemap section', () => {
    expect(sectionOfPath('/adopt-me/values/bat-dragon')).toBe('values-adopt-me')
    expect(sectionOfPath('/adopt-me/values')).toBe('hubs')
    expect(sectionOfPath('/adopt-me/values/methodology')).toBe('hubs')
    expect(sectionOfPath('/roblox/sell')).toBe('sell')
    expect(sectionOfPath('/roblox/buy-robux')).toBe('buy')
    expect(sectionOfPath('/buy/buy-robux')).toBe('buy')
    expect(sectionOfPath('/blog/how-we-work')).toBe('blog')
    expect(sectionOfPath('/valorant/blog/vp-guide')).toBe('blog')
    expect(sectionOfPath('/')).toBe('static')
    expect(sectionOfPath('/terms')).toBe('static')
    expect(sectionOfPath('/roblox')).toBe('hubs')
  })
})

describe('pickInspectionTargets', () => {
  const today = '2026-10-09T00:00:00.000Z'
  it('stays under the daily cap, which leaves room under Google’s 2,000', () => {
    expect(DAILY_INSPECTION_CAP).toBeLessThanOrEqual(1500)
  })

  it('takes changed pages first, then the least recently inspected, never one already inspected today', () => {
    const last = new Map([
      [`${S}/a`, '2026-10-01T00:00:00Z'],
      [`${S}/b`, '2026-10-09T02:00:00Z'], // today
      [`${S}/c`, '2026-09-01T00:00:00Z'],
    ])
    const picked = pickInspectionTargets({
      changed: [`${S}/b`, `${S}/d`],
      sitemap: [`${S}/a`, `${S}/b`, `${S}/c`, `${S}/e`],
      lastInspected: last,
      todayStart: today,
      remaining: 4,
    })
    expect(picked).toEqual([`${S}/d`, `${S}/e`, `${S}/c`, `${S}/a`])
  })

  it('takes nothing once the day’s budget is spent', () => {
    expect(pickInspectionTargets({ changed: [`${S}/a`], sitemap: [], lastInspected: new Map(), todayStart: today, remaining: 0 })).toEqual([])
  })
})

/** A URL that is its own canonical (Google agrees). */
const self = (url: string) => ({ url, googleCanonical: url, userCanonical: url })
const row = (o: Partial<InspectionRow>): InspectionRow => ({
  ...self(o.url ?? `${S}/adopt-me/values/bat-dragon`),
  section: 'values-adopt-me',
  verdict: 'PASS',
  previousVerdict: 'PASS',
  coverageState: 'Submitted and indexed',
  robotsState: 'ALLOWED',
  pageFetchState: 'SUCCESSFUL',
  inSitemap: true,
  ...o,
})

describe('alertsFor', () => {
  const base = { sectionsToday: [], sectionsWeekAgo: [], recent: new Set<string>() }

  it('flags an indexed money page that dropped out of the index', () => {
    const a = alertsFor({ ...base, inspected: [row({ verdict: 'NEUTRAL', previousVerdict: 'PASS', coverageState: 'Crawled - currently not indexed' })] })
    expect(a.map((x) => x.kind)).toEqual(['indexed-page-dropped'])
    expect(a[0].message).toContain('/adopt-me/values/bat-dragon')
  })

  it('does not flag a non-money page dropping, or a page that was never indexed', () => {
    expect(alertsFor({ ...base, inspected: [row({ url: `${S}/terms`, section: 'static', verdict: 'NEUTRAL' })] })).toEqual([])
    expect(alertsFor({ ...base, inspected: [row({ verdict: 'NEUTRAL', previousVerdict: null })] })).toEqual([])
  })

  it('flags robots blocks, fetch errors and a foreign canonical on sitemap URLs', () => {
    const kinds = alertsFor({
      ...base,
      inspected: [
        row({ url: `${S}/a`, robotsState: 'DISALLOWED' }),
        row({ url: `${S}/b`, pageFetchState: 'SERVER_ERROR' }),
        row({ url: `${S}/valorant/buy-vp`, section: 'buy', googleCanonical: 'https://747live.bet/x', userCanonical: `${S}/valorant/buy-vp` }),
      ],
    }).map((x) => x.kind)
    expect(kinds).toEqual(['robots-blocked', 'fetch-error', 'canonical-mismatch'])
  })

  it('ignores a fetch state Google has not reported yet', () => {
    expect(alertsFor({ ...base, inspected: [row({ pageFetchState: null, verdict: null, previousVerdict: null, googleCanonical: null })] })).toEqual([])
  })

  it('flags a section whose index rate fell more than 10% week on week', () => {
    const a = alertsFor({
      ...base,
      inspected: [],
      sectionsToday: [{ section: 'values-adopt-me', inspected: 100, indexed: 40 }],
      sectionsWeekAgo: [{ section: 'values-adopt-me', inspected: 100, indexed: 50 }],
    })
    expect(a.map((x) => x.kind)).toEqual(['section-index-rate-drop'])
    expect(alertsFor({ ...base, inspected: [], sectionsToday: [{ section: 's', inspected: 100, indexed: 46 }], sectionsWeekAgo: [{ section: 's', inspected: 100, indexed: 50 }] })).toEqual([])
    // Too few inspected to judge
    expect(alertsFor({ ...base, inspected: [], sectionsToday: [{ section: 's', inspected: 5, indexed: 0 }], sectionsWeekAgo: [{ section: 's', inspected: 5, indexed: 5 }] })).toEqual([])
  })

  it('does not repeat an alert raised in the last 7 days', () => {
    const recent = new Set([`robots-blocked|${S}/a`])
    expect(alertsFor({ ...base, recent, inspected: [row({ url: `${S}/a`, robotsState: 'DISALLOWED' })] })).toEqual([])
  })
})

describe('sectionStats', () => {
  it('counts sitemap URLs, inspected and indexed per section', () => {
    const stats = sectionStats(
      new Map([['values-adopt-me', [`${S}/x`, `${S}/y`, `${S}/z`]]]),
      new Map([
        [`${S}/x`, 'PASS'],
        [`${S}/y`, 'NEUTRAL'],
      ]),
    )
    expect(stats).toEqual([{ section: 'values-adopt-me', sitemapUrls: 3, inspected: 2, indexed: 1 }])
  })
})
