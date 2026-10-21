import { describe, expect, it } from 'vitest'
import { runMessage } from './notify'
import type { CatalogueGame, RunReport } from './types'

const game = { key: 'sab', name: 'Steal a Brainrot', adapter: { gameSlug: 'steal-a-brainrot', label: 'brainrots' } } as CatalogueGame
const report = (over: Partial<RunReport>): RunReport => ({
  gameSlug: 'steal-a-brainrot',
  status: 'ok',
  listed: 0,
  candidates: 0,
  adopted: 0,
  added: [],
  ignored: 0,
  imagesFixed: 0,
  parseErrors: [],
  message: null,
  wikiRequests: 0,
  ...over,
})

describe('runMessage', () => {
  it('lists added items as links, singular for one', () => {
    expect(runMessage(game, report({ added: [{ slug: 'slushi-huski', name: 'Slushi Huski' }] }), 'https://dropmarket.gg')).toBe(
      '🆕 **Steal a Brainrot**: 1 new brainrot added: [Slushi Huski](<https://dropmarket.gg/steal-a-brainrot/values/slushi-huski>).',
    )
  })
  it('caps the list at 12 names', () => {
    const added = Array.from({ length: 15 }, (_, i) => ({ slug: `b${i}`, name: `B${i}` }))
    expect(runMessage(game, report({ added }), 'https://x')).toMatch(/15 new brainrots added: .* and 3 more\.$/)
  })
  it('says why a blocked run stopped, and stays quiet when nothing is new', () => {
    expect(runMessage(game, report({ status: 'blocked', message: '120 new items is over the safety cap of 50' }), 'https://x')).toBe(
      '⚠️ **Steal a Brainrot** catalogue run stopped: 120 new items is over the safety cap of 50. Nothing was written.',
    )
    expect(runMessage(game, report({ status: 'nothing_new' }), 'https://x')).toBeNull()
  })
})
