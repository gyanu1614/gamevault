import { describe, expect, it } from 'vitest'
import { notLinkedMessage } from './not-linked-message'

const row = (title: string, gameSlug = 'murder-mystery-2') => ({ id: title, gameSlug, title, templateKeys: [] })

describe('notLinkedMessage', () => {
  it('says nothing when every listing linked', () => {
    expect(notLinkedMessage([])).toBeNull()
  })

  it('names one listing and its game', () => {
    expect(notLinkedMessage([row('Frost Wand 2027 - Murder Mystery 2')])).toBe(
      `📝 A new listing has no item page. Add the item if it's real (Admin → Games → Values):\n• "Frost Wand 2027 - Murder Mystery 2" (murder-mystery-2)`,
    )
  })

  it('counts a batch and keeps the line short', () => {
    const text = notLinkedMessage(Array.from({ length: 10 }, (_, i) => row(`Item ${i}`)))!
    expect(text).toContain('10 new listings have no item page')
    expect(text).toContain('Item 7')
    expect(text).not.toContain('Item 8')
    expect(text).toContain('and 2 more')
  })

  it('keeps a title on one line', () => {
    expect(notLinkedMessage([row('Line one\n\nLine   two')])).toContain('"Line one Line two"')
  })
})
