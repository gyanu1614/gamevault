/**
 * REDIRECT: /marketplace/[game]/[category]/[listing] → /[game]/[category]/[listing]
 * Permanent redirect to clean URL structure
 */
import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string; listingSlug: string }>
}

export default async function RedirectListingPage({ params }: PageProps) {
  const { gameSlug, categorySlug, listingSlug } = await params
  permanentRedirect(`/${gameSlug}/${categorySlug}/${listingSlug}`)
}
