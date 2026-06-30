/**
 * SafeDrop protection windows & account-warranty tiers (config).
 *
 * ⚠️ PLACEHOLDER VALUES — pending UK-lawyer sign-off of the Refund & Dispute
 * Policy. The STRUCTURE is final (decided 2026-06-28, see
 * HANDOFF_MONEY_LAYER_PLAN.md §8); the numbers are tunable here in one place.
 * These MUST stay in sync with the public Refund & Dispute Policy.
 *
 * Two timers per category:
 *   • postConfirmDelay — even when the buyer ACTIVELY confirms, funds wait this
 *     long before release. An undo buffer against an accidental/coerced confirm.
 *   • autoRelease      — if the buyer does nothing, release after this long
 *     (the protection window). Begins when the seller marks delivered (or, for
 *     coaching, marks the service complete).
 *
 * Accounts are special: the window + reserve come from a buyer-chosen WARRANTY
 * TIER (platform-funded; longer cover = higher buyer fee = margin on good
 * accounts; risk secured by holding the seller's reserve for ≥ the window).
 * Warranty/reserve behaviour is DORMANT until cards (Tazapay/Phase 7) — crypto
 * has no chargebacks — but the config lives here now.
 */

export type OrderCategory = 'currency' | 'codes' | 'accounts' | 'coaching'

/** Duration helpers → milliseconds. Money-layer time is computed from these. */
export const HOURS = (n: number): number => n * 60 * 60 * 1000
export const DAYS = (n: number): number => n * 24 * 60 * 60 * 1000

export interface WindowConfig {
  /** Delay after an explicit buyer confirm before funds actually release (ms). */
  postConfirmDelayMs: number
  /** Auto-release if the buyer takes no action within this window (ms). */
  autoReleaseMs: number
  /**
   * For coaching/boosting the window starts when the seller marks the service
   * COMPLETE, not when "delivered". Currency/codes start at delivery.
   */
  startsAt: 'delivered' | 'completed'
}

/** Non-account categories: fixed windows. */
export const WINDOWS: Record<Exclude<OrderCategory, 'accounts'>, WindowConfig> = {
  // Currency: tiny undo buffer even on confirm (12h), auto-release after 3 days.
  currency: { postConfirmDelayMs: HOURS(12), autoReleaseMs: DAYS(3), startsAt: 'delivered' },
  // Codes: work-or-don't on redemption → single 24h window, no confirm buffer.
  codes: { postConfirmDelayMs: 0, autoReleaseMs: HOURS(24), startsAt: 'delivered' },
  // Coaching: window runs from completion; small confirm buffer.
  coaching: { postConfirmDelayMs: HOURS(3), autoReleaseMs: DAYS(5), startsAt: 'completed' },
}

// ─── Account warranty tiers (platform-funded, buyer-paid) ─────────

export type WarrantyTier = 'standard' | 'extended' | 'premium'

export interface WarrantyTierConfig {
  /** Protection window for accounts under this tier. */
  windowMs: number
  /** Undo buffer after an explicit confirm. */
  postConfirmDelayMs: number
  /** Buyer fee as a fraction of the order total (0.04 = +4%). */
  buyerFeePct: number
  /** Reserve % of seller payout held back (basis for the reserve engine). */
  reservePct: number
  /** How long the reserve is held. INVARIANT: reserveHoldMs >= windowMs. */
  reserveHoldMs: number
}

export const WARRANTY_TIERS: Record<WarrantyTier, WarrantyTierConfig> = {
  // Default, free: 7-day cover, 10% reserve held 30d.
  standard: {
    windowMs: DAYS(7),
    postConfirmDelayMs: HOURS(12),
    buyerFeePct: 0,
    reservePct: 0.1,
    reserveHoldMs: DAYS(30),
  },
  // +4%: 14-day cover, 10% reserve held 45d.
  extended: {
    windowMs: DAYS(14),
    postConfirmDelayMs: HOURS(12),
    buyerFeePct: 0.04,
    reservePct: 0.1,
    reserveHoldMs: DAYS(45),
  },
  // +6%: 30-day top cover, 12% reserve held 90d.
  premium: {
    windowMs: DAYS(30),
    postConfirmDelayMs: HOURS(12),
    buyerFeePct: 0.06,
    reservePct: 0.12,
    reserveHoldMs: DAYS(90),
  },
}

export const DEFAULT_WARRANTY_TIER: WarrantyTier = 'standard'

/** Resolve the window config for an order, given category (+ warranty tier for accounts). */
export function windowFor(
  category: OrderCategory,
  warrantyTier: WarrantyTier = DEFAULT_WARRANTY_TIER
): WindowConfig {
  if (category === 'accounts') {
    const t = WARRANTY_TIERS[warrantyTier]
    return {
      postConfirmDelayMs: t.postConfirmDelayMs,
      autoReleaseMs: t.windowMs,
      startsAt: 'delivered',
    }
  }
  return WINDOWS[category]
}

/**
 * Invariant guard: for every warranty tier, the reserve must be held at least
 * as long as the protection window — otherwise auto-release could pay the seller
 * before the chargeback/recovery cover lapses, leaving DropMarket exposed.
 * Called by a unit test; throwing here means a config edit broke the rule.
 */
export function assertWarrantyInvariants(): void {
  for (const [tier, cfg] of Object.entries(WARRANTY_TIERS)) {
    if (cfg.reserveHoldMs < cfg.windowMs) {
      throw new Error(
        `Warranty tier "${tier}": reserveHoldMs (${cfg.reserveHoldMs}) must be >= windowMs (${cfg.windowMs})`
      )
    }
  }
}
