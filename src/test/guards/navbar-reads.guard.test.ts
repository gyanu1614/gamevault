/**
 * Guard: the navbar's per-visitor reads stay small (2026-10-20 usage audit, A11).
 *
 * The navbar mounts for every visitor on almost every page, so each of its
 * queries runs once per hard page load (and again on focus after staleTime).
 *   * category_configs was read WHOLE (`config` jsonb: FAQ, steps, bundles,
 *     delivery methods…, 0.2–1 MB) just to show currency icons.
 *   * The spotlight games (2 queries) were fetched on every load although the
 *     comment said "only once the menu opens".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const navbar = readFileSync(join(process.cwd(), 'src/components/navbar-floating.tsx'), 'utf8')
const spotlight = readFileSync(join(process.cwd(), 'src/features/home/hooks/useSpotlightGames.ts'), 'utf8')

describe('navbar reads', () => {
  it('reads only the currency icon URL out of category_configs', () => {
    const query = navbar.slice(navbar.indexOf(".from('category_configs')"), navbar.indexOf(".from('category_configs')") + 400)
    expect(query).toMatch(/currency_icon_url:config->>currency_icon_url/)
    // Never the whole jsonb column.
    expect(query).not.toMatch(/\.select\('[^']*\bconfig\b(?!->)/)
  })

  it('fetches the spotlight games only once the mobile menu has opened', () => {
    expect(navbar).toMatch(/useSpotlightGames\(\{\s*enabled:\s*mobileMenuOpen\s*\}\)/)
    expect(spotlight).toMatch(/export function useSpotlightGames\(\{\s*enabled\s*=\s*true\s*\}/)
    expect(spotlight).toMatch(/\benabled,/)
  })
})
