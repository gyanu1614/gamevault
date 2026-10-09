'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import { fetchMarketPriceHint } from '@/lib/actions/market-price-hint'
import { hintCopy } from '@/lib/price-helper/copy'
import type { HintInput, MarketPriceHint as Hint } from '@/lib/price-helper/resolve'

/** Settle quick successive picks (game → item → trait) into one request. */
const DEBOUNCE_MS = 250

/**
 * Growth point 30 — "Market Price: $X · from N sources" under the price field.
 * Advice only: it never fills, caps or blocks the price. Asks again only when
 * the pair or a picked field changes; hidden while loading and whenever the
 * server has no solid number (see price-helper/).
 */
export function MarketPriceHint({ input, unit }: { input: HintInput | null; unit: string | null }) {
  // A primitive key: the parent rebuilds `input` on every render.
  const key = input ? JSON.stringify(input) : ''
  const [result, setResult] = useState<{ key: string; hint: Hint | null } | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!key) return
    let alive = true
    const t = setTimeout(() => {
      fetchMarketPriceHint(JSON.parse(key))
        .then((hint) => { if (alive) setResult({ key, hint }) })
        .catch(() => { if (alive) setResult({ key, hint: null }) })
    }, DEBOUNCE_MS)
    return () => { alive = false; clearTimeout(t) }
  }, [key])

  // Only the answer for what is picked now, never the previous item's.
  const hint = result && result.key === key ? result.hint : null
  const copy = hint ? hintCopy(hint, unit) : null

  return (
    <AnimatePresence initial={false}>
      {copy && (
        <motion.div
          key="market-price-hint"
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-bg-inset px-3 py-2"
        >
          <InsightsRoundedIcon aria-hidden className="shrink-0 text-text-tertiary" style={{ fontSize: 16 }} />
          <p className="min-w-0 text-[13px] leading-snug text-text-secondary">
            Market Price:{' '}
            <span className="font-semibold tabular-nums text-text-primary">{copy.price}</span>
            {copy.per && <span className="text-text-tertiary"> {copy.per}</span>}
            <span className="text-text-tertiary"> · {copy.sources}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
