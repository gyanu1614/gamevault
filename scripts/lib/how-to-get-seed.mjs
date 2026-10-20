/**
 * The How To Get seed contract shared by the per-game importers
 * (import-mm2-how-to-get, import-sab-facts, import-adopt-me-how-to-get): one
 * validator, one stored shape, one equality — the same object parseHowToGet
 * (src/lib/values/how-to-get.ts) reads back.
 */
export const STATUSES = new Set(['obtainable', 'unobtainable', 'unknown', 'seasonal'])
export const CONFIDENCE = new Set(['high', 'medium', 'low'])
export const OPTIONAL = ['costs', 'odds', 'released', 'note']

export const isText = (v) => typeof v === 'string' && v.trim().length > 0

/** Problems with one How To Get entry (empty = valid). `at` prefixes each message. */
export function howToGetErrors(h, at) {
  const errors = []
  if (!STATUSES.has(h?.status)) errors.push(`${at}: status must be ${[...STATUSES].join('|')}`)
  if (!isText(h?.method)) errors.push(`${at}: method is required`)
  for (const k of OPTIONAL) if (h?.[k] != null && typeof h[k] !== 'string') errors.push(`${at}: ${k} must be a string`)
  if (!Array.isArray(h?.sources) || !h.sources.length || !h.sources.every((s) => /^https:\/\/\S+$/.test(s)))
    errors.push(`${at}: sources must be a non-empty list of https URLs`)
  if (!CONFIDENCE.has(h?.confidence)) errors.push(`${at}: confidence must be ${[...CONFIDENCE].join('|')}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h?.checked_at ?? '')) errors.push(`${at}: checked_at must be YYYY-MM-DD`)
  return errors
}

/** The stored object: the entry's How To Get fields, keys in a fixed order. */
export function toStoredHowToGet(h) {
  const out = { status: h.status, method: h.method.trim() }
  for (const k of OPTIONAL) if (isText(h[k])) out[k] = h[k].trim()
  out.sources = h.sources
  out.confidence = h.confidence
  out.checked_at = h.checked_at
  return out
}

/** Key-order-independent equality for stored JSON. */
export const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
      : JSON.stringify(v)
