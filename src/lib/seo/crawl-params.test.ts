import { describe, it, expect } from 'vitest'

import {
  NON_CANONICAL_PARAMS,
  NON_CANONICAL_PARAM_PREFIXES,
  paramDisallowRules,
} from '@/lib/seo/crawl-params'

describe('crawl-params: the single list robots.txt reads', () => {
  it('emits a ?-form and a &-form rule for every exact param', () => {
    const rules = paramDisallowRules()
    for (const p of NON_CANONICAL_PARAMS) {
      expect(rules).toContain(`/*?${p}=`)
      expect(rules).toContain(`/*&${p}=`)
    }
  })

  it('emits prefix rules without a trailing "=" (utm_source, attr_rarity, ...)', () => {
    const rules = paramDisallowRules()
    for (const p of NON_CANONICAL_PARAM_PREFIXES) {
      expect(rules).toContain(`/*?${p}`)
      expect(rules).toContain(`/*&${p}`)
    }
  })

  it('has no duplicate rules', () => {
    const rules = paramDisallowRules()
    expect(new Set(rules).size).toBe(rules.length)
  })

  it('keeps every rule that was already live before this list existed', () => {
    for (const p of ['sort', 'rarity', 'obtainability', 'page']) {
      expect(NON_CANONICAL_PARAMS).toContain(p)
    }
    for (const p of ['utm_', 'attr_']) {
      expect(NON_CANONICAL_PARAM_PREFIXES).toContain(p)
    }
  })

  it('covers the params found by the crawl audit', () => {
    for (const p of [
      '_rsc', // Next.js prefetch payloads: 26% of Google requests
      'search', 'q', 'view', 'obtain', // `obtain` is what the SAB client emits; `obtainability` never matched
      'minPrice', 'maxPrice', 'type', 'delivery', 'tiers', 'online',
      'variant', 'mutation', 'pet', 'tab', 'brainrot',
      'game', 'category', 'sortBy', 'src', 'ref', 'redirect',
    ]) {
      expect(NON_CANONICAL_PARAMS).toContain(p)
    }
  })
})
