'use client'

/**
 * The signed-in visitor's stock alerts for one game, read ONCE per page (not
 * once per Notify Me button) and shared with every button through context.
 * Personalisation stays client-side so the page itself stays static.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { listMyStockAlerts } from '@/lib/actions/stock-alerts'

interface StockAlertsState {
  /** Item slugs the visitor has an open alert on (empty while signed out or loading). */
  slugs: ReadonlySet<string>
  setLocal: (slug: string, on: boolean) => void
}

const Ctx = createContext<StockAlertsState | null>(null)

export function StockAlertsProvider({ gameSlug, children }: { gameSlug: string; children: ReactNode }) {
  const { user } = useAuth()
  const [slugs, setSlugs] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setSlugs(new Set())
      return
    }
    let alive = true
    listMyStockAlerts(gameSlug)
      .then((r) => {
        if (alive && r.ok) setSlugs(new Set(r.slugs))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user, gameSlug])

  const setLocal = useCallback((slug: string, on: boolean) => {
    setSlugs((prev) => {
      const next = new Set(prev)
      if (on) next.add(slug)
      else next.delete(slug)
      return next
    })
  }, [])

  const value = useMemo(() => ({ slugs, setLocal }), [slugs, setLocal])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** The shared alert state, or null outside a provider (a lone button then tracks itself). */
export function useStockAlerts(): StockAlertsState | null {
  return useContext(Ctx)
}
