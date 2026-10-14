import { describe, expect, it } from 'vitest'
import { contentHubSlugs, pickerGames } from './hub-games'

const g = (slug: string, on: boolean) => ({ slug, name: slug, content_hub_enabled: on })

describe('hub nav game picker (owner, 2026-10-13: only games with content)', () => {
  const games = [g('adopt-me', true), g('rust', false), g('murder-mystery-2', true), g('valorant', false)]
  it('lists only games switched on in admin', () => {
    expect(pickerGames(games, 'adopt-me').map((x) => x.slug)).toEqual(['adopt-me', 'murder-mystery-2'])
  })
  it('keeps the game you are on, even if it is switched off', () => {
    expect(pickerGames(games, 'rust').map((x) => x.slug)).toEqual(['adopt-me', 'rust', 'murder-mystery-2'])
  })
  it('contentHubSlugs: the switched-on slugs', () => {
    expect(contentHubSlugs(games)).toEqual(['adopt-me', 'murder-mystery-2'])
  })
})
