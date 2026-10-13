import type { AttributeTemplateFull } from '@/lib/actions/new-schema'

/**
 * The seller form's field template on the client: one React Query entry per
 * (game, category) pair, read from GET /api/sell/template/<id> (cached on the
 * server and the CDN). staleTime Infinity: going back a step, or switching
 * games and back, never refetches. Step 2 prefetches with the same options.
 */
export function sellTemplateQuery(gameCategoryId: string) {
  return {
    queryKey: ['sell-template', gameCategoryId] as const,
    queryFn: async (): Promise<AttributeTemplateFull | null> => {
      const res = await fetch(`/api/sell/template/${encodeURIComponent(gameCategoryId)}`)
      if (!res.ok) throw new Error('Could not load the item fields. Try again.')
      const body = (await res.json()) as { template: AttributeTemplateFull | null }
      return body.template
    },
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  }
}
