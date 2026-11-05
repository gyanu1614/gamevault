// @vitest-environment node
/**
 * What a seller sees for each state of their ID check, on the Settings card and
 * on the withdrawal page.
 */
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

;(globalThis as { React?: unknown }).React = React

import { IdentityCheckCard, IdentityCheckPanel } from './IdentityCheck'
import type { IdentityState } from '@/lib/identity/state'

function render(component: () => React.ReactElement | null, state: IdentityState | null, available = true): string {
  const client = new QueryClient()
  if (state) client.setQueryData(['identity-check'], { state, available })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(component)))
}

const GATE_MESSAGE = 'Verify your identity to withdraw.'
const Panel = () => createElement(IdentityCheckPanel, { message: GATE_MESSAGE })
const Card = () => createElement(IdentityCheckCard, { shopName: 'CheckShop' })

describe('IdentityCheckCard', () => {
  it('says when it is needed', () => {
    expect(render(Card, 'not_started')).toContain('Required before your first withdrawal.')
  })

  it('not started: offers the check and shows what it gives', () => {
    const html = render(Card, 'not_started')
    expect(html).toContain('Not Started')
    expect(html).toContain('Verify Identity')
    expect(html).toContain('CheckShop')
    expect(html).toContain('Verified badge on your store and listings')
    expect(html).toContain('Withdraw your earnings')
    expect(html).toContain('No additional price review')
  })

  it('in review: no button to start another', () => {
    const html = render(Card, 'in_review')
    expect(html).toContain('In Review')
    expect(html).toContain('Verification In Progress')
    expect(html).not.toContain('Verify Identity')
    expect(html).not.toContain('Try Again')
  })

  it('needs attention: offers another try and support', () => {
    const html = render(Card, 'needs_attention')
    expect(html).toContain('Needs Attention')
    expect(html).toContain('Try Again')
    expect(html).toContain('support@dropmarket.gg')
  })

  it('verified: the store with its badge, and no button', () => {
    const html = render(Card, 'verified')
    expect(html).toContain('Verified')
    expect(html).toContain('CheckShop')
    expect(html).not.toContain('Verify Identity')
  })

  it('checks not open: says so, and offers no button', () => {
    const html = render(Card, 'not_started', false)
    expect(html).toContain('Currently Unavailable')
    expect(html).not.toContain('Verify Identity')
  })

  it('still loading: a placeholder, not a wrong state', () => {
    const html = render(Card, null)
    expect(html).toContain('skeleton')
    expect(html).not.toContain('Not Started')
  })
})

describe('IdentityCheckPanel on the withdrawal page', () => {
  it('offers the check to a seller who has not done it, with the reason', () => {
    const html = render(Panel, 'not_started')
    expect(html).toContain(GATE_MESSAGE)
    expect(html).toContain('Verify Identity')
  })

  it('offers another try after a declined check', () => {
    const html = render(Panel, 'needs_attention')
    expect(html).toContain('Try Again')
    expect(html).toContain('support@dropmarket.gg')
  })

  it('explains the wait while in review, with no button', () => {
    const html = render(Panel, 'in_review')
    expect(html).toContain('Verification In Progress')
    expect(html).not.toContain('<button')
  })

  it('checks not open: the reason stays, with no button', () => {
    const html = render(Panel, 'not_started', false)
    expect(html).toContain(GATE_MESSAGE)
    expect(html).not.toContain('<button')
  })

  it('still loading: the reason shows, with no button yet', () => {
    const html = render(Panel, null)
    expect(html).toContain(GATE_MESSAGE)
    expect(html).not.toContain('<button')
  })

  it('draws nothing once verified', () => {
    expect(render(Panel, 'verified')).toBe('')
  })
})
