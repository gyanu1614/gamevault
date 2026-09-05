'use client'

/**
 * Shared "which variant is selected" state for a pet page. The hero's variant
 * grid writes it; the quick-answer callout, the market-activity stats, and the
 * price-trend chart all read it — so picking Neon Fly Ride up top reprices every
 * section below to NFR. Opens on FR (the trading benchmark).
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Variant } from './_adoptMePetData'

interface Ctx {
  selectedCode: Variant
  setSelectedCode: (v: Variant) => void
}

const SelectedVariantContext = createContext<Ctx | null>(null)

export function SelectedVariantProvider({
  initial = 'FR',
  children,
}: {
  initial?: Variant
  children: ReactNode
}) {
  const [selectedCode, setSelectedCode] = useState<Variant>(initial)
  return (
    <SelectedVariantContext.Provider value={{ selectedCode, setSelectedCode }}>
      {children}
    </SelectedVariantContext.Provider>
  )
}

export function useSelectedVariant(): Ctx {
  const ctx = useContext(SelectedVariantContext)
  if (!ctx) throw new Error('useSelectedVariant must be used within SelectedVariantProvider')
  return ctx
}
