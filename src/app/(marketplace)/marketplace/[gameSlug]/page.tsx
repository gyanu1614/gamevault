/**
 * REDIRECT: /marketplace/[game] → /[game]
 * Permanent redirect to clean URL structure
 */
import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export default async function RedirectGamePage({ params }: PageProps) {
  const { gameSlug } = await params
  permanentRedirect(`/${gameSlug}`)
}
