/**
 * Step 7a — the calculator page no longer reads `searchParams` on the server
 * (that made an ISR route render per request). The deep-link rule moved to the
 * client; this pins it so `?tab=cash`, `?brainrot=` and `?mutation=` keep
 * behaving exactly as the server code did.
 */
import { describe, it, expect } from 'vitest'
import { parseCalculatorDeepLink } from './_deepLink'

const params = (entries: Record<string, string>) => (key: string) => entries[key] ?? null

describe('parseCalculatorDeepLink', () => {
  it('defaults to the trade tab with nothing preselected', () => {
    expect(parseCalculatorDeepLink(params({}))).toEqual({ tab: 'trade' })
  })

  it('opens the cash tab only for tab=cash exactly', () => {
    expect(parseCalculatorDeepLink(params({ tab: 'cash' })).tab).toBe('cash')
    expect(parseCalculatorDeepLink(params({ tab: 'Cash' })).tab).toBe('trade')
    expect(parseCalculatorDeepLink(params({ tab: 'trade' })).tab).toBe('trade')
    expect(parseCalculatorDeepLink(params({ tab: '' })).tab).toBe('trade')
  })

  it('passes brainrot and mutation slugs through untouched, empty as absent', () => {
    expect(
      parseCalculatorDeepLink(params({ brainrot: 'dragon-cannelloni', mutation: 'gold' })),
    ).toEqual({ tab: 'trade', brainrot: 'dragon-cannelloni', mutation: 'gold' })
    expect(parseCalculatorDeepLink(params({ brainrot: '' }))).toEqual({ tab: 'trade' })
  })
})
