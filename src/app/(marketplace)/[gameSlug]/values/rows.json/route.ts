/**
 * /[game]/values/rows.json — every row of a game's value list, packed
 * (lib/serialize/columnar.ts). The value page ships only its first page and
 * fetches this right after hydration (contract: lib/values/lazy-list.ts).
 *
 * Static and cached like the page: same loaders, same tagged readers, so the
 * price publish that refreshes the page refreshes this too
 * (/api/internal/values-revalidate also revalidates this path). Not a page:
 * noindex, never in the sitemap.
 */

import { notFound } from 'next/navigation'
import { pack } from '@/lib/serialize/columnar'
import { loadValueListRows, valueListGames } from '../_listRows'

// Literals: Next reads segment config statically (see CLAUDE.md).
export const dynamic = 'force-static'
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return valueListGames().map((gameSlug) => ({ gameSlug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ gameSlug: string }> }) {
  const { gameSlug } = await params
  const rows = await loadValueListRows(gameSlug)
  // dynamicParams = false is not enforced on Vercel: reject an unknown game here too.
  if (!rows) notFound()
  return Response.json(pack(rows), {
    headers: { 'X-Robots-Tag': 'noindex' },
  })
}
