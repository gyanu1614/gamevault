/**
 * V46 — Legal route: /prohibited. Content lives in src/lib/legal/documents.ts;
 * rendering in components/legal/LegalPage.tsx.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLegalDoc } from '@/lib/legal/documents'
import { LegalPage } from '@/components/legal/LegalPage'
import { seoMeta } from '@/lib/seo/fit'

const doc = getLegalDoc('prohibited')

export const metadata: Metadata = seoMeta({
  title: `${doc?.title ?? 'Legal'}`,
  description: doc?.description,
})

export default function Page() {
  if (!doc) notFound()
  return <LegalPage doc={doc} />
}
