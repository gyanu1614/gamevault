import { describe, expect, it } from 'vitest'
import { replySnippet, senderLabel } from './reply'

describe('reply snippet (the quoted line above a reply, and in the composer)', () => {
  it('plain text, bold markers stripped, one line', () => {
    expect(replySnippet({ content: 'Send the **gems** to\nmy alt please', attachments: [] })).toBe('Send the gems to my alt please')
  })

  it('a long message is cut at a word with an ellipsis', () => {
    const s = replySnippet({ content: 'word '.repeat(40).trim(), attachments: [] })
    expect(s.length).toBeLessThanOrEqual(91)
    expect(s.endsWith('…')).toBe(true)
    expect(s.endsWith(' …')).toBe(false)
  })

  it('a file-only message says what the file is', () => {
    expect(replySnippet({ content: 'Sent a photo', attachments: ['o/chat/a.webp'] })).toBe('Photo')
    expect(replySnippet({ content: 'Sent a PDF', attachments: ['o/chat/a.pdf'] })).toBe('PDF')
  })
})

describe('senderLabel (who wrote the quoted message)', () => {
  it('You for my own, the name for theirs, DropMarket for a notice, User when unknown', () => {
    const names = { u2: 'gemtrader' }
    expect(senderLabel('u1', 'u1', names)).toBe('You')
    expect(senderLabel('u2', 'u1', names)).toBe('gemtrader')
    expect(senderLabel(null, 'u1', names)).toBe('DropMarket')
    expect(senderLabel('u9', 'u1', names)).toBe('User')
  })
})
