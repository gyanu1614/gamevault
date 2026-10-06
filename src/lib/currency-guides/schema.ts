import { z } from 'zod'

/**
 * Shape of one researched currency fact sheet
 * (scripts/content-seeds/currency-guides/<game>.json, see the README there).
 *
 * Variants the renderer has to handle:
 *   - official_prices: null              no official price list (Tarkov, FC Coins…)
 *   - official_prices.packages: []       a rate is known, pack sizes aren't (Blade Ball)
 *   - packages[].usd: null + robux       sold for Robux only (Grow a Garden, 99 Nights…)
 *   - packages[].app_amount              Robux the same money buys in the app (Roblox)
 *   - packages[].label                   a named pack (GTA Shark Cards)
 *   - delivery.typical_time: null        no live seller quotes a time
 */

const text = z.string().trim().min(1)

export const DELIVERY_METHODS = [
  'game_pass',
  'gifting',
  'in_game_trade',
  'code',
  'account_topup',
  'code_or_account_topup',
  'unclear_see_notes',
] as const

const packageSchema = z
  .object({
    amount: z.number().int().positive(),
    usd: z.number().positive().nullable(),
    robux: z.number().int().positive().optional(),
    app_amount: z.number().int().positive().optional(),
    label: text.optional(),
    where: text,
  })
  .strict()
  .refine((p) => p.usd != null || p.robux != null, {
    message: 'a package needs a USD price or a Robux price',
  })

const officialPricesSchema = z
  .object({
    heading: text,
    note: text.nullable().optional(),
    packages: z.array(packageSchema),
    extras: z.array(z.object({ label: text, detail: text }).strict()).nullable().optional(),
    source: z.string().url(),
  })
  .strict()

export const currencyGuideSchema = z
  .object({
    game: z.string().regex(/^[a-z0-9-]+$/),
    currency: text,
    checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    what_is: z.object({ heading: text, paragraphs: z.array(text).min(1) }).strict(),
    official_prices: officialPricesSchema.nullable(),
    delivery: z
      .object({
        heading: text,
        method: z.enum(DELIVERY_METHODS),
        steps: z.array(text),
        no_password: z.boolean(),
        typical_time: text.nullable(),
      })
      .strict(),
    support_topic: z
      .object({ heading: text, paragraphs: z.array(text).min(1), source: z.string().url().optional() })
      .strict()
      .nullable()
      .optional(),
    faq_extra: z.array(z.object({ q: text, a: text }).strict()).default([]),
    trademark_owner: text,
    sources: z.array(z.string().url()).default([]),
    confidence: z.enum(['high', 'medium', 'low']),
    notes: z.string().optional(),
  })
  .strict()

export type CurrencyGuide = z.infer<typeof currencyGuideSchema>
export type GuidePackage = CurrencyGuide['official_prices'] extends infer O
  ? O extends { packages: (infer P)[] }
    ? P
    : never
  : never
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]
