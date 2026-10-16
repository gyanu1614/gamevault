import { describe, it, expect } from 'vitest'
import { METHOD_UI_IDS, toRow } from './_method-ui'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'

describe('checkout method rows', () => {
  it('every selectable registry method has its own icon + notes line (none falls back)', () => {
    const missing = payssionSelectorMethods().map((m) => m.pmId).filter((pm) => !METHOD_UI_IDS.includes(pm))
    expect(missing).toEqual([])
  })

  it('a row carries the label, logo and flag; multi-country methods get the globe', () => {
    const quote = { serviceFeeMinor: 100 } as any
    const br = toRow({ method: 'creditcard_br', label: 'Brazilian Cards', countries: ['BR'], coverage: 'Brazil', quote } as any)
    expect(br).toMatchObject({ id: 'creditcard_br', label: 'Brazilian Cards', flag: '🇧🇷' })
    expect(br.points[0]).toBe('Pay with a card issued in Brazil')
    const sk = toRow({ method: 'skrill', label: 'Skrill', countries: ['GB', 'DE'], coverage: 'Worldwide', quote } as any)
    expect(sk.flag).toBe('🌍')
  })
})
