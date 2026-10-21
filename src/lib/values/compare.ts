/**
 * "How <Item> Compares" for every value item page: the item against its
 * closest same-tier rival, and the items worth about the same from any tier.
 * Pure, so the copy is unit-tested and every game builds it from data it
 * already reads (no extra round trip beyond one nearby-value query).
 */

export interface CompareItem {
  key: string
  name: string
  href: string
  imageUrl: string | null
  /** The price the page leads with (cheapest reputable / market). */
  priceUsd: number | null
  /** Our trade points, where the game has them. */
  tradePoints?: number | null
  /** Ordered facts for the vs table ("Rarity", "Type", "Income"…), only what is known. */
  facts?: Array<{ label: string; value: string }>
}

const ratio = (a: number, b: number) => Math.abs(Math.log(a / b))

/** The `n` items priced closest to `refUsd` (by ratio, so $1 vs $2 is as far as $50 vs $100). */
export function nearestByValue(refUsd: number | null, items: CompareItem[], n: number, exclude: Set<string> = new Set()): CompareItem[] {
  if (refUsd == null || !(refUsd > 0)) return []
  return items
    .filter((i) => !exclude.has(i.key) && i.priceUsd != null && i.priceUsd > 0)
    .sort((a, b) => ratio(a.priceUsd!, refUsd) - ratio(b.priceUsd!, refUsd))
    .slice(0, n)
}

export const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** "Icewing costs 12% less than Harvester ($6.80 vs $7.70)." — or "about the same" within 3%. */
export function vsVerdict(a: CompareItem, b: CompareItem): string | null {
  if (a.priceUsd == null || b.priceUsd == null || !(a.priceUsd > 0)) return null
  const diff = (b.priceUsd - a.priceUsd) / a.priceUsd
  const pair = `(${usd(b.priceUsd)} vs ${usd(a.priceUsd)})`
  if (Math.abs(diff) < 0.03) return `${b.name} and ${a.name} cost about the same ${pair}.`
  const pct = Math.round(Math.abs(diff) * 100)
  if (diff > 0 && b.priceUsd / a.priceUsd >= 2) {
    const x = Math.round((b.priceUsd / a.priceUsd) * 10) / 10
    return `${b.name} costs about ${x}× as much as ${a.name} ${pair}.`
  }
  return `${b.name} costs ${pct}% ${diff > 0 ? 'more' : 'less'} than ${a.name} ${pair}.`
}

/** "Harvester is worth about the same as Icewing, Luger and Gingerscope." */
export function worthSameSentence(name: string, picks: CompareItem[]): string | null {
  if (picks.length === 0) return null
  return `${name} is worth about the same as ${list(picks.map((p) => p.name))}.`
}

/** The vs table's rows: price, trade value, then each fact either item has, in the first item's order. */
export function vsRows(
  a: CompareItem,
  b: CompareItem,
  tradeLabel?: (p: number) => string,
  priceLabel = 'Price',
): Array<{ label: string; a: string; b: string }> {
  const rows: Array<{ label: string; a: string; b: string }> = []
  const dash = '—'
  rows.push({ label: priceLabel, a: a.priceUsd != null ? usd(a.priceUsd) : dash, b: b.priceUsd != null ? usd(b.priceUsd) : dash })
  if (tradeLabel && (a.tradePoints != null || b.tradePoints != null)) {
    rows.push({ label: 'Trade Value', a: a.tradePoints != null ? tradeLabel(a.tradePoints) : dash, b: b.tradePoints != null ? tradeLabel(b.tradePoints) : dash })
  }
  const labels = [...(a.facts ?? []), ...(b.facts ?? [])].map((f) => f.label).filter((l, i, all) => all.indexOf(l) === i)
  for (const label of labels) {
    const av = a.facts?.find((f) => f.label === label)?.value ?? dash
    const bv = b.facts?.find((f) => f.label === label)?.value ?? dash
    if (av === dash && bv === dash) continue
    rows.push({ label, a: av, b: bv })
  }
  return rows
}
