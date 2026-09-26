/**
 * Deployment-environment predicates.
 *
 * `isProductionDeployment` is the repo's existing production test, lifted from
 * the payment providers (coingate/env.ts, payssion/env.ts) where it decides
 * whether a callback origin is safe to bake into a real charge. The two clauses
 * matter:
 *
 *   - `VERCEL_ENV === 'production'` is the authoritative signal on Vercel.
 *   - The NODE_ENV fallback covers non-Vercel production hosts, while
 *     explicitly excluding Vercel *preview* builds — those run with
 *     NODE_ENV=production but are not the live site.
 *
 * Local dev and preview deployments therefore both read as NOT production,
 * which is what internal tooling routes want: usable where they are useful,
 * absent from the live site.
 */
export function isProductionDeployment(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview')
  )
}
