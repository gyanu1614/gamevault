'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Search, Sparkles, TrendingUp, X } from 'lucide-react'
import { usePopularGames } from '@/features/home/hooks/usePopularGames'
import type { PopularGame } from '@/features/home/hooks/usePopularGames'

type HeroVariant = 'kinetic' | 'beam' | 'editorial'

const FALLBACK_GAMES: PopularGame[] = [
  { slug: 'roblox', name: 'Roblox', iconSrc: '/games/roblox.png', coverSrc: '/games/covers/roblox.jpg', categories: [], categoryLinks: [{ slug: 'buy-robux', label: 'Robux' }, { slug: 'buy-items', label: 'Items' }, { slug: 'buy-accounts', label: 'Accounts' }], href: '/roblox/buy-robux' },
  { slug: 'fortnite', name: 'Fortnite', iconSrc: '/games/fortnite.png', coverSrc: '/games/covers/fortnite.jpg', categories: [], categoryLinks: [{ slug: 'buy-accounts', label: 'Accounts' }, { slug: 'buy-vbucks', label: 'V-Bucks' }, { slug: 'buy-skins', label: 'Skins' }], href: '/fortnite/buy-accounts' },
  { slug: 'valorant', name: 'Valorant', iconSrc: '/games/valorant.png', coverSrc: '/games/covers/valorant.jpg', categories: [], categoryLinks: [{ slug: 'buy-accounts', label: 'Accounts' }, { slug: 'buy-vp', label: 'VP' }], href: '/valorant/buy-accounts' },
  { slug: 'r6', name: 'R6 Siege', iconSrc: '/games/r6.png', coverSrc: '/games/covers/r6-siege.jpg', categories: [], categoryLinks: [{ slug: 'buy-accounts', label: 'Accounts' }, { slug: 'buy-credits', label: 'R6 Credits' }], href: '/r6-siege/buy-accounts' },
]

const pillClass = 'inline-flex h-6 shrink-0 items-center rounded-md border border-white/[0.10] bg-white/[0.11] px-2 text-[10px] font-semibold text-white/65'

function GameResult({ game }: { game: PopularGame }) {
  return (
    <Link href={game.href} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.06]">
      <Image src={game.coverSrc} alt="" width={42} height={54} className="h-[54px] w-[42px] shrink-0 rounded-md object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-white">{game.name}</span>
        <span className="mt-1 flex max-w-full gap-1.5 overflow-hidden">
          {game.categoryLinks.slice(0, 4).map((category) => <span key={category.slug} className={pillClass}>{category.label.replace(/\s*\(.*?\)\s*/g, '')}</span>)}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-lime" />
    </Link>
  )
}

function HeroTitle({ variant }: { variant: HeroVariant }) {
  if (variant === 'beam') {
    return (
      <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center font-display text-[clamp(42px,13vw,82px)] font-black leading-[0.92] tracking-[-0.06em] text-white">
        <span className="block">Game More.</span>
        <span className="relative block bg-[linear-gradient(100deg,#4ade80,#c6ff3d,#fff,#c6ff3d)] bg-[length:240%_100%] bg-clip-text text-transparent animate-gradient-x">Grind Less.</span>
      </motion.h1>
    )
  }
  if (variant === 'editorial') {
    return (
      <motion.h1 initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65 }} className="text-center font-display text-[clamp(44px,13vw,88px)] font-black leading-[0.86] tracking-[-0.065em] text-white">
        <span className="block">Game More<span className="text-lime">.</span></span>
        <span className="block text-white/35">Grind <span className="text-white">Less.</span></span>
      </motion.h1>
    )
  }
  return (
    <motion.h1 initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }} className="text-center font-display text-[clamp(44px,13vw,86px)] font-black leading-[0.88] tracking-[-0.065em] text-white">
      <span className="block">{'Game More.'.split('').map((char, i) => <motion.span key={i} variants={{ hidden: { y: 28, opacity: 0, rotate: 5 }, show: { y: 0, opacity: 1, rotate: 0 } }} className="inline-block">{char === ' ' ? '\u00a0' : char}</motion.span>)}</span>
      <span className="block text-lime">{'Grind Less.'.split('').map((char, i) => <motion.span key={i} variants={{ hidden: { y: 28, opacity: 0, rotate: -5 }, show: { y: 0, opacity: 1, rotate: 0 } }} className="inline-block">{char === ' ' ? '\u00a0' : char}</motion.span>)}</span>
    </motion.h1>
  )
}

export default function HeroPreviewPage() {
  const { data } = usePopularGames()
  const games = data?.length ? data : FALLBACK_GAMES
  const [variant, setVariant] = useState<HeroVariant>('kinetic')
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return games.slice(0, 4)
    return games.filter((game) => `${game.name} ${game.categoryLinks.map((c) => c.label).join(' ')}`.toLowerCase().includes(needle)).slice(0, 4)
  }, [games, query])

  return (
    <main className="min-h-screen bg-[#090c0a] px-5 pb-24 pt-24 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime">Hero direction preview</p><h2 className="mt-2 text-2xl font-bold">Choose the feeling first</h2></div>
          <div className="flex gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
            {(['kinetic', 'beam', 'editorial'] as HeroVariant[]).map((item) => <button key={item} onClick={() => setVariant(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${variant === item ? 'bg-white/[0.14] text-lime' : 'text-white/50 hover:text-white'}`}>{item}</button>)}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.10] bg-[radial-gradient(circle_at_50%_0%,rgba(75,125,88,0.28),transparent_48%),linear-gradient(180deg,#15251b,#0b100d)] px-5 pb-8 pt-14 shadow-2xl sm:px-12 sm:pt-20">
          <Sparkles className="pointer-events-none absolute right-[10%] top-[12%] h-5 w-5 text-lime/40" />
          <div className="relative z-10 mx-auto max-w-3xl"><HeroTitle variant={variant} /><p className="mx-auto mt-5 max-w-xl text-center text-base leading-relaxed text-white/60 sm:text-lg">Accounts, currency, items and boosts — every order covered by SafeDrop Buyer Protection.</p>
            <div className="relative mx-auto mt-8 max-w-2xl">
              <div className="flex h-14 items-center rounded-2xl border border-white/[0.16] bg-black/25 px-4 shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl focus-within:border-lime/50"><Search className="h-5 w-5 shrink-0 text-white/45" /><input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)} placeholder="Search games, currency, items…" className="h-full w-full bg-transparent px-3 text-base text-white outline-none placeholder:text-white/35" /><button type="button" onClick={() => { setQuery(''); setFocused(false) }} className={query ? 'text-white/50' : 'hidden'} aria-label="Clear search"><X className="h-4 w-4" /></button></div>
              {focused && <div className="absolute inset-x-0 top-16 z-20 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#101511]/98 p-2 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-2 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35"><TrendingUp className="h-3.5 w-3.5 text-lime" /> Trending now</div>{matches.map((game) => <GameResult key={game.slug} game={game} />)}</div>}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/35">Kinetic</p><p className="mt-2 text-sm text-white/60">Playful letter-by-letter entrance. Most energetic.</p></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/35">Beam</p><p className="mt-2 text-sm text-white/60">Clean animated gradient. Most premium and readable.</p></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/35">Editorial</p><p className="mt-2 text-sm text-white/60">Offset second line. Most distinctive and fashion-led.</p></div></div>
      </div>
    </main>
  )
}
