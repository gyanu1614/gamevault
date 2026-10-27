import { useId } from 'react'
import { cn } from '@/lib/utils'

type Letter = 'N' | 'F' | 'R' | 'M'

/**
 * White letters on a 64-unit badge: Montserrat Bold outlines (Roblox draws its
 * Gotham UI type with Montserrat), sized and placed as measured from in-game
 * inventory screenshots, then thickened with a 2.2-unit stroke to the game's
 * weight. Circles carry the letter slightly above centre, as the game does.
 */
const LETTER: Record<Letter, string> = {
  N: 'M39.15 33.41V14.54H46.25V45.62H40.35L24.85 26.75V45.62H17.75V14.54H23.7Z',
  F: 'M43.74 14.54V20.31H27.45V28.53H41.83V34.3H27.45V45.62H20.26V14.54Z',
  R: 'M45.76 45.62H38.04L32.04 36.96H31.69H25.43V45.62H18.24V14.54H31.69Q35.82 14.54 38.86 15.92Q41.9 17.29 43.54 19.82Q45.19 22.35 45.19 25.82Q45.19 29.28 43.52 31.79Q41.86 34.3 38.79 35.63ZM31.29 20.4H25.43V31.23H31.29Q34.53 31.23 36.22 29.81Q37.91 28.39 37.91 25.82Q37.91 23.2 36.22 21.8Q34.53 20.4 31.29 20.4Z',
  M: 'M50.67 13.9 50.77 50.1H43.54L43.49 28.38L33.69 46.27H30.22L20.46 28.85V50.1H13.23V13.9H19.61L32.07 36.4L44.35 13.9Z',
}

const CIRCLE: Record<Exclude<Letter, 'M'>, string> = { N: '#8DC54A', F: '#3298CB', R: '#EA2E77' }

const isLetter = (c: string): c is Letter => c in LETTER

/**
 * Adopt Me's own trait badges, drawn like the game's inventory tiles (owner,
 * 2026-10-27): N green, F blue and R pink circles, M a violet square. One
 * badge per letter of the trade shorthand, so "NFR" is N F R and "MFR" is
 * M F R. Decorative: the trait's name is always written beside it.
 */
export function TraitMarks({ code, size = 20, className }: { code: string; size?: number; className?: string }) {
  const gradient = `am-mega-${useId().replace(/:/g, '')}`
  const letters = [...code].filter(isLetter)
  if (letters.length === 0) return null

  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center', className)} style={{ gap: Math.max(1, Math.round(size * 0.06)) }}>
      {letters.map((l) => (
        <svg key={l} width={size} height={size} viewBox="0 0 64 64" className="block shrink-0">
          {l === 'M' ? (
            <>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#B84AFB" />
                  <stop offset="1" stopColor="#3D00E5" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="2" fill={`url(#${gradient})`} />
            </>
          ) : (
            <circle cx="32" cy="32" r="32" fill={CIRCLE[l]} />
          )}
          <path d={LETTER[l]} fill="#fff" stroke="#fff" strokeWidth="2.2" strokeMiterlimit="3" />
        </svg>
      ))}
    </span>
  )
}
