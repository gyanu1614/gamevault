import { describe, it, expect } from 'vitest'
import { groupGuides, type GuideGame } from './_guides'

const post = (slug: string, game: string | null, publishedAt: string) =>
  ({ slug, primaryGameSlug: game, publishedAt, title: slug, excerpt: '', postType: 'guide' as const, cover: null, readMinutes: 5 })

const games = new Map<string, GuideGame>([
  ['adopt-me', { slug: 'adopt-me', name: 'Adopt Me', imageUrl: null }],
  ['murder-mystery-2', { slug: 'murder-mystery-2', name: 'Murder Mystery 2', imageUrl: '/mm2.png' }],
])

// Owner, 2026-10-15: /blog in the new UI. The newest guide is featured, then
// one section per game, newest game first; a game links to its blog home only
// when it has one switched on.
describe('/blog guide index', () => {
  const posts = [
    post('mm2-halloween', 'murder-mystery-2', '2026-10-13'),
    post('mm2-values', 'murder-mystery-2', '2026-09-01'),
    post('am-sell', 'adopt-me', '2026-07-31'),
    post('am-worth', 'adopt-me', '2026-07-30'),
    post('safety', null, '2026-06-01'),
    post('gone', 'old-game', '2026-10-14'),
  ]

  it('features the newest post of a known game, and groups the rest by game, newest first, General last', () => {
    const g = groupGuides(posts, games, ['adopt-me'])
    expect(g.featured?.slug).toBe('mm2-halloween')
    expect(g.sections.map((s) => s.key)).toEqual(['murder-mystery-2', 'adopt-me', 'general'])
    // The featured post is not repeated in its game's row.
    expect(g.sections[0].posts.map((p) => p.slug)).toEqual(['mm2-values'])
    expect(g.sections[1].posts.map((p) => p.slug)).toEqual(['am-sell', 'am-worth'])
    expect(g.sections.find((s) => s.key === 'old-game')).toBeUndefined()
  })

  it('drops a row the featured post emptied, but keeps the game in the switcher', () => {
    const g = groupGuides([post('mm2-halloween', 'murder-mystery-2', '2026-10-13'), post('am-sell', 'adopt-me', '2026-07-31')], games, [])
    expect(g.sections.map((s) => s.key)).toEqual(['adopt-me'])
    expect(g.games.map((x) => x.key)).toEqual(['murder-mystery-2', 'adopt-me'])
  })

  it('links a game to its blog home only when the hub is switched on', () => {
    const g = groupGuides(posts, games, ['adopt-me'])
    expect(g.sections.find((s) => s.key === 'adopt-me')?.hubHref).toBe('/adopt-me/blog')
    expect(g.sections.find((s) => s.key === 'murder-mystery-2')?.hubHref).toBeNull()
  })

  it('counts every guide in a section, and has nothing to feature with no posts', () => {
    expect(groupGuides(posts, games, []).games.find((s) => s.key === 'murder-mystery-2')?.total).toBe(2)
    expect(groupGuides([], games, []).featured).toBeNull()
  })
})
