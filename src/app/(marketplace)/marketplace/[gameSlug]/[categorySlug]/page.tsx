/**
 * REDIRECT: /marketplace/[game]/[category] → /[game]/[category]
 * Permanent redirect to clean URL structure
 */
import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string }>
}

export default async function RedirectCategoryPage({ params }: PageProps) {
  const { gameSlug, categorySlug } = await params
  permanentRedirect(`/${gameSlug}/${categorySlug}`)
}
