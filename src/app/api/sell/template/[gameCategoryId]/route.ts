import { NextResponse } from 'next/server'

import { getSellTemplate } from '@/lib/sell/template-read'

/**
 * GET the seller form's field template for one (game, category) pair.
 *
 * A route, not a server action (2026-10-12): actions queue one behind another
 * on the client and pay the /sell auth middleware on every call; the template
 * is public data (the same anon RLS read buyer filters use), so it is served
 * cached, outside the auth gate, and the browser keeps it across steps.
 *
 * The CDN window is short on purpose: an admin save clears the server cache
 * (revalidateTag) at once, but not responses already held at the edge, so
 * 30 s (+60 s stale) is the most a seller can see old fields. A miss here is
 * a data-cache hit (~10 ms), so a longer edge cache would buy little.
 */
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: { gameCategoryId: string } }) {
  const id = params.gameCategoryId
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  try {
    const template = await getSellTemplate(id)
    return NextResponse.json(
      { template },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    )
  } catch (e) {
    console.error('[sell-template] read failed', e)
    return NextResponse.json({ error: 'Could not load the item fields' }, { status: 500 })
  }
}
