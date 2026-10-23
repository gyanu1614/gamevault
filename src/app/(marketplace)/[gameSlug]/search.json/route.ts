/**
 * /[game]/search.json — the hub navbar search's index for one game (items +
 * guides, lib/search/game-search.ts), packed (lib/serialize/columnar.ts). The
 * search panel fetches it when opened, never with the page. Static and cached
 * like rows.json: the same tagged reads, so a price publish refreshes it; the
 * window is a daily backstop. Not a page: noindex, never in the sitemap.
 */
import { notFound } from 'next/navigation'
import { pack } from '@/lib/serialize/columnar'
import { searchIndexGames } from '@/lib/search/game-search'
import { loadSearchIndex } from './_searchIndex'

// Literals: Next reads segment config statically (see CLAUDE.md).
export const dynamic = 'force-static'
export const revalidate = 86400
export const dynamicParams = false

export function generateStaticParams() {
  return searchIndexGames().map((gameSlug) => ({ gameSlug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ gameSlug: string }> }) {
  const { gameSlug } = await params
  // dynamicParams = false is not enforced on Vercel: reject an unknown game here too.
  if (!searchIndexGames().includes(gameSlug)) notFound()
  const index = await loadSearchIndex(gameSlug)
  if (!index) notFound()
  return Response.json({ ...index, items: pack(index.items) }, { headers: { 'X-Robots-Tag': 'noindex' } })
}
