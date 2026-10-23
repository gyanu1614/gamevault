import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), 'src/app/(marketplace)/[gameSlug]/sell', f), 'utf8')

// Values platform Step E (owner, 2026-10-21): data-led sell pages, no fee upfront.
describe('/[game]/sell', () => {
  const page = read('page.tsx')

  it('shows no fee: the commission resolver is gone from the page, title and FAQ', () => {
    expect(page).not.toMatch(/getPairHeadlineRate/)
    expect(page).not.toMatch(/% fee|\$\{rate\}%/)
  })

  it('writes title, description and FAQ from its own data through one copy builder', () => {
    for (const fn of ['sellTitle(', 'sellDescription(', 'sellFaq(']) expect(page).toContain(fn)
    expect(page).toMatch(/loadSellPage\(gameSlug\)/)
  })

  it('renders the data sections, each behind its data', () => {
    for (const s of ['<SellPlayers', '<SellItemGrid', '<CheckYourPrice', '<SellCategories']) expect(page).toContain(s)
    expect(page).toMatch(/\{data\.players && <SellPlayers/)
    expect(page).toMatch(/data\.searchable && data\.pricedCount > 0 && \(/)
  })

  it('only points at a values page when the game has one', () => {
    expect(page).toMatch(/\{hasValues && \(\s*<div className="mt-16">\s*<HubCtaBand/)
  })

  it('reads the value rows through the values list loaders (same cached, tagged reads) and players through the public RPC', () => {
    const data = read('_sellData.ts')
    expect(data).toMatch(/getSabBrainrots\(\)/)
    expect(data).toMatch(/getAdoptMePets\(\)/)
    expect(data).toMatch(/getValueListRows\(gameSlug\)/)
    expect(data).toMatch(/rpc\('public_game_players'/)
    expect(data).not.toMatch(/createServiceRoleClient|@\/lib\/supabase\/server/)
  })
})
