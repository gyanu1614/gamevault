import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const weekly = read('.github/workflows/adopt-me-weekly-catalog.yml')
const daily = read('.github/workflows/values-catalogue-daily.yml')

/**
 * History: the weekly job scraped adoptmevalues.app for new pets (2026-10-14
 * fix: it had never added one) and MM2 ran after it. 2026-10-22: new items for
 * every hub game come from the daily catalogue job (src/lib/catalogue/), which
 * reads each game's Fandom wiki, is insert-only, and finds uncategorised new
 * pages too. adoptmevalues.app is no longer scraped (its terms forbid it, and
 * the import rewrote existing pets every week).
 */
describe('New pets and items come from the daily catalogue', () => {
  it('the daily matrix runs Adopt Me and Murder Mystery 2', () => {
    expect(daily).toMatch(/game: \[[^\]]*adopt-me[^\]]*\]/)
    expect(daily).toMatch(/game: \[[^\]]*murder-mystery-2[^\]]*\]/)
  })

  it('the weekly job no longer scrapes adoptmevalues.app or imports MM2', () => {
    expect(weekly).not.toMatch(/adoptme:catalog|collect-adoptmevalues|import-adoptmevalues|mm2-catalog:|values:mm2:catalogue/)
  })

  it('the weekly job still repairs broken pet pictures from the wiki', () => {
    expect(weekly).toMatch(/pnpm adoptme:images --write/)
  })
})
