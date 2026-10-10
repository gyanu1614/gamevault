import { describe, it, expect } from 'vitest'
import { codeDatedChanges } from './deploy'

const S = 'https://dropmarket.gg'
const sections = new Map<string, { url: string; lastModified?: string | Date }[]>([
  ['static', [{ url: S, lastModified: '2026-10-09T08:00:00Z' }, { url: `${S}/safedrop`, lastModified: '2026-09-28' }, { url: `${S}/terms`, lastModified: '2026-10-09' }]],
  ['hubs', [{ url: `${S}/adopt-me/values/methodology`, lastModified: '2026-10-09' }]],
  ['buy', [{ url: `${S}/buy/buy-robux`, lastModified: '2026-10-09' }, { url: `${S}/roblox/buy-robux`, lastModified: '2026-10-09T10:00:00Z' }]],
  ['values-adopt-me', [{ url: `${S}/adopt-me/values/bat-dragon`, lastModified: '2026-10-09T10:00:00Z' }]],
  ['sell', [{ url: `${S}/roblox/sell`, lastModified: '2026-10-09' }]],
])

describe('codeDatedChanges', () => {
  it('lists the code-dated pages (static, hubs, /buy landings) whose lastmod moved since the last diff', () => {
    expect(codeDatedChanges(sections as never, '2026-10-08T00:00:00Z', '2026-10-09T12:00:00Z').sort()).toEqual(
      [S, `${S}/adopt-me/values/methodology`, `${S}/buy/buy-robux`, `${S}/terms`].sort(),
    )
  })

  it('leaves trigger-logged sections (values, categories, sell) to their own triggers', () => {
    const urls = codeDatedChanges(sections as never, '2026-10-08T00:00:00Z', '2026-10-09T12:00:00Z')
    expect(urls).not.toContain(`${S}/adopt-me/values/bat-dragon`)
    expect(urls).not.toContain(`${S}/roblox/buy-robux`)
    expect(urls).not.toContain(`${S}/roblox/sell`)
  })

  it('logs nothing on the first run (it sets the baseline instead of re-sending every page)', () => {
    expect(codeDatedChanges(sections as never, null, '2026-10-09T12:00:00Z')).toEqual([])
  })

  it('ignores a lastmod in the future', () => {
    expect(codeDatedChanges(sections as never, '2026-10-08T00:00:00Z', '2026-10-09T05:00:00Z')).toEqual([
      `${S}/terms`, `${S}/adopt-me/values/methodology`, `${S}/buy/buy-robux`,
    ])
  })
})
