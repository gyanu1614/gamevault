/**
 * The blue check means "this seller's ID was checked". On 2026-11-04 the audit
 * found it drawn for every approved seller in their own sidebar and Settings,
 * telling 69 unverified sellers they were verified. Being a seller is never
 * enough to draw it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

;(globalThis as { React?: unknown }).React = React
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'

const SRC = join(process.cwd(), 'src')
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

function tsxFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(SRC, f))
}

describe('the blue check follows is_verified', () => {
  it('nothing draws it just because the viewer is a seller', () => {
    const offenders = tsxFiles().filter((f) =>
      /(isSeller|isApprovedSeller)\s*&&\s*<VerifiedBadge/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('the account sidebar reads the verified flag from the profile', () => {
    expect(read('src/components/account/AccountSidebar.tsx')).toMatch(/user\?\.isVerified\s*&&\s*<VerifiedBadge/)
    expect(read('src/app/account/layout.tsx')).toMatch(/isVerified:\s*user\.profile\?\.is_verified === true/)
  })

  it('the Settings card reads the verified flag from the profile', () => {
    expect(read('src/app/account/settings/_ProfileTab.tsx')).toMatch(/isVerified\s*&&\s*<VerifiedBadge/)
    expect(read('src/app/account/settings/page.tsx')).toMatch(/isVerified=\{isSeller && cached\?\.is_verified === true\}/)
  })
})

describe('NewSellerBadge', () => {
  it('tells screen readers what buyers see, with no word about ID checks', () => {
    const html = renderToStaticMarkup(createElement(NewSellerBadge))
    expect(html).toContain('aria-label="New seller"')
    expect(html).not.toMatch(/identity/i)
  })
})
