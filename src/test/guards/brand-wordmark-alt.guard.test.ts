import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Owner, 2026-10-23: Google snippets read "DropMarket DropMarket. Every Trade,
// Protected…" — the logo's alt text plus the visible wordmark beside it. Where
// the wordmark is shown, the logo is decorative (alt=""); a logo shown alone
// (HubNav) keeps alt="DropMarket" because it is the link's only name.
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

const WITH_WORDMARK = [
  'src/components/navbar-floating.tsx',
  'src/components/footer.tsx',
  'src/components/content/HubFooter.tsx',
  'src/app/founding/_components/FoundingNavbar.tsx',
]

describe('brand logo next to the wordmark', () => {
  it.each(WITH_WORDMARK)('%s: the logo is decorative, so the brand reads once', (f) => {
    const src = read(f)
    expect(src).toMatch(/logo-mark-[a-z]+\.avif"\s+alt=""/)
    expect(src).not.toMatch(/alt="DropMarket"/)
  })

  it('a logo shown alone still names its link', () => {
    expect(read('src/components/content/HubNav.tsx')).toMatch(/alt="DropMarket"/)
  })
})
