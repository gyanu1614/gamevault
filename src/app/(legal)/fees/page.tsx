/**
 * V46 — Legal route: /fees. Content lives in src/lib/legal/documents.ts;
 * rendering in components/legal/LegalPage.tsx.
 *
 * Checkout B3: the "Buyer fee" section ends with a table of per-method
 * processing-fee TERMS read from payment_method_fees (anon client,
 * unstable_cache under BUYER_FEES_TAG — the admin buyer-fee action
 * revalidates it). /fees is the one page where buyer-fee numbers appear, and
 * none of them is typed into copy. Static-first: cookie-free, ISR 24 h.
 * Rows are limited to the live processors (PUBLIC_PAYMENT_PROVIDER_KEYS).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLegalDoc, type LegalDoc } from '@/lib/legal/documents'
import { LegalPage } from '@/components/legal/LegalPage'
import { buyerFeeTableBlock, getPublicBuyerFees } from '@/lib/fees/buyer-public-rates'
import { PUBLIC_PAYMENT_PROVIDER_KEYS } from '@/lib/legal/payment-processors'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400

const doc = getLegalDoc('fees')

/** The static document with the live method-fee table appended to its Buyer fee section. */
function withBuyerFeeTable(base: LegalDoc, block: ReturnType<typeof buyerFeeTableBlock>): LegalDoc {
  return {
    ...base,
    sections: base.sections.map((s) => (s.h === 'Buyer fee' ? { ...s, blocks: [...s.blocks, block] } : s)),
  }
}

export const metadata: Metadata = seoMeta({
  title: `${doc?.title ?? 'Legal'}`,
  description: doc?.description,
})

export default async function Page() {
  if (!doc) notFound()
  // Only the processors named in the document (lib/legal/payment-processors)
  // appear in the table: a retired provider's row never reaches the page.
  const rows = (await getPublicBuyerFees()).filter((r) => PUBLIC_PAYMENT_PROVIDER_KEYS.has(r.provider))
  return <LegalPage doc={withBuyerFeeTable(doc, buyerFeeTableBlock(rows))} />
}
