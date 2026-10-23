/**
 * V46 — Legal route: /company. Content lives in src/lib/legal/documents.ts;
 * rendering in components/legal/LegalPage.tsx.
 *
 * Also the brand's about page for search engines (crawl audit 2026-10-23): the
 * full Organization node (same @id as the homepage's, so Google merges them)
 * and an AboutPage whose subject is that Organization.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/config/site'
import { getLegalDoc } from '@/lib/legal/documents'
import { LegalPage } from '@/components/legal/LegalPage'
import { JsonLd, ORGANIZATION_ID, organization } from '@/lib/seo/jsonld'
import { seoMeta } from '@/lib/seo/fit'

const doc = getLegalDoc('company')

export const metadata: Metadata = seoMeta({
  title: `${doc?.title ?? 'Legal'}`,
  description: doc?.description,
})

export default function Page() {
  if (!doc) notFound()
  return (
    <>
      <JsonLd data={organization()} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${SITE_URL}/company#webpage`,
          url: `${SITE_URL}/company`,
          name: doc.title,
          description: doc.description,
          about: { '@id': ORGANIZATION_ID },
          mainEntity: { '@id': ORGANIZATION_ID },
        }}
      />
      <LegalPage doc={doc} />
    </>
  )
}
