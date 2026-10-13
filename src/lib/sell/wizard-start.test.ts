import { describe, expect, it } from 'vitest'
import { pickWizardStart, readWizardStartParams } from './wizard-start'

const game = (slug: string) => ({ game_slug: slug, game_id: `id-${slug}` }) as any

describe('readWizardStartParams', () => {
  it('reads ?game= + ?category= slugs, trimmed and lower-cased', () => {
    expect(readWizardStartParams({ game: ' Adopt-Me ', category: 'items' })).toEqual({ gameSlug: 'adopt-me', categorySlug: 'items' })
  })
  it('null unless both are plain slugs', () => {
    expect(readWizardStartParams({ game: 'adopt-me' })).toBeNull()
    expect(readWizardStartParams({ game: 'adopt me', category: 'items' })).toBeNull()
    expect(readWizardStartParams({ game: ['a', 'b'] as any, category: 'items' })).toBeNull()
  })
})

describe('pickWizardStart', () => {
  it('the category and the game when both are on offer', () => {
    expect(pickWizardStart({ gameSlug: 'adopt-me', categorySlug: 'items' }, ['currency', 'items'], [game('mm2'), game('adopt-me')])).toEqual({
      categorySlug: 'items',
      game: game('adopt-me'),
    })
  })
  it('null when the category or the game is not on offer (wizard starts empty)', () => {
    expect(pickWizardStart({ gameSlug: 'adopt-me', categorySlug: 'boosting' }, ['items'], [game('adopt-me')])).toBeNull()
    expect(pickWizardStart({ gameSlug: 'rust', categorySlug: 'items' }, ['items'], [game('adopt-me')])).toBeNull()
  })
})
