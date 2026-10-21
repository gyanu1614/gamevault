/**
 * The weekly SEO check, one shape for /admin/seo ("This Week") and the
 * Thursday post to #seo-alerts: Google's pipeline (indexed / crawled /
 * discovered / unknown) and its 28-day clicks against a week ago, Bing's last
 * 7 days against the 7 before and its pages in index, and Bing's top pages.
 * Pure: the numbers come from the small daily tables (report.ts reads them).
 */

export interface GoogleTotals {
  indexed: number
  crawled: number
  discovered: number
  unknown: number
  /** Search Analytics, last 28 days (seo_section_daily keeps a rolling 28-day total per day). */
  clicks28d: number
  impressions28d: number
}

export interface BingDay { day: string; clicks: number | null; impressions: number | null; in_index: number | null }

export interface WeeklyCheck {
  google: { now: GoogleTotals; weekAgo: GoogleTotals | null }
  bing: {
    clicks7d: number | null
    clicksPrev7d: number | null
    impressions7d: number | null
    impressionsPrev7d: number | null
    inIndex: number | null
    inIndexWeekAgo: number | null
  } | null
  topBingPages: Array<{ url: string; clicks: number; impressions: number; clicksPrevWeek: number | null }>
}

const sum = (xs: Array<number | null>) => (xs.some((x) => x != null) ? xs.reduce<number>((a, x) => a + (x ?? 0), 0) : null)

/** Bing: the last 7 days with data against the 7 before; pages in index now and ~7 days earlier. */
export function bingWeek(days: BingDay[]): WeeklyCheck['bing'] {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  if (sorted.length === 0) return null
  const last = sorted.slice(-7)
  const prev = sorted.slice(-14, -7)
  const withIndex = sorted.filter((d) => d.in_index != null)
  const inIndex = withIndex.at(-1)?.in_index ?? null
  const weekAgoDay = withIndex.length ? new Date(Date.parse(withIndex.at(-1)!.day) - 7 * 86_400_000).toISOString().slice(0, 10) : null
  const inIndexWeekAgo = weekAgoDay ? [...withIndex].reverse().find((d) => d.day <= weekAgoDay)?.in_index ?? null : null
  return {
    clicks7d: sum(last.map((d) => d.clicks)),
    clicksPrev7d: prev.length ? sum(prev.map((d) => d.clicks)) : null,
    impressions7d: sum(last.map((d) => d.impressions)),
    impressionsPrev7d: prev.length ? sum(prev.map((d) => d.impressions)) : null,
    inIndex,
    inIndexWeekAgo,
  }
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** "+3", "−12", "±0" — a change with its sign; null when there is nothing to compare. */
export function delta(now: number | null | undefined, then: number | null | undefined): string | null {
  if (now == null || then == null) return null
  const d = now - then
  return d === 0 ? '±0' : d > 0 ? `+${fmt(d)}` : `−${fmt(-d)}`
}

/** "+18%" / "−9%"; null when the base is missing or zero. */
export function pct(now: number | null | undefined, then: number | null | undefined): string | null {
  if (now == null || then == null || then === 0) return null
  const p = Math.round(((now - then) / then) * 100)
  return p === 0 ? '±0%' : p > 0 ? `+${p}%` : `−${-p}%`
}

const withChange = (value: number | null, change: string | null) => (value == null ? '—' : change ? `${fmt(value)} (${change})` : fmt(value))
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/** The Discord post: three short lines, numbers first. */
export function weeklyMessage(w: WeeklyCheck, weekEnding: string): string {
  const g = w.google
  const b = w.bing
  const lines = [
    `📈 **Weekly SEO check** — week to ${weekEnding}`,
    `**Google:** ${withChange(g.now.indexed, delta(g.now.indexed, g.weekAgo?.indexed))} indexed · ${withChange(g.now.crawled, delta(g.now.crawled, g.weekAgo?.crawled))} crawled, not indexed · ${withChange(g.now.discovered, delta(g.now.discovered, g.weekAgo?.discovered))} discovered · ${withChange(g.now.unknown, delta(g.now.unknown, g.weekAgo?.unknown))} unknown · ${withChange(g.now.clicks28d, delta(g.now.clicks28d, g.weekAgo?.clicks28d))} clicks (28 days)`,
    b
      ? `**Bing:** ${withChange(b.clicks7d, pct(b.clicks7d, b.clicksPrev7d))} clicks · ${withChange(b.impressions7d, pct(b.impressions7d, b.impressionsPrev7d))} impressions (7 days) · ${withChange(b.inIndex, delta(b.inIndex, b.inIndexWeekAgo))} pages in index`
      : '**Bing:** no data yet (add BING_WEBMASTER_API_KEY)',
  ]
  if (w.topBingPages.length) {
    lines.push(`**Top on Bing:** ${w.topBingPages.slice(0, 5).map((p) => `${pathOf(p.url)} (${fmt(p.clicks)})`).join(' · ')}`)
  }
  return lines.join('\n')
}
