#!/usr/bin/env node
/**
 * MM2 weekly watch — read-only. Tells us when the facts behind the MM2 free
 * items guide, codes page, boxes and events (scripts/values-seeds/murder-mystery-2.*)
 * may be out of date, so a human re-checks them. Nothing is written anywhere
 * except, with --update, the local baseline file.
 *
 * Signals (from free-items.json `watch_sources`), compared against
 * scripts/values-seeds/murder-mystery-2.watch-baseline.json:
 *   - MM2 Fandom wiki revision ids of Codes, Timeline, Shop, Boxes, Crafting, Promos
 *   - future pages still missing (Halloween Event 2026, Christmas Event 2026, Season 2)
 *   - the Roblox game record: `updated` (a game update shipped) and the description
 *   - game passes: how many, and which are on sale (event bundles appear here)
 *   - Roblox virtual events scheduled for the game
 *   - Nikilis's group shout
 * Recent wiki edits to titles with Event/Box/Bundle/Update/Code in the last
 * 7 days are listed for context but never fail the run.
 *
 * Polite: one request at a time, 1.5 s apart, a clear User-Agent, one retry
 * (after 10 s) on a 429 or 5xx. X (@NikilisRBX) has no free API and the
 * Discord announcement channel needs a bot, so neither is read; the wiki
 * usually logs a new post within hours.
 *
 * Usage:
 *   node scripts/mm2-watch.mjs                 print the report; exit 1 if anything changed
 *   node scripts/mm2-watch.mjs --report out.md also write the report as Markdown (issue body)
 *   node scripts/mm2-watch.mjs --update        after re-checking the seeds: store today's values as the baseline
 * Exit codes: 0 no change · 1 something changed · 2 a source could not be read.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'scripts/values-seeds/murder-mystery-2.watch-baseline.json')
const WIKI = 'https://murder-mystery-2.fandom.com/api.php'
const UA = 'DropMarketWatch/1.0 (weekly read-only check of public MM2 pages)'
const GAP_MS = 1500
const RECENT_PATTERN = /Event|Box|Bundle|Update|Code/i

const args = process.argv.slice(2)
const update = args.includes('--update')
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let last = 0

/** GET JSON, one request at a time and never faster than GAP_MS. */
async function getJson(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const wait = last + GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
    let res
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    } catch (err) {
      if (attempt === 0) {
        await sleep(10_000)
        continue
      }
      throw new Error(`${url}: ${err.message}`)
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await sleep(10_000)
      continue
    }
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    return res.json()
  }
  throw new Error(`${url}: gave up`)
}

const wikiUrl = (params) => `${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
const sha = (s) => createHash('sha256').update(s ?? '').digest('hex').slice(0, 16)
const seconds = (iso) => (iso ? iso.replace(/\.\d+Z$/, 'Z') : iso)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Read every signal. Returns the same shape as the baseline's wiki/roblox blocks, plus context. */
async function readCurrent(base) {
  const errors = []
  const safe = async (label, fn) => {
    try {
      return await fn()
    } catch (err) {
      errors.push(`${label}: ${err.message}`)
      return undefined
    }
  }
  const watched = Object.keys(base.wiki.revids)
  const revids = await safe('wiki revisions', async () => {
    const d = await getJson(wikiUrl({ action: 'query', prop: 'revisions', titles: watched.join('|'), rvprop: 'ids|timestamp' }))
    const out = {}
    for (const p of d.query.pages) out[p.title] = p.missing ? null : p.revisions?.[0]?.revid ?? null
    return out
  })
  const missing = await safe('wiki future pages', async () => {
    const d = await getJson(wikiUrl({ action: 'query', prop: 'revisions', titles: base.wiki.missing.join('|'), rvprop: 'ids' }))
    return d.query.pages.filter((p) => p.missing).map((p) => p.title).sort()
  })
  const recent = await safe('wiki recent changes', async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const d = await getJson(
      wikiUrl({ action: 'query', list: 'recentchanges', rcnamespace: '0', rclimit: '100', rcprop: 'title|ids|timestamp', rcend: since }),
    )
    return [...new Set(d.query.recentchanges.map((c) => c.title).filter((t) => RECENT_PATTERN.test(t)))].sort()
  })
  const u = base.roblox.universe_id
  const game = await safe('roblox game', async () => {
    const d = await getJson(`https://games.roblox.com/v1/games?universeIds=${u}`)
    const g = d.data?.[0]
    if (!g) throw new Error('no game record')
    return { updated: seconds(g.updated), descriptionSha: sha(g.description) }
  })
  const passes = await safe('roblox game passes', async () => {
    const all = []
    let token = ''
    for (let page = 0; page < 5; page += 1) {
      const d = await getJson(
        `https://apis.roblox.com/game-passes/v1/universes/${u}/game-passes?passView=Full&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`,
      )
      all.push(...(d.gamePasses ?? []))
      token = d.nextPageToken
      if (!token) break
    }
    return {
      count: all.length,
      forSale: all.filter((p) => p.isForSale).map((p) => p.id).sort((a, b) => a - b),
      names: Object.fromEntries(all.map((p) => [p.id, p.name])),
    }
  })
  const virtualEvents = await safe('roblox virtual events', async () => {
    const d = await getJson(`https://apis.roblox.com/virtual-events/v1/universes/${u}/virtual-events?limit=10`)
    return (d.data ?? []).length
  })
  const shout = await safe('roblox group', async () => {
    const d = await getJson(`https://groups.roblox.com/v1/groups/${base.roblox.group_id}`)
    return d.shout ? { body: d.shout.body ?? '', updated: d.shout.updated ?? null } : null
  })
  return { errors, revids, missing, recent, game, passes, virtualEvents, shout }
}

function diff(base, cur) {
  const changes = []
  if (cur.revids) {
    for (const [title, rev] of Object.entries(base.wiki.revids)) {
      const now = cur.revids[title]
      if (now !== rev) {
        changes.push({
          what: `Wiki page "${title}" was edited (revision ${rev} → ${now ?? 'missing'})`,
          check: `https://murder-mystery-2.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}?diff=${now}&oldid=${rev}`,
        })
      }
    }
  }
  if (cur.missing) {
    for (const title of base.wiki.missing) {
      if (!cur.missing.includes(title)) {
        changes.push({
          what: `Wiki page "${title}" now exists — the wiki has started covering it`,
          check: `https://murder-mystery-2.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        })
      }
    }
  }
  const r = base.roblox
  if (cur.game) {
    if (cur.game.updated !== r.game_updated) {
      changes.push({ what: `MM2 published a game update (${r.game_updated} → ${cur.game.updated})`, check: 'https://www.roblox.com/games/142823291/Murder-Mystery-2' })
    }
    if (cur.game.descriptionSha !== r.description_sha256) {
      changes.push({ what: 'The MM2 game description changed (it can announce an event or a code)', check: 'https://www.roblox.com/games/142823291/Murder-Mystery-2' })
    }
  }
  if (cur.passes) {
    if (cur.passes.count !== r.game_pass_count) {
      changes.push({ what: `Game passes: ${r.game_pass_count} → ${cur.passes.count} (a new bundle usually marks an event)`, check: 'https://www.roblox.com/games/142823291/Murder-Mystery-2#!/store' })
    }
    if (!same(cur.passes.forSale, r.game_passes_for_sale)) {
      const added = cur.passes.forSale.filter((id) => !r.game_passes_for_sale.includes(id))
      const removed = r.game_passes_for_sale.filter((id) => !cur.passes.forSale.includes(id))
      const name = (id) => `${cur.passes.names[id] ?? 'unknown'} (${id})`
      changes.push({
        what: `Passes on sale changed${added.length ? `; now on sale: ${added.map(name).join(', ')}` : ''}${removed.length ? `; off sale: ${removed.map(name).join(', ')}` : ''}`,
        check: 'https://www.roblox.com/games/142823291/Murder-Mystery-2#!/store',
      })
    }
  }
  if (cur.virtualEvents !== undefined && cur.virtualEvents !== r.virtual_event_count) {
    changes.push({ what: `Roblox Events for MM2: ${r.virtual_event_count} → ${cur.virtualEvents} (an event may be scheduled)`, check: 'https://www.roblox.com/games/142823291/Murder-Mystery-2' })
  }
  if (cur.shout !== undefined && !same(cur.shout?.body ?? null, r.group_shout)) {
    changes.push({ what: `Group shout changed: "${(cur.shout?.body ?? '(cleared)').slice(0, 200)}"`, check: `https://www.roblox.com/communities/${r.group_id}` })
  }
  return changes
}

function toMarkdown(base, cur, changes) {
  const lines = [
    `MM2 watch (${new Date().toISOString().slice(0, 10)}), against the baseline from ${base.checked_at}.`,
    '',
  ]
  if (changes.length) {
    lines.push('### What changed', '')
    for (const c of changes) lines.push(`- ${c.what} — ${c.check}`)
    lines.push(
      '',
      '### What to do',
      '',
      '1. Re-check the facts behind `/murder-mystery-2/free-items`, `/murder-mystery-2/codes`, the boxes and the events seeds (`scripts/values-seeds/murder-mystery-2.*.json`).',
      '2. Update the seeds (and `checked_at`) where something is new — a code, an event, a box, a recipe.',
      '3. Run `node scripts/mm2-watch.mjs --update` and commit the new baseline.',
    )
  } else {
    lines.push('No change against the baseline.')
  }
  if (cur.errors.length) lines.push('', '### Could not read', '', ...cur.errors.map((e) => `- ${e}`))
  if (cur.recent?.length) lines.push('', '### Wiki edits in the last 7 days (context only)', '', ...cur.recent.map((t) => `- ${t}`))
  return lines.join('\n')
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
const cur = await readCurrent(base)

if (update) {
  if (cur.errors.length) {
    console.error(`Not updating: ${cur.errors.join('; ')}`)
    process.exit(2)
  }
  const next = {
    ...base,
    checked_at: new Date().toISOString().slice(0, 10),
    wiki: { ...base.wiki, revids: Object.fromEntries(Object.keys(base.wiki.revids).map((t) => [t, cur.revids[t]])), missing: cur.missing },
    roblox: {
      ...base.roblox,
      game_updated: cur.game.updated,
      description_sha256: cur.game.descriptionSha,
      game_pass_count: cur.passes.count,
      game_passes_for_sale: cur.passes.forSale,
      virtual_event_count: cur.virtualEvents,
      group_shout: cur.shout?.body ?? null,
    },
  }
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Baseline updated (${next.checked_at}).`)
  process.exit(0)
}

const changes = diff(base, cur)
const md = toMarkdown(base, cur, changes)
console.log(md)
if (reportPath) writeFileSync(reportPath, `${md}\n`)
process.exit(changes.length ? 1 : cur.errors.length ? 2 : 0)
