import { describe, expect, it } from 'vitest'
import { traitHint } from '@/lib/adopt-me/trait-hint'
import { nextTraitStep, type TraitFlowState } from './trait-hint-flow'

const CHOICES = ['none', 'f', 'r', 'fr', 'nfr', 'mfr'].map((value) => ({ value, label: value === 'none' ? 'None' : value.toUpperCase() }))
const START: TraitFlowState = { auto: null, declined: null }

const step = (title: string, picked: string | null, state = START) =>
  nextTraitStep(traitHint({ title, picked, choices: CHOICES }), picked, state)

describe('nextTraitStep — the four owner cases', () => {
  it('picked FR, title FR → nothing', () => {
    expect(step('FR Frost Dragon', 'fr')).toEqual({ state: START })
  })

  it('picked nothing, title says nothing → nothing', () => {
    expect(step('Frost Dragon', null)).toEqual({ state: START })
  })

  it('picked nothing, title FR → pre-select FR', () => {
    expect(step('FR Frost Dragon', null)).toEqual({ set: 'fr', state: { auto: { variant: 'FR', value: 'fr' }, declined: null } })
  })

  it('picked R, title FR → show the line, keep R', () => {
    const out = step('FR Frost Dragon', 'r')
    expect(out.set).toBeUndefined()
    expect(out.show?.choice.value).toBe('fr')
  })
})

describe('nextTraitStep — after a pre-select', () => {
  const afterAuto: TraitFlowState = { auto: { variant: 'FR', value: 'fr' }, declined: null }

  it('the seller clears it → stays cleared for that title', () => {
    const out = step('FR Frost Dragon', null, afterAuto)
    expect(out.set).toBeUndefined()
    expect(out.state.declined).toBe('FR')
    expect(step('FR Frost Dragon', null, out.state).set).toBeUndefined()
  })

  it('the title changes to another variant → our own pick follows it', () => {
    expect(step('NFR Frost Dragon', 'fr', afterAuto)).toEqual({ set: 'nfr', state: { auto: { variant: 'NFR', value: 'nfr' }, declined: null } })
  })

  it('the seller picked something else themselves → their pick stays, the line shows', () => {
    const out = step('FR Frost Dragon', 'r', afterAuto)
    expect(out.set).toBeUndefined()
    expect(out.show?.titleVariant).toBe('FR')
  })

  it('a declined variant comes back once the title names a different one', () => {
    const declined: TraitFlowState = { auto: { variant: 'FR', value: 'fr' }, declined: 'FR' }
    expect(step('NFR Frost Dragon', null, declined).set).toBe('nfr')
  })
})
