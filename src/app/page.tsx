/**
 * UI.3 — GameVault Homepage (Redesign)
 *
 * Sections:
 *  1. Hero          — animated orbs, headline, animated stats, CTAs
 *  2. Trust bar     — 4 horizontal trust signals
 *  3. Games grid    — glass cards with listing counts
 *  4. Featured      — ListingCard grid (UI.4 component)
 *  5. How It Works  — numbered steps + connector
 *  6. VaultShield   — Standard / Enhanced / Premium comparison
 *  7. Reviews       — TrustpilotCarousel
 *  8. Final CTA     — gradient glass card
 */

import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
  Star,
  Lock,
  Users,
  Award,
  Clock,
  BadgeCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ListingCard } from '@/components/listing-card'
import { FadeIn } from '@/components/motion/FadeIn'
import { AnimatedCounter } from '@/components/motion/AnimatedCounter'
import { TrustpilotCarousel, TrustpilotMini } from '@/components/trustpilot/TrustpilotWidget'
import { cn } from '@/lib/utils'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'GameVault | Buy & Sell Game Accounts, Items & Currency Safely',
  description:
    'The trusted marketplace for gaming accounts, items, and currency. Buy and sell Roblox, Fortnite, Valorant, and LoL assets with VaultShield buyer protection. Lowest fees, instant delivery, 48-hour escrow.',
  keywords: [
    'buy game accounts', 'sell game items', 'gaming marketplace',
    'roblox accounts', 'fortnite accounts', 'valorant accounts',
    'lol accounts', 'game currency', 'safe game trading', 'escrow gaming marketplace',
  ],
  openGraph: {
    title: 'GameVault — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with VaultShield escrow protection',
    type: 'website',
    siteName: 'GameVault',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GameVault — Safe Gaming Marketplace',
    description: 'Buy and sell game assets with VaultShield escrow protection',
  },
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getPageData() {
  const supabase = await createClient()

  const [
    { count: totalListings },
    { count: totalSellers },
    { count: completedOrders },
    { data: games },
    { data: featuredListings },
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('seller_status', 'approved'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase
      .from('games')
      .select('id, name, slug, image_url')
      .eq('is_active', true)
      .order('name')
      .limit(8),
    supabase
      .from('listings')
      .select(`
        *,
        seller:profiles!listings_seller_id_fkey(username, seller_tier, avatar_url),
        game:games!listings_game_id_fkey(name, slug),
        category:categories!listings_category_id_fkey(name, slug)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return {
    stats: {
      totalListings:   totalListings   ?? 0,
      totalSellers:    totalSellers    ?? 0,
      completedOrders: completedOrders ?? 0,
    },
    games:            games            ?? [],
    featuredListings: featuredListings ?? [],
  }
}

// ─── Schema.org ────────────────────────────────────────────────────────────────

function buildSchema(completedOrders: number) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'GameVault',
      url: 'https://gamevault.gg',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://gamevault.gg/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'GameVault',
      url: 'https://gamevault.gg',
      description: 'Trusted gaming marketplace with VaultShield buyer protection',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: completedOrders,
      },
    },
  ]
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { stats, games, featuredListings } = await getPageData()
  const schemas = buildSchema(stats.completedOrders)

  return (
    <>
      {/* JSON-LD */}
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}

      <div className="min-h-screen">

        {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-surface-0">

          {/* Ambient gradient orbs */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-violet-600/20 blur-[120px]" />
            <div className="absolute -bottom-20 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
            <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[80px]" />
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">

            {/* Live badge */}
            <FadeIn direction="up" delay={0} onScroll={false}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-sm mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <Shield className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-sm text-gray-300 font-medium">
                  Protected by VaultShield · {stats.completedOrders.toLocaleString()} safe trades
                </span>
              </div>
            </FadeIn>

            {/* Headline */}
            <FadeIn direction="up" delay={0.08} onScroll={false}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[1.05] tracking-tight mb-6">
                <span className="font-extrabold text-white">
                  Trade Game Assets
                </span>
                <span className="block mt-2 font-black bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
                  Without the Risk
                </span>
              </h1>
            </FadeIn>

            {/* Subheadline */}
            <FadeIn direction="up" delay={0.14} onScroll={false}>
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                The safest peer-to-peer marketplace for game accounts, items, and currency — protected by escrow, verified sellers, and full buyer guarantees.
              </p>
            </FadeIn>

            {/* CTAs */}
            <FadeIn direction="up" delay={0.20} onScroll={false}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
                <Link
                  href="/browse"
                  className={cn(
                    'group flex items-center gap-2 px-8 py-4 rounded-xl',
                    'bg-violet-500 hover:bg-violet-400',
                    'text-white font-semibold text-base',
                    'shadow-glow hover:shadow-glow-lg',
                    'transition-all duration-200',
                  )}
                >
                  Browse Marketplace
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <div className="relative">
                  <Link
                    href="/account/become-seller"
                    className={cn(
                      'flex items-center gap-2 px-8 py-4 rounded-xl',
                      'bg-white/[0.06] hover:bg-white/[0.10]',
                      'border border-white/[0.12] hover:border-violet-500/40',
                      'text-white font-semibold text-base',
                      'backdrop-blur-sm transition-all duration-200',
                    )}
                  >
                    Start Selling
                  </Link>
                  {/* 0% fee badge */}
                  <span className="absolute -top-2.5 -right-3 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-md">
                    0% FEE
                  </span>
                </div>
              </div>
            </FadeIn>

            {/* Animated stats */}
            <FadeIn direction="up" delay={0.26} onScroll={false}>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                <StatPill
                  value={stats.totalListings}
                  label="Active Listings"
                  dotColor="bg-emerald-400"
                />
                <div className="hidden sm:block w-px h-8 bg-white/10" />
                <StatPill
                  value={stats.totalSellers}
                  label="Verified Sellers"
                  dotColor="bg-blue-400"
                />
                <div className="hidden sm:block w-px h-8 bg-white/10" />
                <StatPill
                  value={stats.completedOrders}
                  label="Safe Trades"
                  dotColor="bg-violet-400"
                />
                <div className="hidden sm:block w-px h-8 bg-white/10" />
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-white font-semibold font-mono text-lg">$2.5M+</span>
                  <span>Total Secured</span>
                </div>
              </div>
            </FadeIn>

          </div>
        </section>

        {/* ── 2. TRUST BAR ────────────────────────────────────────────────── */}
        <section className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {TRUST_SIGNALS.map((t) => (
                <FadeIn key={t.label} direction="up" threshold={0.2}>
                  <TrustPill icon={t.icon} label={t.label} sub={t.sub} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. BROWSE BY GAME ───────────────────────────────────────────── */}
        {games.length > 0 && (
          <section className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <FadeIn direction="up">
                <div className="flex items-end justify-between mb-10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-2">
                      18+ Games
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white">
                      Browse by Game
                    </h2>
                  </div>
                  <Link
                    href="/browse"
                    className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </FadeIn>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {games.map((game: any, i: number) => (
                  <FadeIn key={game.id} direction="up" delay={i * 0.05}>
                    <GameCard game={game} />
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 4. FEATURED LISTINGS ────────────────────────────────────────── */}
        {featuredListings.length > 0 && (
          <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
            <div className="max-w-7xl mx-auto">
              <FadeIn direction="up">
                <div className="flex items-end justify-between mb-10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-2">
                      Just Listed
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white">
                      Latest Listings
                    </h2>
                  </div>
                  <Link
                    href="/browse"
                    className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </FadeIn>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {featuredListings.map((listing: any, i: number) => (
                  <ListingCard key={listing.id} listing={listing} index={i} />
                ))}
              </div>

              {/* Mobile "View all" */}
              <div className="mt-8 text-center sm:hidden">
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
                >
                  View all listings <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── 5. HOW IT WORKS ─────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-2">
                  Simple Process
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  How It Works
                </h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                  From browse to delivery in minutes — your money stays safe every step of the way.
                </p>
              </div>
            </FadeIn>

            <div className="relative">
              {/* Connector line (desktop only) */}
              <div
                aria-hidden
                className="hidden md:block absolute top-8 left-[calc(12.5%+2rem)] right-[calc(12.5%+2rem)] h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                {HOW_IT_WORKS.map((step, i) => (
                  <FadeIn key={step.title} direction="up" delay={i * 0.08}>
                    <StepCard {...step} number={i + 1} />
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. VAULTSHIELD COMPARISON ───────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
          <div className="max-w-5xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-12">
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-2">
                  Buyer Protection
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  VaultShield Tiers
                </h2>
                <p className="text-gray-400 max-w-xl mx-auto">
                  Every purchase is protected. Choose the level that fits your order.
                </p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {VAULTSHIELD_TIERS.map((tier, i) => (
                <FadeIn key={tier.name} direction="up" delay={i * 0.1}>
                  <VaultShieldTierCard {...tier} />
                </FadeIn>
              ))}
            </div>

            <FadeIn direction="up" delay={0.3}>
              <p className="text-center text-sm text-gray-500 mt-8">
                VaultShield tier is selected at checkout · All tiers include escrow protection
              </p>
            </FadeIn>
          </div>
        </section>

        {/* ── 7. REVIEWS ──────────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 mb-4">
                  <TrustpilotMini />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  What Gamers Say
                </h2>
                <p className="text-gray-400">
                  Thousands of verified reviews from real buyers and sellers
                </p>
              </div>
            </FadeIn>
            <TrustpilotCarousel />
          </div>
        </section>

        {/* ── 8. FINAL CTA ────────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <FadeIn direction="up">
              <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-cyan-500/5 p-12 text-center">
                {/* Orb */}
                <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-violet-500/20 blur-[80px]" />

                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="ml-1.5 text-sm text-gray-400">4.9 · {stats.completedOrders.toLocaleString()}+ orders</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                    Ready to Trade Safely?
                  </h2>
                  <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                    Join {stats.totalSellers.toLocaleString()}+ verified sellers and thousands of happy buyers on GameVault.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href="/browse"
                      className={cn(
                        'group flex items-center gap-2 px-8 py-4 rounded-xl',
                        'bg-violet-500 hover:bg-violet-400',
                        'text-white font-semibold',
                        'shadow-glow hover:shadow-glow-lg',
                        'transition-all duration-200',
                      )}
                    >
                      Browse Marketplace
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      href="/account/become-seller"
                      className={cn(
                        'flex items-center gap-2 px-8 py-4 rounded-xl',
                        'bg-white/[0.06] hover:bg-white/[0.10]',
                        'border border-white/[0.12] hover:border-violet-500/40',
                        'text-white font-semibold',
                        'transition-all duration-200',
                      )}
                    >
                      Become a Seller
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

      </div>
    </>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  dotColor,
}: {
  value: number
  label: string
  dotColor: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span className={cn('w-2 h-2 rounded-full animate-pulse', dotColor)} />
      <AnimatedCounter
        value={value}
        abbreviate={value >= 10_000}
        className="text-white font-semibold font-mono text-lg"
      />
      <span>{label}</span>
    </div>
  )
}

function TrustPill({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ElementType
  label: string
  sub: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-violet-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  )
}

function GameCard({ game }: { game: any }) {
  return (
    <Link
      href={`/${game.slug}`}
      className={cn(
        'group relative flex flex-col items-center gap-3 p-5 rounded-2xl',
        'bg-white/[0.04] border border-white/[0.08]',
        'hover:bg-white/[0.07] hover:border-violet-500/40',
        'hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.3)]',
        'transition-all duration-200',
      )}
    >
      {/* Icon / Image */}
      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/[0.06] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
        {game.image_url ? (
          <Image
            src={game.image_url}
            alt={game.name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-3xl select-none">🎮</span>
        )}
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white text-center leading-snug transition-colors">
        {game.name}
      </h3>

      {/* Hover arrow */}
      <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200" />
    </Link>
  )
}

function StepCard({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: number
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Circle */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Icon className="w-7 h-7 text-violet-400" />
        </div>
        {/* Number badge */}
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shadow-glow">
          {number}
        </span>
      </div>

      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function VaultShieldTierCard({
  name,
  fee,
  color,
  featured,
  features,
  icon: Icon,
}: {
  name: string
  fee: string
  color: string
  featured?: boolean
  features: string[]
  icon: React.ElementType
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6',
        featured
          ? 'bg-violet-500/10 border-violet-500/40 shadow-glow'
          : 'bg-white/[0.04] border-white/[0.08]',
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full bg-violet-500 text-white text-[11px] font-bold shadow-glow">
            MOST POPULAR
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white text-base">{name}</p>
          <p className="text-sm text-gray-400">{fee}</p>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-6">
        <Link
          href="/browse"
          className={cn(
            'block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all',
            featured
              ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-glow'
              : 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10]',
          )}
        >
          Browse with {name}
        </Link>
      </div>
    </div>
  )
}

// ─── Static data ───────────────────────────────────────────────────────────────

const TRUST_SIGNALS = [
  {
    icon:  Shield,
    label: 'Escrow Protected',
    sub:   'Funds held until delivery confirmed',
  },
  {
    icon:  Zap,
    label: 'Instant Delivery',
    sub:   'Most orders delivered in minutes',
  },
  {
    icon:  BadgeCheck,
    label: 'Verified Sellers',
    sub:   'ID-checked and rated sellers only',
  },
  {
    icon:  Clock,
    label: '48h Buyer Window',
    sub:   'Dispute within 48 hours for a full refund',
  },
]

const HOW_IT_WORKS = [
  {
    icon:        Users,
    title:       'Browse Listings',
    description: 'Find the perfect account or item from thousands of verified sellers.',
  },
  {
    icon:        Lock,
    title:       'Secure Payment',
    description: 'Your payment is held safely in VaultShield escrow — never touches the seller.',
  },
  {
    icon:        CheckCircle2,
    title:       'Receive Delivery',
    description: 'Seller delivers your items with proof. Review everything at your own pace.',
  },
  {
    icon:        Award,
    title:       'Confirm & Done',
    description: 'Approve delivery to release funds. Auto-releases after 48 hours.',
  },
]

const VAULTSHIELD_TIERS = [
  {
    name:     'Standard',
    fee:      'Included free',
    color:    'bg-slate-600',
    icon:     Shield,
    features: [
      '48-hour buyer protection window',
      'Escrow payment hold',
      'Dispute resolution support',
      'Verified seller ratings',
    ],
  },
  {
    name:     'Enhanced',
    fee:      '+2% of order value',
    color:    'bg-violet-600',
    icon:     Star,
    featured: true,
    features: [
      'Everything in Standard',
      '7-day extended warranty',
      'Priority dispute resolution',
      'Dedicated support agent',
    ],
  },
  {
    name:     'Premium',
    fee:      '+5% of order value',
    color:    'bg-amber-500',
    icon:     Award,
    features: [
      'Everything in Enhanced',
      '30-day extended warranty',
      '24/7 VIP support line',
      'Full refund guarantee',
    ],
  },
]
