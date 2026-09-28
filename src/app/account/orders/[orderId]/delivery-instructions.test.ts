/**
 * The buyer sees the seller's instructions (listing.description) on the
 * order page; "Action Needed" only while the order still needs delivering.
 */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveryInstructions } from './_DeliveryInstructions'

;(globalThis as any).React = React

const render = (p: Record<string, unknown>) => renderToStaticMarkup(h(DeliveryInstructions as any, p))

describe('DeliveryInstructions', () => {
  it('shows the seller text with Action Needed while active', () => {
    const html = render({ role: 'buyer', instructions: 'Join my private server\nAccept the trade', active: true })
    expect(html).toMatch(/How To Receive Your Order/)
    expect(html).toMatch(/Join my private server/)
    expect(html).toMatch(/Action Needed/)
  })

  it('a finished order keeps the text, without Action Needed', () => {
    const html = render({ role: 'buyer', instructions: 'Join my private server', active: false })
    expect(html).toMatch(/Join my private server/)
    expect(html).not.toMatch(/Action Needed/)
  })

  it('renders nothing when the seller wrote nothing', () => {
    expect(render({ role: 'buyer', instructions: '   ', active: true })).toBe('')
  })
})
