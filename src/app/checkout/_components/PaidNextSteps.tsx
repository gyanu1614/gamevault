'use client'

/**
 * What happens after "Order Paid" (owner 2026-10-19), in two shapes:
 *
 *   · manual delivery — a three-step journey (Order Received → Chat With
 *     Your Seller → Confirm & You're Set): big silver-glass 3D icons on a
 *     connector line, one bold title and one short line each. No boxes.
 *   · automatic delivery — "Your Item Is Ready" with Show My Item, which
 *     reveals the code / credentials in place (revealMyOrderItem: the signed-
 *     in buyer only; one code claimed atomically, the same one on a retry).
 *
 * Entrances slide, never fade from 0 (readable even if motion never runs).
 */

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, Copy, Loader2 } from 'lucide-react'

import { SilverIcon } from '@/components/ui/silver-icon'
import { revealMyOrderItem } from '@/lib/actions/order-item-reveal'

const EASE = [0.16, 1, 0.3, 1] as const

/** A silver-glass 3D icon on a dark glossy medallion (the connector line runs
 *  behind it); a green tick on the rim marks a step that is already done. */
function IconMark({ src, done = false, size = 'md' }: { src: string; done?: boolean; size?: 'md' | 'lg' }) {
  const plate = size === 'lg' ? 'h-[76px] w-[76px]' : 'h-16 w-16'
  const icon = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <span
      className={`relative grid ${plate} shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_24%,#34363F_0%,#1D1E24_58%,#141519_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-6px_12px_rgba(0,0,0,0.35),0_10px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.07]`}
    >
      <SilverIcon src={src} alt="" className={icon} />
      {done && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-[#2A7A50] shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-[3px] ring-[#121317]">
          <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
        </span>
      )}
    </span>
  )
}

export function PaidNextSteps({ orderId, sellerName, instantDelivery }: { orderId: string; sellerName: string; instantDelivery: boolean }) {
  return instantDelivery ? <InstantItem orderId={orderId} /> : <ManualSteps sellerName={sellerName} />
}

function ManualSteps({ sellerName }: { sellerName: string }) {
  const reduce = useReducedMotion()
  const steps = [
    { icon: '/icons/set/package.svg', title: 'Order Received', line: `${sellerName} has your order`, done: true },
    { icon: '/icons/set/messages.svg', title: 'Chat With Your Seller', line: 'Sort out any details in chat' },
    { icon: '/icons/set/shield-check.svg', title: 'Confirm & You’re Set', line: 'Mark it received when it lands' },
  ]
  return (
    <section aria-label="What happens next" className="mt-7 [@media(max-height:780px)]:mt-5">
      <h2 className="text-center text-[16px] font-semibold text-[#E9EDF2]">What Happens Next</h2>
      <ol className="relative mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-3">
        {/* Connector: across the icons on desktop, down them on phones. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-8 hidden h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(86,184,127,0.75),rgba(233,237,242,0.14)_50%,rgba(233,237,242,0.08))] sm:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-8 left-8 top-8 w-[2px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(86,184,127,0.75),rgba(233,237,242,0.14)_50%,rgba(233,237,242,0.08))] sm:hidden"
        />
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={reduce ? false : { y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.09, ease: EASE }}
            className="relative flex items-center gap-4 sm:flex-col sm:gap-3 sm:text-center"
          >
            <IconMark src={s.icon} done={s.done} />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug text-[#E9EDF2]">{s.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[#9AA6B3]">{s.line}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}

function InstantItem({ orderId }: { orderId: string }) {
  const reduce = useReducedMotion()
  const [state, setState] = useState<'idle' | 'loading' | 'shown'>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reveal = async () => {
    setState('loading')
    setError(null)
    try {
      const r = await revealMyOrderItem(orderId)
      if (r.success && r.code) {
        setCode(r.code)
        setState('shown')
        return
      }
      setError(r.error ?? 'We could not load your item just now. Please try again in a moment.')
    } catch {
      setError('We could not load your item just now. Please try again in a moment.')
    }
    setState('idle')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy — select it instead')
    }
  }

  return (
    <motion.section
      aria-label="Your item"
      initial={reduce ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
      className="mt-7 flex flex-col items-center text-center [@media(max-height:780px)]:mt-5"
    >
      <IconMark src="/icons/set/key.svg" size="lg" done={state === 'shown'} />
      <h2 className="mt-3 text-[18px] font-semibold text-[#E9EDF2]">Your Item Is Ready</h2>
      <p className="mt-1 text-[13.5px] text-[#9AA6B3]">Delivered instantly. Keep it private.</p>

      {state === 'shown' ? (
        <div className="mt-4 flex w-full items-start gap-2 rounded-lg bg-black/35 px-3.5 py-3 text-left ring-1 ring-white/[0.12]">
          <code className="min-w-0 flex-1 select-all whitespace-pre-wrap break-all font-mono text-[14px] leading-relaxed text-[#E9EDF2]">{code}</code>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy your item"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#C9D1DA] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={state === 'loading'}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#E9EDF2] px-6 text-[14.5px] font-semibold text-[#121317] transition-[background-color,transform] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.98] disabled:opacity-70"
        >
          {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === 'loading' ? 'Opening…' : 'Show My Item'}
        </button>
      )}
      {error && <p className="mt-2.5 max-w-[420px] text-[13px] leading-snug text-[#FFB23E]">{error}</p>}
    </motion.section>
  )
}
