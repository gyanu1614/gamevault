import { NextResponse } from 'next/server'

import { itemSearchGame } from '@/app/(sell)/_components/sell-wizard/item-search'
import { getValueCatalog } from '@/lib/value-listings/stock-server'

/**
 * GET the pictures and rarities behind the sell form's item search, for one game:
 * `{ items: { [slug]: [picture, rarity] } }`. Public data, read once by the
 * browser and cached (the catalogue changes when the daily job adds an item), so
 * typing in the search never reaches the server. The search itself reads the
 * form's own lists and works without this.
 */
export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { gameSlug: string } }) {
  if (!itemSearchGame(params.gameSlug, 'items')) return NextResponse.json({ error: 'Unknown game' }, { status: 404 })
  try {
    const catalog = await getValueCatalog(params.gameSlug)
    const items: Record<string, [string | null, string | null]> = {}
    for (const i of catalog?.items ?? []) items[i.slug] = [i.imageUrl ?? null, i.rarity ?? null]
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
  } catch (e) {
    console.error('[sell-catalogue] read failed', e)
    return NextResponse.json({ error: 'Could not load the pictures' }, { status: 500 })
  }
}
