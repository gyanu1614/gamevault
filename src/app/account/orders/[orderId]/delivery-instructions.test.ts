/**
 * The buyer sees the seller's instructions (listing.description) on the
 * order page; "Action Needed" only while the order still needs delivering.
 */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveryInstructions, InstructionsBody } from './_DeliveryInstructions'

;(globalThis as any).React = React

const render = (p: Record<string, unknown>) => renderToStaticMarkup(h(DeliveryInstructions as any, p))

describe('DeliveryInstructions', () => {
  it('shows a compact row (title, step count) with Action Needed while active', () => {
    const html = render({ role: 'buyer', instructions: 'Join my private server\nAccept the trade', active: true })
    expect(html).toMatch(/How To Receive Your Order/)
    expect(html).toMatch(/2 steps from the seller/)
    expect(html).toMatch(/Action Needed/)
    expect(html).toMatch(/aria-haspopup="dialog"/)
  })

  it('a finished order keeps the row, without Action Needed', () => {
    const html = render({ role: 'buyer', instructions: 'Join my private server', active: false })
    expect(html).toMatch(/Instructions from the seller/)
    expect(html).not.toMatch(/Action Needed/)
  })

  it('the popup shows every step, numbered, or the paragraph as written', () => {
    const steps = renderToStaticMarkup(h(InstructionsBody as any, { steps: ['Join my private server', 'Accept the trade'], text: '' }))
    expect(steps).toMatch(/1\.<\/span><span[^>]*>Join my private server/)
    expect(steps).toMatch(/2\.<\/span><span[^>]*>Accept the trade/)
    const para = renderToStaticMarkup(h(InstructionsBody as any, { steps: null, text: 'Add me: Blox123' }))
    expect(para).toMatch(/Add me: Blox123/)
  })

  it('renders nothing when the seller wrote nothing', () => {
    expect(render({ role: 'buyer', instructions: '   ', active: true })).toBe('')
  })
})
