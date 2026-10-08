/**
 * Value lists ship their first page and fetch the rest (lib/values/lazy-list.ts).
 *
 * Why: the MM2, Adopt Me and Steal a Brainrot value lists handed every row to
 * the client as a prop, so the whole list sat in the HTML (0.8–1.7 MB). Bing
 * flagged them "HTML size is too long" and failed to fetch
 * /murder-mystery-2/values (2026-10-07). These are the pages that get us found.
 *
 * This guard fails when:
 *  - a value-list client stops loading its rows through useValueListRows, or
 *  - a value page hands its client a full row array instead of initialValueList(...), or
 *  - a game with a value list isn't served by /[game]/values/rows.json.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))

const VALUES = join(__dirname, '..', '..', 'app', '(marketplace)', '[gameSlug]', 'values')
const read = (rel: string) => readFileSync(join(VALUES, rel), 'utf8')

const CLIENTS = ['_generic/ValueListClient.tsx', '_AdoptMeValuesClient.tsx', '_ValuesDirectoryClient.tsx']
const PAGES: Record<string, string> = {
  '_generic/ValueListPage.tsx': 'ValueListClient',
  '_AdoptMeValuesPage.tsx': 'AdoptMeValuesClient',
  'page.tsx': 'ValuesDirectoryClient',
}

describe('value lists fetch their rows instead of carrying them in the HTML', () => {
  it.each(CLIENTS)('%s loads rows through useValueListRows', (rel) => {
    const src = read(rel)
    expect(src).toMatch(/useValueListRows</)
    expect(src).toMatch(/initial: InitialValueList/)
  })

  it.each(Object.entries(PAGES))('%s hands %s only initialValueList(...)', (rel, client) => {
    const src = read(rel)
    const tag = src.slice(src.indexOf(`<${client}`), src.indexOf('/>', src.indexOf(`<${client}`)))
    expect(tag, `${rel}: <${client}> must get initial={initialValueList(...)}`).toMatch(/initial=\{initialValueList\(/)
    expect(tag).not.toMatch(/\b(rows|pets|brainrots|packed\w*)=\{/)
  })

  it('rows.json serves every game whose values page is a list', async () => {
    const { valueListGames } = await import('@/app/(marketplace)/[gameSlug]/values/_listRows')
    const { VALUE_LIST_HUB_GAMES } = await import('@/lib/values/hub-config')
    const { hasHubPage } = await import('@/lib/content/theme')
    const games = valueListGames()
    expect(games).toEqual(expect.arrayContaining(['adopt-me', 'steal-a-brainrot', 'murder-mystery-2']))
    for (const g of VALUE_LIST_HUB_GAMES.filter((s) => hasHubPage(s, 'values'))) expect(games).toContain(g)
  })
})
