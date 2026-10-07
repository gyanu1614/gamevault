import { describe, expect, it } from 'vitest'
import { article, withArticle } from './article'

describe('article', () => {
  it('picks a/an by sound', () => {
    expect(withArticle('Arctic Reindeer')).toBe('an Arctic Reindeer')
    expect(withArticle('Epic')).toBe('an Epic')
    expect(withArticle('Unicorn')).toBe('a Unicorn')
    expect(withArticle('Secret')).toBe('a Secret')
    expect(withArticle('OG')).toBe('an OG')
    expect(article('hour')).toBe('an')
    expect(article('one-of-a-kind')).toBe('a')
  })
})
