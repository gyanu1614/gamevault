import { z } from 'zod'
import type { HintInput } from './resolve'

/**
 * The market price helper's server action is a public POST endpoint: bound
 * every field. Template answers keep strings only — the matcher reads nothing
 * else — so a payload can't smuggle a large object into a cache key.
 */
const slug = z.string().max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const short = z.string().max(200)

const schema = z.object({
  gameSlug: slug,
  categorySlug: slug,
  gameCategoryId: z.string().uuid(),
  templateData: z.record(z.unknown()).refine((o) => Object.keys(o).length <= 80),
  optionLabels: z.record(z.record(short)).optional(),
  bundleId: z.string().max(128).nullable().optional(),
})

export function parseHintInput(raw: unknown): HintInput | null {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return null
  const templateData: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.data.templateData)) {
    if (typeof v === 'string' && k.length <= 128) templateData[k] = v.slice(0, 200)
  }
  return { ...parsed.data, templateData }
}
