'use client'

/**
 * /listings/[id] — buyer-facing listing detail.
 *
 * V2 reskin: GV tokens, lime accent for primary actions, NumberField for
 * quantity, Tabs for description / delivery / seller, Tooltip for tier
 * badges, GlassCard for the trust block. Lazy image gallery with
 * thumbnail dock.
 */

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Star, Eye, ShoppingCart, Shield, Zap, ArrowLeft, Infinity,
  Clock, Award, ShieldCheck, Crown, Gem, Sparkles, type LucideIcon,
  CheckCircle2, MessageSquare, Flag, TrendingDown,
} from 'lucide-react'
import { getListing } from '@/lib/api/listings'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { NumberField } from '@/components/ui/number-field'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Tier visuals — mirror navbar-floating so badges feel cohesive.
const TIER_CONFIG: Record<string, { Icon: LucideIcon; label: string; cls: string }> = {
  unverified: { Icon: Shield,      label: 'Unverified', cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
  bronze:     { Icon: Award,       label: 'Bronze',     cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  silver:     { Icon: ShieldCheck, label: 'Silver',     cls: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  gold:       { Icon: Crown,       label: 'Gold',       cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  platinum:   { Icon: Gem,         label: 'Platinum',   cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  diamond:    { Icon: Sparkles,    label: 'Diamond',    cls: 'text-lime-text bg-lime/10 border-lime-tint-border' },
}

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['listing', params.id],
    queryFn: () => getListing(params.id as string),
  })

  const listing = data?.data

  const hasPriceDrop = useMemo(() => {
    if (!listing) return false
    return listing.original_price != null && listing.original_price > listing.price
  }, [listing])

  const discountPct = useMemo(() => {
    if (!listing || !hasPriceDrop) return 0
    return Math.round(((listing.original_price! - listing.price) / listing.original_price!) * 100)
  }, [listing, hasPriceDrop])

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:pt-32">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <div className="aspect-square animate-pulse rounded-2xl bg-bg-raised" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-md bg-bg-raised" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-7 w-3/4 animate-pulse rounded-md bg-bg-raised" />
            <div className="h-5 w-1/2 animate-pulse rounded-md bg-bg-raised" />
            <div className="h-12 w-40 animate-pulse rounded-md bg-bg-raised" />
            <div className="h-32 animate-pulse rounded-xl bg-bg-raised" />
          </div>
        </div>
      </main>
    )
  }

  if (error || !listing) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-24 sm:pt-28 lg:pt-32">
        <div className="rounded-2xl border border-error/40 bg-error-bg p-6 text-center">
          <h1 className="text-lg font-bold text-error">Listing not found</h1>
          <p className="mt-1 text-sm text-text-secondary">
            This listing may have been removed or is no longer available.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md border border-border-default bg-bg-raised px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to browse
          </Link>
        </div>
      </main>
    )
  }

  const images = listing.images?.length ? listing.images : ['/placeholder-listing.png']
  const primaryImage = images[activeImage] ?? images[0]
  const isOwnListing = user?.id === listing.seller_id
  const maxQuantity = listing.is_unlimited ? 99 : listing.quantity
  const isSoldOut = !listing.is_unlimited && listing.quantity === 0
  const isLowStock = !listing.is_unlimited && listing.quantity > 0 && listing.quantity <= 5

  const tierKey = (listing.seller.seller_tier ?? 'unverified').toLowerCase()
  const tier = TIER_CONFIG[tierKey] ?? TIER_CONFIG.unverified

  const total = listing.price * quantity

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:pt-32">
      {/* Back link */}
      <Link
        href="/browse"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to browse
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Gallery ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-raised">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryImage}
              alt={listing.title}
              className="aspect-square w-full object-cover"
            />
            {/* Game + category chip */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-md">
              {listing.game.emoji && <span className="text-xs">{listing.game.emoji}</span>}
              <span className="text-[11px] font-medium text-white/90">{listing.game.name}</span>
              <span className="text-white/40">·</span>
              <span className="text-[11px] text-white/70">{listing.category.name}</span>
            </div>
            {hasPriceDrop && (
              <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-1 text-[11px] font-bold text-white">
                <TrendingDown className="h-3 w-3" />
                -{discountPct}%
              </div>
            )}
          </div>

          {/* Thumbnail dock */}
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'aspect-square overflow-hidden rounded-md border-2 transition-colors',
                    i === activeImage
                      ? 'border-lime'
                      : 'border-border-subtle hover:border-border-strong',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${listing.title} ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Buy panel ───────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{listing.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {listing.views} views
              </span>
              <span className="inline-flex items-center gap-1">
                <ShoppingCart className="h-3.5 w-3.5" />
                {listing.sales} sold
              </span>
            </div>
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-border-default bg-bg-raised p-4 sm:p-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl font-bold text-text-primary">
                ${listing.price.toFixed(2)}
              </span>
              {hasPriceDrop && (
                <span className="font-mono text-base text-text-tertiary line-through">
                  ${listing.original_price!.toFixed(2)}
                </span>
              )}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-text-secondary">
              <Clock className="h-3.5 w-3.5" />
              Delivers in {listing.delivery_time ?? 'manual'}
            </div>

            {/* Stock chip */}
            <div className="mt-3">
              {listing.is_unlimited ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <Infinity className="h-3 w-3" />
                  Unlimited stock
                </span>
              ) : isLowStock ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning">
                  Only {listing.quantity} left
                </span>
              ) : isSoldOut ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error-bg px-2 py-0.5 text-[11px] font-semibold text-error">
                  Sold out
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-inset px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {listing.quantity} in stock
                </span>
              )}
            </div>
          </div>

          {/* Quantity + CTA */}
          {!isOwnListing && !isSoldOut && (
            <div className="space-y-3 rounded-2xl border border-border-default bg-bg-raised p-4 sm:p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Quantity
                </label>
                <NumberField
                  value={quantity}
                  onChange={(v) => setQuantity(v)}
                  minValue={1}
                  maxValue={maxQuantity}
                  ariaLabel="Quantity"
                  className="max-w-[180px]"
                />
              </div>
              <Button
                size="lg"
                onClick={() => router.push(`/checkout?listing=${listing.id}&qty=${quantity}`)}
                className="h-12 w-full rounded-xl bg-lime text-text-inverse font-bold uppercase tracking-wider shadow-lg shadow-elevated transition-all hover:bg-lime-hover hover:shadow-glow"
              >
                Buy now — ${total.toFixed(2)}
              </Button>
              <p className="text-center text-[11px] text-text-tertiary">
                Buyer protection covers every purchase.
              </p>
            </div>
          )}

          {isOwnListing && (
            <div className="rounded-2xl border border-warning/40 bg-warning-bg p-4 text-sm text-warning">
              This is your listing. You can't purchase it.
            </div>
          )}

          {/* Trust row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-bg-overlay p-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
              <div>
                <div className="text-xs font-semibold text-text-primary">30-day protection</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">Refund if not as described</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-bg-overlay p-3">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
              <div>
                <div className="text-xs font-semibold text-text-primary">Fast delivery</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">{listing.delivery_time ?? 'Manual'}</div>
              </div>
            </div>
          </div>

          {/* Seller card */}
          <Link
            href={`/sellers/${listing.seller.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-border-default bg-bg-raised p-4 transition-colors hover:bg-bg-raised-hover"
          >
            {listing.seller.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={listing.seller.avatar_url}
                alt={listing.seller.username}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-border-default"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-overlay text-base font-bold text-text-primary ring-2 ring-border-default">
                {listing.seller.username[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-text-primary group-hover:text-lime-text transition-colors">
                  {listing.seller.username}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                        tier.cls,
                      )}
                    >
                      <tier.Icon className="h-2.5 w-2.5" />
                      {tier.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {tier.label} tier — earned through completed sales and rating.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-tertiary">
                {listing.seller.seller_rating > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {listing.seller.seller_rating.toFixed(1)}
                    <span className="text-text-disabled">({listing.seller.total_reviews})</span>
                  </span>
                )}
                <span>{listing.seller.total_sales} sales</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Details tabs ───────────────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-border-default bg-bg-raised p-4 sm:p-5">
        <Tabs defaultValue="description">
          <TabsList variant="underline">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="delivery">Delivery & terms</TabsTrigger>
            <TabsTrigger value="actions">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="description">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
              {listing.description?.trim() || (
                <span className="text-text-disabled">No description provided.</span>
              )}
            </p>
          </TabsContent>

          <TabsContent value="delivery">
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                Delivery method: <span className="text-text-primary">{listing.delivery_method ?? 'Manual'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                Delivery window: <span className="text-text-primary">{listing.delivery_time ?? 'Within 24h'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                Region: <span className="text-text-primary">{(listing as { region?: string | null }).region ?? 'Global'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                Platform: <span className="text-text-primary">{(listing as { platform?: string | null }).platform ?? 'All'}</span>
              </li>
            </ul>
          </TabsContent>

          <TabsContent value="actions">
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/account/messages?seller=${listing.seller.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default bg-bg-overlay px-3 text-sm font-medium text-text-secondary transition-colors hover:border-lime hover:text-lime-text"
              >
                <MessageSquare className="h-4 w-4" />
                Message seller
              </Link>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default bg-bg-overlay px-3 text-sm font-medium text-text-secondary transition-colors hover:border-error hover:text-error"
              >
                <Flag className="h-4 w-4" />
                Report this listing
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
