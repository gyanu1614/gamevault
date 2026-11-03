import { describe, it, expect } from 'vitest'
import { buildChatDigestEmail, chatDigestSubject } from './chat-digest'

const base = {
  name: 'Sam',
  senderName: 'TopSeller',
  orderNumber: 'DM-1001',
  orderId: 'order-1',
  lines: [{ content: 'Hey' }, { content: 'how are you' }],
  unreadCount: 2,
  appUrl: 'https://dropmarket.test',
}

describe('chat digest email', () => {
  it('names the count and the order in the subject', () => {
    expect(chatDigestSubject({ senderName: 'TopSeller', orderNumber: 'DM-1001', unreadCount: 3 })).toBe(
      'TopSeller sent you 3 messages about order #DM-1001',
    )
    expect(chatDigestSubject({ senderName: 'TopSeller', orderNumber: 'DM-1001', unreadCount: 1 })).toBe(
      'TopSeller messaged you about order #DM-1001',
    )
    expect(chatDigestSubject({ senderName: 'TopSeller', orderNumber: null, unreadCount: 2 })).toBe('TopSeller sent you 2 messages')
  })

  it('quotes every line once, in order, and links to the order chat', () => {
    const { html } = buildChatDigestEmail(base)
    // (The hidden preview carries the latest line first; compare the quoted block.)
    expect(html.indexOf('>Hey</p>')).toBeGreaterThan(-1)
    expect(html.indexOf('>Hey</p>')).toBeLessThan(html.indexOf('>how are you</p>'))
    expect(html).toContain('https://dropmarket.test/account/orders/order-1')
    expect(html).toContain('2 new messages')
  })

  it('links a direct message to the inbox', () => {
    const { html } = buildChatDigestEmail({ ...base, orderId: null, orderNumber: null })
    expect(html).toContain('https://dropmarket.test/account/messages')
  })

  it('says how many more wait in the chat when only the latest lines are quoted', () => {
    const { html } = buildChatDigestEmail({ ...base, unreadCount: 9 })
    expect(html).toContain('+ 7 more in the chat')
  })

  it('escapes user text everywhere it lands, including the hidden preview', () => {
    const { html, subject } = buildChatDigestEmail({
      ...base,
      senderName: '<b>evil</b>',
      lines: [{ content: '<img src=x onerror=alert(1)>' }],
      unreadCount: 1,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>evil</b>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    // A subject is a plain-text header, not HTML.
    expect(subject).toBe('<b>evil</b> messaged you about order #DM-1001')
  })

  it('clips a very long line', () => {
    const { html } = buildChatDigestEmail({ ...base, lines: [{ content: 'x'.repeat(500) }], unreadCount: 1 })
    expect(html).not.toContain('x'.repeat(200))
  })
})
