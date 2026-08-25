/**
 * GamesDirectoryCollapse — client shell for the "Popular Games" directory
 * (see footer-game-links.tsx). GameBoost-style default: the first row shows,
 * the rest sits cut off under a fade-to-background gradient with a centered
 * "Show All" button floating over it. The link grid arrives as server-
 * rendered children, so every <a href> is in the initial HTML regardless of
 * this collapsed state — the collapse is max-height only, never unmounting.
 */

'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function GamesDirectoryCollapse({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`relative ${open ? 'pb-16' : ''}`}>
      <div
        className={`overflow-hidden transition-[max-height] duration-500 ease-out ${
          open ? 'max-h-[4000px]' : 'max-h-[400px]'
        }`}
      >
        {children}
      </div>

      {/* Fade — greys the cut-off row into the page background */}
      {!open && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent"
        />
      )}

      <div
        className={`absolute inset-x-0 flex justify-center ${open ? 'bottom-0' : 'bottom-5'}`}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-bg-overlay px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-bg-overlay-2"
        >
          {open ? 'Show Less' : 'Show All'}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 text-text-tertiary transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
    </div>
  )
}
