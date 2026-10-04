import robots from '@/app/robots'

/**
 * Google's robots.txt matching, applied to the REAL robots() output: a rule
 * matches by prefix, `*` is any run, a trailing `$` anchors the end, and the
 * LONGEST matching rule wins (Allow wins a tie). Shared by the tests that pin
 * what crawlers may fetch (robots.route.test.ts, sitemap-robots.guard.test.ts).
 */
function rulesFor(kind: 'allow' | 'disallow'): string[] {
  const rules = robots().rules
  const list = Array.isArray(rules) ? rules : [rules]
  return list.flatMap((r) => (r.userAgent === '*' ? ([] as string[]).concat(r[kind] ?? []) : []))
}

export function patternMatches(pattern: string, target: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const source = body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(target)
}

/** Robots rules match from the path onward: an absolute URL is reduced to path + query. */
export function robotsTarget(urlOrPath: string): string {
  try {
    const u = new URL(urlOrPath)
    return `${u.pathname}${u.search}`
  } catch {
    return urlOrPath
  }
}

export function isBlockedByRobots(urlOrPath: string): boolean {
  const target = robotsTarget(urlOrPath)
  const longest = (rules: string[]) =>
    rules.filter((r) => patternMatches(r, target)).reduce((n, r) => Math.max(n, r.length), -1)
  return longest(rulesFor('disallow')) > longest(rulesFor('allow'))
}
