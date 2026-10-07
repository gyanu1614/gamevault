import { describe, expect, it } from 'vitest'
import { gameTrademarkLine } from './trademark'

describe('gameTrademarkLine', () => {
  it('names the game, the currency and the owner', () => {
    expect(gameTrademarkLine('Roblox', { currency: 'Robux', owner: 'Roblox Corporation' })).toBe(
      "Roblox and Robux are trademarks of Roblox Corporation. DropMarket is independent and isn't affiliated with, sponsored or endorsed by Roblox Corporation.",
    )
  })
  it('does not repeat a game already in the currency name', () => {
    expect(gameTrademarkLine('Blade Ball', { currency: 'Blade Ball Tokens', owner: 'Wiggity' })).toMatch(/^Blade Ball Tokens are trademarks of Wiggity\./)
  })
  it('one mark reads singular; an unknown owner stays generic', () => {
    expect(gameTrademarkLine('Fortnite', { owner: 'Epic Games, Inc.' })).toMatch(/^Fortnite is a trademark of Epic Games, Inc\. DropMarket/)
    expect(gameTrademarkLine('Adopt Me')).toBe(
      "Adopt Me and related names are trademarks of their owners. DropMarket is independent and isn't affiliated with, sponsored or endorsed by them.",
    )
  })
})
