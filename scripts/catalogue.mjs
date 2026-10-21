#!/usr/bin/env node
/**
 * Values catalogue: add newly released items from each game's Fandom wiki
 * (src/lib/catalogue/; spec docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
 *
 *   pnpm catalogue --game=sab --env=local                  # dry run, local stack
 *   pnpm catalogue --game=sab --env=prod --yes             # dry run against prod (reads only)
 *   pnpm catalogue --game=sab --write --env=prod --yes     # owner only
 *   pnpm catalogue --game=sab --write --env=prod --yes --allow-large   # first run / big backlog
 *   (GitHub) pnpm catalogue --game=sab --write --trigger=schedule
 *   --report=<file> also writes the run report as JSON.
 *
 * Insert-only: existing rows are never changed. A run that would add more than
 * the game's cap, or cannot parse the wiki, stops and posts to Discord instead.
 * Exit 1 only on a failure (the workflow's failure step then alerts).
 */
import fs from 'node:fs'
import process from 'node:process'
import { findCatalogueGame } from '../src/lib/catalogue/registry.ts'
import { createWikiClient } from '../src/lib/catalogue/wiki.ts'
import { createImageStore } from '../src/lib/catalogue/images.ts'
import { runCatalogue } from '../src/lib/catalogue/run.ts'
import { postOpsAlert } from '../src/lib/ops/discord-alert.ts'
import { httpRevalidator } from '../src/lib/pricing/publish.ts'
import { valuesDbClient } from './lib/values-db.mjs'

const argv = process.argv.slice(2)
const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const flag = (name) => argv.includes(`--${name}`)

function print(game, r, write) {
  const lines = [
    `### ${game.name} catalogue: ${r.status}${write ? '' : ' (dry run)'}`,
    `listed ${r.listed} · read ${r.candidates} · already ours ${r.adopted} · not items ${r.ignored} · images fixed ${r.imagesFixed} · wiki requests ${r.wikiRequests}`,
    r.message ? `**${r.message}**` : null,
    r.added.length ? `${write && r.status === 'ok' ? 'Added' : 'Would add'} ${r.added.length}: ${r.added.map((a) => a.name).join(', ')}` : 'Nothing new.',
    r.parseErrors.length ? `Parse errors: ${r.parseErrors.slice(0, 10).join('; ')}` : null,
  ].filter(Boolean)
  console.log(lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n\n')}\n`)
}

async function main() {
  const key = val('game')
  if (!key) throw new Error('--game=<key> is required')
  const only = val('only')
  if (only && only !== key) return console.log(`skipped (--only=${only})`)
  const game = findCatalogueGame(key)
  const write = flag('write')
  const { db, url } = valuesDbClient({ env: val('env') ?? undefined, yes: flag('yes') })
  const isProd = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)
  const siteUrl = process.env.PUBLIC_API_URL || 'https://dropmarket.gg'
  const secret = process.env.VALUES_REVALIDATE_SECRET
  const revalidator = write && isProd && secret ? httpRevalidator({ baseUrl: siteUrl, secret }) : null
  console.log(`${write ? 'Writing to' : 'Dry run against'} ${url}${write && !revalidator ? ' (pages will not be refreshed)' : ''}`)

  const wiki = createWikiClient({ host: game.adapter.wikiHost })
  const report = await runCatalogue(
    game,
    {
      db,
      wiki,
      images: createImageStore({ db, wiki }),
      revalidate: revalidator ? (gameSlug, changedSlugs) => revalidator({ gameSlug, changedSlugs }) : null,
      notify: (text) => (isProd ? postOpsAlert(text) : Promise.resolve(false)),
    },
    { write, allowLarge: flag('allow-large'), trigger: val('trigger') === 'schedule' ? 'schedule' : 'manual', siteUrl },
  )
  print(game, report, write)
  if (val('report')) fs.writeFileSync(val('report'), `${JSON.stringify(report, null, 2)}\n`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
