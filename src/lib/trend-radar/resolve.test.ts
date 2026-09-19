import { describe, it, expect } from 'vitest'
import { chooseUniverse as chooseRaw, resolveUniverse as resolveRaw, type ResolveDeps } from './resolve'
import { ACCEPT_THRESHOLD, decideMatch, scoreCandidate, type IconCandidate } from '@/lib/games/icons'

const c = (id: number, title: string): IconCandidate => ({ id, title })
const matcher = { decideMatch, scoreCandidate, acceptThreshold: ACCEPT_THRESHOLD }
const chooseUniverse = (t: string, cs: IconCandidate[], p: Map<number, number>) => chooseRaw(t, cs, p, matcher)
const resolveUniverse = (t: string, d: Omit<ResolveDeps, 'matcher'>) => resolveRaw(t, { ...d, matcher })

describe('chooseUniverse', () => {
  it('returns the single exact match, not ambiguous', () => {
    const r = chooseUniverse('Steal a Brainrot', [c(1, 'Steal a Brainrot'), c(2, 'Steal a Brainrot 2 Tycoon')], new Map())
    expect(r).toMatchObject({ universeId: 1, matchedTitle: 'Steal a Brainrot', ambiguous: false, confidence: 1 })
  })

  it('on a duplicate title picks the universe with the higher current playerCount and flags it', () => {
    const r = chooseUniverse(
      'Steal An Egg',
      [c(10563114921, 'Steal An Egg'), c(555, 'Steal An Egg'), c(777, '[🥚] Steal An Egg From Verity')],
      new Map([[555, 1_200], [10563114921, 2_034_139]]),
    )
    expect(r).toMatchObject({ universeId: 10563114921, ambiguous: true })
    expect(r?.candidates.map((x) => x.universeId)).toEqual(expect.arrayContaining([10563114921, 555]))
    expect(r?.candidates[0]).toMatchObject({ universeId: 10563114921, playing: 2_034_139 })
  })

  it('a duplicate with no playerCount data for either is still resolved, to the first, and flagged', () => {
    const r = chooseUniverse('Steal An Egg', [c(1, 'Steal An Egg'), c(2, 'Steal An Egg')], new Map())
    expect(r).toMatchObject({ universeId: 1, ambiguous: true, playerCountKnown: false })
  })

  it('returns null when nothing clears the bar', () => {
    expect(chooseUniverse('Heroes RNG', [c(1, 'RNG Heroes'), c(2, 'Hero Simulator')], new Map())).toBeNull()
  })
})

describe('resolveUniverse', () => {
  it('searches, then fills missing playerCounts for the tied candidates before choosing', async () => {
    const searched: string[] = []
    const asked: number[][] = []
    const r = await resolveUniverse('Steal An Egg', {
      search: async (q) => { searched.push(q); return [c(1, 'Steal An Egg'), c(2, 'Steal An Egg')] },
      playingById: new Map(),
      fetchPlaying: async (ids) => { asked.push(ids); return new Map([[1, 10], [2, 900]]) },
    })
    expect(searched).toEqual(['Steal An Egg'])
    expect(asked).toEqual([[1, 2]])
    expect(r).toMatchObject({ universeId: 2, ambiguous: true, playerCountKnown: true })
  })

  it('does not call fetchPlaying when the sorts already answer', async () => {
    let called = false
    const r = await resolveUniverse('X', {
      search: async () => [c(1, 'X'), c(2, 'X')],
      playingById: new Map([[1, 5], [2, 50]]),
      fetchPlaying: async () => { called = true; return new Map() },
    })
    expect(called).toBe(false)
    expect(r?.universeId).toBe(2)
  })
})
