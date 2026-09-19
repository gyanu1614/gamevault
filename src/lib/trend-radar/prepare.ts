/**
 * Prepare run: turn unhandled trend events into pending games — the game row,
 * its external id, the two category templates, an icon, a draft taxonomy and
 * one Discord alert — and mark the events handled.
 *
 * Idempotent-repair, not a transaction (approved design): PostgREST cannot
 * span a multi-table transaction and pairs MUST go through ensureGameCategory
 * (CLAUDE.md), so `game_external_ids` is the idempotency key. A run that dies
 * halfway leaves a pending game the next run completes; nothing is ever
 * deleted. Every step's outcome is recorded on the event
 * (`flags.prepare`) so the review card can show what did and did not happen.
 * A step that keeps failing is retried on later runs up to `maxAttempts`,
 * then the event is marked handled with `gaveUp` so it cannot loop forever.
 */
import { ensureGameCategory as ensureGameCategoryWired } from '@/lib/categories'
import { fetchGameIcon, searchRobloxGames, type GameForIcon, type IconResult, type StorageLike } from '@/lib/games/icons'
import type { MessagePayload } from '@/lib/discord/types'
import { DEFAULT_CONFIG, type TrendConfig } from './config'
import { postWebhook, trendAlertPayload, trendDigestPayload, type PostResult } from './discord'
import { draftTaxonomy as draftTaxonomyReal, type TaxonomyDraft } from './fandom'
import { chooseUniverse } from './index'
import { createPacer, fetchGameMetrics, type FetchLike, type Pacer } from './roblox'
import type { IconCandidate } from './resolve'
import { cleanTitle, resolveSlug, RADAR_CATEGORY_SLUGS } from './slug'
import { loadRobloxCatalogue, type CatalogueGame, type Db } from './store'

const NO_WEBHOOK = 'DISCORD_TREND_RADAR_WEBHOOK_URL not set'

export interface PrepareDeps {
  db: Db
  siteUrl: string
  webhookUrl?: string | null
  storage?: StorageLike
  fetchImpl?: FetchLike
  pacer?: Pacer
  config?: TrendConfig
  now?: Date
  /** No writes, no sends: return what would happen. */
  dryRun?: boolean
  maxAttempts?: number
  // Seams (defaults are the real implementations).
  fetchIcon?: (game: GameForIcon) => Promise<IconResult>
  draftTaxonomy?: (title: string) => Promise<TaxonomyDraft>
  search?: (title: string) => Promise<IconCandidate[]>
  fetchPlaying?: (ids: number[]) => Promise<Map<number, number>>
  ensure?: (gameId: string, globalSlug: string) => Promise<unknown>
  post?: (payload: MessagePayload) => Promise<PostResult>
}

export interface PrepareSummary {
  dryRun: boolean
  processed: number
  created: string[]
  repaired: string[]
  handled: number
  deferred: number
  wouldCreate: { slug: string; name: string; universeId: number }[]
  payloads: MessagePayload[]
  errors: string[]
}

interface EventRow {
  id: string
  platform: 'roblox' | 'eldorado'
  external_id: string
  game_id: string | null
  signal: string
  value: number
  name: string | null
  flags: Record<string, any>
  draft: unknown | null
  discord_message_id: string | null
  created_at: string
}

interface StepLog extends Record<string, unknown> {
  categories?: number
  icon?: string
  wiki?: boolean
  discord?: string
  errors: string[]
}

export async function runPrepare(deps: PrepareDeps): Promise<PrepareSummary> {
  const {
    db,
    siteUrl,
    webhookUrl = null,
    fetchImpl = fetch,
    now = new Date(),
    dryRun = false,
    maxAttempts = 3,
    config = DEFAULT_CONFIG,
  } = deps
  const pacer = deps.pacer ?? createPacer()
  const storage = deps.storage ?? (db as any).storage
  const fetchIcon = deps.fetchIcon ?? ((g: GameForIcon) => fetchGameIcon(g, { storage, fetchImpl }))
  const draft = deps.draftTaxonomy ?? ((t: string) => draftTaxonomyReal(t, { fetchImpl }))
  const search = deps.search ?? ((t: string) => searchRobloxGames(t, fetchImpl))
  const fetchPlaying =
    deps.fetchPlaying ??
    (async (ids: number[]) => new Map((await fetchGameMetrics(ids, { fetchImpl, pacer })).map((r) => [r.universeId, r.playing])))
  const ensure =
    deps.ensure ?? ((gameId: string, globalSlug: string) => ensureGameCategoryWired(db, { gameId, globalSlug, seedCurrencyConfig: false }))
  const post =
    deps.post ??
    ((payload: MessagePayload) =>
      webhookUrl ? postWebhook(webhookUrl, payload, { fetchImpl }) : Promise.resolve<PostResult>({ ok: false, status: null, error: NO_WEBHOOK }))

  const summary: PrepareSummary = { dryRun, processed: 0, created: [], repaired: [], handled: 0, deferred: 0, wouldCreate: [], payloads: [], errors: [] }

  const { data: rows, error } = await db
    .from('trend_events')
    .select('id, platform, external_id, game_id, signal, value, name, flags, draft, discord_message_id, created_at')
    .is('handled_at', null)
    .in('signal', ['top30_entry', 'growth_48h', 'rmt_chart'])
    .order('created_at', { ascending: true })
  if (error) throw new Error(`trend_events read failed: ${error.message}`)
  const events = (rows ?? []) as EventRow[]
  if (events.length === 0) return summary

  const catalogue = await loadRobloxCatalogue(db)
  const { data: slugRows } = await db.from('games').select('slug')
  const existingSlugs = new Set(((slugRows ?? []) as { slug: string }[]).map((r) => r.slug))

  // ── group events by target universe ────────────────────────────────────
  const byUniverse = new Map<number, EventRow[]>()
  for (const ev of events) {
    summary.processed += 1
    let universeId: number | null = null
    if (ev.platform === 'roblox') {
      universeId = Number(ev.external_id)
    } else {
      // rmt_chart: Eldorado gave a name; resolve it to a universe (refinement i).
      const title = ev.name ?? ev.external_id
      const choice = await resolveWith(title, search, fetchPlaying)
      if (!choice) {
        await handleUnresolved(ev)
        continue
      }
      universeId = choice.universeId
      ev.flags = {
        ...ev.flags,
        ambiguous: choice.ambiguous,
        resolved: { universeId: choice.universeId, matchedTitle: choice.matchedTitle, confidence: choice.confidence, candidates: choice.candidates },
      }
      if (!ev.name) ev.name = choice.matchedTitle
    }
    if (universeId === null || !Number.isFinite(universeId)) continue
    const list = byUniverse.get(universeId) ?? []
    list.push(ev)
    byUniverse.set(universeId, list)
  }

  // ── per universe ──────────────────────────────────────────────────────
  const prepared: {
    evs: EventRow[]
    game: CatalogueGame
    name: string
    universeId: number
    log: StepLog
    attempts: number
    wikiFound: boolean
    needsAlert: boolean
  }[] = []
  for (const [universeId, evs] of byUniverse) {
    const primary = evs[0]
    const existing = catalogue.get(universeId)
    const rawName = evs.find((e) => e.name)?.name ?? String(universeId)
    const name = cleanTitle(rawName)
    const log: StepLog = { errors: [] }
    const attempts = Number(primary.flags?.prepareAttempts ?? 0) + 1

    // A growth event on a game that is already approved/rejected/declining
    // is evidence only (collect marks these handled; this is belt and braces).
    if (existing && existing.reviewStatus !== 'pending') {
      await markHandled(evs, existing.gameId, { ...log, note: 'already in catalogue' })
      continue
    }

    if (dryRun) {
      const slug = existing?.slug ?? resolveSlug(name, existingSlugs)?.slug ?? '(unsluggable)'
      summary.wouldCreate.push({ slug, name, universeId })
      summary.payloads.push(alertFor(evs, { slug, name, universeId, iconUrl: existing?.imageUrl ?? null, wikiFound: false }))
      continue
    }

    try {
      // 1. Game row + external id (the idempotency key).
      let game: CatalogueGame
      if (existing) {
        game = existing
        summary.repaired.push(game.slug)
      } else {
        const resolved = resolveSlug(name, existingSlugs)
        if (!resolved) throw new Error(`cannot build a slug from "${rawName}"`)
        const playingNow = Math.max(0, ...evs.map((e) => Number(e.flags?.playingNow ?? 0)), Number(primary.value === undefined ? 0 : 0))
        const { data: g, error: ge } = await db
          .from('games')
          .insert({
            name,
            slug: resolved.slug,
            ecosystem: 'roblox',
            content_tier: 'listed',
            source: 'trend-radar',
            is_active: false,
            review_status: 'pending',
            trend_detected_at: primary.created_at,
            trend_peak_playing: playingNow || null,
          })
          .select('id, slug, name, is_active, review_status, image_url, review_snoozed_until, updated_at')
          .single()
        if (ge) throw new Error(`games insert failed: ${ge.message}`)
        const { error: xe } = await db
          .from('game_external_ids')
          .insert({ game_id: (g as any).id, platform: 'roblox', external_id: String(universeId) })
        if (xe) {
          // Lost a race with another run: drop our row, theirs is the key.
          await db.from('games').delete().eq('id', (g as any).id)
          throw new Error(`game_external_ids insert failed: ${xe.message}`)
        }
        existingSlugs.add(resolved.slug)
        game = {
          gameId: (g as any).id,
          slug: (g as any).slug,
          name: (g as any).name,
          isActive: false,
          reviewStatus: 'pending',
          imageUrl: null,
          reviewSnoozedUntil: null,
          updatedAt: (g as any).updated_at ?? null,
        }
        catalogue.set(universeId, game)
        summary.created.push(game.slug)
        if (resolved.collided) for (const e of evs) e.flags = { ...e.flags, slugCollision: resolved.collidedWith }
      }

      // 2. Category templates — the ONLY creation path.
      let cats = 0
      for (const globalSlug of RADAR_CATEGORY_SLUGS) {
        await ensure(game.gameId, globalSlug)
        cats += 1
      }
      log.categories = cats

      // 3. Icon (known universe id → no name search, no ambiguity refusal).
      if (!game.imageUrl) {
        try {
          const icon = await fetchIcon({ slug: game.slug, name, ecosystem: 'roblox', externalId: String(universeId) })
          log.icon = icon.status
          if (icon.status === 'filled' && icon.iconUrl) {
            const { error: ue } = await db
              .from('games')
              .update({ image_url: icon.iconUrl, image_source: icon.source ?? 'roblox', image_synced_at: now.toISOString() })
              .eq('id', game.gameId)
            if (ue) log.errors.push(`icon write: ${ue.message}`)
            else game.imageUrl = icon.iconUrl
          } else if (icon.error) log.errors.push(`icon: ${icon.error}`)
        } catch (e) {
          log.icon = 'error'
          log.errors.push(`icon: ${e instanceof Error ? e.message : String(e)}`)
        }
      } else {
        log.icon = 'kept'
      }

      // 4. Draft taxonomy — stored on the primary event, never in a table.
      let wikiFound = Boolean((primary.draft as TaxonomyDraft | null)?.found)
      if (!primary.draft) {
        try {
          const d = await draft(name)
          primary.draft = d
          wikiFound = d.found
          const { error: de } = await db.from('trend_events').update({ draft: d as any }).eq('id', primary.id)
          if (de) log.errors.push(`draft write: ${de.message}`)
        } catch (e) {
          log.errors.push(`wiki: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      log.wiki = wikiFound

      // 5. Discord is decided after the loop (one message per game, or one
      // digest when the run prepared more than alertBurstMax games).
      const alreadyPosted = evs.find((e) => e.discord_message_id)?.discord_message_id ?? null
      if (alreadyPosted) log.discord = 'already'
      prepared.push({ evs, game, name, universeId, log, attempts, wikiFound, needsAlert: !alreadyPosted })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.errors.push(msg)
      summary.errors.push(`${name}: ${msg}`)
      const gameId = catalogue.get(universeId)?.gameId ?? null
      if (attempts >= maxAttempts) await markHandled(evs, gameId, log, attempts, { gaveUp: true })
      else await defer(evs, gameId, log, attempts)
    }
  }

  // ── Discord + handled ─────────────────────────────────────────────────
  const toAlert = prepared.filter((p) => p.needsAlert)
  if (toAlert.length > config.alertBurstMax) {
    const adminUrl = `${siteUrl}/admin/games?status=pending`
    const payload = trendDigestPayload(
      toAlert.map((p) => ({
        name: p.name,
        slug: p.game.slug,
        playingNow: Math.max(0, ...p.evs.map((e) => Number(e.flags?.playingNow ?? 0))),
        rank: p.evs.find((e) => e.signal === 'top30_entry')?.value ?? null,
        signals: [...new Set(p.evs.map((e) => e.signal))],
      })),
      adminUrl,
    )
    const res = await post(payload)
    for (const p of toAlert) applyPostResult(p, res)
  } else {
    for (const p of toAlert) {
      const payload = alertFor(p.evs, { slug: p.game.slug, name: p.name, universeId: p.universeId, iconUrl: p.game.imageUrl, wikiFound: p.wikiFound })
      applyPostResult(p, await post(payload))
    }
  }
  for (const p of prepared) {
    const blocking = p.log.discord === 'failed' && webhookUrl // no webhook configured is not a reason to loop
    if (blocking && p.attempts < maxAttempts) {
      await defer(p.evs, p.game.gameId, p.log, p.attempts)
    } else {
      await markHandled(p.evs, p.game.gameId, p.log, p.attempts, blocking ? { gaveUp: true } : {})
    }
  }

  return summary

  // ── helpers ────────────────────────────────────────────────────────────

  function applyPostResult(p: (typeof prepared)[number], res: PostResult) {
    const digest = toAlert.length > config.alertBurstMax
    if (res.ok && 'dryRun' in res) {
      if (!digest || summary.payloads[summary.payloads.length - 1] !== res.payload) summary.payloads.push(res.payload)
      p.log.discord = 'dry'
      return
    }
    if (res.ok) {
      p.log.discord = digest ? 'digest' : 'sent'
      const id = res.messageId ?? 'sent'
      for (const ev of p.evs) ev.discord_message_id = id
      return
    }
    if (res.error === NO_WEBHOOK) {
      p.log.discord = 'skipped' // not configured is a setup state, not an error
      return
    }
    p.log.discord = 'failed'
    p.log.errors.push(`discord: ${res.error}`)
  }

  async function resolveWith(title: string, s: typeof search, fp: typeof fetchPlaying) {
    const candidates = await s(title)
    const first = chooseUniverse(title, candidates, new Map())
    if (!first || !first.ambiguous) return first
    const playing = await fp(first.candidates.map((c) => c.universeId))
    return chooseUniverse(title, candidates, playing)
  }

  async function handleUnresolved(ev: EventRow) {
    const payload: MessagePayload = {
      content: `📡 New on Eldorado's seller-fee chart: **${ev.name ?? ev.external_id}** — not found on Roblox (may be another platform). No game created.`,
      allowed_mentions: { parse: [] },
    }
    if (dryRun) {
      summary.payloads.push(payload)
      return
    }
    const res = await post(payload)
    const messageId = res.ok && !('dryRun' in res) ? res.messageId : null
    const { error: ue } = await db
      .from('trend_events')
      .update({ handled_at: now.toISOString(), discord_message_id: messageId, flags: { ...ev.flags, unresolved: true } })
      .eq('id', ev.id)
    if (ue) summary.errors.push(`unresolved write: ${ue.message}`)
    summary.handled += 1
  }

  function alertFor(evs: EventRow[], g: { slug: string; name: string; universeId: number; iconUrl: string | null; wikiFound: boolean }): MessagePayload {
    const order = ['top30_entry', 'growth_48h', 'rmt_chart']
    const signals = [...new Set(evs.map((e) => e.signal))].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const top = evs.find((e) => e.signal === 'top30_entry')
    const growth = evs.find((e) => e.signal === 'growth_48h')
    const rootPlaceId = evs.map((e) => e.flags?.rootPlaceId).find((x) => x) as number | undefined
    const flags = Object.assign({}, ...evs.map((e) => e.flags))
    return trendAlertPayload({
      name: g.name,
      slug: g.slug,
      universeId: g.universeId,
      playingNow: Math.max(0, ...evs.map((e) => Number(e.flags?.playingNow ?? 0))),
      playing48hAgo: growth ? Number(growth.flags?.playing48hAgo ?? 0) || null : null,
      signals: signals as any,
      rank: top ? Number(top.value) : null,
      adminUrl: `${siteUrl}/admin/games?status=pending#${g.slug}`,
      robloxUrl: rootPlaceId ? `https://www.roblox.com/games/${rootPlaceId}` : `https://www.roblox.com/games/refer?universeId=${g.universeId}`,
      iconUrl: g.iconUrl,
      categories: [...RADAR_CATEGORY_SLUGS],
      wikiFound: g.wikiFound,
      flags,
    })
  }

  async function markHandled(
    evs: EventRow[],
    gameId: string | null,
    log: Record<string, unknown>,
    attempts?: number,
    extra: Record<string, unknown> = {},
  ) {
    for (const ev of evs) {
      const { error: ue } = await db
        .from('trend_events')
        .update({
          handled_at: now.toISOString(),
          game_id: gameId,
          discord_message_id: ev.discord_message_id,
          flags: { ...ev.flags, ...extra, prepare: log, ...(attempts ? { prepareAttempts: attempts } : {}) },
        })
        .eq('id', ev.id)
      if (ue) summary.errors.push(`handled write: ${ue.message}`)
      else summary.handled += 1
    }
  }

  async function defer(evs: EventRow[], gameId: string | null, log: StepLog, attempts: number) {
    for (const ev of evs) {
      const { error: ue } = await db
        .from('trend_events')
        .update({ game_id: gameId, discord_message_id: ev.discord_message_id, flags: { ...ev.flags, prepare: log, prepareAttempts: attempts } })
        .eq('id', ev.id)
      if (ue) summary.errors.push(`defer write: ${ue.message}`)
      else summary.deferred += 1
    }
  }
}
