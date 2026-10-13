import { describe, expect, it } from 'vitest'
import { titleExample } from './title-example'

describe('titleExample', () => {
  it('a real item for the games we know', () => {
    expect(titleExample('adopt-me', 'Adopt Me')).toBe('Bat Dragon - Adopt Me')
    expect(titleExample('murder-mystery-2', 'Murder Mystery 2')).toBe('Chroma Luger - Murder Mystery 2')
  })
  it('the item name pattern for any other game', () => {
    expect(titleExample('blox-fruits', 'Blox Fruits')).toBe('Item Name - Blox Fruits')
    expect(titleExample(undefined, undefined)).toBe('Item Name - Game Name')
  })
})
