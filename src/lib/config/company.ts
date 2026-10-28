/**
 * DropMarket's registered company — the single source for the legal documents
 * (LEGAL_ENTITY in src/lib/legal/documents.ts) and the Organization JSON-LD
 * (src/lib/seo/jsonld.ts). Plain constants, no dependencies: jsonld.ts is
 * imported by client components, so it must not pull in the legal texts.
 */
export const COMPANY = {
  legalName: 'DropMarket Ltd',
  companyNumber: '17309867',
  jurisdiction: 'England & Wales',
  vatNumber: '287522083',
  /** Companies House incorporation date. */
  incorporatedOn: '30 June 2026',
  phone: '+44 7476 562276',
  email: 'support@dropmarket.gg',
  address: {
    streetAddress: '82A James Carter Road',
    addressLocality: 'Mildenhall',
    addressRegion: 'Suffolk',
    postalCode: 'IP28 7DE',
    addressCountry: 'GB',
  },
} as const

/** The registered office on one line, as the legal pages and the footer print it. */
export const COMPANY_REGISTERED_OFFICE = [
  COMPANY.address.streetAddress,
  COMPANY.address.addressLocality,
  COMPANY.address.addressRegion,
  COMPANY.address.postalCode,
  'United Kingdom',
].join(', ')

/** The company's public record on the UK register (Companies House). */
export const COMPANY_REGISTER_URL = `https://find-and-update.company-information.service.gov.uk/company/${COMPANY.companyNumber}`

/** The VAT number as UK invoices and disclosures print it. */
export const COMPANY_VAT_DISPLAY = `GB${COMPANY.vatNumber}`
