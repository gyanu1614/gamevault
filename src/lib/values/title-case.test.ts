import { describe, it, expect } from 'vitest'
import { titleCaseValue } from './title-case'

// Owner, 2026-10-14: "its Unobtainable, not unobtainable, so capitalize stuff
// wherever needed" — item facts read as labels.
describe('titleCaseValue', () => {
  it('capitalises each word of a fact value', () => {
    expect(titleCaseValue('unobtainable')).toBe('Unobtainable')
    expect(titleCaseValue('halloween 2019 event')).toBe('Halloween 2019 Event')
    expect(titleCaseValue('limited-time')).toBe('Limited-Time')
  })

  it('keeps small joining words low, except the first', () => {
    expect(titleCaseValue('hatched from the jungle egg')).toBe('Hatched From the Jungle Egg')
    expect(titleCaseValue('of the year')).toBe('Of the Year')
  })

  it('leaves numbers, money, apostrophes and existing capitals alone', () => {
    expect(titleCaseValue("traveler's gun")).toBe("Traveler's Gun")
    expect(titleCaseValue('$400B')).toBe('$400B')
    expect(titleCaseValue('Diamond · 1.5x')).toBe('Diamond · 1.5x')
    expect(titleCaseValue('NFR')).toBe('NFR')
  })
})
