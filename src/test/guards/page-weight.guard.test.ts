/**
 * First-load weight (Bundle 1, task 3).
 *
 * Google's live test of /valorant/buy-vp skipped 43 of ~100 page resources
 * ("Other error": its own fetch budget) and rendered the page unstyled. The HTML
 * asked for 37 preload tags and 58 images, 32 of them not lazy. Each guard below
 * pins one lever that keeps the first view cheap. scripts/measure-page-weight.mjs
 * measures the effect on the five routes.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('no preload for a file the page may not use', () => {
  it('the marketplace layout emits no <link rel=preload> and no shared backdrop image', async () => {
    // Every marketplace route draws its OWN game's hero (GameHeroBackdrop,
    // one preload for the one image it shows); the layout loading the old
    // shared marketplace.avif under it would be a second, unseen download.
    const { default: MarketplaceLayout } = await import('@/app/(marketplace)/layout')
    const html = renderToStaticMarkup(createElement(MarketplaceLayout, null, createElement('main', null, 'page')))
    expect(html).not.toMatch(/rel="preload"/)
    expect(html).not.toContain('hero-backdrop')
    expect(html).not.toContain('/assets/heroes/marketplace.avif')
  })

  it.each([
    ['Archivo (homepage seller card only)', /const archivo = Archivo\(\{[\s\S]*?\n\}\)/],
    ['Roboto Condensed (homepage buyer steps only)', /const bigShoulders = Roboto_Condensed\(\{[\s\S]*?\n\}\)/],
  ])('%s does not preload on every route', (_name, block) => {
    const src = read('src/app/layout.tsx')
    const match = src.match(block)
    expect(match, 'font declaration not found in src/app/layout.tsx').not.toBeNull()
    expect(match![0]).toMatch(/preload:\s*false/)
  })
})

describe('social-proof toasts stay out of the first-load window', () => {
  it('the root layout mounts them through DeferredSocialProof, never by a direct import', () => {
    const src = read('src/app/layout.tsx')
    expect(src).toContain("from '@/components/marketplace/DeferredSocialProof'")
    expect(src).not.toMatch(/from '@\/components\/marketplace\/RecentPurchaseToast'/)
    expect(src).not.toMatch(/<RecentPurchaseToast|<DailyStatsToast/)
  })

  it('DeferredSocialProof loads them with next/dynamic (client only) and renders nothing until idle', async () => {
    const src = read('src/components/marketplace/DeferredSocialProof.tsx')
    expect(src).toMatch(/dynamic\(\(\) => import\('@\/components\/marketplace\/RecentPurchaseToast'\),\s*\{\s*ssr:\s*false\s*\}\)/)
    const { DeferredSocialProof } = await import('@/components/marketplace/DeferredSocialProof')
    // Server render (and the first client render): nothing, so no code and no sockets yet.
    expect(renderToStaticMarkup(createElement(DeferredSocialProof))).toBe('')
  })
})

/**
 * Images that sit below the first screen load lazily and decode off the main
 * thread. `eagerOk`: tags (matched by a substring) that ARE above the fold.
 */
const BELOW_THE_FOLD: { file: string; eagerOk?: string[] }[] = [
  { file: 'src/components/icons/how-it-works/Step1ChooseItem.tsx' },
  { file: 'src/components/icons/how-it-works/Step2SecurePayment.tsx' },
  { file: 'src/components/icons/how-it-works/Step3Delivery.tsx' },
  { file: 'src/components/icons/how-it-works/Step4Confirm.tsx' },
  { file: 'src/components/marketplace/HowItWorksBand.tsx' },
  { file: 'src/components/marketplace/TrustBand.tsx' },
  { file: 'src/components/footer.tsx' },
  // Home: the seller card sits below the hero, popular games and latest listings.
  { file: 'src/features/home/components/SellerCtaCard.tsx' },
  // React preloads every eager server-rendered <img>; the mask of the same URL
  // still loads, so only the duplicate preload tag and early <img> fetch go.
  { file: 'src/components/ui/silver-icon.tsx' },
  // The values/calculator hubs' closing CTA band.
  { file: 'src/components/content/HubCtaBand.tsx' },
  // The hub header logo (src={gameImageUrl}) is the first thing on the page.
  { file: 'src/app/(marketplace)/[gameSlug]/_GameHub.tsx', eagerOk: ['src={gameImageUrl}'] },
]

describe('below-the-fold images are lazy and decode async', () => {
  it.each(BELOW_THE_FOLD.map((b) => [b.file, b] as const))('%s', (_file, { file, eagerOk = [] }) => {
    // `<img` + whitespace: a real element, not the text "<img>" in a comment.
    const tags = read(file).match(/<img\s[\s\S]*?\/>/g) ?? []
    expect(tags.length, `${file} renders no <img>: remove it from this list`).toBeGreaterThan(0)
    const bad = tags
      .filter((t) => !eagerOk.some((ok) => t.includes(ok)))
      .filter((t) => !/loading="lazy"/.test(t) || !/decoding="async"/.test(t))
    expect(bad.map((t) => t.replace(/\s+/g, ' ').slice(0, 110))).toEqual([])
  })
})
