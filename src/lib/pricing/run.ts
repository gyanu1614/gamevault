/**
 * One game's scheduled pricing pass, on the runner: reprice, then publish.
 *
 *   pnpm reprice --game=adopt-me --publish            changed items only (T1)
 *   pnpm reprice --game=adopt-me --publish=full       whole game (?full=1)
 *   pnpm reprice --game=adopt-me                      reprice only, no revalidation
 *
 * scripts/reprice.mjs is the thin CLI around this; the logic lives here so it
 * is unit-tested (src/lib/pricing/run.test.ts).
 */
import { priceChangeRule, type EnvLike } from './config'
import {
  PublishedSnapshotUnavailableError,
  commitPublishedSnapshot,
  httpRevalidator,
  loadPublishedSnapshot,
  publishPriceChanges,
  type Revalidator,
  type SnapshotClient,
} from './publish'
import type { PricingGame, RepriceOptions } from './registry'

export type PublishMode = 'off' | 'changed' | 'full'

export type RunOptions = {
  full?: boolean
  publish: PublishMode
  env?: EnvLike
  /** Injected in tests; the runner builds the service-role client. */
  client?: SnapshotClient
  revalidate?: Revalidator
  log?: (line: string) => void
}

function revalidatorFromEnv(env: EnvLike): Revalidator {
  const baseUrl = env.PUBLIC_API_URL?.trim()
  const secret = env.VALUES_REVALIDATE_SECRET?.trim()
  if (!baseUrl || !secret) {
    // ROUTE-010: a publish step that silently revalidates nothing must not
    // look like a success.
    throw new Error('--publish needs PUBLIC_API_URL and VALUES_REVALIDATE_SECRET')
  }
  return httpRevalidator({ baseUrl, secret })
}

async function serviceClient(): Promise<SnapshotClient> {
  const { createServiceRoleClient } = await import('@/lib/supabase/service')
  return createServiceRoleClient() as unknown as SnapshotClient
}

export async function repriceAndPublish(
  game: PricingGame,
  options: RunOptions,
): Promise<Record<string, unknown>> {
  const env = options.env ?? process.env
  const log = options.log ?? ((line: string) => console.log(line))

  // Fail on missing publish config BEFORE spending the reprice.
  const revalidate =
    options.publish === 'off' ? null : (options.revalidate ?? revalidatorFromEnv(env))

  const repriceOptions: RepriceOptions = { full: options.full }
  const { publishedPrices, ...summary } = await game.run(repriceOptions)

  if (options.publish === 'off' || !revalidate) {
    return { ...summary, publish: { mode: 'off' } }
  }

  const client = options.client ?? (await serviceClient())
  const rule = priceChangeRule(game.gameSlug, env)

  if (options.publish === 'full') {
    await revalidate({ gameSlug: game.gameSlug, full: true })
    // Every page was just told the current prices: make that the baseline.
    let snapshotWritten = 0
    if (publishedPrices) {
      try {
        const snapshot = await loadPublishedSnapshot(client, game.gameSlug)
        const current = new Set(publishedPrices.map((r) => `${r.itemSlug}\u0000${r.variant}`))
        const deletes = snapshot
          .filter((r) => !current.has(`${r.itemSlug}\u0000${r.variant}`))
          .map(({ itemSlug, variant }) => ({ itemSlug, variant }))
        snapshotWritten = (
          await commitPublishedSnapshot(client, game.gameSlug, { upserts: publishedPrices, deletes })
        ).written
      } catch (error) {
        if (!(error instanceof PublishedSnapshotUnavailableError)) throw error
      }
    }
    log(`✅ ${game.gameSlug}: whole-game refresh requested (?full=1).`)
    return { ...summary, publish: { mode: 'full', snapshot_written: snapshotWritten } }
  }

  if (!publishedPrices) {
    throw new Error(
      `${game.key} returned no publishedPrices — it cannot take part in changed-only revalidation`,
    )
  }

  const outcome = await publishPriceChanges({
    client,
    gameSlug: game.gameSlug,
    current: publishedPrices,
    rule,
    revalidate,
    log,
  })
  return { ...summary, publish: outcome }
}
