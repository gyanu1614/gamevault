/**
 * MM2 values pipeline wiring: the pieces live in four places (migration seed,
 * normaliser config, pricing registry, daily workflow) and must agree.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { eldoradoStructuredConfig } from '@/lib/values/sources/eldorado-structured-games'

const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const MIGRATION = read('supabase/migrations/20261005004438_values_mm2_catalogue.sql')
const WORKFLOW = read('.github/workflows/values-pricing-daily.yml')
const PKG = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

describe('MM2 values pipeline wiring', () => {
  it('the migration seeds values_games with the config\'s Eldorado gameId and normaliser', () => {
    const config = eldoradoStructuredConfig('murder-mystery-2')!
    expect(MIGRATION).toContain(`"game_ref":"${config.gameId}"`)
    expect(MIGRATION).toContain("'eldorado-structured'")
    expect(MIGRATION).toMatch(/where g\.slug = 'murder-mystery-2'/)
    // The hub is not live yet: the seed must not enable it.
    expect(MIGRATION).toMatch(/1440,\s*\n\s*false/)
  })

  it('the migration is additive and keeps the raw table private', () => {
    expect(MIGRATION).not.toMatch(/\bdrop table\b|\bdrop column\b|\btruncate\b|\bdelete from\b/i)
    expect(MIGRATION).not.toMatch(/grant\s+[^;]*values_raw_listings[^;]*to\s+(anon|authenticated)/i)
    expect(MIGRATION).not.toMatch(/create (or replace )?function/i)
  })

  it('the daily MM2 job is OFF unless the repo variable (or an explicit forced run) turns it on', () => {
    const job = WORKFLOW.slice(WORKFLOW.indexOf('\n  murder-mystery-2:'))
    expect(job).toContain("vars.MM2_PRICING_ENABLED == 'true'")
    expect(job).toContain("inputs.games == 'murder-mystery-2' && inputs.mm2_force")
    expect(job).toContain('pnpm values:eldorado --game=murder-mystery-2 --crawl --write')
    expect(job).toContain('pnpm reprice --game=murder-mystery-2')
    // values-revalidate 400s for a non-hub game: publish only once the hub is live.
    expect(job).toContain("vars.MM2_HUB_LIVE == 'true' && env.PUBLISH_FLAG")
  })

  it('every script the job and the runbook call exists', () => {
    for (const name of ['values:eldorado', 'values:eldorado:import', 'values:mm2:catalogue', 'values:images', 'values:dryrun', 'reprice']) {
      expect(PKG.scripts[name], name).toBeTruthy()
      const file = PKG.scripts[name].split(' ').find((p) => p.startsWith('scripts/'))
      if (file) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true)
    }
  })
})
