import { describe, it, expect } from 'vitest'
import { answerLine, formatAboutUsd, formatUpdatedDate } from './value-answer-format'

describe('value answer line', () => {
  it('reads "<Item> is worth about $X · from N offers we track · Updated <date>"', () => {
    expect(answerLine({ name: 'Bat Dragon', valueUsd: 41.6, offers: 18, updatedAt: '2026-10-09T08:30:00Z' })).toBe(
      'Bat Dragon is worth about $42 · from 18 offers we track · Updated 9 Oct 2026',
    )
  })
  it('never says "sales", says "offer" for one, and drops the date when there is none', () => {
    const line = answerLine({ name: 'Los Gattitos', valueUsd: 1.18, offers: 1, updatedAt: null })
    expect(line).toBe('Los Gattitos is worth about $1.18 · from 1 offer we track')
    expect(line).not.toMatch(/sale/i)
  })
  it('rounds like a person would', () => {
    expect(formatAboutUsd(0.5)).toBe('$0.50')
    expect(formatAboutUsd(9.99)).toBe('$9.99')
    expect(formatAboutUsd(12.4)).toBe('$12')
    expect(formatAboutUsd(1749.99)).toBe('$1,750')
  })
  it('dates in UTC, day month year', () => {
    expect(formatUpdatedDate('2026-10-09T23:59:00Z')).toBe('9 Oct 2026')
    expect(formatUpdatedDate('not a date')).toBeNull()
  })
})

describe('answer sentence for the snippet and JSON-LD', () => {
  it('ends with a period, is null when unpriced, and leads the description', async () => {
    const { answerSentence, withAnswer } = await import('./value-answer-format')
    const a = answerSentence({ name: 'Harvester', valueUsd: 7.63, offers: 73, updatedAt: '2026-10-08T00:00:00Z' })
    expect(a).toBe('Harvester is worth about $7.63 · from 73 offers we track · Updated 8 Oct 2026.')
    expect(answerSentence({ name: 'X', valueUsd: null, offers: 0, updatedAt: null })).toBeNull()
    expect(withAnswer(a, 'Rest of it.')).toBe(`${a} Rest of it.`)
    expect(withAnswer(null, 'Rest of it.')).toBe('Rest of it.')
  })
})
