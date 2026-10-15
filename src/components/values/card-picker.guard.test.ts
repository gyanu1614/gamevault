import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const card = read('src/components/values/ValueCard.tsx')
const overlay = card.slice(card.indexOf('export function CardPickerOverlay'))

/**
 * Bug (owner, 2026-10-14, reproduced on prod): pick a variant in a card's
 * popup, close it, and the card turns dead — the popup stayed mounted at
 * opacity 0 on top of the card, so taps hit its hidden chips ("it changes to
 * Neon, no popup"). Its fade-out exit never finished once the chips' sliding
 * pill (a Framer layoutId) had moved. The card popup now unmounts the moment
 * it closes: no exit animation that can strand it.
 */
describe('card picker popup', () => {
  it('unmounts on close — no AnimatePresence exit that can leave it over the card', () => {
    expect(overlay).not.toMatch(/AnimatePresence|exit=\{/)
    expect(overlay).toMatch(/\{open && \(/)
  })

  it('closes when a variant is picked (Adopt Me + mutation cards)', () => {
    const am = read('src/app/(marketplace)/[gameSlug]/values/_AdoptMeValuesClient.tsx')
    expect(am).toMatch(/onChange=\{\(v\) => \{\s*setCode\(v\)\s*setPickerOpen\(false\)/)
    const dir = read('src/app/(marketplace)/[gameSlug]/values/_ValuesDirectoryClient.tsx')
    expect(dir).toMatch(/setSelectedSlug\(slug\)\s*setPickerOpen\(false\)/)
  })

  it('uses the extra-small chips inside a card, so a tier row fits', () => {
    const am = read('src/app/(marketplace)/[gameSlug]/values/_AdoptMeValuesClient.tsx')
    expect(am).toMatch(/<CompactVariantPicker[^>]*size="xs"[^>]*onChange=\{\(v\) => \{/)
  })
})
