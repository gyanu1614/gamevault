'use client'

/**
 * Phone purchase sheet for currency pages (below lg).
 *
 * The quantity is typed on a keypad inside the sheet, never the OS keyboard.
 * On iOS Safari a focused input in a bottom sheet makes Safari pan the page
 * to reveal it while the sheet is also lifted above the keyboard, so the
 * sheet ended up off screen (2026-10-01, owner's iPhone). With no OS
 * keyboard the sheet keeps one stable layout: amount field (tap for the
 * keypad, − / + to step), quick-pick amounts, then a footer with the Buy
 * button that never scrolls away.
 *
 * vaul draws the sheet (drag to dismiss, overlay, focus trap); framer-motion
 * animates the keypad (shared Expand), the chip highlight and the amount.
 */

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Delete, Minus, Plus, ShieldCheck, X } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Expand } from '@/components/ui/expand'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { PURCHASES_ENABLED } from '@/lib/config/purchases'
import { priceUnit, type QuantityGranularity } from '@/lib/currency/quantity-unit'
import { quickAmounts, typeKey, type KeypadKey } from '@/lib/currency/quantity-entry'
import type { Offer } from './_currencyData'

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back']

/** Chip text: "1K" / "2.5K" on unit games; "5 M" on bulk games. */
function chipLabel(n: number, granularity: QuantityGranularity, unitLabel: string) {
  if (granularity !== 'unit') return `${n.toLocaleString('en-US')} ${unitLabel}`
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

export function PhoneBuySheet({
  open, onOpenChange, offer, unitLabel, granularity, qty, setQty, stepUp, stepDown,
  unit, total, onBuy, buying, deliveryText,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: Offer
  /** Quantity suffix: the currency's name, or 'K' / 'M' on bulk games. */
  unitLabel: string
  granularity: QuantityGranularity
  qty: number
  setQty: (n: number) => void
  stepUp: () => void
  stepDown: () => void
  /** Price per unit at this quantity (ladder applied). */
  unit: number
  total: number
  onBuy: () => void
  buying: boolean
  deliveryText: string
}) {
  const reduce = useReducedMotion()
  const keypadId = useId()
  const [keypadOpen, setKeypadOpen] = useState(false)
  // The amount being typed; null while the field shows the committed qty.
  const [draft, setDraft] = useState<string | null>(null)
  // Set when a typed amount was cut back to the stock.
  const [capped, setCapped] = useState(false)

  const stock = offer.stock
  const amounts = quickAmounts(offer.minQty, stock)
  const showMax = stock > 0 && !amounts.includes(stock)
  const belowMin = qty < offer.minQty
  const canBuy = !belowMin && qty > 0 && stock > 0
  const per = granularity === 'unit' ? unitLabel : priceUnit(granularity)

  // Every opening starts from the shown quantity with the keypad closed.
  useEffect(() => {
    if (!open) return
    setKeypadOpen(false)
    setDraft(null)
    setCapped(false)
  }, [open])

  const press = (key: KeypadKey) => {
    const next = typeKey(draft, qty, key)
    const n = next === '' ? 0 : Number(next)
    if (stock > 0 && n > stock) {
      setDraft(String(stock))
      setQty(stock)
      setCapped(true)
      return
    }
    setDraft(next)
    setQty(n)
    setCapped(false)
  }

  // Chips and steppers set a whole amount: typing starts fresh after them.
  const settle = () => {
    setDraft(null)
    setCapped(false)
  }

  // A hardware keyboard (iPad, a narrow desktop window) types on the keypad.
  useEffect(() => {
    if (!open || !keypadOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) press(e.key as KeypadKey)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') setKeypadOpen(false)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handleOpenChange = (next: boolean) => {
    // Leave the page bar on a buyable amount.
    if (!next && qty < offer.minQty) setQty(offer.minQty)
    onOpenChange(next)
  }

  const notice = capped
    ? `Only ${stock.toLocaleString('en-US')} ${unitLabel} In Stock`
    : belowMin
      ? `Minimum Is ${offer.minQty.toLocaleString('en-US')} ${unitLabel}`
      : null

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 lg:hidden" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] w-full max-w-[480px] flex-col rounded-t-lg bg-bg-raised text-text-primary shadow-elevated outline-none lg:hidden">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Drawer.Title className="text-[19px] font-bold tracking-tight">
                  Confirm Your Purchase
                </Drawer.Title>
                <Drawer.Description className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-text-secondary">
                  <span className="truncate font-medium text-text-primary">{offer.seller}</span>
                  {offer.verified && <VerifiedBadge size={13} />}
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{deliveryText}</span>
                </Drawer.Description>
              </div>
              <Drawer.Close className="-mr-2 -mt-1 shrink-0 rounded-sm p-2.5 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Drawer.Close>
            </div>

            {/* Amount: − / + step; the middle opens the keypad. */}
            <div
              className={cn(
                'mt-5 flex h-[60px] items-stretch overflow-hidden rounded-md transition-colors duration-200',
                keypadOpen ? 'bg-bg-overlay-2' : 'bg-bg-overlay',
              )}
            >
              <StepButton
                label="Decrease quantity"
                disabled={qty <= offer.minQty}
                onClick={() => {
                  settle()
                  stepDown()
                }}
              >
                <Minus className="h-4 w-4" />
              </StepButton>
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setKeypadOpen((v) => !v)
                }}
                aria-expanded={keypadOpen}
                aria-controls={keypadId}
                aria-label={`Quantity ${qty.toLocaleString('en-US')} ${unitLabel}. ${keypadOpen ? 'Hide' : 'Show'} the keypad to type an amount`}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft"
              >
                <motion.span
                  key={qty}
                  initial={reduce ? false : { opacity: 0.4, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="text-[24px] font-bold tabular-nums leading-none"
                >
                  {qty.toLocaleString('en-US')}
                </motion.span>
                {keypadOpen && (
                  <motion.span
                    aria-hidden
                    animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                    transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                    className="-ml-1.5 h-6 w-[2px] rounded-full bg-text-primary"
                  />
                )}
                <span className="text-[16px] font-semibold text-text-secondary">{unitLabel}</span>
              </button>
              <StepButton
                label="Increase quantity"
                disabled={stock > 0 && qty >= stock}
                onClick={() => {
                  settle()
                  stepUp()
                }}
              >
                <Plus className="h-4 w-4" />
              </StepButton>
            </div>

            <div className="mt-2 flex min-h-[18px] items-center justify-between gap-3 px-1 text-[12.5px] font-medium">
              <AnimatePresence mode="wait" initial={false}>
                {notice ? (
                  <motion.span
                    key="notice"
                    role="status"
                    initial={reduce ? false : { opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-amber-300"
                  >
                    {notice}
                  </motion.span>
                ) : (
                  <motion.span
                    key="limits"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="truncate text-text-secondary"
                  >
                    Min {offer.minQty.toLocaleString('en-US')} · {stock.toLocaleString('en-US')} In Stock
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="shrink-0 tabular-nums text-text-secondary">
                ${unit.toFixed(4)} / {per}
              </span>
            </div>

            {/* Quick picks. Horizontal scroll on narrow phones, so vaul must
                not read the swipe as a drag. */}
            <div
              data-vaul-no-drag
              className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {amounts.map((n) => (
                <Chip key={n} active={qty === n} onClick={() => { settle(); setQty(n) }}>
                  {chipLabel(n, granularity, unitLabel)}
                </Chip>
              ))}
              {showMax && (
                <Chip active={qty === stock} onClick={() => { settle(); setQty(stock) }}>
                  Max
                </Chip>
              )}
            </div>

            <Expand open={keypadOpen} id={keypadId} data-vaul-no-drag>
              <div role="group" aria-label="Amount keypad" className="grid grid-cols-3 gap-2 pb-1 pt-4">
                {KEYS.map((key) => (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    whileTap={reduce ? undefined : { scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                    aria-label={key === 'back' ? 'Delete' : key === '00' ? 'Double zero' : key}
                    className="flex h-[52px] items-center justify-center rounded-md bg-bg-overlay text-[22px] font-semibold tabular-nums text-text-primary transition-colors active:bg-bg-overlay-2 [@media(max-height:740px)]:h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft"
                  >
                    {key === 'back' ? <Delete className="h-5 w-5" strokeWidth={2} /> : key}
                  </motion.button>
                ))}
              </div>
            </Expand>
          </div>

          {/* Footer stays put: the Buy button never scrolls out of reach. */}
          <div className="shrink-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <BuyButton
              onClick={() => {
                setKeypadOpen(false)
                onBuy()
              }}
              loading={buying}
              disabled={!canBuy}
              className="w-full"
            >
              {PURCHASES_ENABLED ? 'Buy Now · ' : 'Buying Opens Soon · '}
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </BuyButton>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-text-tertiary [@media(max-height:680px)]:hidden">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              SafeDrop Protection: Item Guaranteed or Full Refund
            </p>
            <span className="sr-only" aria-live="polite">
              {qty.toLocaleString('en-US')} {unitLabel}, total {formatCurrency(total)}
            </span>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function StepButton({
  label, disabled, onClick, children,
}: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex w-14 shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-text-primary active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft"
    >
      {children}
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative h-10 shrink-0 rounded-md px-4 text-[14px] font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft',
        active ? 'text-text-primary' : 'bg-bg-overlay text-text-secondary hover:text-text-primary',
      )}
    >
      {active && (
        <motion.span
          layoutId="phone-buy-chip"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          className="absolute inset-0 rounded-md bg-white/[0.14]"
        />
      )}
      <span className="relative">{children}</span>
    </button>
  )
}
