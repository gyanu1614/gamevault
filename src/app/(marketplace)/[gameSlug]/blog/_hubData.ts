import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Data for the blog-hub teaser strips. Kept small and defensive: every query
 * falls back to an empty result so a data hiccup hides a section rather than
 * breaking the page. Only SAB has a live catalog today; other games return
 * empty and their teasers self-hide.
 */

export interface HubTeaserItem {
  name: string
  slug: string
  priceLabel: string
  qualifier: string
  imageUrl: string | null
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * The top few priced items by value, for the "Live values" teaser. Sourced
 * from the same public catalog the Values page reads, so the numbers match.
 */
export async function getHubTopValues(
  gameSlug: string,
  limit = 4,
): Promise<HubTeaserItem[]> {
  if (gameSlug !== 'steal-a-brainrot') return []

  const supabase = await createClient()

  const [catalogRes, priceRes] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select('id,name,slug,image_url,confidence_label'),
    (supabase as any)
      .from('sab_public_price_catalog_corrected')
      .select('brainrot_id,market_value_usd,confidence_label')
      .eq('mutation_slug', 'default'),
  ])

  if (catalogRes.error || priceRes.error) {
    if (catalogRes.error) {
      console.error('Hub top-values catalog error:', catalogRes.error)
    }
    if (priceRes.error) {
      console.error('Hub top-values price error:', priceRes.error)
    }
    return []
  }

  type CatalogRow = {
    id: string
    name: string
    slug: string
    image_url: string | null
    confidence_label: string | null
  }
  type PriceRow = {
    brainrot_id: string
    market_value_usd: number | string | null
    confidence_label: string | null
  }

  const priceById = new Map<string, PriceRow>(
    ((priceRes.data ?? []) as PriceRow[])
      .filter(
        (r) =>
          r.market_value_usd != null &&
          Number.isFinite(Number(r.market_value_usd)),
      )
      .map((r) => [r.brainrot_id, r]),
  )

  return ((catalogRes.data ?? []) as CatalogRow[])
    .map((row) => {
      const price = priceById.get(row.id)
      if (!price) return null
      const usd = Number(price.market_value_usd)
      const confidence = (
        price.confidence_label ??
        row.confidence_label ??
        'low'
      ).toUpperCase()
      return {
        name: row.name,
        slug: row.slug,
        imageUrl: row.image_url,
        usd,
        qualifier: `${confidence} CONFIDENCE`,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit)
    .map((x) => ({
      name: x.name,
      slug: x.slug,
      imageUrl: x.imageUrl,
      priceLabel: USD.format(x.usd),
      qualifier: x.qualifier,
    }))
}
