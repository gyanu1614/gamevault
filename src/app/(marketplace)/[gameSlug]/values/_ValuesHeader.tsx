'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import { SwooshLink } from './_SwooshLink'

/**
 * Fixed section header for the SAB "Values" hub. Transparent over the hero at
 * the top of the page; once the user scrolls it fills with the near-black page
 * color + a hairline, staying pinned — mirrors the main navbar's behavior.
 * NOT a full navbar: brand left, one game-specific storefront CTA right.
 */
export function ValuesHeader({
  gameName = 'Steal a Brainrot',
  buyHref = '/steal-a-brainrot/buy-items',
}: {
  gameName?: string
  buyHref?: string
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? 'border-b border-[#1E2723] bg-[#0C0F0E]/95 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
        {/* Matches the main navbar logo exactly, + "| Values"; links HOME to
            strengthen internal linking back to the marketplace. */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/brand/logo-mark-white.png"
            alt="DropMarket"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          />
          <span className="inline-flex items-center whitespace-nowrap font-bold text-white">
            DropMarket
            <span className="mx-2 font-normal text-white/25">|</span>
            <span className="text-[#4FB477]">Values</span>
          </span>
        </Link>

        <SwooshLink
          href={buyHref}
          to="marketplace"
          ariaLabel={`Buy ${gameName} Items`}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1B6B3F] px-3 py-2 text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(27,107,63,0.6)] transition hover:bg-[#1f7a48] sm:px-4 sm:py-2.5 sm:text-sm"
        >
          {/* Full label on desktop, compact on mobile so the header stays one line. */}
          <span className="hidden sm:inline">Buy {gameName} Items</span>
          <span className="sm:hidden">Buy Items</span>
          <NorthEastIcon sx={{ fontSize: 14 }} className="text-white/90" />
        </SwooshLink>
      </div>
    </header>
  )
}
