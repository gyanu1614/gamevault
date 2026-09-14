'use client'

/**
 * GameBar — sticky category bar, sits directly below the navbar.
 *
 * Identical on every game page. The only per-game input is the category
 * list; the icon, title and every layout value are shared.
 *
 * Its inner measure (1550px) is deliberately WIDER than the page content
 * measure (max-w-7xl / 1280px), so the bar reads as chrome spanning the
 * page rather than as another content row.
 *
 * No backdrop-filter — the reference has none, and the 75% surface is
 * already opaque enough to carry the text over hero art.
 */

import Image from 'next/image'
import Link from 'next/link'

export interface GameBarCategory {
  label: string
  href: string
}

interface GameBarProps {
  gameName: string
  /** Square game icon, rendered at 32×32 with no radius. */
  iconSrc: string
  categories: GameBarCategory[]
}

export function GameBar({ gameName, iconSrc, categories }: GameBarProps) {
  return (
    <div
      className="fixed inset-x-0 z-40 h-[58px] w-full border-y px-4 sm:px-6 lg:px-8"
      style={{
        top: 'var(--navbar-bottom, 60px)',
        backgroundColor: 'rgba(var(--color-bg-raised-rgb, 31, 36, 44), 0.75)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <div className="relative mx-auto flex h-full max-w-[1550px] items-center">
        <span className="flex shrink-0 items-center gap-3">
          <Image src={iconSrc} alt="" aria-hidden width={32} height={32} className="h-8 w-8" />
          <span className="text-[14px] font-semibold text-text-primary">{gameName}</span>
        </span>

        <nav aria-label={`${gameName} categories`} className="ml-6 min-w-0">
          <ul className="flex items-center overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <li key={category.href}>
                <Link
                  href={category.href}
                  className="inline-flex h-14 items-center gap-2 whitespace-nowrap px-4 py-2 text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
