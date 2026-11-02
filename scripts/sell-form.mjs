#!/usr/bin/env node
/**
 * Sell-form sync from the values catalogue (src/lib/catalogue/sell-form/;
 * spec docs/superpowers/specs/2026-10-29-sell-form-catalogue-sync-design.md).
 *
 *   pnpm sell-form --game=murder-mystery-2 --env=prod            # dry run, prod, public reads only
 *   pnpm sell-form --game=murder-mystery-2 --env=local           # dry run, this worktree's stack
 *   pnpm sell-form --game=murder-mystery-2 --env=local --write   # apply locally (no page refresh)
 *   --report=<file> writes the full plan (fields, options, rules, repairs) as JSON.
 *
 * Production writes go through POST /api/internal/sell-form/sync (the daily
 * catalogue workflow, or a manual run of it): a repair must re-link listings
 * and refresh pages, which only the app can do. A prod dry run uses the anon
 * key, so it sees enabled items and active listings only.
 */
import fs from 'node:fs'
import process from 'node:process'
import { findSellFormConfig } from '../src/lib/catalogue/sell-form/config.ts'
import { syncSellForm } from '../src/lib/catalogue/sell-form/run.ts'
import { valuesDbClient } from './lib/values-db.mjs'

const argv = process.argv.slice(2)
const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const flag = (name) => argv.includes(`--${name}`)

function countBy(rows, key) {
  const out = {}
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1
  return Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} ${n}`).join(' · ')
}

async function main() {
  const game = val('game')
  const config = game && findSellFormConfig(game)
  if (!config) throw new Error(`--game=<slug> with a sell-form config is required (got "${game}")`)
  const env = val('env')
  const write = flag('write')
  if (write && env !== 'local') throw new Error('--write is local only; production writes go through /api/internal/sell-form/sync')
  const { db, url } = valuesDbClient({ env: env ?? undefined, readOnly: !write })
  console.log(`${write ? 'Writing to' : 'Dry run against'} ${url}`)

  const { report, plan, repairs } = await syncSellForm(config, { db, afterRepairs: null, afterFormChange: null }, { write, allowLarge: flag('allow-large') || !write })
  const lines = [
    `### ${config.gameSlug} sell form: ${report.status}${write ? '' : ' (dry run)'}`,
    report.message ? `**${report.message}**` : null,
  ]
  if (plan) {
    lines.push(
      `fields: +${plan.createFields.length} new (${plan.createFields.map((f) => f.node).join(', ') || 'none'}), ${plan.updateFields.length} fixed${plan.renamed.length ? `, renamed back: ${plan.renamed.map((r) => `${r.from}→${r.node}`).join(', ')}` : ''}`,
      `options: +${plan.createOptions.length} (${countBy(plan.createOptions, (c) => c.node) || 'none'})`,
      `options fixed/adopted: ${plan.updateOptions.length} · to drop: ${plan.deleteOptions.length}${plan.deleteOptions.length ? ` (${plan.deleteOptions.slice(0, 10).map((d) => `${d.node}:${d.value} ${d.reason}`).join('; ')})` : ''}`,
      `rules set: ${plan.setRules.length}`,
      `listings moved onto the chain: ${repairs.length}${repairs.length ? ` (${repairs.map((r) => `${r.id.slice(0, 8)}→${r.itemSlug ?? 'other'}`).join(', ')})` : ''}`,
      ...plan.warnings.map((w) => `⚠ ${w}`),
    )
  }
  if (report.optionsKept.length) lines.push(`kept (still used): ${report.optionsKept.map((k) => `${k.node}:${k.value}`).join(', ')}`)
  console.log(lines.filter(Boolean).join('\n'))
  if (val('report')) fs.writeFileSync(val('report'), `${JSON.stringify({ report, plan, repairs }, null, 2)}\n`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
