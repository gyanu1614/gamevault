import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { ORGANIZATION_ID, ORGANIZATION_SAME_AS, SITE_ALTERNATE_NAMES, organization } from '@/lib/seo/jsonld'
import { LEGAL_ENTITY } from '@/lib/legal/documents'
import { DISCORD_INVITE_URL } from '@/lib/config/social'
import { TRUSTPILOT_PROFILE_URL } from '@/lib/trustpilot/links'

// Crawl audit 2026-10-23 (docs/handoff/seo-crawl-audit-2026-10-23.md): the
// brand entity Google builds from this node pointed at another business.
describe('Organization JSON-LD', () => {
  const org = organization()

  it('claims only profiles DropMarket controls', () => {
    expect(org.sameAs).toEqual([
      DISCORD_INVITE_URL,
      TRUSTPILOT_PROFILE_URL,
      'https://find-and-update.company-information.service.gov.uk/company/17309867',
    ])
    for (const url of org.sameAs) {
      // github.com/dropmarket is "Drop-Market.com" (another business, 2024);
      // twitter.com/dropmarket was never confirmed ours.
      expect(url).not.toMatch(/github\.com|twitter\.com|x\.com/)
    }
  })

  it('names the registered company behind the brand, from the same facts as the legal pages', () => {
    expect(org['@id']).toBe(ORGANIZATION_ID)
    expect(org.name).toBe('DropMarket')
    expect(org.legalName).toBe(LEGAL_ENTITY.name)
    expect(org.identifier.value).toBe(LEGAL_ENTITY.companyNumber)
    expect(org.vatID).toBe(`GB${LEGAL_ENTITY.vatNumber}`)
    expect(org.email).toBe(LEGAL_ENTITY.email)
    expect(org.telephone).toBe(LEGAL_ENTITY.phone)
    const a = org.address
    expect(`${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion}, ${a.postalCode}, United Kingdom`).toBe(
      LEGAL_ENTITY.registeredOffice,
    )
  })

  it('keeps the registered office the legal pages and footer print', () => {
    expect(LEGAL_ENTITY.registeredOffice).toBe('82A James Carter Road, Mildenhall, Suffolk, IP28 7DE, United Kingdom')
  })

  it('declares a logo Google can use (≥112px, with its size)', () => {
    expect(org.logo).toMatchObject({ '@type': 'ImageObject', width: 256, height: 256 })
  })

  it('is emitted on the homepage and the /company page, and the footers link only owned profiles', () => {
    const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
    expect(read('src/app/page.tsx')).toMatch(/organization\(\)/)
    const company = read('src/app/(legal)/company/page.tsx')
    expect(company).toMatch(/<JsonLd data=\{organization\(\)\} \/>/)
    expect(company).toMatch(/'@type': 'AboutPage'/)
    expect(read('src/components/content/HubFooter.tsx')).not.toMatch(/twitter\.com|github\.com/)
    expect(read('src/components/footer.tsx')).not.toMatch(/twitter\.com|github\.com/)
    expect(ORGANIZATION_SAME_AS).toContain(DISCORD_INVITE_URL)
  })

  // Owner, 2026-10-07 and 2026-10-23: the result should read "DropMarket", not "dropmarket.gg".
  it('names the site DropMarket everywhere Google looks, with no domain-form alternate', () => {
    const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
    expect(org.name).toBe('DropMarket')
    expect(org.alternateName).toEqual([...SITE_ALTERNATE_NAMES])
    for (const n of SITE_ALTERNATE_NAMES) expect(n).not.toMatch(/\.gg$|\.com$/i)
    const home = read('src/app/page.tsx')
    expect(home).toMatch(/'@type': 'WebSite'[\s\S]*name: SITE_NAME,\s*alternateName: \[\.\.\.SITE_ALTERNATE_NAMES\]/)
    expect(home).toMatch(/title: \{ absolute: "DropMarket - /)
    const layout = read('src/app/layout.tsx')
    expect(layout).toMatch(/applicationName: 'DropMarket'/)
    expect(layout).toMatch(/siteName: 'DropMarket'/)
  })
})
