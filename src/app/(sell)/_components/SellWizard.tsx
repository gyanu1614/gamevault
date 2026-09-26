'use client'

/**
 * SellWizard — seller listing creator at /sell/new.
 *
 * Visual: matches the homepage (GV design tokens — lime accent on dark
 * elevation surfaces, same Navbar component on top via layout-wrapper).
 * The wizard adds a slim sticky step bar beneath the navbar.
 *
 * 4 steps:
 *   1. Category    (5 global categories; Boosting disabled)
 *   2. Game        (flat tiles, search, Popular / Recent tabs)
 *   3. Details     (dynamic fields; sub-fields nest INSIDE the parent
 *                   card, indented and animated in)
 *   4. Publish     (title, photos, description, pricing, stock, delivery)
 *
 * Writes go to the live `listings` table (publishListing resolves the
 * legacy category_id via metadata->>'type' mapping).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, Loader2, Upload, X as IconX, Image as ImageIcon,
  ChevronLeft, Clock, Zap, FileSpreadsheet, Minus, Plus,
  Coins, Backpack, UserSquare2, Trophy,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { commissionPct, netProceeds } from '@/lib/fees'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDeliveryLabel, SELLER_DELIVERY_WINDOWS } from '@/lib/utils/delivery-time'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchSellGamesForCategory,
  fetchSellTemplate,
  publishListing,
  updateListingFromWizard,
  fetchPublishPolicy,
  fetchPriceGuidance,
  fetchListingForDuplicate,
  fetchExistingCurrencyListingId,
  fetchExistingBundleListingId,
  type SellerPublishPolicy,
  type PriceGuidance,
  uploadSellImage,
  type SellGameOption,
} from '@/lib/actions/sell-wizard'
// V19/P2 — Pull the per-(game, category) currency config so the seller
// wizard knows the right unit label (Robux, Orbs, V-Bucks, ...) and
// minimum-quantity rules. Replaces the static CURRENCY_UNIT_NAMES map.
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import { normalizePlatformOptions, type CurrencyBundle, type CurrencyConfig, type PlatformFields, type PlatformFieldKind } from '@/lib/types/category-configs'
import { visiblePlatformKinds } from './PlatformFieldsBlock'
import { quantityUnit } from '@/lib/currency/quantity-unit'
import type {
  GlobalCategory,
  AttributeTemplateFull,
  Attribute,
} from '@/lib/actions/new-schema'

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Category', hint: 'Choose A Category' },
  { id: 2, label: 'Game',     hint: 'Choose A Game' },
  { id: 3, label: 'Details',  hint: 'Offer Details' },
] as const

const RECENT_GAMES_KEY = 'gv_sell_recent_games'
// R16 — sessionStorage key for the wizard snapshot so refresh keeps the
// seller on the same step with the same draft. Lives on sessionStorage so it
// auto-clears when the tab closes (we don't want a stale half-filled draft
// to come back days later).
const WIZARD_SNAPSHOT_KEY = 'gv_sell_wizard_snapshot'

interface WizardSnapshot {
  step: number
  categoryId: string | null
  gameId: string | null
  region: string
  platform: string
  // V19/P24/P3 — Bundle id for fixed-bundle currency listings.
  // Optional so old snapshots still parse.
  bundleId?: string
  title: string
  description: string
  price: string
  originalPrice: string
  quantity: string
  minQuantity: string
  deliveryMethod: 'manual' | 'instant'
  deliveryTime: string
  images: string[]
  fieldValues: Record<string, unknown>
  agreeSellerRules: boolean
  agreeTos: boolean
}

/**
 * Pure visibility check (mirrors LivePreview / new-schema.ts/isAttributeVisible).
 *
 * V15c — Walks the full ancestor chain so a stale value on a now-hidden
 * parent can't keep a descendant on screen. If the third arg is provided,
 * we look up parent attributes by id; otherwise we fall back to the
 * shallow rule check (preserves call sites that don't have the full list).
 */
function isVisible(
  attr: Attribute,
  values: Record<string, unknown>,
  byId?: Map<string, Attribute>,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(attr.id)) return true
  seen.add(attr.id)
  const rules = attr.conditional_rules ?? []
  if (rules.length === 0) return true
  for (const r of rules) {
    if (byId) {
      const parent = byId.get(r.trigger_attribute_id)
      if (parent && !isVisible(parent, values, byId, seen)) return false
    }
    const cur = values[r.trigger_attribute_id]
    const trig = r.trigger_values ?? []
    let pass = false
    switch (r.operator) {
      case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
      case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
      case 'in':         pass = trig.includes(cur as string); break
      case 'not_in':     pass = !trig.includes(cur as string); break
    }
    if (!pass) return false
  }
  return true
}

/**
 * V15c — Collect every descendant attribute id of a parent. Used when
 * the user changes a parent value so we can wipe stale sub-selections
 * (e.g. switching Item Type from Brainrot → Base Skin clears both Rarity
 * and the leaf "Brainrot" selection).
 */
function collectDescendantIds(parentId: string, attrs: Attribute[]): Set<string> {
  const out = new Set<string>()
  let frontier = new Set<string>([parentId])
  let safety = 0
  while (frontier.size > 0 && safety++ < 32) {
    const next = new Set<string>()
    for (const a of attrs) {
      if (out.has(a.id)) continue
      const rules = a.conditional_rules ?? []
      for (const r of rules) {
        if (frontier.has(r.trigger_attribute_id)) {
          out.add(a.id)
          next.add(a.id)
          break
        }
      }
    }
    frontier = next
  }
  return out
}

/** Build parent → (triggerValue → children[]) index, just like the admin tree. */
function buildChildIndex(attrs: Attribute[]) {
  const childrenOf = new Map<string, Map<string, Attribute[]>>()
  const childIds = new Set<string>()
  for (const a of attrs) {
    if (!a.conditional_rules || a.conditional_rules.length === 0) continue
    childIds.add(a.id)
    const r = a.conditional_rules[0]
    const triggerVal = r.trigger_values[0] ?? ''
    const inner = childrenOf.get(r.trigger_attribute_id) ?? new Map<string, Attribute[]>()
    const list = inner.get(triggerVal) ?? []
    list.push(a)
    inner.set(triggerVal, list)
    childrenOf.set(r.trigger_attribute_id, inner)
  }
  childrenOf.forEach((inner) => {
    inner.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order))
  })
  const topLevel = attrs.filter((a) => !childIds.has(a.id)).sort((a, b) => a.sort_order - b.sort_order)
  return { topLevel, childrenOf }
}

// ─── Step bar (clickable step labels + lime progress rail) ───────────────────

/**
 * StepBar — three clickable step labels above a progress rail.
 *
 * R13 — Pill chrome dropped. Each step is now a plain text label with a
 * leading number/check badge. Active = lime text. Completed = clickable,
 * subtle hover bg. Future = dimmed. No bordered box around the label.
 */
function StepBar({
  step,
  onJumpToStep,
  onBack,
  backLabel,
}: {
  step: number
  onJumpToStep: (target: number) => void
  onBack: () => void
  backLabel: string
}) {
  return (
    // The wizard's own navbar. The global nav is stripped on /sell, so
    // without this the page had no brand anchor and no way out except a
    // back link floating in the body. One bar now carries all three:
    // identity (logo), escape (back), and position (the segments).
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-subtle bg-[rgba(10,10,15,0.85)] backdrop-blur">
      {/* The brand row spans the viewport like a real navbar; only the
          step segments stay on the form's measure, so the rails line up
          with the fields below them. */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Row 1 — brand left, back right. */}
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-white.avif"
              alt="DropMarket"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
            />
            <span className="text-[15px] font-bold text-text-primary">
              DropMarket
            </span>
          </Link>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1 rounded-md py-1.5 text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </button>
        </div>

        {/* Row 2 — the three step segments, flush to the bar's bottom
            edge so the rails read as one continuous progress strip. */}
      </div>

      {/* Segments use main's exact container (mx-auto max-w-3xl px-4
          sm:px-6) so each rail sits flush with the field edges below. */}
      <nav
        aria-label="Progress"
        className="mx-auto w-full max-w-3xl px-4 sm:px-6"
      >
        <ol className="flex gap-1.5">
            {STEPS.map((s) => {
              const done = step > s.id
              const active = step === s.id
              const clickable = done // only backwards, to a completed step

              return (
                <li key={s.id} className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onJumpToStep(s.id)}
                    aria-current={active ? 'step' : undefined}
                    aria-label={
                      clickable
                        ? `Back to step ${s.id}, ${s.label}`
                        : `Step ${s.id}, ${s.label}${active ? ' (current)' : ''}`
                    }
                    className={cn(
                      'group block w-full pb-2.5 text-left',
                      clickable ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'mb-2 block truncate text-[11px] font-semibold uppercase tracking-wider transition-colors',
                        active && 'text-lime-text',
                        done && 'text-text-tertiary group-hover:text-text-secondary',
                        !done && !active && 'text-text-disabled',
                      )}
                    >
                      {s.label}
                    </span>
                    <span
                      className={cn(
                        'block h-[3px] w-full rounded-full transition-colors duration-300',
                        // Explicit rgba, not `bg-lime/45`: the lime token is
                        // a CSS variable, and Tailwind's slash-opacity cannot
                        // apply an alpha channel to `var(...)`, so the
                        // completed segment rendered fully transparent.
                        done &&
                          'bg-[rgba(198,255,61,0.45)] group-hover:bg-[rgba(198,255,61,0.75)]',
                        active && 'bg-lime',
                        !done && !active && 'bg-border-default',
                      )}
                    />
                  </button>
                </li>
              )
          })}
        </ol>
      </nav>
    </header>
  )
}


// ─── Main component ──────────────────────────────────────────────────────────

export default function SellWizard({
  initialCategories,
  duplicateFromId,
  editListingId,
}: {
  initialCategories: GlobalCategory[]
  /** D4 — when set, fetch this listing on mount and pre-fill the wizard. */
  duplicateFromId?: string | null
  /** V14k — when set, the wizard runs in EDIT mode: pre-fills from the
   *  listing (same loader as duplicate), lands on Step 3, and submits
   *  via updateListingFromWizard instead of publishListing. Mutually
   *  exclusive with duplicateFromId (editListingId wins). */
  editListingId?: string | null
}) {
  const router = useRouter()
  // V14p — Query client used to bust the seller-listings cache after an
  // edit-mode save. The /account/listings page reads via react-query with
  // a 1-minute staleTime, so without an explicit invalidate the seller
  // would see the old row until the cache expired.
  const queryClient = useQueryClient()
  // Ref to the wizard card so we can scroll to the top of it whenever the
  // step changes (per R8 user feedback — landing on the prior scroll
  // position of the next page is disorienting).
  const cardRef = useRef<HTMLElement | null>(null)
  const [, startTransition] = useTransition()

  // V14k — Hoisted up so other effects (snapshot persist, rehydrate gate)
  // can reference it.
  const isEditMode = !!editListingId
  // V14o — Edit-mode shows a full-card loader until the prefill resolves
  // AND we've landed on Step 3. Without this gate, the wizard renders
  // Step 1 → Step 2 → Step 3 in rapid succession as data arrives, which
  // looks glitchy. Hidden surface, animated lime spinner, faded copy.
  const [editLoading, setEditLoading] = useState<boolean>(isEditMode)
  // Moderation state of the listing being edited. Drives the Changes
  // Requested banner above the wizard and the "Resubmitted" toast copy.
  const [editStatus, setEditStatus] = useState<string | null>(null)
  const [editModerationNotes, setEditModerationNotes] = useState<string | null>(null)

  const [step, setStep] = useState(1)
  // V67 — Step-slide direction: forward steps enter from the right,
  // Back enters from the left (reference: stacked-card wizard feel).
  const lastStepRef = useRef(1)
  const stepDir = step >= lastStepRef.current ? 1 : -1
  useEffect(() => { lastStepRef.current = step }, [step])
  const [categories] = useState<GlobalCategory[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<GlobalCategory | null>(null)

  // D1 — Publish policy (tier, cap, moderation gate). Fetched on mount;
  // surfaced in Step 3 so the seller sees pending-approval status and cap
  // info before they click Create Offer.
  const [policy, setPolicy] = useState<SellerPublishPolicy | null>(null)

  // D2 — Price guidance for the chosen (game, category). Fetched whenever
  // both are set; surfaced in the Pricing sub-card so the seller sees the
  // going rate before they price too high/low.
  const [priceGuidance, setPriceGuidance] = useState<PriceGuidance | null>(null)
  // V19/P2 — Per-(game, category) currency config (unit_label, min_quantity,
  // glyph, ...). Null until both selectedGame and selectedCategory resolve
  // AND the category is currency. Used by Step 3 thumbnail label and Step 4
  // Pricing / Stock cards.
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig | null>(null)
  // V19/P16 — Track config fetch so Step 3 + 4 can suppress the
  // "Currency" placeholder flicker that used to flash before the
  // admin-set unit_label ("Tokens", "Robux") arrived.
  const [currencyConfigLoading, setCurrencyConfigLoading] = useState(false)

  const [games, setGames] = useState<SellGameOption[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState<SellGameOption | null>(null)
  const [gameFilter, setGameFilter] = useState('')
  const [recentGameIds, setRecentGameIds] = useState<string[]>([])
  const [gameSortMode, setGameSortMode] = useState<'popular' | 'recent'>('popular')

  const [template, setTemplate] = useState<AttributeTemplateFull | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [region, setRegion] = useState<string>('')
  const [platform, setPlatform] = useState<string>('')
  // V19/P3 — Device is the third platform-style field (iOS / Android /
  // PC client, etc.). Driven by the per-category currencyConfig
  // platform_fields, NOT the game-level settings. Empty string when
  // the field isn't enabled for the chosen game.
  const [device, setDevice] = useState<string>('')
  // V19/P24/P3 — Bundle id for fixed-bundle currencies. Empty when
  // the currency is in flexible mode (no bundles defined for this
  // game) or the seller hasn't picked one yet. Required to publish
  // when bundles exist; gated in canPublish.
  const [bundleId, setBundleId] = useState<string>('')
  // V19/P24/P6 — Existing-listing id for the current (game, bundle,
  // region) combo. Surfaced as an inline banner above the bundle
  // picker so the seller can jump straight into edit mode instead of
  // filling the whole form and failing at publish. Empty string =
  // "no dup". The check is best-effort; the publish-time guard is the
  // hard enforcement.
  const [existingBundleListingId, setExistingBundleListingId] = useState<string>('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<string>('')
  const [originalPrice, setOriginalPrice] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [minQuantity, setMinQuantity] = useState<string>('1')
  const [deliveryMethod, setDeliveryMethod] = useState<'manual' | 'instant'>('manual')
  const [deliveryTime, setDeliveryTime] = useState<string>('1hr')
  const [images, setImages] = useState<string[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  /**
   * Step the seller asked to jump back to while Step 3 held unsaved
   * input. Holding it here (rather than jumping straight away) is what
   * lets the confirm dialog be the gate.
   */
  const [pendingJump, setPendingJump] = useState<1 | 2 | 3 | null>(null)

  /**
   * True when Step 3 holds work the seller would lose by going back.
   * Deliberately ignores the fields that carry defaults (quantity 1,
   * delivery 1hr) — warning about untouched defaults would train people
   * to dismiss the dialog.
   */
  const hasStep3Input =
    description.trim().length > 0 ||
    price.trim().length > 0 ||
    title.trim().length > 0 ||
    images.length > 0 ||
    Object.values(fieldValues).some(
      (v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
    )
  // Synchronous re-entrancy guard. `submitting` state drives the button's
  // disabled/spinner UI, but state updates are async — a very fast double
  // click can enter handlePublish twice before the re-render disables the
  // button, creating two listings. This ref flips synchronously so the
  // second call bails immediately.
  const submittingRef = useRef(false)

  // Terms gate (R8 — both must be checked to enable Create Offer)
  const [agreeSellerRules, setAgreeSellerRules] = useState(false)
  const [agreeTos, setAgreeTos] = useState(false)

  // R12 — uniform top spacing on mount + every step transition.
  //
  // The previous version skipped the very first render to avoid a smooth-scroll
  // jerk, but that left the initial paint at a different scroll position than
  // every subsequent step landed at — the navbar-to-modal gap looked
  // inconsistent. Now we scroll on both:
  //   - first paint: instant (no smooth) — lands the card at the same target
  //     offset before the user sees anything else, so the gap is right from
  //     the start.
  //   - step changes:  smooth scroll to the same target.
  // The offset (-128) leaves a generous gap below the floating homepage navbar.
  // V19/P13 — Skip the auto-scroll on first paint AND on the edit-mode
  // initialization jump (when the wizard mounts on step 1, hydrates the
  // listing data, then programmatically jumps to step 3). Both cases
  // are "first arrival" — the user wants to see the top of the page,
  // not the wizard card mid-screen. User-driven step changes after that
  // still scroll smooth so the new step's header is in view.
  const WIZARD_TOP_OFFSET = 128
  const didMountRef = useRef(false)
  const initialEditJumpDoneRef = useRef(!isEditMode)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!initialEditJumpDoneRef.current) {
      initialEditJumpDoneRef.current = true
      return
    }
    if (!cardRef.current) return
    const top =
      cardRef.current.getBoundingClientRect().top + window.scrollY - WIZARD_TOP_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }, [step])

  // R16 — Refresh persistence. Snapshot lives in sessionStorage so a hard
  // refresh keeps the seller on the same step with the same fields filled.
  // Cleared on successful publish (see handlePublish below).
  //
  // Two-phase rehydrate:
  //   1. Synchronously restore everything EXCEPT step (deferred so step
  //      never gets ahead of selectedCategory / selectedGame).
  //   2. Once the data needed for the saved step has resolved (category for
  //      step 2; game for step 3), bump step up to the target.
  const pendingGameIdRef = useRef<string | null>(null)
  const pendingStepRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)
  // Rehydrate on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    // V14k — In edit mode, skip the session snapshot. The prefill effect
    // below loads the actual listing and should fully own the form state.
    if (editListingId) { hydratedRef.current = true; return }
    try {
      const raw = sessionStorage.getItem(WIZARD_SNAPSHOT_KEY)
      if (!raw) { hydratedRef.current = true; return }
      const snap = JSON.parse(raw) as WizardSnapshot
      if (snap.categoryId) {
        const cat = categories.find((c) => c.id === snap.categoryId) ?? null
        if (cat) setSelectedCategory(cat)
      }
      pendingGameIdRef.current = snap.gameId ?? null
      pendingStepRef.current =
        typeof snap.step === 'number' && snap.step >= 1 && snap.step <= 3 ? snap.step : null
      setRegion(snap.region ?? '')
      setPlatform(snap.platform ?? '')
      setBundleId(snap.bundleId ?? '')
      setTitle(snap.title ?? '')
      setDescription(snap.description ?? '')
      setPrice(snap.price ?? '')
      setOriginalPrice(snap.originalPrice ?? '')
      setQuantity(snap.quantity ?? '1')
      setMinQuantity(snap.minQuantity ?? '1')
      setDeliveryMethod(snap.deliveryMethod ?? 'manual')
      setDeliveryTime(snap.deliveryTime ?? '1hr')
      setImages(Array.isArray(snap.images) ? snap.images : [])
      setFieldValues(snap.fieldValues ?? {})
      setAgreeSellerRules(!!snap.agreeSellerRules)
      setAgreeTos(!!snap.agreeTos)
    } catch {}
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Resolve the pending gameId once games arrive.
  useEffect(() => {
    if (!pendingGameIdRef.current) return
    if (games.length === 0) return
    const g = games.find((g) => g.game_id === pendingGameIdRef.current) ?? null
    if (g) setSelectedGame(g)
    pendingGameIdRef.current = null
  }, [games])
  // Bump step to the rehydrate target as soon as the data it needs is ready.
  useEffect(() => {
    const target = pendingStepRef.current
    if (target === null) return
    if (target === 1) {
      pendingStepRef.current = null
      return
    }
    if (target === 2 && selectedCategory) {
      setStep(2)
      pendingStepRef.current = null
      return
    }
    if (target === 3 && selectedCategory && selectedGame) {
      setStep(3)
      pendingStepRef.current = null
      // V14o — Reveal the wizard once we've actually arrived at Step 3.
      // The category + game are now resolved, so the details form is
      // ready to render with the prefilled data.
      if (isEditMode) setEditLoading(false)
    }
  }, [selectedCategory, selectedGame, isEditMode])
  // Persist on every relevant state change (after initial hydrate finishes).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hydratedRef.current) return
    // V14k — Don't persist in edit mode; we don't want editing an existing
    // listing to clobber an in-progress /sell/new draft.
    if (isEditMode) return
    const snap: WizardSnapshot = {
      step,
      categoryId: selectedCategory?.id ?? null,
      gameId: selectedGame?.game_id ?? null,
      region,
      platform,
      bundleId,
      title,
      description,
      price,
      originalPrice,
      quantity,
      minQuantity,
      deliveryMethod,
      deliveryTime,
      images,
      fieldValues,
      agreeSellerRules,
      agreeTos,
    }
    try { sessionStorage.setItem(WIZARD_SNAPSHOT_KEY, JSON.stringify(snap)) } catch {}
  }, [
    step,
    selectedCategory,
    selectedGame,
    region,
    platform,
    title,
    description,
    price,
    originalPrice,
    quantity,
    minQuantity,
    deliveryMethod,
    deliveryTime,
    images,
    fieldValues,
    agreeSellerRules,
    agreeTos,
  ])

  // R11.c — sync the wizard step with browser history so the back gesture
  // walks step 3 -> step 2 -> step 1 -> previous page instead of leaving
  // the wizard outright on the first back tap.
  //
  // Mechanics:
  //  - On mount, replace the current history entry with { step: 1 } so we
  //    always have a known starting state for popstate.
  //  - When the seller advances (or jumps back via a chip), pushState so
  //    the browser stack grows in lockstep with `step`.
  //  - On popstate, read state.step and call setStep — guarded by a ref so
  //    the resulting step change effect below does NOT push another entry.
  // D1 — Fetch publish policy on mount. Cheap RPC, runs in parallel with
  // the rest of the page; no need to block render on it. We only read it
  // when the seller hits Step 3 / clicks Create Offer.
  useEffect(() => {
    let cancelled = false
    fetchPublishPolicy().then((res) => {
      if (cancelled) return
      if (res.success) setPolicy(res.data)
    })
    return () => { cancelled = true }
  }, [])

  // D4 / V14k — Prefill for duplicate AND edit modes. Same loader, same
  // landing step (3). Edit mode just changes the toast copy and what
  // handlePublish calls on submit.
  const prefillId = editListingId ?? duplicateFromId ?? null
  useEffect(() => {
    if (!prefillId) return
    let cancelled = false
    fetchListingForDuplicate(prefillId).then((res) => {
      if (cancelled) return
      if (!res.success) {
        toast.error(res.error)
        // V14o — Drop the loader on failure so the user isn't stuck on a
        // blank loader screen; they'll see the empty wizard and can back out.
        if (isEditMode) setEditLoading(false)
        return
      }
      const d = res.data
      const cat = categories.find((c) => c.slug === d.category_slug) ?? null
      if (cat) setSelectedCategory(cat)
      pendingGameIdRef.current = d.game_id
      pendingStepRef.current = 3
      setTitle(d.title)
      setDescription(d.description)
      setPrice(String(d.price))
      setOriginalPrice(d.original_price != null ? String(d.original_price) : '')
      setQuantity(String(d.quantity))
      setMinQuantity(String(d.min_quantity))
      setDeliveryMethod(d.delivery_method)
      setDeliveryTime(d.delivery_time ?? '1hr')
      setRegion(d.region ?? '')
      setPlatform(d.platform ?? '')
      setBundleId((d as any).bundle_id ?? '')
      setFieldValues(d.template_data ?? {})
      setImages(d.images)
      if (isEditMode) {
        setEditStatus(d.status ?? null)
        setEditModerationNotes(d.moderation_notes ?? null)
      }
      toast.success(isEditMode ? 'Loaded your listing for editing' : 'Pre-filled from your existing listing')
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId])

  const popstateGuardRef = useRef(false)
  // Mount: lay down the initial history entry.
  // V14o — Skip the step-history wiring in edit mode. The wizard only ever
  // shows Step 3 in edit mode, so there's nothing to step back through —
  // the browser back gesture should fall through to the previous page
  // (i.e. /account/listings), not bounce the seller to Steps 2/1 which
  // they can't legally edit anyway.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isEditMode) return
    window.history.replaceState({ wizardStep: 1 }, '')
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { wizardStep?: number } | null)?.wizardStep
      if (typeof target === 'number' && target >= 1 && target <= 3) {
        popstateGuardRef.current = true
        setStep(target)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Step change → push history (unless we got here via popstate). Same edit-mode skip.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isEditMode) return
    if (popstateGuardRef.current) {
      popstateGuardRef.current = false
      return
    }
    const cur = (window.history.state as { wizardStep?: number } | null)?.wizardStep
    if (cur === step) return // initial replaceState already covers step 1
    window.history.pushState({ wizardStep: step }, '')
  }, [step, isEditMode])

  // Read recent games from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_GAMES_KEY)
      if (raw) setRecentGameIds(JSON.parse(raw))
    } catch {}
  }, [])

  // Load games when category changes
  useEffect(() => {
    if (!selectedCategory) return
    let cancelled = false
    setGamesLoading(true)
    fetchSellGamesForCategory(selectedCategory.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setGames(res.data)
        else toast.error(res.error)
      })
      .finally(() => { if (!cancelled) setGamesLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory])

  // Load template
  useEffect(() => {
    if (!selectedCategory || !selectedGame) return
    let cancelled = false
    setTemplateLoading(true)
    fetchSellTemplate(selectedGame.game_id, selectedCategory.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setTemplate(res.data)
        else toast.error(res.error)
      })
      .finally(() => { if (!cancelled) setTemplateLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory, selectedGame])


  // D2 — Fetch price guidance whenever (game, category) is set. Cheap
  // RPC; runs in parallel with template-load. The Pricing card consumes it.
  useEffect(() => {
    if (!selectedCategory || !selectedGame) {
      setPriceGuidance(null)
      return
    }
    let cancelled = false
    fetchPriceGuidance(selectedGame.game_id, selectedCategory.slug).then((res) => {
      if (cancelled) return
      if (res.success) setPriceGuidance(res.data)
    })
    return () => { cancelled = true }
  }, [selectedCategory, selectedGame])

  // V19/P2 — Fetch currency config when a currency category is chosen so the
  // wizard can render the unit label (Robux, Orbs, V-Bucks, ...) the admin
  // configured for this game. Non-currency categories clear it.
  useEffect(() => {
    if (!selectedGame || selectedCategory?.slug !== 'currency') {
      setCurrencyConfig(null)
      setCurrencyConfigLoading(false)
      return
    }
    let cancelled = false
    setCurrencyConfigLoading(true)
    fetchCategoryConfigBySlug(selectedGame.game_slug, 'currency').then((cfg) => {
      if (cancelled) return
      setCurrencyConfig(cfg)
      setCurrencyConfigLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedCategory, selectedGame])

  // V19/P24/P6 — Bundle-dup eager check. Fires whenever the seller
  // changes their bundle pick or region. Skipped in edit mode (we
  // ARE the existing listing). The result drives the inline banner
  // above the bundle picker. Errors are silent — the publish-time
  // guard catches anything we miss here.
  useEffect(() => {
    if (isEditMode) {
      setExistingBundleListingId('')
      return
    }
    if (!selectedGame || !bundleId) {
      setExistingBundleListingId('')
      return
    }
    let cancelled = false
    fetchExistingBundleListingId(
      selectedGame.game_id,
      bundleId,
      region || null,
      platform || null,
    )
      .then((res) => {
        if (!cancelled) setExistingBundleListingId(res?.id ?? '')
      })
    return () => { cancelled = true }
  }, [selectedGame, bundleId, region, platform, isEditMode])

  // Force allowed delivery mode
  useEffect(() => {
    if (!selectedGame) return
    if (!selectedGame.delivery_modes.includes('instant') && deliveryMethod !== 'manual') {
      setDeliveryMethod('manual')
    }
    if (selectedGame.delivery_modes.length === 1) {
      setDeliveryMethod(selectedGame.delivery_modes[0] as 'manual' | 'instant')
    }
  }, [selectedGame, deliveryMethod])

  // Track recently used games
  const rememberGame = (gameId: string) => {
    try {
      const next = [gameId, ...recentGameIds.filter((id) => id !== gameId)].slice(0, 12)
      setRecentGameIds(next)
      localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(next))
    } catch {}
  }

  const { topLevel, childrenOf } = useMemo(
    () => buildChildIndex(template?.attributes ?? []),
    [template]
  )

  // Step 3 validity: every visible required field has a value
  const allRequiredFilled = useMemo(() => {
    if (!template) return true
    // V15c — Build the byId index once so isVisible can walk the full chain.
    const byId = new Map<string, Attribute>()
    for (const a of template.attributes) byId.set(a.id, a)
    function check(list: Attribute[]): boolean {
      for (const a of list) {
        if (!isVisible(a, fieldValues, byId)) continue
        if (a.is_required) {
          const v = fieldValues[a.id]
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false
        }
        // recurse into the children of whichever choice is currently selected
        const inner = childrenOf.get(a.id)
        if (inner) {
          const v = fieldValues[a.id]
          if (typeof v === 'string' && v) {
            const kids = inner.get(v) ?? []
            if (!check(kids)) return false
          }
        }
      }
      return true
    }
    return check(topLevel)
  }, [template, fieldValues, topLevel, childrenOf])

  // canGoNext: only meaningful for step 1 → 2 and step 2 → 3.
  // Step 3 is the final step — its "next" is Publish, gated by canPublish below.
  const canGoNext = useMemo(() => {
    if (step === 1) return !!selectedCategory
    if (step === 2) {
      if (!selectedGame) return false
      if (selectedGame.requires_region && !region) return false
      // V19/P24/P7.b — Platform gate moved to Step 3 (canPublish);
      // the Step-1 picker is gone so we can't gate here anymore.
      return true
    }
    return false
  }, [step, selectedCategory, selectedGame, region, platform])

  // canPublish: gates the Create Offer button on step 3. Combines dynamic
  // attribute validity (allRequiredFilled) with the static fields and the
  // two R8 terms checkboxes.
  const canPublish = useMemo(() => {
    if (!allRequiredFilled) return false
    // V13 — Currency listings skip Title + Photos requirements (server fills
    // them automatically from the currency record).
    const isCurrency = selectedCategory?.slug === 'currency'
    if (!isCurrency && !title.trim()) return false
    if (!isCurrency && images.length === 0) return false
    const p = parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return false
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return false
    if (!agreeSellerRules || !agreeTos) return false
    // V19/P3 — Currency platform fields. Any enabled+non-empty kind on the
    // currency config must be picked before the seller can publish. We
    // read straight from the same currencyConfig the form does so admin
    // edits propagate without an extra source of truth.
    if (isCurrency) {
      const kinds = visiblePlatformKinds(currencyConfig?.platform_fields)
      const vals: Record<'region' | 'platform' | 'device', string> = { region, platform, device }
      if (kinds.some((k) => !vals[k])) return false
      // V19/P24/P3 — Bundle currencies REQUIRE a bundle pick. Flexible
      // currencies (no bundles defined) skip this check.
      if ((currencyConfig?.bundles?.length ?? 0) > 0 && !bundleId) return false
    }
    // D1 — block clicking Create Offer when the seller is at their tier's
    // active-listing cap. The server enforces this too, but blocking the
    // button avoids the round-trip + error toast.
    if (policy?.at_listing_limit) return false
    return true
  }, [allRequiredFilled, title, images, price, quantity, agreeSellerRules, agreeTos, policy, selectedCategory, currencyConfig, region, platform, device, bundleId])

  const handleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (images.length + files.length > 5) { toast.error('Maximum 5 images'); return }
    setImageUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadSellImage(fd)
        if (!res.success) { toast.error(res.error); continue }
        uploaded.push(res.data.url)
      }
      if (uploaded.length > 0) setImages((prev) => [...prev, ...uploaded])
    } finally {
      setImageUploading(false)
    }
  }

  const handlePublish = async (asDraft: boolean) => {
    if (!selectedGame || !selectedCategory) return
    // Synchronous double-submit guard — bail if a publish is already in
    // flight, even if React hasn't re-rendered the disabled button yet.
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    // On success we navigate away to /account/listings — keep the button
    // disabled through that transition rather than re-enabling it (which
    // would let an over-eager click fire a SECOND publish during the nav).
    // Only reset the guard when we stay on the page (failure / error).
    let succeeded = false
    try {
      const templateData: Record<string, unknown> = {}
      if (template) {
        // V15c — Use the chain-aware visibility check so hidden-ancestor
        // values don't sneak into the publish payload.
        const byId = new Map<string, Attribute>()
        for (const a of template.attributes) byId.set(a.id, a)
        for (const a of template.attributes) {
          if (!isVisible(a, fieldValues, byId)) continue
          const v = fieldValues[a.id]
          if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
          templateData[a.slug] = v
        }
      }
      // Bundle listings are sold one bundle at a time, so their minimum
      // is always 1. A flexible currency uses the seller's figure,
      // clamped up to the per-game admin floor so a stale form value
      // can never publish below it.
      const adminFloor = Math.max(1, currencyConfig?.min_quantity ?? 1)
      const typedMin = parseInt(minQuantity, 10)
      const stockValue = parseInt(quantity, 10)
      const minQuantityValue = bundleId
        ? 1
        : (() => {
            const wanted = Math.max(
              adminFloor,
              Number.isFinite(typedMin) ? typedMin : adminFloor,
            )
            // A minimum above stock is unsellable: the buyer's stepper
            // would open below the floor it is clamped to and no order
            // could ever be placed. Cap at stock, but never below the
            // admin floor — if stock is under the floor the listing is
            // out of range anyway and the floor is the honest value.
            return Number.isFinite(stockValue) && stockValue > 0
              ? Math.max(adminFloor, Math.min(wanted, stockValue))
              : wanted
          })()

      const payload = {
        game_id: selectedGame.game_id,
        category_slug: selectedCategory.slug,
        title: title.trim(),
        description,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        quantity: parseInt(quantity, 10),
        // The seller's own minimum order size, in the category's
        // granularity unit (a `thousand` game stores 1 for "1K"). Was
        // hardcoded to 1 while the input was absent from the wizard,
        // which meant the per-game admin floor never reached the row
        // and the buyer stepper fell back to a magic 100.
        min_quantity: minQuantityValue,
        delivery_method: deliveryMethod,
        delivery_time: deliveryTime,
        images,
        template_data: templateData,
        region: region || null,
        platform: platform || null,
        // V19/P3 — Device is gated by admin currency config. Until the
        // listings table has a `device` column + the server zod schema
        // accepts it, the field is sent for forward-compatibility but
        // dropped server-side. UI is the source of truth for now.
        device: device || null,
        // V19/P24/P3 — Bundle id for fixed-bundle currency listings.
        // Wired all the way through PublishListingInput → DB column;
        // empty string becomes null so non-bundle listings stay clean.
        bundle_id: bundleId || null,
        status: (asDraft ? 'draft' : 'active') as 'draft' | 'active',
      }
      // V14k — Edit mode UPDATES the existing row; publish/duplicate INSERTs
      // a new one.
      const res = isEditMode && editListingId
        ? await updateListingFromWizard(editListingId, payload)
        : await publishListing(payload)
      if (!res.success) { toast.error(res.error); return }
      const landed = res.data.status
      if (isEditMode) {
        // Resubmit loop: an offer the review team bounced back re-enters
        // the queue — make the toast say so instead of a generic "updated".
        const wasBounced = editStatus === 'changes_requested' || editStatus === 'rejected'
        toast.success(
          wasBounced && landed === 'pending_approval'
            ? 'Resubmitted for review'
            : 'Listing updated',
        )
      } else if (asDraft) {
        toast.success('Saved as draft')
      } else if (landed === 'pending_approval') {
        toast.success('Listing submitted — pending review by our team')
      } else {
        toast.success('Listing published!')
      }
      // R16 — clear the refresh-persistence snapshot so a future visit to
      // /sell/new starts fresh instead of restoring this just-published draft.
      try { sessionStorage.removeItem(WIZARD_SNAPSHOT_KEY) } catch {}
      // V14p — Bust react-query caches so the listings page shows fresh data.
      // updateListingFromWizard already revalidates the RSC path, but the
      // /account/listings page is a client component using useQuery, so we
      // also need to invalidate the in-memory cache here.
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
      queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
      succeeded = true
      startTransition(() => router.push('/account/listings'))
    } finally {
      // Re-enable only if we're staying on the page (failure/error). On
      // success the navigation unmounts this wizard, so leaving the button
      // disabled is both correct and prevents a duplicate-publish click.
      if (!succeeded) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }

  // V14o — Edit-mode loader screen. While the listing is being fetched and
  // the wizard is being walked to Step 3, show a centered loader instead
  // of the half-built wizard (the seller doesn't need to see Step 1 → 2 → 3
  // flash by — they only care about editing the details).
  if (isEditMode && editLoading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl items-center justify-center px-3 pb-24 pt-20 sm:px-6 sm:pt-20 lg:max-w-5xl lg:pt-20">
        <section
          className="relative flex w-full flex-col items-center gap-4 rounded-3xl border border-border-default bg-bg-raised p-10 shadow-elevated sm:p-14"
          aria-live="polite"
          aria-busy="true"
        >
          {/* Soft lime glow behind the spinner */}
          <div
            aria-hidden
            className="absolute inset-0 -m-8 rounded-3xl bg-lime/5 blur-3xl"
          />
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-border-subtle"
            />
            <div
              aria-hidden
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime border-r-lime"
              style={{ animationDuration: '0.9s' }}
            />
            <Loader2 className="h-0 w-0" />
          </div>
          <div className="relative text-center">
            <h1 className="text-[18px] font-bold text-text-primary sm:text-[20px]">
              Loading your listing
            </h1>
            <p className="mt-1 text-[13.5px] text-text-tertiary">
              Pulling in your offer details — one moment.
            </p>
          </div>
        </section>
      </main>
    )
  }

  // V19/P14 — Top padding reduced so the wizard sits flush below the
  // scrolled-bar navbar (≈64px). The old pt-24/28/32 left a
  // 32–64px scroll-up zone above the card; with the auto-scroll
  // gone (V19/P13), that empty band was reachable as the user could
  // scroll up into nothing. pt-20 = navbar height + 16px breath.
  return (
    // Focused canvas: one narrow centred column on the page background.
    // max-w-3xl (768px, Eldorado's form width) — a reading measure for a
    // form; 672px read as thin and tall. Wider still and rows
    // make label/field pairs drift apart. Bottom padding clears the
    // sticky action bar on every breakpoint, not just mobile.
    // Steps 1 and 2 are short (a heading and a handful of tiles). Pinned
    // to the top they left ~450px of dead space underneath and read as a
    // fragment of a page. Centring the column in the space between the
    // top rail and the sticky action bar makes the choice the subject of
    // the screen. Step 3 is long, so it falls back to top-aligned and
    // simply scrolls.
    <main
      className={cn(
        // pt clears the fixed wizard navbar (96px: brand row + segment
        // row) and leaves ~32px (40px on sm+) before the title, the same
        // on all three steps.
        // `sell-form` scopes the focus-ring override in globals.css.
        'sell-form mx-auto flex w-full flex-col px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-32 sm:px-6 sm:pt-[8.5rem]',
        'max-w-3xl',
        // min-h-0 + the sticky bar's height as bottom padding: using
        // 100dvh WITH padding made the box taller than the viewport and
        // reintroduced a scrollbar on a screen that has nothing to scroll.
        // Top-aligned, not centred: centring parked the title in the
        // middle of the viewport with a large empty band under the bar.
        step < 3 && 'min-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))]',
      )}
    >
      {/* No card. The form IS the page — the progress line is pinned to
          the viewport top, the heading sits on the background, and the
          only surfaces below are the inputs themselves. */}
      <section ref={cardRef} className="relative isolate overflow-visible">
        <StepBar
          step={step}
          backLabel={isEditMode || step === 1 ? 'Back to Listings' : 'Back'}
          onBack={() => {
            if (isEditMode || step === 1) {
              router.push('/account/listings')
              return
            }
            setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
          }}
          // V14o — In edit mode the seller can't change category/game on
          // an existing row (would orphan template_data + category_id), so
          // disable jumping back to Steps 1/2. Keeps them focused on the
          // editable details on Step 3.
          onJumpToStep={(target) => {
            if (isEditMode || target >= step) return
            // Going back from Details re-picks the category or game,
            // which resets the per-template fields — warn before the
            // seller loses typed work. Steps 1 -> 2 carry nothing.
            if (step === 3 && hasStep3Input) {
              setPendingJump(target as 1 | 2 | 3)
              return
            }
            setStep(target as 1 | 2 | 3)
          }}
        />

        {/* Step header.
            Step 1 / 2 just show the hint text.
            Step 3 swaps in the "Sell Game Items" title with a game-logo
            sub-header — the chosen game is now context, not a question. */}
        <div className="mb-4 sm:mb-5">
          {step === 3 && selectedGame ? (
            (() => {
              // V13 — On currency we want the buyer-facing currency name
              // ("Robux") as the title, with the game ("Roblox") as a quiet
              // subtitle below. Other categories keep "Game Category" as
              // a single line.
              const isCurrency = selectedCategory?.slug === 'currency'
              // V19/P7 — Single-line "{Game} {unit}" for currency
              // listings ("Blade Ball Tokens", "Roblox Robux"). Drops
              // the separate FOR {GAME} subtitle line. Non-currency
              // keeps the existing "{Game} {Category}" format.
              // V19/P16 — While the currency config is still fetching,
              // suppress the title so we don't render "Currency" and
              // then flicker to the admin-set unit_label ("Tokens").
              const unit = currencyConfig?.unit_label
              const showTitle = !isCurrency || !currencyConfigLoading
              const title = isCurrency
                ? `${selectedGame.game_name} ${unit ?? ''}`.trim()
                : `${selectedGame.game_name} ${selectedCategory?.name ?? 'Listing'}`
              return (
                <div className="flex items-center justify-center gap-3 text-left">
                  {selectedGame.game_logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedGame.game_logo_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border-default"
                    />
                  ) : (
                    <span className="text-3xl">{selectedGame.game_emoji ?? '🎮'}</span>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
                      {/* V19/P16 — Render a width-stable skeleton while
                          the currency config is loading. Same line
                          height as the real title so the row doesn't
                          jump when the data arrives. */}
                      {showTitle ? (
                        title
                      ) : (
                        <span className="inline-block h-[1em] w-48 animate-pulse rounded-md bg-bg-overlay align-middle" />
                      )}
                    </h1>
                  </div>
                </div>
              )
            })()
          ) : (
            // Compact heading. The decorative icon medallion and the
            // lg:text-3xl H1 together pushed the actual choices ~660px
            // down the viewport — the content the seller came for sat
            // below the fold on a laptop. Hierarchy now comes from
            // weight and colour rather than raw scale.
            // Title only, no subline: the heading IS the label for the
            // card directly under it, and a subtitle between them made the
            // two read as separate things.
            <div className="text-center">
              <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
                {/* Context, not the question: the question ("Choose A
                    Game") is the title bar of the card below, the same way
                    every Step 3 card is titled. */}
                {step === 1
                  ? 'Create An Offer'
                  : `Sell ${selectedCategory?.name ?? 'Items'}`}
              </h1>
            </div>
          )}
        </div>

        {/* R17 — `initial={false}` skips the entry animation on first mount
            (page load / refresh) so the wizard body appears in its final
            position alongside the navbar instead of fading in a beat later.
            Step-to-step transitions still animate because AnimatePresence
            re-mounts the child when `key={step}` changes. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 64 * stepDir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -64 * stepDir }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <Step1Category
                categories={categories}
                selected={selectedCategory}
                onSelect={(c) => { setSelectedCategory(c); setSelectedGame(null); setTemplate(null); setFieldValues({}) }}
              />
            )}

            {step === 2 && selectedCategory && (
              <Step2Game
                category={selectedCategory}
                games={games}
                loading={gamesLoading}
                selected={selectedGame}
                onSelect={async (g) => {
                  // V19/P9 — One currency listing per (seller, game). If the
                  // seller already has one, redirect to its edit page instead
                  // of letting them advance to Step 3 and discover the
                  // collision at publish-time. Non-currency categories skip
                  // the check entirely (zero overhead for items / accounts /
                  // boosting / top-up).
                  if (selectedCategory?.slug === 'currency' && !isEditMode) {
                    const existing = await fetchExistingCurrencyListingId(g.game_id)
                    if (existing?.id) {
                      toast.success(
                        `You already have a currency listing for ${g.game_name}. Opening it for editing…`,
                      )
                      router.push(`/sell/edit/${existing.id}`)
                      return
                    }
                  }

                  setSelectedGame(g)
                  rememberGame(g.game_id)
                  // V19/P24/P7.b — Region + Platform both live in Step 3
                  // now (driven by currency platform_fields), so picking
                  // the game always jumps straight to Details.
                  setStep(3)
                }}
                filter={gameFilter}
                onFilter={setGameFilter}
                recentGameIds={recentGameIds}
                sortMode={gameSortMode}
                onSortMode={setGameSortMode}
                region={region} onRegion={setRegion}
                platform={platform} onPlatform={setPlatform}
              />
            )}

            {/* Step 3 — the combined Details + Publish content.
                Rendered in two stacked blocks: dynamic attribute fields
                (Offer Details) and the static fields (Offer Description).
                R4 wraps these into proper sub-cards; for R2 they're
                stacked with a divider so the page works while the
                visual restructure lands. */}
            {step === 3 && selectedCategory && selectedGame && (
              <div className="space-y-5">
                {/* Changes Requested — what the review team asked for.
                    Saving a non-draft edit resubmits into the queue. */}
                {isEditMode && editStatus === 'changes_requested' && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-bg px-3 py-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.5} />
                    <div className="min-w-0 flex-1 text-[13px]">
                      <span className="font-semibold text-warning">
                        Changes Requested.
                      </span>{' '}
                      <span className="text-text-secondary">
                        {editModerationNotes
                          ? editModerationNotes
                          : 'Our review team asked for changes to this offer.'}{' '}
                        Saving your update resubmits it for review.
                      </span>
                    </div>
                  </div>
                )}
                <PolicyBanner policy={policy} />
                <Step3Details
                  templateLoading={templateLoading}
                  template={template}
                  topLevel={topLevel}
                  childrenOf={childrenOf}
                  values={fieldValues}
                  onChange={(id, v) =>
                    setFieldValues((prev) => {
                      // V15c — Cascade-reset descendants when a parent value
                      // changes so stale sub-selections (e.g. an Antonio
                      // leaf left over from Brainrot → Secret) can't sit
                      // under a now-hidden parent and silently re-appear.
                      const next: Record<string, unknown> = { ...prev, [id]: v }
                      const attrs = template?.attributes ?? []
                      collectDescendantIds(id, attrs).forEach((childId) => {
                        delete next[childId]
                      })
                      return next
                    })
                  }
                />
                <Step4Publish
                  title={title} setTitle={setTitle}
                  description={description} setDescription={setDescription}
                  price={price} setPrice={setPrice}
                  originalPrice={originalPrice} setOriginalPrice={setOriginalPrice}
                  quantity={quantity} setQuantity={setQuantity}
                  minQuantity={minQuantity} setMinQuantity={setMinQuantity}
                  deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod}
                  deliveryTime={deliveryTime} setDeliveryTime={setDeliveryTime}
                  allowedDeliveryModes={selectedGame.delivery_modes}
                  images={images}
                  onUpload={handleImages}
                  onRemoveImage={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  imageUploading={imageUploading}
                  priceGuidance={priceGuidance}
                  categorySlug={selectedCategory.slug}
                  gameName={selectedGame.game_name}
                  gameSlug={selectedGame.game_slug}
                  unitLabel={currencyConfig?.unit_label ?? null}
                  unitLabelLoading={currencyConfigLoading}
                  granularity={currencyConfig?.quantity_granularity ?? 'unit'}
                  adminMinQuantity={currencyConfig?.min_quantity ?? 1}
                  platformFields={currencyConfig?.platform_fields ?? null}
                  region={region} onRegion={setRegion}
                  platform={platform} onPlatform={setPlatform}
                  device={device} onDevice={setDevice}
                  bundles={currencyConfig?.bundles ?? null}
                  bundleId={bundleId} onBundleId={setBundleId}
                  existingBundleListingId={existingBundleListingId}
                />
                <TermsCard
                  agreeSellerRules={agreeSellerRules}
                  setAgreeSellerRules={setAgreeSellerRules}
                  agreeTos={agreeTos}
                  setAgreeTos={setAgreeTos}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      {/* Footer / publish row.
          Desktop (sm+): inline at the bottom of the wizard card with the
            standard mt-8 border-t pt-6 treatment.
          Mobile (< sm): fixed at the bottom of the viewport with a
            backdrop so the seller can hit Publish without scrolling
            all the way to the end. main.pb-24 already leaves space. */}
      {/* Actions sit at the END of the page, in flow. A fixed bar floated
          over the content on every step and stole vertical space on a
          phone; all three steps are short enough to scroll to the end. */}
      <div className="mt-8 border-t border-border-subtle pt-5">
      <div className="flex w-full items-center justify-between gap-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={submitting}
            className={cn(BTN_SECONDARY, 'disabled:opacity-40')}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          // D5 — On Step 1 (no Back button), the bottom-left slot becomes
          // the Bulk-upload entry point. Same border / size grammar as the
          // Back button so the footer reads as one row. Lime accent only on
          // hover so it doesn't compete with Continue.
          <Link
            href="/sell/bulk"
            className={BTN_SECONDARY}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk upload
          </Link>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            disabled={!canGoNext}
            className={canGoNext ? BTN_PRIMARY : BTN_PRIMARY_DISABLED}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          // R14 — Save draft removed; Create Offer is now the sole primary CTA.
          // Bumped to h-11, taller padding, no leading icon — the button
          // should read as the unambiguous next action, not one of two.
          <button
            type="button"
            onClick={() => handlePublish(false)}
            disabled={!canPublish || submitting}
            // Same size as Continue, Title Case (not uppercase): the final
            // step's CTA is the same kind of action, just the last one. A
            // min width stops the button shrinking to the spinner.
            className={cn(canPublish && !submitting ? BTN_PRIMARY : BTN_PRIMARY_DISABLED, 'min-w-[136px]')}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditMode ? 'Save Changes' : 'Create Offer')}
          </button>
        )}
      </div>
      </div>
      </section>

      {/* Unsaved-work guard for a backwards step jump. */}
      <Dialog
        open={pendingJump !== null}
        onOpenChange={(open) => { if (!open) setPendingJump(null) }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Go Back?</DialogTitle>
            <DialogDescription>
              Changing your{' '}
              {pendingJump === 1 ? 'category' : 'game'} clears the offer
              details you have filled in. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setPendingJump(null)}
              className={BTN_SECONDARY}
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => {
                const target = pendingJump
                setPendingJump(null)
                if (target) setStep(target)
              }}
              className={BTN_DANGER}
            >
              Discard Details
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

// ─── Step 1: category picker ────────────────────────────────────────────────

// R12 — Category tile theme per slug: icon + gradient bg + accent ring.
// Each category gets a distinct gradient tint so the grid reads as a
// well-branded chooser rather than 'five generic dark cards'.
/**
 * Masks the shared house category glyph (public/icons/categories/*.svg),
 * the same set the homepage hero chips and the navbar use. Masking rather
 * than <img> lets the glyph take its colour from the plate it sits on.
 */
function categoryGlyphStyle(icon: string): React.CSSProperties {
  const url = `url(/icons/categories/${icon}.svg)`
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  }
}

const CATEGORY_THEME: Record<
  string,
  {
    /** Slug of the house SVG under public/icons/categories. */
    icon: string
    iconBg: string    // gradient classes for the icon plate
    ring: string      // hover/active ring accent
    /**
     * R15 — concrete one-line example shown on the tile instead of the DB
     * description. The DB descriptions ran long and got truncated; short
     * concrete examples (e.g. "Robux, V-Bucks, gold") read faster and
     * always fit on one line at this card size.
     */
    example: string
  }
> = {
  currency: {
    icon: 'currency',
    iconBg: 'bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-orange-500/20',
    ring: 'group-hover:border-amber-400/40',
    example: 'Robux, Gold',
  },
  items: {
    icon: 'items',
    iconBg: 'bg-gradient-to-br from-rose-500/30 via-pink-500/20 to-red-500/20',
    ring: 'group-hover:border-rose-400/40',
    example: 'Pets, Skins, Knives',
  },
  accounts: {
    icon: 'accounts',
    iconBg: 'bg-gradient-to-br from-sky-400/30 via-blue-500/20 to-indigo-500/20',
    ring: 'group-hover:border-sky-400/40',
    example: 'Ranked, Progression',
  },
  'top-up': {
    icon: 'top-up',
    iconBg: 'bg-gradient-to-br from-yellow-300/30 via-amber-400/25 to-yellow-500/20',
    ring: 'group-hover:border-yellow-400/40',
    example: 'Crystals, UC, Crew',
  },
  boosting: {
    icon: 'boosting',
    iconBg: 'bg-gradient-to-br from-lime/25 via-lime/15 to-emerald-500/15',
    ring: 'group-hover:border-lime-tint-border',
    example: 'Rank Pushes, Win Boosts',
  },
}

function Step1Category({
  categories, selected, onSelect,
}: {
  categories: GlobalCategory[]
  selected: GlobalCategory | null
  onSelect: (c: GlobalCategory) => void
}) {
  // R14 — Balanced flex-wrap layout: each tile takes a fixed share of the row
  // (~half on mobile, ~third on lg) and the last row centers any orphan cards
  // so the 5-category set reads as 2-2-1 (centered) instead of an
  // off-balance 3-2 grid.
  return (
    // 2x2 on desktop, single column on a phone. CSS Grid rather than
    // flex-wrap so the cells are equal width and the row count is
    // explicit (see 3.E: grid over flex-math).
    <SubCard title="Choose A Category">
    <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      {categories.map((c, i) => {
        const active = selected?.id === c.id
        const disabled = !c.is_active
        const theme = CATEGORY_THEME[c.slug] ?? CATEGORY_THEME.items
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(c)}
            // R17 — entry animation dropped on first paint. The page is
            // server-rendered; staggered fade-in made the tiles feel "loaded
            // later" than the navbar.
            initial={false}

            className={cn(
              // A 2-col grid cell (the parent owns the columns now). The
              // old 3-per-row flex basis left the 4th category orphaned
              // on its own row; with 4 fixed categories a 2x2 grid fills
              // exactly, with no stray cell.
              // Inside the card now, so translucent rather than a second
              // solid surface (a card inside a card), rectangular like the
              // other controls, and colour-only on hover (no lift).
              'group relative flex items-center gap-3 overflow-hidden rounded-md border p-3 text-left transition-colors',
              disabled && 'cursor-not-allowed opacity-50',
              active
                ? 'border-lime bg-lime-tint-bg'
                : cn('border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06]', theme.ring),
            )}
          >
            {/* Icon plate — smaller than the previous tile design */}
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-default sm:h-11 sm:w-11',
                theme.iconBg,
              )}
            >
              <span
                aria-hidden
                style={categoryGlyphStyle(theme.icon)}
                className="block h-5 w-5 bg-text-primary sm:h-6 sm:w-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-text-primary sm:text-base">{c.name}</span>
                {disabled && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-warning bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
                    Soon
                  </span>
                )}
              </div>
              {/* R15 — concrete examples (see CATEGORY_THEME.example) replace
                  the DB description. Brighter color + no truncation so the
                  helper text is always readable. */}
              <div className="mt-0.5 truncate text-xs text-text-secondary sm:text-[13px]">
                {theme.example}
              </div>
            </div>

            {/* Trailing indicator */}
            {!disabled && (
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'bg-lime text-text-inverse'
                    : 'text-text-tertiary group-hover:text-text-primary',
                )}
              >
                {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ArrowRight className="h-3.5 w-3.5" />}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
    </SubCard>
  )
}

// ─── Step 2: game picker ────────────────────────────────────────────────────

function Step2Game({
  category, games, loading, selected, onSelect, filter, onFilter,
  recentGameIds, sortMode, onSortMode,
  region, onRegion, platform, onPlatform,
}: {
  category: GlobalCategory
  games: SellGameOption[]
  loading: boolean
  selected: SellGameOption | null
  onSelect: (g: SellGameOption) => void
  filter: string
  onFilter: (s: string) => void
  recentGameIds: string[]
  sortMode: 'popular' | 'recent'
  onSortMode: (m: 'popular' | 'recent') => void
  region: string
  onRegion: (s: string) => void
  platform: string
  onPlatform: (s: string) => void
}) {
  // Reorder games by tab
  const ordered = useMemo(() => {
    const filtered = games.filter((g) =>
      !filter ||
      g.game_name.toLowerCase().includes(filter.toLowerCase()) ||
      g.game_slug.includes(filter.toLowerCase())
    )
    if (sortMode === 'recent') {
      const rank = new Map<string, number>()
      recentGameIds.forEach((id, idx) => rank.set(id, idx))
      return [...filtered].sort((a, b) => {
        const ra = rank.has(a.game_id) ? rank.get(a.game_id)! : 9999
        const rb = rank.has(b.game_id) ? rank.get(b.game_id)! : 9999
        if (ra !== rb) return ra - rb
        return a.game_sort_order - b.game_sort_order
      })
    }
    return filtered // already sorted by sort_order in the action
  }, [games, filter, sortMode, recentGameIds])

  /** The seller's last few games, newest first, as quick chips. */
  const recentGames = useMemo(
    () =>
      recentGameIds
        .map((id) => games.find((g) => g.game_id === id))
        .filter((g): g is NonNullable<typeof g> => !!g)
        .slice(0, 5),
    [recentGameIds, games],
  )

  return (
    // The picker lives in a titled card (SubCard, the Step 3 panel), so all
    // three steps share one pattern: page title = context ("Sell Items"),
    // card title = the question ("Choose A Game").
    <SubCard title="Choose A Game">
    <div className="space-y-4">
      {/* A searchable dropdown rather than a wall of tiles. The catalogue
          runs to hundreds of games; a grid made the seller hunt visually
          and truncated every label. Combobox (Radix Popover + cmdk) gives
          type-ahead, keyboard nav and the small per-game icon for free —
          and it is the same control the rest of the app already uses. */}
      {loading ? (
        <div className="flex h-11 items-center gap-2 rounded-md border border-border-default px-3 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          Loading games…
        </div>
      ) : games.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-tertiary">
          No games have {category.name} enabled yet. An admin needs to enable it.
        </p>
      ) : (
        <Combobox
          value={selected?.game_id ?? ''}
          onChange={(id) => {
            const g = games.find((x) => x.game_id === id)
            if (g) onSelect(g)
          }}
          options={games.map((g) => ({
            value: g.game_id,
            label: g.game_name,
            icon_url: g.game_logo_url ?? null,
          }))}
          placeholder={`Search games that sell ${category.name.toLowerCase()}…`}
          emptyText="No games match that search."
          ariaLabel="Choose a game"
          tone="neutral"
          iconInTrigger
        />
      )}

      {/* Recently used, as quick chips under the field — keeps the one
          genuinely useful part of the old Popular/Recent tabs without
          re-introducing a second browsing surface. */}
      {recentGames.length > 0 && (
        // One row, never a second: overflow scrolls sideways (scrollbar
        // hidden) and the right edge fades so a cut-off chip reads as
        // "more this way" rather than as clipped.
        <div className="flex items-center gap-2 border-t border-border-subtle pt-4">
          <span className="mr-1 shrink-0 text-[13px] font-medium text-text-tertiary">Recent</span>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recentGames.map((g) => (
            <button
              key={g.game_id}
              type="button"
              onClick={() => onSelect(g)}
              className={cn(
                // Rectangular chips (rounded-md), matching the card and the
                // inputs — pills were the only round shapes left on the page.
                'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-[13px] font-medium transition-colors',
                selected?.game_id === g.game_id
                  ? 'border-lime bg-lime-tint-bg text-lime-text'
                  : 'border-border-default bg-bg-overlay text-text-secondary hover:border-border-strong hover:text-text-primary',
              )}
            >
              {g.game_logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={g.game_logo_url} alt="" className="h-5 w-5 rounded object-cover" />
              )}
              {g.game_name}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
    </SubCard>
  )
}

function PillRow<T extends { value: string; label: string }>({
  options, value, onChange,
}: {
  options: T[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 rounded-full border px-3 text-xs font-medium transition-colors sm:h-8',
              on
                ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 3: dynamic details (with nested sub-fields) ────────────────────────

function Step3Details({
  templateLoading, template, topLevel, childrenOf, values, onChange,
}: {
  templateLoading: boolean
  template: AttributeTemplateFull | null
  topLevel: Attribute[]
  childrenOf: Map<string, Map<string, Attribute[]>>
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
}) {
  // R8 — when there are no admin-defined extra fields for this (game, category),
  // skip the Offer Details sub-card entirely. The seller starts straight at the
  // Title card. Loading state still renders so the UI doesn't flash.
  if (templateLoading) {
    return (
      <SubCard title="Offer Details">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          Loading details…
        </div>
      </SubCard>
    )
  }
  if (!template || topLevel.length === 0) return null

  return (
    <SubCard title="Offer Details">
      <div className="space-y-4">
        {topLevel.map((a) => (
          <FieldCard
            key={a.id}
            attribute={a}
            values={values}
            onChange={onChange}
            childrenOf={childrenOf}
            depth={0}
          />
        ))}
      </div>
    </SubCard>
  )
}

/**
 * FieldCard — renders a single attribute and, if it has children that are
 * revealed by the current value, recursively renders those children
 * indented INSIDE this card.
 */
function FieldCard({
  attribute, values, onChange, childrenOf, depth,
}: {
  attribute: Attribute
  values: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
  childrenOf: Map<string, Map<string, Attribute[]>>
  depth: number
}) {
  if (!isVisible(attribute, values)) return null

  const inner = childrenOf.get(attribute.id)
  const currentValue = values[attribute.id]
  const revealedKids = inner && typeof currentValue === 'string' && currentValue
    ? inner.get(currentValue) ?? []
    : []

  // V19/P20 — Inside the SubCard wrapper, top-level fields are flat rows;
  // nested (depth > 0) fields previously used bg-bg-inset which made them
  // read as a black hole sitting inside the lime rail. Switching to a
  // slightly raised tone (bg-bg-overlay/30) keeps the hierarchy cue
  // without the heavy contrast.
  // Mobile trims the nested shell padding (~18px saved per level) so
  // depth-2 inputs keep a usable width inside a 360px viewport.
  const shell = depth === 0
    ? ''
    : 'rounded-xl border border-border-subtle bg-bg-overlay/30 p-3 sm:p-4'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={shell}
    >
      <FieldInput
        attribute={attribute}
        value={currentValue}
        onChange={(v) => {
          // If the user changes the parent value, drop any descendant values
          // so we don't leave stale data attached to a hidden branch.
          if (inner) {
            const nextValues = { ...values, [attribute.id]: v }
            // Clear any kids that were revealed by the OLD value
            const oldKids = typeof currentValue === 'string' ? inner.get(currentValue) ?? [] : []
            for (const kid of oldKids) {
              delete (nextValues as any)[kid.id]
              // recursively walk further descendants
              walkAndClear(kid, childrenOf, nextValues)
            }
            // Apply: we use onChange repeatedly so the reducer in the parent
            // stays simple. The bulk delete is rare and the list is short.
            Object.entries(nextValues).forEach(([k, val]) => onChange(k, val))
          } else {
            onChange(attribute.id, v)
          }
        }}
      />

      {/* Nested sub-fields (animated) */}
      <AnimatePresence initial={false}>
        {revealedKids.length > 0 && (
          <motion.div
            key="nested"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* V19/P20 — Sub-field group. Lime left rail + a tiny
                eyebrow signal "this group depends on the parent". The
                eyebrow now sits on its own line above the cards with
                a clear breath, not crammed against them. */}
            <div className="mt-4 border-l-2 border-lime-tint-border pl-3 sm:pl-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <span className="text-text-secondary">{attribute.name}:</span>{' '}
                <span className="text-lime-text">{labelFor(attribute, currentValue as string)}</span>
              </div>
              <div className="space-y-3">
                {revealedKids.map((kid) => (
                  <FieldCard
                    key={kid.id}
                    attribute={kid}
                    values={values}
                    onChange={onChange}
                    childrenOf={childrenOf}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function walkAndClear(
  attr: Attribute,
  childrenOf: Map<string, Map<string, Attribute[]>>,
  out: Record<string, unknown>,
) {
  const inner = childrenOf.get(attr.id)
  if (!inner) return
  inner.forEach((kids) => {
    kids.forEach((k) => {
      delete out[k.id]
      walkAndClear(k, childrenOf, out)
    })
  })
}

function labelFor(attr: Attribute, value: string): string {
  if (attr.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  const opt = attr.options?.find((o) => o.value === value)
  return opt?.label ?? value
}

// ─── FieldInput: renders the right control for the attribute type ──────────

function FieldInput({
  attribute, value, onChange,
}: {
  attribute: Attribute
  value: unknown
  onChange: (v: unknown) => void
}) {
  const v = value as any

  // R14 — per-field touched state so required attributes show "required" only
  // after the user has interacted and moved on (not on first paint).
  const [touched, setTouched] = useState(false)
  const isEmpty =
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  const showError = attribute.is_required && touched && isEmpty
  const markTouched = () => setTouched(true)

  return (
    <div>
      <label className="mb-1.5 block">
        <span className="text-[13px] font-medium text-text-secondary">
          {attribute.name}
          {attribute.is_required && <span className="ml-1 text-error">*</span>}
        </span>
      </label>

      {attribute.type === 'text' && (
        <input
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'textarea' && (
        <textarea
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          maxLength={attribute.max_length ?? undefined}
          rows={3}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={cn(inputCls, 'h-auto py-2 sm:h-auto')}
        />
      )}

      {attribute.type === 'number' && (
        <input
          type="number"
          value={v ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
          placeholder={attribute.placeholder ?? ''}
          min={attribute.min_value ?? undefined}
          max={attribute.max_value ?? undefined}
          aria-invalid={showError || undefined}
          aria-required={attribute.is_required || undefined}
          className={inputCls}
        />
      )}

      {attribute.type === 'boolean' && (
        <div className="flex gap-2">
          {['true', 'false'].map((opt) => {
            const on = v === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={cn(
                  'h-10 flex-1 rounded-xl border text-sm font-medium transition-colors',
                  on
                    ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                    : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
                )}
              >
                {opt === 'true' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>
      )}

      {attribute.type === 'select' && (
        <Combobox
          value={typeof v === 'string' ? v : ''}
          onChange={(val) => { onChange(val); markTouched() }}
          onBlur={markTouched}
          invalid={showError}
          placeholder={attribute.placeholder || 'Choose…'}
          ariaLabel={attribute.name}
          options={(attribute.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
            icon_url: o.icon_url,
          }))}
          tone="neutral"
          iconInTrigger
        />
      )}

      {attribute.type === 'multiselect' && (
        <PillRow
          options={(attribute.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          value={Array.isArray(v) && v.length === 1 ? (v as string[])[0] : ''}
          onChange={(val) => {
            const arr = Array.isArray(v) ? (v as string[]) : []
            if (arr.includes(val)) onChange(arr.filter((x) => x !== val))
            else onChange([...arr, val])
          }}
        />
      )}

      {attribute.type === 'image_select' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(attribute.options ?? []).length === 0 ? (
            <p className="col-span-full text-xs text-text-tertiary">No choices yet.</p>
          ) : attribute.options!.map((o) => {
            const on = v === o.value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? '' : o.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors',
                  on
                    ? 'border-lime bg-lime-tint-bg'
                    : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover'
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-bg-raised-hover">
                  {o.icon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-text-disabled" />
                  )}
                </div>
                <span className="line-clamp-1 text-xs text-text-primary">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Required-field error — beats the hint when both would show. */}
      {showError ? (
        <FieldError className="mt-1.5">This field is required.</FieldError>
      ) : (
        attribute.help_text &&
        !(['select', 'multiselect', 'image_select', 'boolean'] as const).includes(attribute.type as any) && (
          <TipBox>{attribute.help_text}</TipBox>
        )
      )}
    </div>
  )
}

// ─── Step 4: publish ────────────────────────────────────────────────────────

interface Step4Props {
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
  // D2 — Price guidance from recently sold listings for this (game,
  // category). NULL until fetch resolves; when sample_size < 3 we still
  // return a row but the p25/median/p75 fields are null.
  priceGuidance: PriceGuidance | null
  // V13 — Category slug drives the field set. For 'currency' we hide
  // Title + Photos (auto-filled server-side) and rename Description to
  // Instructions.
  categorySlug?: string
  /** V13 — Used to label the currency banner ("Roblox Robux — title and image…"). */
  gameName?: string
  gameSlug?: string
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
}

/**
 * V19/P7 — Pick the natural per-unit display for a currency listing:
 *   • granularity=thousand → "K" (Robux, V-Bucks bulk markets)
 *   • granularity=million  → "M" (GTA-money, very high-volume tokens)
 *   • granularity=unit     → the currency's own name ("Robux", "Tokens")
 *
 * Used by Step 4 ("Price per K") and the Stock card suffix. Falling
 * back to "unit" keeps non-currency callers working.
 */
// Shared with the buyer page so a seller's "100 M" is the buyer's "100 M".
const formatPriceSuffix = quantityUnit

/**
 * Step4Publish — the static publish fields, rendered as 5 separate SubCards
 * stacked vertically. Each card has its own labelled title (Title, Description,
 * Photos, Pricing, Stock & Delivery). Sibling spacing between cards comes from
 * the parent's `space-y-5`, so each card breathes equally with the Offer
 * Details card above.
 *
 * Helper text under each input uses the FormDescription pattern:
 *   text-[11px] text-text-tertiary leading-snug, no surface.
 */
function Step4Publish(p: Step4Props) {
  const priceNum = parseFloat(p.price || '0')
  // V19/P24/P7.b — Custom-delivery dialog replaces window.prompt().
  // Local state lives at this scope because the trigger and the
  // submit handler need to reach `p.setDeliveryTime`.
  const discount = p.originalPrice && priceNum > 0
    ? Math.round(((parseFloat(p.originalPrice) - priceNum) / parseFloat(p.originalPrice)) * 100)
    : 0

  // R14 — Touched state for required fields. A field is "touched" once it has
  // received and then lost focus. The error message + red border appear only
  // for touched-and-empty required fields, so the seller isn't yelled at the
  // moment the form first renders.
  const [touched, setTouched] = useState<{
    title?: boolean
    price?: boolean
  }>({})
  const mark = (k: keyof typeof touched) => setTouched((t) => ({ ...t, [k]: true }))

  const titleInvalid = touched.title && !p.title.trim()
  const priceInvalid = touched.price && !(parseFloat(p.price) > 0)

  // V13 — Currency listings skip Title + Photos (auto-filled server-side).
  // The text card is "Description" on every category.
  const isCurrency = p.categorySlug === 'currency'

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Title — hidden for currency */}
      {!isCurrency && (
        <SubCard title="Title">
          <FieldRow>
            <input
              value={p.title}
              onChange={(e) => p.setTitle(e.target.value)}
              onBlur={() => mark('title')}
              // Generic on purpose: the old example was a Steal a Brainrot
              // item, which read as wrong on every other game.
              placeholder="Type here…"
              maxLength={100}
              aria-invalid={titleInvalid || undefined}
              aria-required
              className={inputCls}
            />
            {titleInvalid && <FieldError>Offer title is required.</FieldError>}
            <TipBox>Lead with the words buyers search for. Max 100 characters.</TipBox>
          </FieldRow>
        </SubCard>
      )}

      {/* V19/P24/P7.b — Listing details (platform / region / device)
          moved ABOVE the bundle picker. Each enabled kind renders as
          a tile row with the admin-uploaded logo (when present),
          matching the bundle picker look. Replaces the prior pair of
          shadcn Selects. */}
      {isCurrency && visiblePlatformKinds(p.platformFields).length > 0 && (
        <SubCard title="Listing details">
          <PlatformTileRows
            fields={p.platformFields}
            values={{ region: p.region, platform: p.platform, device: p.device }}
            onChange={(kind, v) => {
              if (kind === 'region') p.onRegion(v)
              else if (kind === 'platform') p.onPlatform(v)
              else if (kind === 'device') p.onDevice(v)
            }}
          />
        </SubCard>
      )}

      {/* V19/P24/P3 — Bundle picker (searchable dropdown with bundle art). */}
      {isCurrency && (p.bundles?.length ?? 0) > 0 && (
        <SubCard title="Bundle">
          {/* V19/P24/P6 — Eager dup banner. When the seller already
              has a listing for the picked bundle+region, surface it
              now so they can edit instead of filling the whole form
              and failing at publish. */}
          {p.existingBundleListingId && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-bg/30 px-4 py-3">
              <p className="text-[12.5px] text-text-secondary">
                <span className="font-semibold text-text-primary">
                  You already list this bundle.
                </span>{' '}
                Update the existing listing instead of creating a duplicate.
              </p>
              <Link
                href={`/sell/edit/${p.existingBundleListingId}`}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-3 py-1.5 text-[12.5px] font-semibold text-lime-text transition-colors hover:bg-lime-tint-bg/80 sm:min-h-0"
              >
                Update it
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          {/* Dropdown with the admin's bundle art beside each name — the
              same control as the game picker. The tile grid showed every
              bundle at once, which on a game with a dozen bundles pushed
              the rest of the form a screen down. `unsorted` keeps the
              admin's sort_order: an A→Z sort would put "1000 V-Bucks"
              before "200 V-Bucks". */}
          <Combobox
            value={p.bundleId ?? ''}
            onChange={(id) => p.onBundleId(id)}
            options={[...(p.bundles ?? [])]
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((b) => ({
                value: b.id,
                label: b.name || '(unnamed bundle)',
                icon_url: b.icon_url ?? null,
              }))}
            unsorted
            placeholder="Choose the bundle you are selling"
            emptyText="No bundles match that search."
            ariaLabel="Choose a bundle"
            tone="neutral"
          iconInTrigger
          />
          <TipBox>Buyers see your listing under this exact bundle.</TipBox>
        </SubCard>
      )}

      {/* Description — one label for every category (was "Instructions" on currency). */}
      <SubCard
        title="Description"
        right={
          <span className="text-xs tabular-nums text-text-tertiary">
            {p.description.length}/{isCurrency ? 1000 : 2000}
          </span>
        }
      >
        <FieldRow>
          <AutoGrowTextarea
            value={p.description}
            onChange={p.setDescription}
            placeholder={isCurrency ? 'Type here…' : 'What’s included, condition, delivery notes, terms…'}
            maxLength={isCurrency ? 1000 : 2000}
            ariaLabel="Description"
          />
          <TipBox>
            {isCurrency
              ? 'Shown to buyers on your offer. Line breaks are allowed.'
              : 'Include condition, delivery method and any terms.'}
          </TipBox>
        </FieldRow>
      </SubCard>

      {/* Photos — hidden for currency (auto-set to currency icon) */}
      {!isCurrency && (
      <SubCard
        title="Photos"
        right={<span className="text-xs text-text-tertiary">{p.images.length}/5</span>}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {p.images.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {/* Remove — always visible on touch (hover-reveal only at sm+),
                  36px hitbox around the 24px visual circle. */}
              <button
                type="button"
                onClick={() => p.onRemoveImage(i)}
                aria-label="Remove photo"
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-error text-text-primary">
                  <IconX className="h-3 w-3" />
                </span>
              </button>
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-bold text-text-inverse">
                  Main
                </span>
              )}
            </div>
          ))}
          {p.images.length < 5 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-default bg-bg-inset transition-colors hover:border-lime hover:bg-bg-raised-hover">
              {p.imageUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-lime-text" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-text-tertiary" />
                  <span className="text-xs text-text-tertiary">Upload</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                disabled={p.imageUploading}
                onChange={(e) => { p.onUpload(e.target.files); e.currentTarget.value = '' }}
                className="hidden"
              />
            </label>
          )}
        </div>
        <TipBox>At least 800px square. Your first photo is the thumbnail.</TipBox>
      </SubCard>
      )}

      {/* V19/P24/P7.b — Old Listing details SubCard removed; moved
          above the Bundle picker as PlatformTileRows. */}

      {/* V19/P24/P7.b — Price + Stock combined into one SubCard.
          Left column = Price, right column = Stock. Min order qty
          dropped (bundle mode never needed it; flexible mode falls
          back to a server-side floor). Fee breakdown removed
          everywhere — buyers pay the listed price, sellers can do
          the math from a separate fees page if needed. */}
      {(() => {
          // Bundle mode is a property of the GAME's currency config (it
          // sells in fixed bundles), not of whether a bundle is picked
          // yet. Keying it off the pick showed "Price per V-Bucks" and a
          // Min Order field until the seller chose a bundle.
          const isBundleMode = isCurrency && (p.bundles?.length ?? 0) > 0
          // V19/P24/P7.c — Bundles ARE the unit, so the seller reads
          // "1 unit" / "1,000 units" instead of "1 V-Bucks". Flexible
          // currencies still use the granularity suffix ("K Tokens"),
          // non-currency listings keep no suffix.
          const suffix = isBundleMode
            ? 'unit'
            : isCurrency
              ? formatPriceSuffix(p.granularity, p.unitLabel)
              : null
          const adminMin = Math.max(1, p.adminMinQuantity ?? 1)
          const stockNow = Number.isFinite(parseInt(p.quantity, 10))
            ? parseInt(p.quantity, 10)
            : 1
          const typedMinNow = parseInt(p.minQuantity, 10)
          const minAboveStock =
            Number.isFinite(typedMinNow) && stockNow > 0 && typedMinNow > stockNow
          const numOr = (raw: string, fallback: number) => {
            const n = parseInt(raw, 10)
            return Number.isFinite(n) ? n : fallback
          }
          return (
            <>
              {/* Quantity first, then Price: how much you have comes before
                  what each unit costs. Separate cards, two decisions; every
                  price helper lives INSIDE the Price card. */}
              <SubCard title="Quantity">
                {isCurrency && !isBundleMode ? (
                  // Stock + minimum: two plain boxes, stock on the left. No
                  // steppers here — at these magnitudes nobody steps by one,
                  // and two stepper rows side by side crowd a phone.
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-text-secondary">
                        Total Stock Available
                      </label>
                      <QuantityInput
                        value={numOr(p.quantity, 1)}
                        onChange={(n) => p.setQuantity(String(n))}
                        min={1}
                        max={10_000_000}
                        suffix={suffix}
                        ariaLabel="Total stock available"
                      />
                    </div>

                    {/* Floor = the per-game admin minimum; ceiling = stock,
                        since a minimum above stock can never sell. */}
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-text-secondary">
                        Minimum Offer Quantity
                      </label>
                      <QuantityInput
                        value={numOr(p.minQuantity, adminMin)}
                        onChange={(n) => p.setMinQuantity(String(n))}
                        min={adminMin}
                        max={Math.max(adminMin, stockNow)}
                        suffix={suffix}
                        ariaLabel="Minimum offer quantity"
                      />
                      {/* No tip: the label explains itself. Only the
                          warning remains, because it reports a problem the
                          seller can't otherwise see (it is fixed on save). */}
                      {minAboveStock && (
                        <FieldHint className="mt-2 text-warning">
                          {`Above your stock. It will be lowered to ${stockNow.toLocaleString()} ${suffix ?? ''} when saved.`.replace('  ', ' ')}
                        </FieldHint>
                      )}
                    </div>
                  </div>
                ) : (
                  // Stock alone (items, accounts, bundles): small counts,
                  // where stepping by one is exactly what a seller does.
                  <StockStepper
                    value={numOr(p.quantity, 1)}
                    onChange={(n) => p.setQuantity(String(n))}
                    suffix={suffix}
                    hint={isBundleMode ? 'Each unit is one bundle you can deliver.' : null}
                  />
                )}
              </SubCard>

              <SubCard title="Price">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-text-secondary">
                    {isBundleMode
                      ? 'Price Per Bundle'
                      : isCurrency && suffix
                        ? `Price Per ${suffix}`
                        : 'Price'}{' '}
                    <span className="text-error">*</span>
                  </label>
                  <div
                    className={cn(
                      'flex h-11 w-full items-center rounded-md border border-border-default bg-transparent transition-colors hover:border-border-strong focus-within:border-text-secondary sm:h-10',
                      priceInvalid && 'border-error hover:border-error focus-within:border-error',
                    )}
                  >
                    <span aria-hidden className="flex shrink-0 items-center pl-3 pr-1 text-sm text-text-tertiary">$</span>
                    {/* text + inputMode="decimal", not type="number": no
                        spinner arrows, no value changing under a scroll
                        wheel, and a decimal keypad on phones. Input is
                        filtered to digits and one point, capped at the
                        precision the price is stored at. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={p.price}
                      onChange={(e) => {
                        const places = isCurrency && !isBundleMode ? 4 : 2
                        const v = e.target.value.replace(',', '.')
                        if (new RegExp(`^\\d*(\\.\\d{0,${places}})?$`).test(v)) p.setPrice(v)
                      }}
                      onBlur={() => mark('price')}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0.00"
                      aria-label="Price in US dollars"
                      aria-invalid={priceInvalid || undefined}
                      aria-required
                      className="h-full min-w-0 flex-1 bg-transparent pr-2 text-base tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none sm:text-sm"
                    />
                    {/* Currency as quiet text inside the field, the same way
                        Stock shows its unit. The old separate near-black
                        slab with its own divider read as a second control
                        bolted onto the input. */}
                    <span className="shrink-0 pr-3 text-sm font-medium text-text-tertiary">USD</span>
                  </div>
                  {priceInvalid && <FieldError>This field is required.</FieldError>}
                  {/* Fee spec §1 — the seller sees their exact commission
                      and estimated net proceeds before publishing. */}
                  {Number(p.price) > 0 && (
                    <p className="text-[12px] text-text-tertiary">
                      You’ll receive{' '}
                      <span className="font-semibold text-lime-text">
                        ${netProceeds(Number(p.price), { categorySlug: p.categorySlug, gameSlug: p.gameSlug }).toFixed(2)}
                      </span>
                      {isBundleMode ? ' per bundle' : isCurrency ? ` per ${suffix}` : ''} after the{' '}
                      {commissionPct({ categorySlug: p.categorySlug, gameSlug: p.gameSlug })}% commission.
                    </p>
                  )}
                </div>

                {/* Top-up original price — the discount badge depends on it. */}
                {p.categorySlug === 'top-up' && (
                  <div className="mt-4 space-y-1.5">
                    <label className="block text-[13px] font-medium text-text-secondary">
                      Original Price{' '}
                      <span className="font-normal normal-case tracking-normal text-text-disabled">
                        (optional)
                      </span>
                    </label>
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={p.originalPrice}
                        onChange={(e) => {
                          const v = e.target.value.replace(',', '.')
                          if (/^\d*(\.\d{0,2})?$/.test(v)) p.setOriginalPrice(v)
                        }}
                        placeholder="0.00"
                        className={cn(inputCls, 'pl-7')}
                      />
                    </div>
                    {discount > 0 && (
                      <FieldHint className="text-success">
                        {discount}% discount badge will show
                      </FieldHint>
                    )}
                  </div>
                )}

                <PriceGuidanceCard
                  guidance={p.priceGuidance}
                  currentPrice={parseFloat(p.price)}
                />

                {!isCurrency && (
                  <TipBox>Competitive prices rank higher in the offer list.</TipBox>
                )}
              </SubCard>
            </>
          )
      })()}

      {/* Delivery time first, then how it is delivered — the seller
          picks the promise before the mechanism. Two cards, per the
          same one-decision-per-panel rule as Price and Quantity. */}
      {/* Instant delivery has no window to choose, so the card itself
          is hidden rather than rendering an empty titled panel. */}
      {p.deliveryMethod === 'manual' && (
      <SubCard title="Delivery Time">
        {(() => {
          // One dropdown instead of a wall of pills. The list is shared
          // with the listings-table bulk editor (SELLER_DELIVERY_WINDOWS),
          // so both surfaces offer exactly the same promises.
          //
          // An existing listing can hold a value we no longer offer
          // (instant, 5min, 20min, an old custom "45min"). Remapping it
          // silently would change a live promise the seller made to
          // buyers, so it is shown as its own "current" option until
          // they choose a new window.
          const offered = SELLER_DELIVERY_WINDOWS.some((w) => w.value === p.deliveryTime)
          return (
            <div className="space-y-2">
              <Select value={p.deliveryTime} onValueChange={(v) => p.setDeliveryTime(v)}>
                <SelectTrigger
                  aria-label="Guaranteed delivery time"
                  className="h-11 text-base sm:h-10 sm:text-sm focus:border-text-secondary focus:ring-0 data-[state=open]:border-text-secondary data-[state=open]:ring-0"
                >
                  <SelectValue placeholder="Choose a delivery time" />
                </SelectTrigger>
                {/* ~5.5 rows visible: the half row at the bottom is the
                    cue that the list scrolls. Rows stay 36px on touch
                    screens and tighten to 32px with a mouse. */}
                <SelectContent className="max-h-[200px]">
                  {!offered && p.deliveryTime && (
                    <SelectItem value={p.deliveryTime} className="sm:py-1.5">
                      {formatDeliveryLabel(p.deliveryTime)} (current)
                    </SelectItem>
                  )}
                  {SELLER_DELIVERY_WINDOWS.map((w) => (
                    <SelectItem key={w.value} value={w.value} className="sm:py-1.5">
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TipBox>The longest you will take. Faster windows rank higher.</TipBox>
            </div>
          )
        })()}
      </SubCard>
      )}

      <SubCard title="Delivery Method">
        <div>
          <RadioGroup
            value={p.deliveryMethod}
            onValueChange={(v) => p.setDeliveryMethod(v as 'manual' | 'instant')}
            className="grid gap-2 sm:grid-cols-2"
          >
            {(['manual', 'instant'] as const).map((m) => {
              const allowed = p.allowedDeliveryModes.includes(m)
              const on = p.deliveryMethod === m
              const Icon = m === 'manual' ? Clock : Zap
              return (
                <label
                  key={m}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                    !allowed && 'cursor-not-allowed opacity-40',
                    on && allowed
                      ? 'border-lime bg-lime-tint-bg'
                      : 'border-border-default bg-bg-inset hover:bg-bg-raised-hover',
                  )}
                >
                  <RadioGroupItem
                    value={m}
                    disabled={!allowed}
                    className="sr-only"
                  />
                  <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-lime-text' : 'text-text-tertiary')} />
                  <div>
                    <div className="text-[13.5px] font-semibold text-text-primary">
                      {m === 'manual' ? 'Manual Delivery' : 'Instant Delivery'}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-snug text-text-tertiary">
                      {m === 'manual' ? 'You deliver within your chosen time window.' : 'Codes and credentials sent automatically.'}
                    </div>
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        </div>

      </SubCard>

    </div>
  )
}

// ─── FieldRow — input + caption + hint vertical stack ───────────────────────

/**
 * FieldRow is the canonical wrapper for "one input with bits below it".
 * Matches the spacing the shadcn FormItem provides (space-y-2) so that when
 * we later swap in react-hook-form via shadcn Form, the visual rhythm
 * doesn't change. Used inside Step3 sub-cards.
 */
function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}

// ─── FieldHint — small dim text under a control. No surface. ────────────────

/**
 * FieldHint — small surface containing dim text under a control.
 * R14: contained in a soft `bg-bg-inset` box with a subtle border so hints
 * no longer "float". Reverses the R7 "no surface" call after seller feedback
 * that bare grey text read as out-of-place.
 */
/**
 * QuantityInput — a plain numeric box for Stock and Minimum order.
 *
 * No +/- steppers: quantities here run from 1 to hundreds of thousands,
 * where stepping by one is useless and the buttons only ate width on a
 * phone. Instead the whole number is selected on focus, so the seller
 * types straight over it ("1K" -> click -> "1" is selected).
 *
 * Selecting in onFocus alone is not enough: Safari/iOS fire a mouseup
 * after focus that collapses the selection back to a caret. The first
 * mouseup after a focus is swallowed so the selection survives.
 *
 * The value is shown with thousands separators while idle and as raw
 * digits while editing; it is clamped to [min, max] on blur. Every
 * keystroke is also reported (unclamped) so a Save pressed mid-edit
 * sees what the seller typed.
 */
function QuantityInput({
  value,
  onChange,
  min,
  max,
  suffix,
  ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  suffix?: string | null
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const swallowMouseUp = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const display = draft ?? value.toLocaleString('en-US')

  return (
    // Number + unit centred together ("1,000 K"), not number-left and
    // unit-right. The input is sized to its digits so the pair centres as
    // one; clicking the empty space either side still focuses the field
    // (and selects the number, via onFocus).
    <div
      onMouseDown={(e) => {
        if (e.target === inputRef.current) return
        e.preventDefault()
        inputRef.current?.focus()
        // Focus came from code, not a click on the input, so there is no
        // input mouseup to swallow.
        swallowMouseUp.current = false
      }}
      className="flex h-11 w-full cursor-text items-center justify-center gap-1.5 rounded-md border border-border-default bg-transparent px-3 transition-colors hover:border-border-strong focus-within:border-text-secondary sm:h-10"
    >
      <input
        ref={inputRef}
        style={{ width: `${Math.max(display.length, 1) + 0.5}ch` }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        onFocus={(e) => {
          const el = e.currentTarget
          swallowMouseUp.current = true
          setDraft(String(value))
          // After React swaps in the raw digits, select them.
          requestAnimationFrame(() => el.select())
        }}
        onMouseUp={(e) => {
          if (swallowMouseUp.current) {
            e.preventDefault()
            swallowMouseUp.current = false
          }
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
          setDraft(digits)
          const n = parseInt(digits, 10)
          if (Number.isFinite(n)) onChange(n)
        }}
        onBlur={() => {
          const n = parseInt(draft ?? '', 10)
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : Math.max(min, value))
          setDraft(null)
          swallowMouseUp.current = false
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-full min-w-0 max-w-full bg-transparent text-center text-base tabular-nums text-text-primary placeholder:text-text-tertiary focus:outline-none sm:text-sm"
      />
      {suffix && (
        <span className="shrink-0 text-sm text-text-tertiary">{suffix}</span>
      )}
    </div>
  )
}

/**
 * AutoGrowTextarea — starts at three lines and grows with the text.
 *
 * The old box was a fixed 176px on desktop even when empty, which made a
 * one-line field look like the main event of the page. Now the resting
 * height matches a short answer, a long one gets the room it needs, and
 * past MAX_HEIGHT it scrolls instead of pushing the form off-screen.
 */
const AUTOGROW_MAX_HEIGHT = 320

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  ariaLabel: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Collapse, then size to content. +2 for the 1px borders, because
    // scrollHeight excludes them and the box is border-box.
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, AUTOGROW_MAX_HEIGHT)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel}
      rows={3}
      className={cn(inputCls, 'h-auto min-h-[88px] resize-none overflow-y-auto py-2.5 leading-relaxed sm:h-auto')}
    />
  )
}

/**
 * StockStepper — the stock field when it stands alone.
 *
 * The − and + are separate square buttons on either side of the box, not
 * fused into it, so each reads as its own control and each gets a full
 * 44px touch target on a phone. The centre box is a QuantityInput, so a
 * seller with 250 units can still click and type instead of pressing +.
 */
const STOCK_MAX = 10_000_000

function StockStepper({
  value,
  onChange,
  suffix,
  hint,
}: {
  value: number
  onChange: (n: number) => void
  suffix?: string | null
  hint?: string | null
}) {
  const step = (d: number) => onChange(Math.min(STOCK_MAX, Math.max(1, value + d)))
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-default text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 sm:h-10 sm:w-10'
  return (
    <div className="flex flex-col items-center">
      <label className="mb-2 block text-[13px] font-medium text-text-secondary">
        Total Stock Available
      </label>
      <div className="flex w-full max-w-xs items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= 1}
          aria-label="Decrease stock"
          className={btn}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <QuantityInput
            value={value}
            onChange={onChange}
            min={1}
            max={STOCK_MAX}
            suffix={suffix}
            ariaLabel="Total stock available"
          />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= STOCK_MAX}
          aria-label="Increase stock"
          className={btn}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {hint && <TipBox className="w-full">{hint}</TipBox>}
    </div>
  )
}

/**
 * TipBox — guidance under a field: a small muted info icon and one line
 * of text, left-aligned, directly under the input. No box and no colour —
 * a tinted panel made every tip compete with the fields for attention.
 * (Distinct from FieldHint, which stays for coloured status text such as
 * the stock warning and the discount confirmation.)
 */
function TipBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // !mt-1.5 (6px): FieldRow spaces children with space-y-2, a sibling
    // selector that outranks a plain mt-*, so without `!` the gap stayed 8px.
    <div className={cn('!mt-1.5 flex items-start gap-1.5 text-left', className)}>
      <InfoOutlinedIcon
        aria-hidden
        sx={{ width: 13, height: 13, color: 'var(--color-text-tertiary)', mt: '2.5px', flexShrink: 0 }}
      />
      <p className="text-[12px] leading-[18px] text-text-tertiary">{children}</p>
    </div>
  )
}

function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        // Plain text, not a pill. With no card or section borders left,
        // a bordered inset box around every helper line became the
        // heaviest thing on the page — louder than the fields it was
        // meant to support.
        'mt-2 text-[12px] leading-snug text-text-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}

/**
 * FieldError — red message shown beneath a touched-but-empty required field.
 * Mirrors FieldHint's shape so the layout doesn't jump when error replaces hint.
 */
function FieldError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-error/40 bg-error-bg px-2.5 py-1.5 text-xs leading-snug text-error',
        className,
      )}
    >
      {children}
    </p>
  )
}

// ─── PolicyBanner — D1 moderation/cap status at the top of Step 3 ───────────

/**
 * D1 — Surfaces the seller's tier, moderation status, and active-listing
 * cap at the top of Step 3 so they know what to expect BEFORE they hit
 * Create Offer. Three states:
 *   1. needs_moderation  → amber  "Your first N listings need review."
 *   2. at_listing_limit  → red    "You're at your cap — pause one first."
 *   3. otherwise         → lime   "Auto-publishing as <Tier>."
 */
/**
 * Action-required states (cap reached, needs moderation) keep a small
 * banner so the seller can't miss them. The default "auto-publishing"
 * case is rendered as a tiny status footer beneath the Create Offer
 * button instead (see `<PolicyStatusFooter/>` below).
 */
function PolicyBanner({ policy }: { policy: SellerPublishPolicy | null }) {
  if (!policy) return null

  if (policy.at_listing_limit) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-bg px-3 py-2.5">
        <IconX className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={3} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-error">
            At your listing cap ({policy.listing_limit}).
          </span>{' '}
          <span className="text-text-secondary">
            Pause one of your existing listings, or level up your tier.
          </span>
        </div>
      </div>
    )
  }

  if (policy.needs_moderation) {
    const remaining = Math.max(
      0,
      policy.pre_moderation_listings - policy.approved_listings,
    )
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-bg px-3 py-2.5">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.5} />
        <div className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-warning">
            New seller — {remaining} review{remaining === 1 ? '' : 's'} left.
          </span>{' '}
          <span className="text-text-secondary">
            Your first {policy.pre_moderation_listings} listings are reviewed by our team before going live.
          </span>
        </div>
      </div>
    )
  }

  // Default ok state is NOT rendered here — see PolicyStatusFooter below.
  return null
}

/**
 * V13 — Tiny status line shown just above the footer Create Offer button.
 * Replaces the big lime "Bronze seller — auto-publishing" panel that
 * dominated the top of Step 3. Pulls weight off the banner area when
 * everything is fine.
 */
function PolicyStatusFooter({ policy }: { policy: SellerPublishPolicy | null }) {
  if (!policy) return null
  if (policy.at_listing_limit || policy.needs_moderation) return null // banner handles these

  const tierLabel = policy.tier.charAt(0).toUpperCase() + policy.tier.slice(1)
  const limitCopy = policy.listing_limit
    ? `${policy.active_count}/${policy.listing_limit} active`
    : `${policy.active_count} active`

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <span>
        Auto-publishing as <span className="font-medium text-text-secondary">{tierLabel}</span>
        <span className="mx-1.5 text-text-disabled">·</span>
        {limitCopy}
      </span>
    </div>
  )
}

// ─── D3 — Buyer-card live preview ──────────────────────────────────────────

/**
 * D3 — Live preview of what the buyer will see in marketplace search. Mirrors
 * the visual structure of `src/components/listing-card.tsx` but operates on
 * raw wizard state (no Listing object required) and renders as a
 * non-interactive `<div>` instead of a `<Link>` — no wishlist button, no
 * navigation. Updates in realtime as the seller fills out the form.
 *
 * We don't reuse ListingCard directly because it expects a full
 * `ListingWithRelations` (seller profile, game record, category record,
 * stable id, etc.) and embeds `<WishlistButton/>` which would call APIs
 * with a placeholder id. The preview here is the same visual shell minus
 * those concerns.
 */
function BuyerCardPreview({
  title, price, originalPrice, images, deliveryTime, deliveryMethod,
  quantity, game, category,
}: {
  title: string
  price: string
  originalPrice: string
  images: string[]
  deliveryTime: string
  deliveryMethod: 'manual' | 'instant'
  quantity: string
  game: SellGameOption
  category: GlobalCategory
}) {
  const primaryImage = images[0] || null
  const priceNum = parseFloat(price)
  const origPriceNum = parseFloat(originalPrice)
  const qtyNum = parseInt(quantity, 10)
  const hasPriceDrop = Number.isFinite(origPriceNum) && origPriceNum > priceNum && priceNum > 0
  const discountPct = hasPriceDrop
    ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100)
    : 0
  const isLowStock = Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 5

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-inset p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Buyer preview
        </div>
        <div className="text-xs text-text-tertiary">Updates live</div>
      </div>

      {/* The card itself — pointer-events-none on the whole thing so nothing
          here is clickable, but we keep hover styles for visual fidelity. */}
      <div className="pointer-events-none mx-auto w-full max-w-xs">
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white/[0.04] backdrop-blur-sm">
          {/* Image area */}
          <div className="relative aspect-[4/3] overflow-hidden bg-bg-overlay">
            {primaryImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={primaryImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl text-text-disabled">
                {game.game_emoji ?? '🎮'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Game chip */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-md">
              {game.game_emoji && <span className="text-xs">{game.game_emoji}</span>}
              <span className="text-[10px] font-medium leading-none text-white/80">{game.game_name}</span>
            </div>

            {/* Stock badge */}
            {isLowStock && (
              <div className="absolute right-2.5 top-2.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-[10px] font-semibold leading-none text-amber-400 backdrop-blur-md">
                {qtyNum} left
              </div>
            )}

            {/* Price */}
            <div className="absolute bottom-2.5 left-2.5 flex flex-col items-start gap-0.5">
              {hasPriceDrop && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] leading-none text-white/50 line-through">
                    ${origPriceNum.toFixed(2)}
                  </span>
                  <span className="rounded bg-green-500/90 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    -{discountPct}%
                  </span>
                </div>
              )}
              <span className="font-mono text-xl font-bold text-white drop-shadow-md">
                {Number.isFinite(priceNum) && priceNum > 0 ? `$${priceNum.toFixed(2)}` : '$—'}
              </span>
            </div>

            {/* Delivery time */}
            {deliveryTime && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md">
                {deliveryMethod === 'instant' ? (
                  <Zap className="h-3 w-3 text-lime-text" />
                ) : (
                  <Clock className="h-3 w-3 text-white/60" />
                )}
                <span className="text-[10px] leading-none text-white/70">{deliveryTime}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-lime-text/80">
              {category.name}
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {title || 'Your offer title appears here'}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── D2 — Price guidance band ──────────────────────────────────────────────

/**
 * Shows a horizontal band representing the p25–p75 range of recent sold
 * prices for this (game, category), with a marker for the seller's current
 * price so they immediately see whether they're above / below market.
 *
 * Hidden until we have a meaningful sample (>= 3 sales in 60 days). When
 * the seller is way above p75 we tag the marker red; below p25 yellow;
 * inside the band lime.
 */
function PriceGuidanceCard({
  guidance, currentPrice,
}: {
  guidance: PriceGuidance | null
  currentPrice: number
}) {
  if (!guidance || guidance.sample_size < 3 || guidance.p25 == null || guidance.p75 == null || guidance.median == null) {
    return null
  }

  const { p25, median, p75, sample_size } = guidance
  // Pad each end so the marker has room when the seller types something
  // wildly off-band; clamp to [0, ∞).
  const span = p75 - p25
  const padded_min = Math.max(0, p25 - span * 0.5)
  const padded_max = p75 + span * 0.5
  const range = Math.max(0.01, padded_max - padded_min)

  const hasValidPrice = Number.isFinite(currentPrice) && currentPrice > 0
  const pricePct = hasValidPrice
    ? Math.min(100, Math.max(0, ((currentPrice - padded_min) / range) * 100))
    : null

  const p25Pct    = ((p25    - padded_min) / range) * 100
  const medianPct = ((median - padded_min) / range) * 100
  const p75Pct    = ((p75    - padded_min) / range) * 100

  const tone: 'good' | 'high' | 'low' | null = hasValidPrice
    ? currentPrice > p75 ? 'high'
    : currentPrice < p25 ? 'low'
    : 'good'
    : null

  const toneCopy =
    tone === 'high' ? `Above market — most sold for $${p25.toFixed(2)}–$${p75.toFixed(2)}.`
    : tone === 'low' ? `Below market — most sold for $${p25.toFixed(2)}–$${p75.toFixed(2)}.`
    : tone === 'good' ? `In the typical range. Median $${median.toFixed(2)}.`
    : `Most recent sales went for $${p25.toFixed(2)}–$${p75.toFixed(2)} (median $${median.toFixed(2)}).`

  const toneClass =
    tone === 'high' ? 'text-error'
    : tone === 'low' ? 'text-warning'
    : tone === 'good' ? 'text-lime-text'
    : 'text-text-secondary'

  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-bg-inset p-3">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        <span>Recent sales</span>
        <span>{sample_size} sold · last 60 days</span>
      </div>

      {/* Band */}
      <div className="relative h-2 w-full rounded-full bg-bg-raised-hover">
        <div
          className="absolute inset-y-0 rounded-full bg-lime/40"
          style={{ left: `${p25Pct}%`, width: `${Math.max(0, p75Pct - p25Pct)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-lime-text"
          style={{ left: `${medianPct}%` }}
          aria-hidden
        />
        {pricePct !== null && (
          <div
            className={cn(
              'absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full',
              tone === 'high' && 'bg-error',
              tone === 'low'  && 'bg-warning',
              tone === 'good' && 'bg-lime',
            )}
            style={{ left: `${pricePct}%` }}
            aria-hidden
          />
        )}
      </div>

      {/* Labels */}
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-text-tertiary">
        <span>${p25.toFixed(2)}</span>
        <span>median ${median.toFixed(2)}</span>
        <span>${p75.toFixed(2)}</span>
      </div>

      <p className={cn('mt-2 text-xs leading-snug', toneClass)}>{toneCopy}</p>
    </div>
  )
}

// ─── TermsCard — final sub-card on Step 3; gates the Create Offer button ────

/**
 * Two checkboxes the seller must tick to enable Create Offer:
 *   - Seller Rules (community standards / what can be listed)
 *   - Terms of Service (platform-wide ToS)
 *
 * Uses the existing shadcn Checkbox (themed to lime in R8). The Create Offer
 * button is gated on (canPublish && agreeSellerRules && agreeTos) — the
 * parent SellWizard reads these two booleans into its canPublish check.
 */
function TermsCard({
  agreeSellerRules, setAgreeSellerRules, agreeTos, setAgreeTos,
}: {
  agreeSellerRules: boolean; setAgreeSellerRules: (v: boolean) => void
  agreeTos: boolean; setAgreeTos: (v: boolean) => void
}) {
  return (
    <SubCard title="Confirm">
      <ul className="space-y-3">
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeSellerRules}
              onCheckedChange={(v) => setAgreeSellerRules(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Seller Rules"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/seller-rules"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Seller Rules
              </a>
              .
            </span>
          </label>
        </li>
        <li>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreeTos}
              onCheckedChange={(v) => setAgreeTos(v === true)}
              className="mt-0.5"
              aria-label="I agree to the Terms of Service"
            />
            <span className="text-sm text-text-primary">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-text underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
              .
            </span>
          </label>
        </li>
      </ul>
    </SubCard>
  )
}

// ─── SubCard — one labelled section of the Details step ────────────────────

/**
 * SubCard wraps a labelled section of the Details step.
 *
 * Despite the name it is not a card: the focused-canvas layout dropped
 * the wizard's outer panel, and a bordered section inside a borderless
 * page just reintroduces the nesting. It renders a heading, a hairline,
 * and the section's fields; spacing does the grouping.
 */
function SubCard({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Each section is its own panel: a title bar, a hairline, then the
    // fields. Rectangular (rounded-lg, not a pill) per the house card
    // language. The divider is the only line inside the panel, so the
    // title reads as a header rather than another field label.
    <section className="scroll-mt-28 overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay">
      {/* Compact title bar: the divider sits just under the title so the
          bar reads as a label for the panel, not a section of its own. */}
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border-subtle px-4 py-2 sm:px-5">
        <h2 className="text-[14.5px] font-bold leading-tight tracking-tight text-text-primary">
          {title}
        </h2>
        {right}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}

// ─── PlatformTileRows — seller-side tile picker for Listing details ─────────
//
// V19/P24/P7.b — Replaces the prior PlatformFieldsBlock dropdowns. Each
// enabled kind (region / platform / device) renders as a single row of
// tile chips. Platform tiles show the admin-uploaded logo when one is
// set; region/device tiles stay text-only (admin doesn't upload icons
// for those). Picking a tile sets the value; the publish gate stays in
// canPublish, no change there.

const TILE_KIND_LABELS: Record<PlatformFieldKind, string> = {
  region: 'Region',
  platform: 'Platform',
  device: 'Device',
}

function PlatformTileRows({
  fields,
  values,
  onChange,
}: {
  fields: PlatformFields | null | undefined
  values: Record<PlatformFieldKind, string>
  onChange: (kind: PlatformFieldKind, v: string) => void
}) {
  const visible = visiblePlatformKinds(fields)
  if (visible.length === 0) return null

  return (
    <div className="space-y-4">
      {visible.map((kind) => {
        const options = normalizePlatformOptions(fields?.[kind]?.options)
        const value = values[kind]
        return (
          <div key={kind} className="space-y-2">
            <label className="block text-[13px] font-medium text-text-secondary">
              {TILE_KIND_LABELS[kind]} <span className="text-error">*</span>
            </label>
            <RadioGroup
              value={value || undefined}
              onValueChange={(v) => onChange(kind, v)}
              className="flex flex-wrap gap-2"
            >
              {options.map((opt) => {
                const on = value === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      // Compact translucent chips that sit ON the card
                      // rather than solid black boxes inside it. Rectangular
                      // (rounded-md) like every other control on the form.
                      'relative flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-semibold transition-colors',
                      'has-[:focus-visible]:border-text-secondary',
                      on
                        ? 'border-lime bg-lime-tint-bg text-lime-text'
                        : 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-text-primary',
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    {kind === 'platform' && opt.icon_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={opt.icon_url}
                        alt=""
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                    ) : null}
                    <span className="uppercase tracking-wide">{opt.value}</span>
                  </label>
                )
              })}
            </RadioGroup>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared input styles ─────────────────────────────────────────────────────

// R14 — reverted to rounded-md from R12's rounded-none after seller feedback
// that the sharp corners felt severe. Still transparent over the sub-card
// surface; border defines the field. Focus lightens the border to near-white
// (no lime glow ring) — lime is reserved for selection and the primary CTA,
// and a lime ring on every field made the form read as all-accent.
// Mobile uses text-base (16px) so iOS Safari doesn't auto-zoom the page on
// focus (14px inputs trigger the zoom + horizontal panning); sm+ keeps text-sm.
// Wizard buttons — one system for Back, Bulk upload, Continue, Create
// Offer and the go-back dialog. Rectangular (rounded-md) like the inputs,
// one height, no glow. `border` on every variant (transparent where not
// visible) so primary and secondary are exactly the same box size.
const BTN_BASE =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none sm:h-10 sm:px-5'
const BTN_PRIMARY = cn(BTN_BASE, 'border-transparent bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed')
const BTN_SECONDARY = cn(BTN_BASE, 'border-border-default bg-bg-overlay text-text-secondary hover:border-border-strong hover:text-text-primary')
const BTN_PRIMARY_DISABLED = cn(BTN_BASE, 'cursor-not-allowed border-border-subtle bg-bg-overlay text-text-disabled')
const BTN_DANGER = cn(BTN_BASE, 'border-transparent bg-error text-white hover:opacity-90')

const inputCls =
  'h-11 w-full rounded-md border border-border-default bg-transparent px-3 text-base sm:h-10 sm:text-sm text-text-primary placeholder:text-text-tertiary hover:border-border-strong focus:border-text-secondary focus:outline-none transition-colors aria-[invalid=true]:border-error aria-[invalid=true]:focus:border-error'
