/**
 * Every picture on a public page goes through pictureUrl (src/lib/images/picture-url.ts).
 *
 * A raw storage link skips the optimizer: full-size download, straight from
 * Supabase, gone when Supabase is. On 2026-11-05 that was 8,100 of 14,400 daily
 * picture downloads, and every picture died with the outage. Pure source
 * analysis, so a new raw <img> fails here until it uses the function or is
 * listed with a reason.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { publicServerModules, rawImageSources } from '../../../scripts/check-public-route-caching.mjs'

const AVATAR = 'Avatar: overwritten at one path, so a saved copy would show the old face. Stored small at upload.'
const LOCAL = 'A file we ship in /public, never a stored picture.'

const NOT_THROUGH_THE_FUNCTION: Record<string, { count: number; why: string }> = {
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/_ListingDetailClient.tsx': { count: 2, why: AVATAR },
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/_CurrencyPageClient.tsx': { count: 1, why: AVATAR },
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard.tsx': { count: 1, why: AVATAR },
  'src/app/(marketplace)/[gameSlug]/inventory/_InventoryShareCard.tsx': { count: 1, why: 'Captured to a PNG in the browser, from the file itself' },
  'src/app/(marketplace)/[gameSlug]/inventory/_InventoryTool.tsx': { count: 1, why: 'A blob: URL the browser just made' },
  'src/components/listing-card.tsx': { count: 1, why: AVATAR },
  'src/components/marketplace/CurrencySellerRow.tsx': { count: 1, why: AVATAR },
  'src/components/marketplace/GameHeroArt.tsx': { count: 1, why: 'hero.server.ts already sent it through the function' },
  'src/components/marketplace/PaymentsMarquee.tsx': { count: 2, why: LOCAL },
  'src/components/navbar/NavChrome.tsx': { count: 1, why: AVATAR },
  'src/components/navbar/ProfileMenu.tsx': { count: 1, why: AVATAR },
  'src/components/shop/SellerProfileBanner.tsx': { count: 1, why: AVATAR },
  'src/components/shop/StoreBannerArt.tsx': { count: 2, why: 'Banner: overwritten at one path, like an avatar' },
  'src/components/ui/avatar-upload.tsx': { count: 1, why: AVATAR },
  'src/features/home/components/SellerCtaCard.tsx': { count: 2, why: LOCAL },
  'src/features/item-buy/PaymentMarks.tsx': { count: 1, why: LOCAL },
  'src/lib/blog/render/client-nodes.tsx': { count: 1, why: 'A YouTube thumbnail' },
}

const isLocalTemplate = (src: string) => src.startsWith('`/')

describe('pictures on public pages', () => {
  const modules = publicServerModules({ includeClient: true }).filter((f) => f.endsWith('.tsx'))

  it('walks the client components too (guards a vacuous pass)', () => {
    expect(modules).toContain('src/features/items-grid/ItemPicture.tsx')
    expect(modules).toContain('src/components/navbar-floating.tsx')
    expect(modules.length).toBeGreaterThan(300)
  })

  it('every raw <img> uses pictureUrl, or is listed with a reason', () => {
    const found: Record<string, number> = {}
    for (const file of modules) {
      const raw = rawImageSources(readFileSync(file, 'utf8')).filter((src) => !src.includes('pictureUrl(') && !isLocalTemplate(src))
      if (raw.length) found[file] = raw.length
    }
    const listed = Object.fromEntries(Object.entries(NOT_THROUGH_THE_FUNCTION).map(([file, v]) => [file, v.count]))
    expect(found).toEqual(listed)
  })

  it('mediaUrl is called from one place, so moving pictures later means changing one file', () => {
    const files = execFileSync('git', ['grep', '--untracked', '-l', 'mediaUrl(', '--', 'src'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !/\.test\.tsx?$/.test(f))
    expect(files.sort()).toEqual(['src/lib/images/media-url.ts', 'src/lib/images/picture-url.ts'])
  })
})

describe('rawImageSources', () => {
  it('reads a dynamic src, skips a static one and a comment', () => {
    const source = `
      // an <img src={fromAComment} />
      <img src={a.b} alt="" />
      <img src="/static.png" alt="" />
      <motion.img className="x" src={pick({ a: 1 })} />
    `
    expect(rawImageSources(source)).toEqual(['a.b', 'pick({ a: 1 })'])
  })
})
