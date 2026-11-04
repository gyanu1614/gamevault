import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { resolveItemRoute } from '../../../_valueItemOffers'

/** An unknown trait is a real 404: this check sits above [variant]/loading.tsx (see ../layout.tsx). */
export default async function ItemVariantLayout({
  params,
  children,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string; variant: string }>
  children: ReactNode
}) {
  const { gameSlug, categorySlug, itemSlug, variant } = await params
  if (!(await resolveItemRoute(gameSlug, categorySlug, itemSlug, variant))) notFound()
  return children
}
