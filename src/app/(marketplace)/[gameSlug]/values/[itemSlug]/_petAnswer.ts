import type { AdoptMePetDetail } from './_adoptMePetData'

/**
 * The variant an Adopt Me pet's answer sentence quotes: Fly Ride (the trading
 * benchmark) when it has a real price, else the real price backed by the most
 * offers. Estimated prices never count. Same rule as the SEO evidence
 * (lib/seo/gate/refresh adoptMeHeadline).
 */
export function petHeadline(pet: AdoptMePetDetail) {
  const real = pet.variants.filter((v) => v.cashUsd != null && !v.isEstimated)
  return real.find((v) => v.variant === 'FR') ?? [...real].sort((a, b) => b.listingsTracked - a.listingsTracked)[0] ?? null
}
