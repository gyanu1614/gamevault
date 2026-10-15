import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), '.github/workflows')

/**
 * Bug (2026-10-12): MM2 Weekly Watch failed at "Set up Node.js" with
 * "Unable to locate executable file: pnpm". package.json declares
 * packageManager pnpm, so setup-node@v5 turns on pnpm caching by itself; a
 * job that never installs pnpm (plain-Node scripts) then fails before it runs.
 * Every setup-node@v5 job either installs pnpm first or opts out.
 */
describe('workflow Node setup', () => {
  it.each(readdirSync(DIR).filter((f) => f.endsWith('.yml')))('%s installs pnpm or turns off package-manager caching', (f) => {
    const wf = readFileSync(join(DIR, f), 'utf8')
    if (!wf.includes('actions/setup-node@v5')) return
    const ok = wf.includes('pnpm/action-setup') || /package-manager-cache:\s*false/.test(wf)
    expect(ok, f).toBe(true)
  })
})
