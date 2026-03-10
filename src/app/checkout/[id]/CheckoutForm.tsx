'use client'

/**
 * UI.6 — Checkout Redesign
 *
 * Redesigned as a 2-step wizard:
 *   Step 1 — Review: listing preview, VaultShield tier, quantity, promo code
 *   Step 2 — Payment: Stripe PaymentElement, guest/login, terms, submit
 *
 * Sticky order summary sidebar visible on both steps (lg+).
 * All existing state/logic from P4.1 + P5.2 + P5.3 preserved exactly.
 */

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { createPaymentIntent } from '@/lib/actions/stripe-payment'
import type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'
import { createOrder } from '@/lib/actions/orders'
import { validatePromoCode } from '@/lib/actions/promo'
import type { PromoValidationResult } from '@/lib/actions/promo'
import { getWalletBalance } from '@/lib/actions/wallet'
import type { WalletBalance } from '@/lib/actions/wallet'
import { useRouter } from 'next/navigation'
import {
  Shield, Star, Award, Check, Loader2, AlertCircle,
  Lock, CheckCircle2, Tag, X, ChevronRight, ChevronLeft,
  Zap, CreditCard, ShieldCheck, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Tier config ────────────────────────────────────────────────────────────

interface TierConfig {
  id:       VaultShieldTier
  name:     string
  feeRate:  number
  warranty: string
  icon:     React.ElementType
  color:    string
  border:   string
  selectedBg: string
  badge?:   string
  features: string[]
}

const TIERS: TierConfig[] = [
  {
    id:         'standard',
    name:       'Standard',
    feeRate:    0,
    warranty:   '48h protection',
    icon:       Shield,
    color:      'text-slate-300',
    border:     'border-slate-500/30',
    selectedBg: 'bg-slate-500/10',
    features: [
      '48-hour buyer protection',
      'Escrow payment hold',
      'Dispute resolution',
      'Email support',
    ],
  },
  {
    id:         'enhanced',
    name:       'Enhanced',
    feeRate:    2,
    warranty:   '7-day warranty',
    icon:       Star,
    color:      'text-violet-300',
    border:     'border-violet-500/40',
    selectedBg: 'bg-violet-500/10',
    badge:      'Most Popular',
    features: [
      'Everything in Standard',
      '7-day extended warranty',
      'Priority dispute resolution',
      'Dedicated support agent',
    ],
  },
  {
    id:         'premium',
    name:       'Premium',
    feeRate:    5,
    warranty:   '30-day warranty',
    icon:       Award,
    color:      'text-amber-300',
    border:     'border-amber-500/40',
    selectedBg: 'bg-amber-500/10',
    features: [
      'Everything in Enhanced',
      '30-day extended warranty',
      '24/7 VIP support',
      'Full refund guarantee',
    ],
  },
]

// ── Order summary sidebar ──────────────────────────────────────────────────

function OrderSummary({
  listing, quantity, subtotal, platformFeeRate, platformFee,
  paymentProcessingFee, selectedTier, tierFeeAmount, promoDiscount,
  appliedCode, promoResult, walletAmount, total, user, walletBalance,
  useWallet, setUseWallet,
}: {
  listing: any; quantity: number; subtotal: number; platformFeeRate: number
  platformFee: number; paymentProcessingFee: number; selectedTier: TierConfig
  tierFeeAmount: number; promoDiscount: number; appliedCode: string | undefined
  promoResult: PromoValidationResult | null; walletAmount: number; total: number
  user: any; walletBalance: number; useWallet: boolean
  setUseWallet: (value: boolean) => void
}) {
  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Listing preview */}
      <div className="p-5 border-b border-white/[0.06]">
        {/* Game logo + name (small, on top) */}
        <div className="flex items-center gap-2 mb-3">
          <img
            src={listing.game?.image_url || '/placeholder-game.jpg'}
            alt={listing.game?.name || 'Game'}
            className="h-6 w-6 rounded object-cover ring-1 ring-white/10 flex-shrink-0"
          />
          <p className="text-sm text-white/60">{listing.game?.name}</p>
        </div>

        {/* Listing image + title (large, below) */}
        <div className="flex gap-3">
          <img
            src={listing.images?.[0] || '/placeholder-game.jpg'}
            alt={listing.title}
            className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{listing.title}</p>
            <p className="text-xs text-white/40 mt-1">by @{listing.seller?.username}</p>
            {quantity > 1 && (
              <p className="text-xs text-white/30 mt-0.5">Qty: {quantity}</p>
            )}
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="p-5 space-y-2.5 text-sm">
        <div className="flex justify-between text-white/50">
          <span>Subtotal</span>
          <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Platform fee ({platformFeeRate.toFixed(1)}%)</span>
          <span>${platformFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Processing (3.5%)</span>
          <span>${paymentProcessingFee.toFixed(2)}</span>
        </div>
        {selectedTier.feeRate > 0 && (
          <div className="flex justify-between text-violet-300/80">
            <span>VaultShield {selectedTier.name} (+{selectedTier.feeRate}%)</span>
            <span>+${tierFeeAmount.toFixed(2)}</span>
          </div>
        )}
        {promoDiscount > 0 && (
          <div className="flex justify-between text-green-400">
            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{appliedCode}</span>
            <span>-${promoDiscount.toFixed(2)}</span>
          </div>
        )}
        {walletAmount > 0 && (
          <div className="flex justify-between text-emerald-400">
            <span className="flex items-center gap-1"><Wallet className="w-3 h-3" />Wallet Balance</span>
            <span>-${walletAmount.toFixed(2)}</span>
          </div>
        )}

        {/* Wallet Balance Button - Compact */}
        {user && (
          <div className="pt-3 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={() => walletBalance > 0 && setUseWallet(!useWallet)}
              disabled={walletBalance === 0}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 flex items-center justify-between transition-all text-left",
                walletBalance > 0
                  ? useWallet
                    ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
                    : "bg-[#0a0a0a] border-white/[0.08] hover:border-emerald-500/20"
                  : "bg-white/5 border-white/10 cursor-not-allowed opacity-60"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className={cn(
                  "w-4 h-4 flex-shrink-0",
                  walletBalance > 0 ? "text-emerald-400" : "text-white/30"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    walletBalance > 0 ? "text-white" : "text-white/40"
                  )}>
                    Wallet: ${walletBalance.toFixed(2)}
                  </div>
                  <div className="text-xs text-white/40">
                    {walletBalance > 0
                      ? (useWallet ? `Applying $${walletAmount.toFixed(2)}` : 'Click to use balance')
                      : 'Earn cashback'}
                  </div>
                </div>
              </div>
              {walletBalance > 0 && (
                <div className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                  useWallet ? "bg-emerald-500" : "bg-white/20"
                )}>
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      useWallet ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-3 border-t border-white/[0.07]">
          <span className="font-semibold text-white">Total</span>
          <span className="text-2xl font-bold text-white">${total.toFixed(2)}</span>
        </div>

        {/* Cashback */}
        <div className="flex items-center justify-between rounded-lg bg-green-500/8 border border-green-500/15 px-3 py-2">
          <span className="text-xs text-green-400/80">Earn cashback</span>
          <span className="text-xs font-semibold text-green-400">+${(subtotal * 0.02).toFixed(2)}</span>
        </div>
      </div>

      {/* Active tier summary */}
      <div className={`px-5 py-3 border-t border-white/[0.06] flex items-center gap-2.5 ${selectedTier.selectedBg}`}>
        {(() => { const Icon = selectedTier.icon; return <Icon className={cn('w-3.5 h-3.5', selectedTier.color)} /> })()}
        <span className="text-xs text-white/70">
          VaultShield™ {selectedTier.name} · {selectedTier.warranty}
        </span>
      </div>

      {/* Trust badges */}
      <div className="px-5 py-4 border-t border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Lock className="w-3 h-3" /> SSL encrypted
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <ShieldCheck className="w-3 h-3" /> Escrow protected
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Zap className="w-3 h-3" /> Instant delivery
        </div>
      </div>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {[
        { n: 1, label: 'Review Order' },
        { n: 2, label: 'Payment' },
      ].map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2">
          {i > 0 && <div className={`h-px w-8 transition-colors ${step >= n ? 'bg-violet-500' : 'bg-white/10'}`} />}
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              step > n  ? 'bg-violet-500 text-white' :
              step === n ? 'bg-violet-500/20 border border-violet-500/60 text-violet-300' :
              'bg-white/5 border border-white/10 text-white/30'
            )}>
              {step > n ? <Check className="w-3 h-3" /> : n}
            </div>
            <span className={cn('text-sm font-medium hidden sm:block transition-colors',
              step === n ? 'text-white' : 'text-white/30'
            )}>
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── CheckoutForm (outer — manages state, initializes Stripe) ───────────────

interface CheckoutFormProps {
  listing: any
  user:    any
}

export function CheckoutForm({ listing, user }: CheckoutFormProps) {
  const [step,            setStep]            = useState<1 | 2>(1)
  const [clientSecret,    setClientSecret]    = useState<string | null>(null)
  const [quantity,        setQuantity]        = useState(1)
  const [vaultshieldTier, setVaultshieldTier] = useState<VaultShieldTier>('standard')
  const [platformFeeRate, setPlatformFeeRate] = useState<number>(9.9)
  const [tierFee,         setTierFee]         = useState<number>(0)
  const [loading,         setLoading]         = useState(false)

  // P5.3 — Promo code state
  const [promoInput,      setPromoInput]      = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult,     setPromoResult]     = useState<PromoValidationResult | null>(null)
  const promoDiscount = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0
  const promoCodeId   = promoResult?.valid ? promoResult.promoCodeId : undefined
  const appliedCode   = promoResult?.valid ? promoResult.code : undefined

  // Wallet balance state
  const [walletBalance,   setWalletBalance]   = useState<number>(0)
  const [useWallet,       setUseWallet]       = useState(false)
  const [walletLoading,   setWalletLoading]   = useState(false)

  const subtotal             = listing.price * quantity
  const platformFee          = subtotal * (platformFeeRate / 100)
  const paymentProcessingFee = subtotal * 0.035
  const selectedTier         = TIERS.find((t) => t.id === vaultshieldTier)!
  const tierFeeAmount        = subtotal * (selectedTier.feeRate / 100)
  const totalBeforeWallet    = subtotal + platformFee + paymentProcessingFee + tierFeeAmount - promoDiscount
  const walletAmount         = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0
  const total                = Math.max(totalBeforeWallet - walletAmount, 0)

  // Fetch wallet balance on mount (only for authenticated users)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchWallet() {
      setWalletLoading(true)
      const result = await getWalletBalance()
      if (cancelled) return
      if (result.success && result.balance) {
        setWalletBalance(result.balance.available_balance)
      }
      setWalletLoading(false)
    }
    fetchWallet()
    return () => { cancelled = true }
  }, [user])

  // Re-initialize payment intent when quantity, tier, promo discount, or wallet changes
  useEffect(() => {
    let cancelled = false
    async function initialize() {
      setLoading(true)
      setClientSecret(null)
      const result = await createPaymentIntent(
        listing.id,
        quantity,
        vaultshieldTier,
        promoDiscount,
        true,  // skipRateLimit - only rate limit on final payment
        walletAmount
      )
      if (cancelled) return
      if (result.success && result.clientSecret) {
        setClientSecret(result.clientSecret)
        if (result.platformFeeRate !== undefined) setPlatformFeeRate(result.platformFeeRate)
        if (result.tierFee         !== undefined) setTierFee(result.tierFee)
      } else {
        toast.error(result.error || 'Failed to initialize checkout')
      }
      setLoading(false)
    }
    initialize()
    return () => { cancelled = true }
  }, [listing.id, quantity, vaultshieldTier, promoDiscount, walletAmount])

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoValidating(true)
    const result = await validatePromoCode(promoInput, subtotal)
    setPromoResult(result)
    setPromoValidating(false)
    if (result.valid) {
      toast.success(`Promo applied: ${result.description}`)
    } else {
      toast.error(result.error || 'Invalid promo code')
    }
  }

  const handleRemovePromo = () => { setPromoInput(''); setPromoResult(null) }

  const summaryProps = {
    listing, quantity, subtotal, platformFeeRate, platformFee,
    paymentProcessingFee, selectedTier, tierFeeAmount, promoDiscount,
    appliedCode, promoResult, walletAmount, total, user, walletBalance,
    useWallet, setUseWallet,
  }

  return (
    <div>
      <StepIndicator step={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">

        {/* ── Left / Main column ─────────────────────────────────────────── */}
        <div>
          <AnimatePresence mode="wait">

            {/* ── STEP 1 — Review ─────────────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Listing hero */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                  <div className="p-5">
                    {/* Game info (small logo + name) */}
                    <div className="flex items-center gap-2 mb-3">
                      <img
                        src={listing.game?.image_url || '/placeholder-game.jpg'}
                        alt={listing.game?.name || 'Game'}
                        className="h-6 w-6 rounded object-cover ring-1 ring-white/10 flex-shrink-0"
                      />
                      <p className="text-sm text-white/60">{listing.game?.name}</p>
                    </div>

                    {/* Listing info (large image + title) */}
                    <div className="flex gap-4">
                      <img
                        src={listing.images?.[0] || '/placeholder-game.jpg'}
                        alt={listing.title}
                        className="h-24 w-24 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-white leading-tight line-clamp-2 mb-1">{listing.title}</p>
                        <p className="text-sm text-violet-400 mb-3">Sold by @{listing.seller?.username}</p>

                        {/* Quantity selector */}
                        {!listing.is_unlimited && listing.quantity > 1 && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-white/40">Qty</label>
                            <select
                              value={quantity}
                              onChange={(e) => setQuantity(parseInt(e.target.value))}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white focus:border-violet-500 focus:outline-none"
                            >
                              {Array.from({ length: Math.min(listing.quantity, 10) }, (_, i) => i + 1).map((i) => (
                                <option key={i} value={i}>{i}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-white">${subtotal.toFixed(2)}</p>
                        {quantity > 1 && (
                          <p className="text-xs text-white/30">${listing.price.toFixed(2)} each</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VaultShield tier selector */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">VaultShield™ Protection</h2>
                      <p className="text-xs text-white/40">Choose your buyer protection level</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {TIERS.map((tier) => {
                      const Icon     = tier.icon
                      const selected = vaultshieldTier === tier.id
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setVaultshieldTier(tier.id)}
                          className={cn(
                            'relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-150',
                            selected
                              ? `${tier.border} ${tier.selectedBg}`
                              : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]',
                          )}
                        >
                          {tier.badge && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-violet-500 text-white text-[10px] font-bold whitespace-nowrap">
                              {tier.badge}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('w-4 h-4', tier.color)} />
                            <span className="text-sm font-semibold text-white">{tier.name}</span>
                            {selected && <CheckCircle2 className={cn('w-3.5 h-3.5 ml-auto', tier.color)} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">
                              {tier.feeRate === 0 ? 'Free' : `+${tier.feeRate}%`}
                            </p>
                            {tier.feeRate > 0 && (
                              <p className="text-[11px] text-white/40">+${(subtotal * tier.feeRate / 100).toFixed(2)}</p>
                            )}
                          </div>
                          <p className="text-[11px] text-white/50">{tier.warranty}</p>
                          <AnimatePresence>
                            {selected && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="text-[10px] text-white/60 leading-relaxed">
                                  {tier.features.join(' • ')}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Promo code */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-white/50" />
                    Promo Code
                  </h2>
                  {appliedCode ? (
                    <div className="flex items-center justify-between rounded-xl bg-violet-500/10 border border-violet-500/25 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-violet-400" />
                        <div>
                          <span className="text-sm font-bold text-violet-300 tracking-widest">{appliedCode}</span>
                          <p className="text-xs text-violet-400/70">{promoResult?.description}</p>
                        </div>
                      </div>
                      <button type="button" onClick={handleRemovePromo} className="text-white/30 hover:text-white/60 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                        placeholder="Enter promo code"
                        className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white
                                   placeholder:text-white/20 uppercase tracking-widest focus:border-violet-500/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={!promoInput.trim() || promoValidating}
                        className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white transition-colors flex items-center gap-1.5"
                      >
                        {promoValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                  )}
                </div>


                {/* Continue to payment */}
                <button
                  type="button"
                  onClick={() => {
                    setStep(2)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={loading || !clientSecret}
                  className={cn(
                    'w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold text-white transition-all',
                    loading || !clientSecret
                      ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.25)]'
                  )}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Preparing checkout…</>
                  ) : (
                    <><CreditCard className="w-5 h-5" /> Continue to Payment <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </motion.div>
            )}

            {/* ── STEP 2 — Payment ─────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to review
                </button>

                {!loading && clientSecret ? (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: 'night',
                        variables: {
                          colorPrimary:    '#8b5cf6',
                          colorBackground: '#0a0a0a',
                          colorText:       '#ffffff',
                          colorDanger:     '#ef4444',
                          fontFamily:      'system-ui, sans-serif',
                          borderRadius:    '10px',
                          spacingUnit:     '4px',
                        },
                        rules: {
                          '.Input': {
                            border: '1px solid rgba(255,255,255,0.08)',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                          },
                        },
                      },
                    }}
                  >
                    <PaymentForm
                      listing={listing}
                      user={user}
                      quantity={quantity}
                      total={total}
                      vaultshieldTier={vaultshieldTier}
                      promoCodeId={promoCodeId}
                      promoDiscount={promoDiscount}
                    />
                  </Elements>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-10 flex items-center justify-center min-h-[200px]">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
                      <p className="text-sm text-white/40">Loading payment form…</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right / Summary sidebar (sticky on lg) ─────────────────────── */}
        <div className="lg:sticky lg:top-6 self-start">
          <OrderSummary {...summaryProps} />
        </div>
      </div>
    </div>
  )
}

// ── PaymentForm (inner — inside Elements context) ──────────────────────────

function PaymentForm({
  listing, user, quantity, total, vaultshieldTier, promoCodeId, promoDiscount,
}: {
  listing:         any; user: any; quantity: number; total: number
  vaultshieldTier: VaultShieldTier; promoCodeId?: string; promoDiscount?: number
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const router   = useRouter()

  const [isProcessing,    setIsProcessing]    = useState(false)
  const [termsAccepted,   setTermsAccepted]   = useState(false)
  const [escrowAccepted,  setEscrowAccepted]  = useState(false)
  const [errorMessage,    setErrorMessage]    = useState<string | null>(null)
  const [isGuestCheckout, setIsGuestCheckout] = useState(!user)
  const [guestEmail,      setGuestEmail]      = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    if (!termsAccepted || !escrowAccepted) { toast.error('Please accept all required terms'); return }
    if (isGuestCheckout && !guestEmail) { toast.error('Please enter your email address'); return }
    if (isGuestCheckout && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      toast.error('Please enter a valid email address'); return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })
      if (error) {
        setErrorMessage(error.message || 'Payment failed')
        toast.error(error.message || 'Payment failed')
        setIsProcessing(false)
        return
      }
      if (paymentIntent?.status === 'succeeded') {
        const orderResult = await createOrder({
          paymentIntentId: paymentIntent.id,
          listingId:       listing.id,
          quantity,
          vaultshieldTier,
          isGuest:         isGuestCheckout,
          guestEmail:      isGuestCheckout ? guestEmail : undefined,
          promoCodeId,
          promoDiscount,
        })
        if (orderResult.success) {
          toast.success('Payment successful! Redirecting to your order...')
          router.push(`/orders/${orderResult.orderId}`)
        } else {
          setErrorMessage(orderResult.error || 'Failed to create order')
          toast.error(orderResult.error || 'Failed to create order')
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred')
      toast.error(err.message || 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const canSubmit = !!stripe && !isProcessing && termsAccepted && escrowAccepted &&
    (user || (isGuestCheckout && !!guestEmail))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Guest / Login — only for unauthenticated */}
      {!user && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Checkout As</h2>
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-3 p-3 rounded-xl border border-white/[0.07] hover:bg-white/[0.03] transition-colors">
              <input type="radio" checked={isGuestCheckout} onChange={() => setIsGuestCheckout(true)} className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-sm font-semibold text-white">Continue as Guest</p>
                <p className="text-xs text-white/40">Quick checkout with email only</p>
              </div>
            </label>
            <AnimatePresence>
              {isGuestCheckout && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-7 overflow-hidden">
                  <input
                    type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="your@email.com" required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-violet-500/50 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-white/30">Order confirmation will be sent here</p>
                </motion.div>
              )}
            </AnimatePresence>

            <label className="flex cursor-pointer items-center gap-3 p-3 rounded-xl border border-white/[0.07] hover:bg-white/[0.03] transition-colors">
              <input type="radio" checked={!isGuestCheckout} onChange={() => setIsGuestCheckout(false)} className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-sm font-semibold text-white">Login to Account</p>
                <p className="text-xs text-white/40">Access loyalty rewards & order history</p>
              </div>
            </label>
            <AnimatePresence>
              {!isGuestCheckout && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-7 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => router.push('/login?redirect=' + encodeURIComponent(window.location.pathname))}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    Go to Login
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Stripe PaymentElement */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
        <h2 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white/50" />
          Payment Information
        </h2>
        <PaymentElement />
      </div>

      {/* Terms */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white mb-1">Terms & Agreements</h2>
        {[
          {
            state: termsAccepted, set: setTermsAccepted,
            label: <>I agree to the <a href="/terms" target="_blank" className="text-violet-400 hover:underline">Terms of Service</a> and <a href="/refund-policy" target="_blank" className="text-violet-400 hover:underline">Refund Policy</a></>,
          },
          {
            state: escrowAccepted, set: setEscrowAccepted,
            label: <>I understand my payment is held in VaultShield™ escrow until delivery is confirmed</>,
          },
        ].map((item, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
            <input
              type="checkbox" checked={item.state} onChange={(e) => item.set(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 text-violet-500 accent-violet-500"
            />
            <span className="text-sm text-white/60">{item.label}</span>
          </label>
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-red-500/25 bg-red-500/8 p-4 flex items-start gap-3"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">Payment Error</p>
              <p className="mt-0.5 text-sm text-red-300/80">{errorMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          'flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-base font-bold text-white transition-all',
          canSubmit
            ? 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 shadow-[0_0_30px_rgba(6,182,212,0.2),0_0_50px_rgba(139,92,246,0.15)] hover:scale-[1.01]'
            : 'cursor-not-allowed bg-white/5 border border-white/10 text-white/30',
        )}
      >
        {isProcessing ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
        ) : (
          <><Lock className="h-5 w-5" /> Complete Purchase — ${total.toFixed(2)}</>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-white/25">
        <Shield className="h-3.5 w-3.5" />
        <span>Secured by Stripe · Protected by VaultShield™</span>
      </div>
    </form>
  )
}
