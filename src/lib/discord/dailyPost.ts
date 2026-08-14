/**
 * The daily value-list post.
 *
 * The growth playbook's #1 retention hook and DropMarket's wedge against the
 * 400k-member competitors: they don't publish good daily price data, we do.
 * A cron posts this to a #value-list channel via an incoming webhook — no
 * gateway, no bot presence required, just an HTTP POST.
 *
 * Reads the SAME corrected view the site and /value command read, so the daily
 * post can never quote a different number than the rest of the product.
 */

import { botSupabase, selectAll } from './supabase'
import { formatCash } from '@/lib/sab/format'
import { BRAND_COLOR, rarityColor } from './format'
import { itemUrl, pageUrl } from './embeds'
import type { Embed, MessagePayload } from './types'

const DEFAULT_MUTATION = 'default'
const TOP_COUNT = 8
const MOVER_COUNT = 5

/**
 * Movers are only meaningful from history captured AFTER the price-correction
 * layer went live. Earlier snapshots hold pre-correction values, so comparing
 * across that boundary shows the CORRECTION as a fake move (Spyder Elephant
 * "+2832%" is the $9.98→$292.65 fix, not a rally). Gate on this date until two
 * clean days exist; then the section turns itself on.
 */
const CORRECTION_EPOCH = '2026-07-31'

/**
 * A day-over-day move larger than this is almost certainly a data artifact
 * (a fake listing appearing or being filtered), not a real market swing — real
 * SAB prices rarely move this much in a day. Belt-and-suspenders alongside the
 * epoch gate.
 */
const MAX_PLAUSIBLE_MOVE_PCT = 60

type CatalogRow = {
  brainrot_slug: string
  brainrot_name: string
  rarity: string | null
  mutation_slug: string
  market_value_usd: number | string | null
}

type HistoryRow = {
  brainrot_id: string
  history_date: string
  median_usd: number | string | null
  sab_brainrots: { slug: string; name: string } | null
  sab_mutations: { slug: string } | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The N highest-value Brainrots (default mutation) from the corrected view. */
async function getTopValues(): Promise<CatalogRow[]> {
  const { data, error } = await botSupabase()
    .from('sab_price_display')
    .select('brainrot_slug,brainrot_name,rarity,mutation_slug,market_value_usd')
    .eq('mutation_slug', DEFAULT_MUTATION)
    .order('market_value_usd', { ascending: false })
    .limit(TOP_COUNT)

  if (error) {
    console.error('Daily post: top-values query failed:', error)
    return []
  }
  return (data ?? []) as CatalogRow[]
}

export type Mover = {
  name: string
  slug: string
  from: number
  to: number
  pct: number
}

/**
 * Biggest day-over-day movers on the default mutation.
 *
 * Compares each Brainrot's two most recent history snapshots. Returns [] when
 * there aren't two distinct days yet — better to omit the section than invent
 * movement, matching the honesty rules elsewhere in the pipeline.
 */
async function getBiggestMovers(): Promise<Mover[]> {
  const rows = await selectAll<HistoryRow>(
    'sab_price_history',
    'brainrot_id,history_date,median_usd,sab_brainrots!inner(slug,name),sab_mutations!inner(slug)',
  ).catch((error) => {
    console.error('Daily post: history query failed:', error)
    return [] as HistoryRow[]
  })

  const defaultRows = rows.filter(
    (row) =>
      row.sab_mutations?.slug === DEFAULT_MUTATION &&
      // Only post-correction snapshots, so a fix never reads as a market move.
      row.history_date >= CORRECTION_EPOCH,
  )

  // Latest two values per Brainrot, in date order.
  const byBrainrot = new Map<
    string,
    { date: string; value: number; name: string; slug: string }[]
  >()

  for (const row of defaultRows) {
    const value = toNumber(row.median_usd)
    const meta = row.sab_brainrots
    if (value == null || !meta) continue
    const list = byBrainrot.get(row.brainrot_id) ?? []
    list.push({ date: row.history_date, value, name: meta.name, slug: meta.slug })
    byBrainrot.set(row.brainrot_id, list)
  }

  const movers: Mover[] = []

  for (const list of byBrainrot.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => a.date.localeCompare(b.date))
    const previous = list[list.length - 2]
    const latest = list[list.length - 1]
    if (previous.value <= 0) continue
    const pct = ((latest.value - previous.value) / previous.value) * 100
    // Ignore rounding-noise moves; a real mover shifted meaningfully.
    if (Math.abs(pct) < 5) continue
    // Ignore implausible swings — a data artifact, not a market move.
    if (Math.abs(pct) > MAX_PLAUSIBLE_MOVE_PCT) continue
    movers.push({
      name: latest.name,
      slug: latest.slug,
      from: previous.value,
      to: latest.value,
      pct,
    })
  }

  movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
  return movers.slice(0, MOVER_COUNT)
}

/** Human date like "31 Jul" in UTC — deterministic across hosts. */
function formatUtcDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export async function buildDailyPost(now: Date): Promise<MessagePayload | null> {
  const [top, movers] = await Promise.all([getTopValues(), getBiggestMovers()])

  if (!top.length) return null

  const topLines = top.map((row, index) => {
    const price = formatCash(toNumber(row.market_value_usd)) ?? '—'
    return `**${index + 1}.** [${row.brainrot_name}](${itemUrl(row.brainrot_slug)}) — **${price}**`
  })

  const fields: Embed['fields'] = [
    { name: '💎 Top Values', value: topLines.join('\n'), inline: false },
  ]

  if (movers.length) {
    const moverLines = movers.map((mover) => {
      const arrow = mover.pct > 0 ? '📈' : '📉'
      const sign = mover.pct > 0 ? '+' : ''
      return `${arrow} [${mover.name}](${itemUrl(mover.slug)}) ${sign}${mover.pct.toFixed(0)}% (${formatCash(mover.from)} → ${formatCash(mover.to)})`
    })
    fields.push({
      name: '🔥 Biggest Movers',
      value: moverLines.join('\n'),
      inline: false,
    })
  }

  const embed: Embed = {
    title: `Daily Values — ${formatUtcDate(now)}`,
    description:
      'Live Steal a Brainrot prices from DropMarket — blended across marketplaces, fakes filtered out.',
    color: rarityColor('Secret') ?? BRAND_COLOR,
    url: pageUrl('/values'),
    fields,
    footer: { text: 'DropMarket Values • dropmarket.gg' },
    timestamp: now.toISOString(),
  }

  return {
    content: '',
    embeds: [embed],
    allowed_mentions: { parse: [] },
  }
}

/**
 * POST the payload to a Discord incoming webhook. Never throws — a failed daily
 * post is a missed message, not a reason to fail the cron.
 */
export async function sendToWebhook(
  webhookUrl: string,
  payload: MessagePayload,
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(
        `Daily post webhook failed (${response.status}): ${detail.slice(0, 300)}`,
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Daily post webhook threw:', error)
    return false
  }
}
