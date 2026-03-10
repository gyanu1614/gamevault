/**
 * REDIRECT: /marketplace → /
 *
 * The /marketplace route has been consolidated into the homepage.
 * All game-specific routes (/marketplace/[gameSlug]/...) are handled by
 * their own redirect pages in the same directory.
 */
import { permanentRedirect } from 'next/navigation'

export default function RedirectMarketplacePage() {
  permanentRedirect('/')
}
