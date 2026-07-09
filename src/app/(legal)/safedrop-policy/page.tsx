/**
 * V46 — Legal route: /safedrop-policy (the /safedrop URL is the marketing page). Content lives in src/lib/legal/documents.ts;
 * rendering in components/legal/LegalPage.tsx.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLegalDoc } from '@/lib/legal/documents'
import { LegalPage } from '@/components/legal/LegalPage'

const doc = getLegalDoc('safedrop')

export const metadata: Metadata = {
  title: `${doc?.title ?? 'Legal'}`,
  description: doc?.description,
}

export default function Page() {
  if (!doc) notFound()
  return <LegalPage doc={doc} />
}
