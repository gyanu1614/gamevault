/**
 * One promise for how fast a dispute is reviewed.
 *
 * The dispute email says 24 to 48 hours; the modal, toast and status strip
 * said 24. Nothing in the DB enforces either (disputes carry no deadline),
 * so every surface makes the longer, keepable promise.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SURFACES = [
  'src/app/account/orders/[orderId]/_DisputeModal.tsx',
  'src/app/account/orders/[orderId]/_StatusStrip.tsx',
  'src/lib/email/index.ts',
]

describe('dispute review-time copy', () => {
  for (const file of SURFACES) {
    it(`${file} never promises a 24-hour review`, () => {
      const src = readFileSync(file, 'utf8')
      expect(src).not.toMatch(/within 24 ?(h|hours)\b(?! ?(to|–|&ndash;|-) ?48)/i)
    })
  }
  it('the email and the order page both say 24 to 48 hours', () => {
    expect(readFileSync(SURFACES[0], 'utf8')).toMatch(/24 to 48 hours/)
    expect(readFileSync(SURFACES[2], 'utf8')).toMatch(/24(–|&ndash;)48 hours/)
  })
})
