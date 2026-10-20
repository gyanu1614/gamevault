/**
 * Steal a Brainrot item facts from the fan wiki (stealabrainrot.fandom.com,
 * CC BY-SA): the infobox (status, release update, cost), the Obtainment list
 * and the Update Log's dates, turned into the shared facts every value page
 * renders (released, origin, How To Get — src/lib/values/item-facts.ts).
 *
 * Pure and dependency-free: the collector (scripts/collect-sab-wiki-facts.mjs)
 * loads it through tsx, so no `@/` imports and no TS-only runtime syntax.
 *
 * Honesty rules, same as MM2's How To Get:
 *   - a status we can't read is "unknown", never obtainable;
 *   - an unobtainable brainrot reads in the past tense;
 *   - odds are only the wiki's stated ones, kept as written ("0.5%").
 */

export interface WikiSource {
  /** "Red Carpet", "Admin Lucky Block", "Santa's Fuse". */
  name: string
  /** Stated chance, as written: "0.5%". */
  odds: string | null
}

export type SabHowToGetStatus = 'obtainable' | 'unobtainable' | 'unknown' | 'seasonal'

export interface SabWikiFacts {
  slug: string
  /** YYYY-MM-DD: the date of the update that added it. */
  released_at: string | null
  origin: string | null
  how_to_get: {
    status: SabHowToGetStatus
    method: string
    costs?: string
    released?: string
    sources: string[]
    confidence: 'high' | 'medium' | 'low'
    checked_at: string
  } | null
}

/** The body of the first `{{Name …}}` template, braces balanced, or null. */
export function templateBody(text: string, name: string): string | null {
  const re = new RegExp(`\\{\\{\\s*${name.replace(/ /g, '[ _]')}\\s*(?=[|}])`, 'i')
  const m = re.exec(text)
  if (!m) return null
  let depth = 0
  for (let i = m.index; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return text.slice(m.index + m[0].length, i - 1)
    }
  }
  return null
}

/** Split a template body on its top-level pipes (not inside {{ }}, [[ ]] or <tag>…</tag>). */
function topLevelParts(body: string): string[] {
  const parts: string[] = []
  let cur = ''
  let braces = 0
  let brackets = 0
  let tag = 0
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{') { braces++; cur += two; i++; continue }
    if (two === '}}') { braces--; cur += two; i++; continue }
    if (two === '[[') { brackets++; cur += two; i++; continue }
    if (two === ']]') { brackets--; cur += two; i++; continue }
    if (/^<(gallery|tabber)\b/i.test(body.slice(i, i + 8))) tag++
    if (/^<\/(gallery|tabber)>/i.test(body.slice(i, i + 10))) tag = Math.max(0, tag - 1)
    if (body[i] === '|' && braces === 0 && brackets === 0 && tag === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += body[i]
  }
  parts.push(cur)
  return parts
}

/** Named params of a template body: `status=Obtainable` → { status: 'Obtainable' }. */
export function templateParams(body: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!body) return out
  for (const part of topLevelParts(body)) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    if (/^[a-z0-9 _-]+$/.test(key)) out[key] = part.slice(eq + 1).trim()
  }
  return out
}

/** One inline template → its text: {{$|1B}} → "$1B", {{RarityText|Secret|Secret}} → "Secret". */
function inlineTemplate(inner: string): string {
  const parts = topLevelParts(inner)
  const name = parts[0].trim()
  const args = parts.slice(1)
  const positional = args.filter((a) => !/^\s*[A-Za-z0-9 _-]+\s*=/.test(a)).map((a) => a.trim())
  const named = Object.fromEntries(
    args.filter((a) => /^\s*[A-Za-z0-9 _-]+\s*=/.test(a)).map((a) => [a.slice(0, a.indexOf('=')).trim().toLowerCase(), a.slice(a.indexOf('=') + 1).trim()]),
  )
  if (name === '$') return `$${positional[0] ?? ''}`
  if (name === '$/s') return `$${positional[0] ?? ''}/s`
  if (/^pagename$/i.test(name)) return ''
  return named.name ?? positional[positional.length - 1] ?? Object.values(named)[0] ?? name
}

/** Wiki markup → plain text: links, inline templates, bold/italics, tags. */
export function plainText(wiki: string): string {
  let s = wiki
  s = s.replace(/<nowiki\s*\/>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  s = s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  // Innermost templates first, until none are left.
  for (let n = 0; n < 6 && /\{\{/.test(s); n++) s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => inlineTemplate(inner))
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
  s = s.replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, '')
  return s.replace(/\s+/g, ' ').trim()
}

const STRIP_LEAD =
  /^(?:(?:by\s+)?(?:buying|getting|obtaining|obtained|fusing|crafting|rolling|fishing|stealing|finding|trading|winning|opening|hatching|redeeming|spawning|collecting|purchasing)(?:\s+(?:it|them|one|a\s+egg|an\s+egg))?(?:\s+out)?\s+(?:from|in|on|at|through|via|with)\s+|from\s+|in\s+|through\s+|during\s+)/i
/** A trailing clause that says how or when, not where: " with a very low chance", " for $17.5M or 299". */
const TRAILING_CLAUSE = /\s+(?:with|when|after|by|for|during|as|while|until|if|using|only|which)\b.*$/i

/** One cleaned place name → a source; null when it isn't a place we can name. */
function toSource(raw: string, odds: string | null): WikiSource | null {
  let name = raw.replace(/^(?:the|a|an)\s+/i, '').replace(/[\s.,;:]+$/, '').trim()
  if (/merch|dlc|plush|official website/i.test(name)) name = 'Official Merch Code'
  if (/^limited stock\b/i.test(name)) name = 'Limited Stock'
  if (!name || name.length > 40 || /\b(is|are|was|were|scored|logging|inserting)\b/i.test(name)) return null
  if (/^(stealing|ritual|doing a ritual|stock|obtaining|fusing|crafting|spawning)$/i.test(name) || /^(by|purchasing)\b/i.test(name)) return null
  if (/^tenth day of the advent calendar$/i.test(name)) name = 'Advent Calendar'
  return { name: name.charAt(0).toUpperCase() + name.slice(1), odds }
}

/** One top-level Obtainment line → its sources ("Craft Machine and Brainrot Trader" is two). */
export function parseSource(line: string): WikiSource[] {
  let s = plainText(line).replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const odds = s.match(/(?:with\s+an?\s+|at\s+an?\s+)?(\d+(?:\.\d+)?%)(?:\s*\(1\s+in\s+[\d,]+\))?\s*(?:chance|odds)?/i)
  if (odds) s = s.replace(odds[0], ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // A verb with no place after it ("Crafting as a Limited Stock Brainrot") is the Craft Machine.
  if (/^crafting\b/i.test(s) && !STRIP_LEAD.test(s)) s = 'Craft Machine'
  s = s.replace(STRIP_LEAD, '').replace(/,\s*(?:both|only|which|and only)\b.*$/i, '').replace(TRAILING_CLAUSE, '')
  const parts = s.split(/,\s+(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/i)
  const out: WikiSource[] = []
  parts.forEach((p, i) => {
    const src = toSource(p, i === 0 && odds ? odds[1] : null)
    if (src) out.push(src)
  })
  return out
}

/** The Obtainment list: the template's own default (the Red Carpet) when it has no list. */
export function parseObtainment(text: string): { sources: WikiSource[]; upcoming: boolean } | null {
  const body = templateBody(text, 'Obtainment')
  if (body == null) return null
  const params = templateParams(body)
  const list = params.obtainment ?? '# Buying from the [[Red Carpet]].'
  const sources: WikiSource[] = []
  for (const line of list.split('\n')) {
    if (!/^#(?![*#:])/.test(line.trim())) continue
    for (const src of parseSource(line.trim().slice(1))) {
      if (!sources.some((x) => x.name.toLowerCase() === src.name.toLowerCase())) sources.push(src)
    }
  }
  return { sources, upcoming: Boolean(params.upcoming) }
}

/** Update number → release date (YYYY-MM-DD) from the wiki's Update Log. */
export function parseUpdateLog(text: string): Map<number, string> {
  const out = new Map<number, string>()
  const re = /\{\{UpdateLogEntry([\s\S]*?)\n?\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const block = m[1]
    const num = block.match(/Update\s*0*(\d+)\s*(?:\]\]|\|)/i)
    const date = block.match(/SortDate\s*=\s*([\d-]+)/i)
    if (!num || !date) continue
    const iso = isoDate(date[1])
    if (iso) out.set(Number(num[1]), iso)
  }
  return out
}

/** "2025-06-21" or "10-3-2026" (M-D-YYYY) → "2025-06-21" / "2026-10-03". */
function isoDate(v: string): string | null {
  let y: number, mo: number, d: number
  const a = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const b = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (a) [y, mo, d] = [Number(a[1]), Number(a[2]), Number(a[3])]
  else if (b) [y, mo, d] = [Number(b[3]), Number(b[1]), Number(b[2])]
  else return null
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null
  return t.toISOString().slice(0, 10)
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Infobox status → the How To Get status. Anything unreadable is "unknown". */
export function statusOf(raw: string | undefined): SabHowToGetStatus {
  const s = plainText(raw ?? '').toLowerCase()
  if (/^unobtainable|^removed|^discontinued/.test(s)) return 'unobtainable'
  if (/^obtainable/.test(s)) return 'obtainable'
  if (/^(limited|seasonal|event)/.test(s)) return 'seasonal'
  return 'unknown'
}

/** "the Admin Lucky Block (0.5% chance)"; people and possessives ("Sammy's Base") take no article. */
const place = (s: WikiSource) =>
  /^limited stock$/i.test(s.name)
    ? 'a limited-stock sale'
    : `${/^(sammy|spydersammy|fat sammy|official merch code)/i.test(s.name) || /'s\b/.test(s.name) ? '' : 'the '}${s.name}${s.odds ? ` (${s.odds} chance)` : ''}`

function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "1B" → "$1B in-game cash" (the infobox cost). */
function costText(raw: string | undefined): string | null {
  const c = plainText(raw ?? '').replace(/^\$/, '')
  return /^\d+(?:\.\d+)?\s*[KMBTQ]?[a-z]*$/i.test(c) ? `$${c} in-game cash` : null
}

/** "Admin Abuse Exclusive Brainrots" / "Exclusive to the Los Taco Blocks." → the place it is exclusive to. */
function exclusiveTo(text: string, categories: string[]): string | null {
  const special = templateParams(templateBody(text, 'SpecialContent')).reason
  const m = special && plainText(special).match(/exclusive to (?:the )?(.+?)\.?$/i)
  const named = m ? parseSource(m[1])[0]?.name : null
  if (named) return named
  if (categories.some((c) => /admin abuse exclusive/i.test(c))) return 'Admin Abuse events'
  return null
}

export function buildSabFacts(input: {
  slug: string
  pageUrl: string
  text: string
  categories: string[]
  updates: Map<number, string>
  checkedAt: string
}): SabWikiFacts {
  const info = templateParams(templateBody(input.text, 'Brainrot Infobox'))
  const update = (info.release ?? '').match(/update\s*0*(\d+)/i)
  const releasedAt = update ? input.updates.get(Number(update[1])) ?? null : null
  const obtain = parseObtainment(input.text)
  const exclusive = exclusiveTo(input.text, input.categories)
  const sources = obtain?.sources ?? []
  const origin = exclusive ?? sources[0]?.name ?? null

  if (!obtain || sources.length === 0) {
    return { slug: input.slug, released_at: releasedAt, origin, how_to_get: null }
  }
  const status: SabHowToGetStatus = obtain.upcoming ? 'unknown' : statusOf(info.status)
  const now = status !== 'unobtainable'
  const [first, ...rest] = sources
  const redCarpet = /^red carpet/i.test(first.name)
  const head = redCarpet
    ? `${now ? 'Spawns' : 'Spawned'} on the Red Carpet`
    : `${now ? 'Comes' : 'Came'} from ${place(first)}`
  const others = rest.slice(0, 2).map(place)
  // "Spawns on the Red Carpet or comes from X and Y" / "Came from X or Y".
  const more = rest.length > 2 ? `, plus ${rest.length - 2} more` : ''
  const tail = others.length ? ` or ${redCarpet ? `${now ? 'comes' : 'came'} from ` : ''}${list(others)}${more}` : ''
  const cost = redCarpet || sources.some((s) => /^red carpet/i.test(s.name)) ? costText(info.cost) : null
  const released = releasedAt ? `${dateLabel(releasedAt)}${update ? ` (Update ${Number(update[1])})` : ''}` : null

  return {
    slug: input.slug,
    released_at: releasedAt,
    origin,
    how_to_get: {
      status,
      method: `${head}${tail}.`,
      ...(cost ? { costs: `${cost} on the Red Carpet` } : {}),
      ...(released ? { released } : {}),
      sources: [input.pageUrl],
      confidence: 'medium',
      checked_at: input.checkedAt,
    },
  }
}
