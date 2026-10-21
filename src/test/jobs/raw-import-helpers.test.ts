import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — plain .mjs helpers shared by the runner scripts
import { sabImporterArgs, runSabImporter } from '../../../scripts/lib/sab-importer.mjs'
// @ts-expect-error — plain .mjs helpers shared by the runner scripts
import { retireUnseenRawListings } from '../../../scripts/lib/values-raw.mjs'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// 2026-10-20 usage audit (C2): the G2G crawl imported WITH publish, so the
// heavy SAB recompute chain (estimates, evidence rebuild, price display) ran
// once after G2G and again in the reprice 1-2 h later. The reprice is the one
// publisher; every crawl imports with --no-publish.
describe('SAB crawl import never publishes', () => {
  it('the shared importer args carry --send and --no-publish', () => {
    expect(sabImporterArgs('data/feed.json')).toEqual([
      'scripts/import-sab-market-json.mjs',
      'data/feed.json',
      '--send',
      '--no-publish',
    ])
  })

  it('runSabImporter spawns node with those args and resolves on exit 0', async () => {
    const calls: unknown[][] = []
    const fakeSpawn = (...args: unknown[]) => {
      calls.push(args)
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('exit', 0))
      return child
    }
    await runSabImporter('feed.json', { spawnFn: fakeSpawn })
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(process.execPath)
    expect(calls[0][1]).toEqual(sabImporterArgs('feed.json'))
  })

  it('runSabImporter rejects on a non-zero exit', async () => {
    const fakeSpawn = () => {
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('exit', 3))
      return child
    }
    await expect(runSabImporter('feed.json', { spawnFn: fakeSpawn })).rejects.toThrow(/code 3/)
  })

  it('both SAB collectors use the shared importer (no private copy)', () => {
    for (const file of ['scripts/collect-g2g-sab.mjs', 'scripts/collect-eldorado-sab-api-v6.mjs']) {
      const src = read(file)
      expect(src, file).toMatch(/from ['"]\.\/lib\/sab-importer\.mjs['"]/)
      expect(src, file).not.toMatch(/function runImporter\(/)
    }
  })
})

type Call = { op: string; args: unknown[] }
function recordingDb(error: { message: string } | null = null) {
  const calls: Call[] = []
  const chain: Record<string, unknown> = {}
  for (const op of ['from', 'update', 'eq', 'lt']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args })
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) => resolve({ error })
  return { db: chain, calls }
}

// 2026-10-20 usage audit (B3): Steal an Egg's retire step had no
// is_active filter, so every daily run rewrote the game's WHOLE history
// (all already inactive), doubling values_raw_listings with dead rows.
describe('retireUnseenRawListings', () => {
  it('only touches rows that are still active, for this game, from before this crawl', async () => {
    const { db, calls } = recordingDb()
    await retireUnseenRawListings(db, 'game-1', '2026-10-20T00:00:00.000Z')
    expect(calls).toEqual([
      { op: 'from', args: ['values_raw_listings'] },
      { op: 'update', args: [{ is_active: false }] },
      { op: 'eq', args: ['game_id', 'game-1'] },
      { op: 'eq', args: ['is_active', true] },
      { op: 'lt', args: ['observed_at', '2026-10-20T00:00:00.000Z'] },
    ])
  })

  it('throws with the table name when the update fails', async () => {
    const { db } = recordingDb({ message: 'boom' })
    await expect(retireUnseenRawListings(db, 'g', 'now')).rejects.toThrow('values_raw_listings retire: boom')
  })

  it('both values writers use it (no private retire query)', () => {
    for (const file of ['scripts/lib/sae-write.mjs', 'scripts/lib/values-import.mjs']) {
      const src = read(file)
      expect(src, file).toMatch(/retireUnseenRawListings\(/)
      expect(src, file).not.toMatch(/update\(\{\s*is_active:\s*false\s*\}\)/)
    }
  })
})
