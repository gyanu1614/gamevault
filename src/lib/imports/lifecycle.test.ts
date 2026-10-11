import { describe, it, expect } from 'vitest'
import { BATCH_STATUS_FROM, reimportDecision } from './lifecycle'

describe('re-importing a row this store already has', () => {
  it('a live listing just takes the new price and stock', () => {
    expect(reimportDecision({ status: 'active', quantity: 3, isUnlimited: false })).toEqual({ kind: 'update', status: null })
  })

  it('a sold-out listing comes back when the import restocks it', () => {
    expect(reimportDecision({ status: 'sold', quantity: 2, isUnlimited: false })).toEqual({ kind: 'update', status: 'active' })
    expect(reimportDecision({ status: 'sold', quantity: 0, isUnlimited: false })).toEqual({ kind: 'update', status: null })
  })

  it('a removed (archived) listing is re-listed — same listing, same URL', () => {
    expect(reimportDecision({ status: 'archived', quantity: 1, isUnlimited: false })).toEqual({ kind: 'update', status: 'active' })
  })

  it('a paused listing stays paused (its batch Resume brings it back)', () => {
    expect(reimportDecision({ status: 'paused', quantity: 5, isUnlimited: false })).toEqual({ kind: 'update', status: null })
  })

  it('never revives what moderation took down', () => {
    expect(reimportDecision({ status: 'suspended', quantity: 1, isUnlimited: false }).kind).toBe('refuse')
    expect(reimportDecision({ status: 'rejected', quantity: 1, isUnlimited: false }).kind).toBe('refuse')
  })

  it('leaves review states to moderation', () => {
    for (const status of ['pending_approval', 'changes_requested', 'draft']) {
      expect(reimportDecision({ status, quantity: 1, isUnlimited: false })).toEqual({ kind: 'update', status: null })
    }
  })
})

describe('batch Pause / Resume / Remove only move the statuses they own', () => {
  it('pause takes live listings only; resume brings back paused ones only', () => {
    expect(BATCH_STATUS_FROM.paused).toEqual(['active'])
    expect(BATCH_STATUS_FROM.active).toEqual(['paused'])
  })

  it('remove never touches a taken-down, rejected or already-removed listing', () => {
    for (const s of ['suspended', 'rejected', 'archived']) expect(BATCH_STATUS_FROM.archived).not.toContain(s)
    expect(BATCH_STATUS_FROM.archived).toEqual(expect.arrayContaining(['active', 'paused', 'sold']))
  })

  it('no transition ever turns a sold listing back on', () => {
    expect(BATCH_STATUS_FROM.active).not.toContain('sold')
    expect(BATCH_STATUS_FROM.paused).not.toContain('sold')
  })
})
