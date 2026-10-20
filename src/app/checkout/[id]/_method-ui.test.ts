import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { MARK_SLOT, METHOD_UI_IDS, markSize, toRow } from './_method-ui'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { PAYMENT_METHOD_LOGOS, PAYMENT_METHOD_ONDARK } from '@/lib/payments/method-marks'

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
    expect(sk.mark).toEqual({ logo: '/payments/ondark/skrill.svg', aspect: 2.85 })
    expect(br.mark).toBeUndefined() // no brand mark → the row's icon
  })

  it('every method with a brand mark has its on-dark version, and the file exists', () => {
    for (const pm of Object.keys(PAYMENT_METHOD_LOGOS)) {
      const mark = PAYMENT_METHOD_ONDARK[pm]
      expect(mark, pm).toBeDefined()
      expect(existsSync(join(process.cwd(), 'public', mark.logo)), mark.logo).toBe(true)
      expect(mark.aspect, pm).toBeGreaterThan(0)
    }
  })

  it('markSize: every mark fits the slot; a square tile stands taller than a wide wordmark', () => {
    for (const { aspect } of Object.values(PAYMENT_METHOD_ONDARK)) {
      const s = markSize(aspect)
      expect(s.width).toBeLessThanOrEqual(MARK_SLOT.width)
      expect(s.height).toBeLessThanOrEqual(MARK_SLOT.height)
    }
    expect(markSize(1)).toEqual({ width: 30, height: 30 })
    expect(markSize(4).height).toBeLessThan(markSize(1).height)
    expect(markSize(4).width).toBeGreaterThan(markSize(1).width)
    expect(markSize(Number.NaN)).toEqual({ width: 30, height: 30 })
  })
})
