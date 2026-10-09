/**
 * SAB market-estimate publish, run by the reprice (2026-10-09). It used to run
 * inside the sab-market-import edge function on the crawl's final batch, under
 * one 150 s wall-clock limit while the Adopt Me job loaded the same database,
 * and timed out daily — failing the crawl step before the reprice ran at all.
 *
 * Called right AFTER sab_refresh_evidence_display, so the estimates come from
 * this run's evidence (the edge function published before refreshing it).
 *
 * Never throws: sab_publish_market_estimates only feeds the fallback prices
 * (sab_external_market_observations, 48 h expiry) — the live estimate wins in
 * sab_public_price_catalog_rows — so a failure must not cost the run its
 * corrections. It is logged loudly instead.
 */
type RpcClient = {
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export async function publishSabMarketEstimates(
  admin: RpcClient,
): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  const { data, error } = await admin.rpc('sab_publish_market_estimates')
  if (error) {
    console.error(`❌ sab_publish_market_estimates failed (fallback prices keep their last values): ${error.message}`)
    return { ok: false, error: error.message }
  }
  const rows = Number(data ?? 0)
  console.log(`✅ sab market estimates published: ${rows} rows`)
  return { ok: true, rows }
}
