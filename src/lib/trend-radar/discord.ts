/**
 * Trend-radar Discord alerts — one incoming-webhook message per game, posted
 * to the supplier channel (DISCORD_TREND_RADAR_WEBHOOK_URL).
 *
 * Webhooks cannot reply in a thread, so the "live" reply on approval is done
 * the way a webhook can: the alert is posted with `?wait=true` (Discord then
 * returns the message id, which trend_events keeps), and approval PATCHes
 * that message to the live state and posts a short follow-up.
 *
 * Never throws — a missed alert is a log line, not a failed run.
 */
import { BRAND_COLOR, clamp, formatPercentDelta } from '@/lib/discord/format'
import { Limits, type Embed, type EmbedField, type MessagePayload } from '@/lib/discord/types'
import type { TrendSignal } from './signals'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const FOOTER = { text: 'DropMarket Trend Radar • dropmarket.gg' }
const LIVE_COLOR = 0x22c55e

export interface TrendAlertInput {
  name: string
  slug: string
  universeId: number
  playingNow: number
  playing48hAgo: number | null
  signals: readonly TrendSignal[]
  rank?: number | null
  adminUrl: string
  robloxUrl: string
  iconUrl?: string | null
  categories: string[]
  wikiFound: boolean
  flags?: Record<string, unknown>
}

const fmtInt = (n: number) => n.toLocaleString('en-US')

export function trendAlertPayload(input: TrendAlertInput): MessagePayload {
  const change =
    input.playing48hAgo && input.playing48hAgo > 0
      ? formatPercentDelta(input.playing48hAgo, input.playingNow)
      : 'n/a (no 48h sample)'

  const flagNotes: string[] = []
  if (input.flags?.ambiguous) flagNotes.push('ambiguous title — resolved to the busier universe')
  if (input.flags?.slugCollision) flagNotes.push(`slug collision → ${input.slug}`)

  const fields: EmbedField[] = [
    { name: 'Players now', value: fmtInt(input.playingNow), inline: true },
    { name: '48h change', value: change, inline: true },
    { name: 'Rank', value: input.rank ? `#${input.rank}` : '—', inline: true },
    { name: 'Signals', value: input.signals.join(', ') || '—', inline: false },
    { name: 'Categories to enable', value: input.categories.join(', ') || '—', inline: true },
    { name: 'Wiki', value: input.wikiFound ? 'Fandom wiki found — draft taxonomy attached' : 'No wiki found', inline: true },
  ]
  if (flagNotes.length) fields.push({ name: 'Flags', value: clamp(flagNotes.join('\n'), Limits.fieldValue), inline: false })

  const embed: Embed = {
    title: clamp(`📡 Trend detected: ${input.name}`, Limits.embedTitle),
    description: clamp(
      `Pending review — nothing is live until you approve.\n[Review in admin](${input.adminUrl}) · [Roblox page](${input.robloxUrl})`,
      Limits.embedDescription,
    ),
    url: input.adminUrl,
    color: BRAND_COLOR,
    fields,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  }
  if (input.iconUrl) embed.thumbnail = { url: input.iconUrl }

  return { embeds: [embed], allowed_mentions: { parse: [] } }
}

/** The alert, rewritten after approval. */
export function markLive(original: MessagePayload, liveUrl: string): MessagePayload {
  const first = original.embeds?.[0]
  if (!first) return original
  const title = first.title?.replace(/^📡 Trend detected:/, '✅ Live:') ?? '✅ Live'
  return {
    ...original,
    embeds: [
      {
        ...first,
        title,
        url: liveUrl,
        color: LIVE_COLOR,
        description: clamp(`Approved and live: ${liveUrl}`, Limits.embedDescription),
      },
      ...(original.embeds?.slice(1) ?? []),
    ],
  }
}

export function liveFollowupPayload(name: string, liveUrl: string): MessagePayload {
  return { content: `✅ **${name}** is live: ${liveUrl}`, allowed_mentions: { parse: [] } }
}

// ── IO ─────────────────────────────────────────────────────────────────────

export interface WebhookDeps {
  fetchImpl?: FetchLike
  dryRun?: boolean
}

export type PostResult =
  | { ok: true; messageId: string | null }
  | { ok: true; dryRun: true; payload: MessagePayload }
  | { ok: false; status: number | null; error: string }

export async function postWebhook(webhookUrl: string, payload: MessagePayload, deps: WebhookDeps = {}): Promise<PostResult> {
  if (deps.dryRun) return { ok: true, dryRun: true, payload }
  const fetchImpl = deps.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const error = await res.text().catch(() => '')
      console.error(`Trend radar webhook failed (${res.status}): ${error.slice(0, 300)}`)
      return { ok: false, status: res.status, error }
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null
    return { ok: true, messageId: typeof body?.id === 'string' ? body.id : null }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('Trend radar webhook threw:', error)
    return { ok: false, status: null, error }
  }
}

export async function patchWebhookMessage(
  webhookUrl: string,
  messageId: string,
  payload: MessagePayload,
  deps: WebhookDeps = {},
): Promise<boolean> {
  if (deps.dryRun) return true
  const fetchImpl = deps.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(`${webhookUrl}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error(`Trend radar webhook PATCH failed (${res.status})`)
    return res.ok
  } catch (e) {
    console.error('Trend radar webhook PATCH threw:', e)
    return false
  }
}

/** One message for a burst of newly prepared games (first run, or a big shake-up). */
export function trendDigestPayload(
  games: { name: string; slug: string; playingNow: number; rank: number | null; signals: readonly string[] }[],
  adminUrl: string,
): MessagePayload {
  const lines = games
    .slice(0, 25)
    .map((g) => `• **${g.name}** — ${fmtInt(g.playingNow)} playing${g.rank ? ` · #${g.rank}` : ''} · ${g.signals.join(', ')}`)
  if (games.length > 25) lines.push(`… and ${games.length - 25} more`)
  return {
    embeds: [
      {
        title: clamp(`📡 Trend radar: ${games.length} new games pending review`, Limits.embedTitle),
        description: clamp(`${lines.join('\n')}\n\n[Review in admin](${adminUrl})`, Limits.embedDescription),
        url: adminUrl,
        color: BRAND_COLOR,
        footer: FOOTER,
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: { parse: [] },
  }
}
