import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SeoReport } from '@/lib/seo/report'

// The admin components use the automatic JSX runtime under Next; vitest compiles them classic, so React must be in scope.
;(globalThis as { React?: typeof React }).React = React
const { createElement } = React
const { SeoWeekly } = await import('./_SeoWeekly')
const { SeoBing } = await import('./_SeoBing')

const report: SeoReport = {
  day: '2026-10-20',
  weekly: {
    google: {
      now: { indexed: 101, crawled: 14, discovered: 840, unknown: 1180, clicks28d: 24, impressions28d: 450 },
      weekAgo: { indexed: 98, crawled: 14, discovered: 829, unknown: 1192, clicks28d: 23, impressions28d: 433 },
    },
    bing: { clicks7d: 84, clicksPrev7d: 70, impressions7d: 7000, impressionsPrev7d: 6500, inIndex: 1065, inIndexWeekAgo: 1030 },
    topBingPages: [{ url: 'https://dropmarket.gg/adopt-me/values', clicks: 31, impressions: 900, clicksPrevWeek: 25 }],
  },
  sections: [{ section: 'values-adopt-me', sitemapUrls: 500, indexed: 40, crawled: 3, discovered: 300, unknown: 157, clicks28d: 9, impressions28d: 200, indexedWeekAgo: 38, clicks28dWeekAgo: 7 }],
  bingDays: [{ day: '2026-10-19', clicks: 12, impressions: 1000, in_index: 1065 }],
  bingQueries: [{ query: 'adopt me values', clicks: 20, impressions: 600, avgPosition: 6.4, clicksPrevWeek: null }],
}

describe('/admin/seo panels', () => {
  it('This Week + the pipeline table render the numbers and changes', () => {
    const html = renderToStaticMarkup(createElement(SeoWeekly, { report, sectionLabel: (s: string) => s }))
    expect(html).toContain('This Week')
    expect(html).toContain('+3')
    expect(html).toContain('+20%')
    expect(html).toContain('values-adopt-me')
    expect(html).toContain('Unknown To Google 1,180')
  })
  it('Bing panel shows top pages and queries; without data it says how to switch it on', () => {
    expect(renderToStaticMarkup(createElement(SeoBing, { report }))).toContain('adopt me values')
    expect(renderToStaticMarkup(createElement(SeoBing, { report: { ...report, bingDays: [] } }))).toContain('BING_WEBMASTER_API_KEY')
  })
})
