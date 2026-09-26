/**
 * Persist collected Steal An Egg listings into values_raw_listings.
 *
 * Runs the same normaliser the app uses, via the taxonomy + aliases stored in
 * the database — so a title that matches here matches identically at read
 * time, and the owner can fix a match by adding an alias row rather than
 * shipping code.
 *
 * Unmatched rows are WRITTEN with parse_status='unmatched', never dropped:
 * that table IS the review file the brief asks for.
 */
import { createClient } from '@supabase/supabase-js'

const GAME_SLUG = 'steal-an-egg'

/** Mirrors the normaliser's classifier closely enough for ingestion. */
function comparable(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9&+/. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const RANDOM_RE = /\b(r[ao]nd[ou]m|ramdom|randum|any area|you choose|mystery)\b/
const SERVICE_RE = /\b(egg run|carry|service|boost(ing)?|tips? jar|1 hr|hour run)\b/
const CURRENCY_RE = /\b(x\s?2|x\s?3)\s*(money|growth|luck|speed)\b|\bgamepass\b|\b\d+r\b/
const ACCOUNT_RE = /\b(account|fresh|acc)\b|\bincome\b|\d\s*[kmbt]\s*\+*\s*\/?\s*s\b/
const UNITS = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }

function parseIncome(title) {
  const raw = String(title || '').toLowerCase().replace(/\s+/g, ' ')
  const range = raw.match(/(\d+(?:\.\d+)?)\s*([kmbt])?\s*[-–]\s*(\d+(?:\.\d+)?)\s*([kmbt])/)
  if (range) {
    const unit = (range[2] || range[4]).toLowerCase()
    const low = parseFloat(range[1]) * (UNITS[unit] ?? 1)
    if (Number.isFinite(low)) return low
  }
  let best = null
  const re = /(\d+(?:\.\d+)?)\s*([kmbt])\s*\+*\s*(?:\/?\s*s\b|\b)/g
  let m
  const t = comparable(title)
  while ((m = re.exec(t))) {
    const v = parseFloat(m[1]) * (UNITS[m[2].toLowerCase()] ?? 1)
    if (Number.isFinite(v) && (best == null || v > best)) best = v
  }
  return best
}

function parseQuantity(title) {
  const t = comparable(title)
  for (const re of [/\b(\d{1,4})\s*x\b/, /\bx\s*(\d{1,4})\b/, /^(\d{1,4})\s+eggs?\b/, /\b(\d{1,4})\s+eggs\b/]) {
    const m = t.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 1000) return n
    }
  }
  return 1
}

function matchItem(text, entries) {
  const sorted = entries
    .flatMap((e) => [e.name, ...(e.aliases || [])].map((label) => ({ e, label: comparable(label) })))
    .filter((c) => c.label.length > 2)
    .sort((a, b) => b.label.length - a.label.length)
  for (const c of sorted) {
    const esc = c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|\\s)${esc}(\\s|$)`).test(text)) return c.e
    const bare = c.label.replace(/\s+eggs?$/, '')
    if (bare !== c.label && bare.length > 3) {
      const b = bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(^|\\s)${b}(\\s|$)`).test(text)) return c.e
    }
  }
  return null
}

export async function writeListings(listings) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: game } = await db.from('games').select('id').eq('slug', GAME_SLUG).maybeSingle()
  if (!game) throw new Error(`game '${GAME_SLUG}' not found — run seed-steal-an-egg.mjs first`)

  const { data: items } = await db
    .from('values_items')
    .select('id,slug,name,kind,bracket_min,bracket_max,values_item_aliases(alias)')
    .eq('game_id', game.id)
    .eq('is_enabled', true)

  const withAliases = (items ?? []).map((i) => ({
    ...i,
    aliases: (i.values_item_aliases ?? []).map((a) => a.alias),
  }))
  const eggs = withAliases.filter((i) => i.kind === 'egg')
  const areas = withAliases.filter((i) => i.kind === 'area')
  const brackets = withAliases
    .filter((i) => i.kind === 'account_bracket')
    .sort((a, b) => Number(a.bracket_min) - Number(b.bracket_min))

  const now = new Date().toISOString()
  const rows = []
  const stats = { matched: 0, unmatched: 0, rejected: 0 }

  for (const l of listings) {
    const t = comparable(l.title)
    const mentionsEgg = /\begg/.test(t.replace(/steal an egg/g, ''))
    let matchedId = null
    let status = 'unmatched'
    let confidence = null

    if (SERVICE_RE.test(t) || (CURRENCY_RE.test(t) && !mentionsEgg)) {
      status = 'rejected'
    } else if (ACCOUNT_RE.test(t) && !mentionsEgg) {
      const income = parseIncome(l.title)
      if (income != null) {
        const b = brackets.find(
          (x) =>
            income >= Number(x.bracket_min) &&
            (x.bracket_max == null || income < Number(x.bracket_max)),
        )
        if (b) {
          matchedId = b.id
          status = 'matched'
          confidence = 0.8
        }
      }
    } else if (mentionsEgg) {
      const named = !RANDOM_RE.test(t) ? matchItem(t, eggs) : null
      const area = named ? null : matchItem(t, areas)
      const hit = named ?? area
      if (hit) {
        matchedId = hit.id
        status = 'matched'
        confidence = named ? 0.95 : RANDOM_RE.test(t) ? 0.9 : 0.75
      }
    }

    stats[status === 'matched' ? 'matched' : status === 'rejected' ? 'rejected' : 'unmatched'] += 1

    rows.push({
      game_id: game.id,
      source: l.source,
      source_offer_id: l.source_offer_id,
      title: l.title,
      price_usd: l.price_usd,
      quantity: parseQuantity(l.title),
      seller_reviews: l.seller_reviews,
      parse_status: status,
      matched_item_id: matchedId,
      match_confidence: confidence,
      is_active: true,
      observed_at: now,
    })
  }

  // Listings not seen in this crawl are no longer active: their prices must
  // stop counting. History rows are untouched.
  await db
    .from('values_raw_listings')
    .update({ is_active: false })
    .eq('game_id', game.id)
    .lt('observed_at', now)

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('values_raw_listings').insert(rows.slice(i, i + 500))
    if (error) throw new Error(`values_raw_listings insert: ${error.message}`)
  }

  const total = rows.length
  console.log(`  matched   : ${stats.matched} (${((stats.matched / total) * 100).toFixed(1)}%)`)
  console.log(`  unmatched : ${stats.unmatched}  <- review these`)
  console.log(`  rejected  : ${stats.rejected} (services/currency)`)
  return stats
}
