import 'server-only'
import { unstable_cache } from 'next/cache'

import { getAttributeTemplateFull, type AttributeTemplateFull } from '@/lib/actions/new-schema'
import { SELL_TEMPLATE_TAG } from './template-tags'

/**
 * The (game, category) field template the seller form renders, cached
 * (2026-10-12: every visit made 7–8 sequential round trips). Admin writes
 * revalidate SELL_TEMPLATE_TAG; the hour TTL only backstops script and
 * migration writes. The read inside is the untagged anon client — a tagged
 * fetch inside unstable_cache leaks its tags onto the caller in Next 14.2.
 * A read error throws, so a failure is never cached as "no template".
 */
export function getSellTemplate(gameCategoryId: string): Promise<AttributeTemplateFull | null> {
  return unstable_cache(
    async () => {
      const res = await getAttributeTemplateFull(gameCategoryId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    ['sell-template', gameCategoryId],
    { tags: [SELL_TEMPLATE_TAG], revalidate: 3600 },
  )()
}
