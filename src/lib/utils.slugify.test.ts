/**
 * QUAL-010 — one slugify, and it must not move any URL that already exists.
 *
 * `games.slug` is the URL-visible game identifier (/{gameSlug}/...) and is
 * indexed. Before this change two admin paths generated it with different
 * algorithms — AddGameDialog (truncating at 48, stripping `_`) and GameWizard
 * (no truncation) — so the same game created through different UIs got
 * different public URLs.
 *
 * The fixture below is every row of `games` in PRODUCTION, read through the
 * service role on 2026-09-13 (26 rows). The check is: for every slug that the
 * old code would have GENERATED from the name, the unified slugify must produce
 * byte-identical output. Four rows are deliberately hand-edited short forms
 * (fc25, fc26, lol, cs2) that no algorithm produces — the admin UI lets the slug
 * be overridden — so they are asserted as overrides, not as generator output.
 * That split is the point: it proves the change is inert for live URLs.
 */
import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils'

// [name, slug] for every row in production `games`.
const PROD_GAMES: ReadonlyArray<readonly [string, string]> = [
  ["Adopt Me", "adopt-me"],
  ["Apex Legends", "apex-legends"],
  ["Blade Ball", "blade-ball"],
  ["Blox Fruits", "blox-fruits"],
  ["Brookhaven RP", "brookhaven-rp"],
  ["Call of Duty", "call-of-duty"],
  ["Counter Strike 2", "cs2"],
  ["Escape from Tarkov", "escape-from-tarkov"],
  ["EA FC25", "fc25"],
  ["EA FC 26", "fc26"],
  ["Fortnite", "fortnite"],
  ["Free Fire", "free-fire"],
  ["Genshin Impact", "genshin-impact"],
  ["Grow a Garden", "grow-a-garden"],
  ["Grow a Garden 2", "grow-a-garden-2"],
  ["GTA V", "gta-v"],
  ["GTA VI", "gta-vi"],
  ["League of Legends", "lol"],
  ["Minecraft", "minecraft"],
  ["Mobile Legends", "mobile-legends"],
  ["Murder Mystery 2", "murder-mystery-2"],
  ["PUBG Mobile", "pubg-mobile"],
  ["R6 Siege", "r6-siege"],
  ["Roblox", "roblox"],
  ["Steal a Brainrot", "steal-a-brainrot"],
  ["Valorant", "valorant"],
]

// Slugs typed by hand in the admin UI rather than generated from the name.
const HAND_EDITED = new Set(['fc25', 'fc26', 'lol', 'cs2'])

describe('QUAL-010 — slugify is stable for every existing games.slug', () => {
  it('reproduces every generated production slug byte-for-byte', () => {
    const generated = PROD_GAMES.filter(([, slug]) => !HAND_EDITED.has(slug))
    expect(generated.length).toBeGreaterThan(0)
    const drifted = generated.filter(([name, slug]) => slugify(name) !== slug)
    expect(drifted.map(([n, s]) => `${n}: ${s} -> ${slugify(n)}`)).toEqual([])
  })

  it('the hand-edited slugs are genuinely not generator output', () => {
    // If one of these ever starts matching, it stopped being an override and
    // the set above should shrink — not a failure, but it should be noticed.
    for (const [name, slug] of PROD_GAMES.filter(([, s]) => HAND_EDITED.has(s))) {
      expect(slugify(name), `${name} is no longer an override`).not.toBe(slug)
    }
  })

  it('is idempotent — slugifying a slug returns it unchanged', () => {
    for (const [, slug] of PROD_GAMES) {
      if (HAND_EDITED.has(slug)) continue
      expect(slugify(slug)).toBe(slug)
    }
  })

  it('fixes the divergences the four copies disagreed on', () => {
    // Underscore is a separator, not a word char (old lib/utils kept it).
    expect(slugify('Pet_Simulator 99')).toBe('pet-simulator-99')
    // Accents fold to their base letter (old copies dropped or dashed them).
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
    // No hidden truncation (only AddGameDialog truncated, at 48).
    const long = 'a'.repeat(80)
    expect(slugify(long)).toHaveLength(80)
    // No leading/trailing or repeated separators.
    expect(slugify('  --Hello   World!!  ')).toBe('hello-world')
  })
})
