import type { CurrencyBundle, CurrencyDeliveryMethod, PlatformFields } from '@/lib/types/category-configs'
import type { CurrencyPriceRules } from '@/lib/currency/price-rules'
import type { HintInput } from '@/lib/price-helper/resolve'

/** Everything the Details step's publish fields read and write (state lives in the wizard). */
export interface Step4Props {
  title: string; setTitle: (s: string) => void
  description: string; setDescription: (s: string) => void
  price: string; setPrice: (s: string) => void
  originalPrice: string; setOriginalPrice: (s: string) => void
  quantity: string; setQuantity: (s: string) => void
  minQuantity: string; setMinQuantity: (s: string) => void
  deliveryMethod: 'manual' | 'instant'; setDeliveryMethod: (m: 'manual' | 'instant') => void
  deliveryTime: string; setDeliveryTime: (s: string) => void
  allowedDeliveryModes: string[]
  images: string[]
  onUpload: (files: FileList | null) => void
  onRemoveImage: (i: number) => void
  imageUploading: boolean
  /** Growth point 30 — what the market price helper looks up (null = hidden). */
  priceHintInput: HintInput | null
  // V13 — Category slug drives the field set. For 'currency' we hide
  // Title + Photos (auto-filled server-side) and rename Description to
  // Instructions.
  categorySlug?: string
  /** V13 — Used to label the currency banner ("Roblox Robux — title and image…"). */
  gameName?: string
  gameSlug?: string
  /**
   * Fee engine PR 5 — the (game, category) pair the seller is listing under.
   * The net-proceeds preview resolves THIS seller's rate for it through the
   * same RPC checkout stamps on the order (founding + rank included).
   */
  gameCategoryId?: string | null
  /**
   * V19/P2 — Admin-configured unit label for currency listings
   * ("Robux", "V-Bucks", "Orbs", "Crystals"). Null when not a currency
   * category or when the config is still loading. Used to render the
   * confirmation banner, "Price per X" label, and the suffix shown
   * inside the Total / Min Offer quantity inputs.
   */
  unitLabel?: string | null
  /** V19/P16 — True while the fetch for `unitLabel` is in flight. */
  unitLabelLoading?: boolean
  /**
   * V19/P7 — Quantity granularity from admin config. Drives the
   * suffix on "Price per K" (vs "Price per Tokens"), and the suffix
   * inside the Stock card inputs. Defaults to 'unit' so non-currency
   * categories don't need to know.
   */
  granularity?: 'unit' | 'thousand' | 'million'
  /**
   * Per-game floor from the admin currency config. The seller may set
   * their own minimum at or above this, never below it.
   */
  adminMinQuantity?: number
  /**
   * V19/P3 — Per-(game, currency) platform-style requirements. Each
   * enabled kind gets a Select in the publish card. Null when not a
   * currency category or when admin hasn't configured any platform
   * fields for this game.
   */
  platformFields?: PlatformFields | null
  region: string; onRegion: (v: string) => void
  platform: string; onPlatform: (v: string) => void
  device: string; onDevice: (v: string) => void
  /** Currency delivery methods the admin turned on for this game ([] = hidden). */
  deliveryMethods: CurrencyDeliveryMethod[]
  deliveryMethodType: string; onDeliveryMethodType: (v: string) => void
  /**
   * V19/P24/P3 — Bundle list from admin currency config. When at
   * least one bundle exists, the seller MUST pick one — the wizard
   * switches the Stock card from free-quantity to "how many of this
   * bundle" and the price label becomes "Price per {bundle.name}".
   * Null/empty = flexible-quantity currency (Robux-style).
   */
  bundles?: CurrencyBundle[] | null
  bundleId: string
  onBundleId: (v: string) => void
  /**
   * V19/P24/P6 — Listing id (if any) of a seller-owned bundle that
   * already exists for the current (game, bundle, region) combo.
   * Renders an inline "you already list this" banner above the
   * bundle picker so the seller can jump straight to edit instead
   * of failing at publish.
   */
  existingBundleListingId?: string
  /**
   * D2/D3 — The admin's price range for this currency (per bundle in bundle
   * mode, per unit otherwise), read the same way the server validator reads
   * it. Shown under the price field so the seller sees the range before
   * Create Offer, not as a toast after it. Null = no rules / not currency.
   */
  priceRules?: CurrencyPriceRules | null
}
