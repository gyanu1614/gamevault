/**
 * Split chat text into plain-text and link segments.
 *
 * Only http(s) URLs and bare "www." hosts become links; anything else
 * (javascript:, data:, mailto:) stays text. Trailing sentence punctuation
 * is left out of the link ("see https://x.com/a." links to /a).
 */

export type TextSegment = { type: 'text'; value: string } | { type: 'link'; value: string; href: string }

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi
const TRAILING = /[).,!?;:\]}]+$/

function safeHref(raw: string): string | null {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export function linkifySegments(text: string): TextSegment[] {
  const out: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    let url = m[0]
    const trail = url.match(TRAILING)?.[0] ?? ''
    if (trail) url = url.slice(0, url.length - trail.length)
    const href = url ? safeHref(url) : null
    if (!href) continue
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) })
    out.push({ type: 'link', value: url, href })
    last = start + url.length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}
