'use client'

/**
 * V19/P24/P7.d — Shared "meta" blocks for currency pages.
 *
 * HowItWorks + FAQ are identical on the flexible (Robux-style) and
 * bundle (V-Bucks-style) buyer pages, but they used to live inside
 * `_CurrencyPageClient.tsx` and never made it onto the bundle page.
 * Extracted here so both clients import them. No behaviour change for
 * the flexible page.
 */

import { useId, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Inbox, Lock, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CurrencyStep {
  n: number
  title: string
  body: string
}

export interface CurrencyFaq {
  q: string
  a: string
}

export function HowItWorks({ steps }: { steps: CurrencyStep[] }) {
  const ICONS: LucideIcon[] = [SlidersHorizontal, Lock, Inbox]
  return (
    <section>
      <div className="text-center">
        <h2 className="text-[22px] font-bold text-text-primary sm:text-[26px]">How it works</h2>
        <p className="mt-1.5 text-[13.5px] text-text-tertiary">
          Every purchase is escrow-protected from checkout to delivery.
        </p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = ICONS[i] ?? SlidersHorizontal
          return (
            <div key={s.n} className="rounded-xl border border-border-subtle bg-bg-raised p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-bg-overlay text-lime-text">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-display text-2xl font-black tabular-nums text-text-tertiary">
                  0{s.n}
                </span>
              </div>
              <h3 className="mt-3 text-[15.5px] font-bold text-text-primary">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-text-secondary">{s.body}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function FAQ({ items }: { items: CurrencyFaq[] }) {
  const [openIdx, setOpenIdx] = useState<number>(-1)
  const baseId = useId()
  return (
    <section>
      <div className="text-center">
        <h2 className="text-[22px] font-bold text-text-primary sm:text-[26px]">
          Frequently asked questions
        </h2>
        <p className="mt-1.5 text-[13.5px] text-text-tertiary">
          Everything you need to know before you buy.
        </p>
      </div>
      <div className="mx-auto mt-7 max-w-2xl space-y-2.5">
        {items.map((item, i) => {
          const open = openIdx === i
          const buttonId = `${baseId}-q-${i}`
          const panelId = `${baseId}-a-${i}`
          return (
            <div
              key={i}
              className={cn(
                'overflow-hidden rounded-xl border bg-bg-raised transition-colors',
                open
                  ? 'border-border-default shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]'
                  : 'border-border-subtle hover:border-border-default',
              )}
            >
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[14.5px] font-semibold text-text-primary">{item.q}</span>
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-text-tertiary transition-all',
                      open
                        ? 'rotate-180 border-border-default bg-bg-overlay text-text-primary'
                        : 'border-border-subtle',
                    )}
                    aria-hidden
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
              </h3>
              {open && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="border-t border-border-subtle px-5 pb-5 pt-4"
                >
                  <FAQAnswer text={item.a} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FAQAnswer({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className="space-y-3 text-[13.5px] leading-[1.65] text-text-secondary">
      {paras.length > 0 ? paras.map((p, i) => <p key={i}>{p}</p>) : <p>{text}</p>}
    </div>
  )
}
