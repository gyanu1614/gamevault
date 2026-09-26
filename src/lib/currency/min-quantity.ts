/**
 * The minimum order quantity a currency listing is saved with.
 *
 * One rule for the wizard and the server: the seller's figure, raised to
 * the per-game admin floor (`category_configs.config.min_quantity`, in the
 * game's granularity units) and capped at stock so the offer stays
 * buyable — but never capped below the floor. Bundles sell one at a time.
 *
 * Replaces a hard-coded 100 floor on the server, which turned a seller's
 * "1 K" into "100 K" on every save regardless of the admin setting.
 */
export function resolveMinQuantity(opts: {
  requested: number
  adminFloor: number | null | undefined
  stock: number
  unlimited?: boolean
  isBundle?: boolean
}): number {
  if (opts.isBundle) return 1
  const floor = Math.max(1, Math.floor(opts.adminFloor || 1))
  const wanted = Number.isFinite(opts.requested)
    ? Math.max(floor, Math.floor(opts.requested))
    : floor
  if (opts.unlimited || !(opts.stock > 0)) return wanted
  return Math.max(floor, Math.min(wanted, Math.floor(opts.stock)))
}
