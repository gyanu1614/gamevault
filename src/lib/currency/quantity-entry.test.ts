import { describe, it, expect } from 'vitest'
import { quickAmounts, typeKey, MAX_QTY_DIGITS } from './quantity-entry'

describe('quickAmounts', () => {
  it('starts at the minimum and steps up in round numbers', () => {
    expect(quickAmounts(100, 93_000)).toEqual([100, 500, 1_000, 5_000])
  })

  it('rounds each step up to a 1/2/5 number', () => {
    expect(quickAmounts(150, 1_000_000)).toEqual([150, 1_000, 2_000, 10_000])
  })

  it('works for bulk games counted in K or M', () => {
    expect(quickAmounts(1, 500)).toEqual([1, 5, 10, 50])
  })

  it('drops steps that reach the stock (Max covers those)', () => {
    expect(quickAmounts(100, 1_000)).toEqual([100, 500])
    expect(quickAmounts(100, 100)).toEqual([100])
  })

  it('treats a missing minimum as 1', () => {
    expect(quickAmounts(0, 100)).toEqual([1, 5, 10, 50])
  })
})

describe('typeKey', () => {
  it('a digit starts a new amount instead of appending to the shown one', () => {
    expect(typeKey(null, 100, '7')).toBe('7')
  })

  it('digits append while typing', () => {
    expect(typeKey('25', 100, '0')).toBe('250')
  })

  it('never keeps leading zeros', () => {
    expect(typeKey(null, 100, '0')).toBe('')
    expect(typeKey('', 100, '0')).toBe('')
    expect(typeKey('', 100, '00')).toBe('')
  })

  it('00 multiplies the shown amount by 100 when nothing is typed yet', () => {
    expect(typeKey(null, 25, '00')).toBe('2500')
    expect(typeKey('3', 100, '00')).toBe('300')
  })

  it('backspace edits the shown amount, then the typed one', () => {
    expect(typeKey(null, 2500, 'back')).toBe('250')
    expect(typeKey('7', 100, 'back')).toBe('')
    expect(typeKey('', 100, 'back')).toBe('')
  })

  it(`stops at ${MAX_QTY_DIGITS} digits`, () => {
    const full = '9'.repeat(MAX_QTY_DIGITS)
    expect(typeKey(full, 0, '1')).toBe(full)
    expect(typeKey(full, 0, '00')).toBe(full)
  })
})
