'use client'

/**
 * FAQ accordion, shared by every FAQ on the site (currency, bundle, game hub,
 * listing detail, /buy, /browse, /sell/fees, /support, the content hubs and
 * the homepage). Built on the Radix Accordion (single, collapsible): Radix
 * owns the trigger wiring (aria-expanded / aria-controls, h3 headers, arrow-key
 * navigation between questions).
 *
 * Owner, 2026-10-05: the old rows were too wide, too padded and too round
 * (20px pills, 28px padding). Now: a narrow centred column (max-w-3xl),
 * rectangles with 8px corners, compact rows, a quiet plus that turns into a
 * cross when open, and answers that run the full row width.
 *
 * Variants:
 *   default  near-black row on the page ground, hairline edge.
 *   square   the content hubs: the marketplace card gradient (MARKET_CARD).
 *   glass    the homepage: blurred translucent surface (`.faq-glass` in
 *            globals.css) with the rotating chevron.
 *
 * Answers open and close with the shared framer-motion Expand. Content is
 * force-mounted, so every answer stays in the server HTML for search, and the
 * FAQPage JSON-LD each page emits matches the visible text exactly.
 *
 * `FaqSection` adds the standard heading: ONE centred H2 and at most one
 * short subtitle.
 */

import { useState } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { cn } from '@/lib/utils'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { Expand } from '@/components/ui/expand'

export interface FaqItem {
  q: string
  a: string
}

export function FaqCards({
  items,
  defaultOpen = 0,
  className,
  square = false,
  glass = false,
}: {
  items: FaqItem[]
  /** Index opened initially; -1 for all closed. */
  defaultOpen?: number
  className?: string
  /** Content-hub variant: marketplace card surface. */
  square?: boolean
  /** Homepage variant: glassmorphic surface, rotating chevron. */
  glass?: boolean
}) {
  const [value, setValue] = useState<string>(defaultOpen >= 0 ? String(defaultOpen) : '')
  return (
    <Accordion.Root
      type="single"
      collapsible
      value={value}
      onValueChange={setValue}
      className={cn('mx-auto mt-6 max-w-3xl', glass ? 'space-y-2' : 'space-y-1.5', className)}
    >
      {items.map((item, i) => {
        const id = String(i)
        const open = value === id
        return (
          <Accordion.Item
            key={id}
            value={id}
            className={cn(
              'transition-colors duration-200',
              glass
                ? cn('faq-glass', open && 'faq-glass--open')
                : square
                  ? cn('overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)
                  : cn(
                      'overflow-hidden rounded-lg transition-colors',
                      open
                        ? 'bg-[#24252B]'
                        : 'bg-[#1D1E23] hover:bg-[#212228]',
                    ),
            )}
          >
            {/* Radix renders the header as an <h3>. */}
            <Accordion.Header className="m-0">
              <Accordion.Trigger
                className={cn(
                  'group flex w-full items-center justify-between text-left',
                  glass ? 'gap-5 px-5 py-4 sm:px-6 sm:py-[18px]' : 'gap-4 px-4 py-3.5 sm:px-5 sm:py-4',
                )}
              >
                <span
                  className={cn(
                    'leading-snug text-text-primary',
                    glass
                      ? 'text-[16px] font-semibold tracking-[-0.005em] sm:text-[17.5px]'
                      : 'text-[15px] font-medium tracking-[-0.005em] sm:text-[15.5px]',
                  )}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex shrink-0 items-center justify-center transition-colors duration-200',
                    glass
                      ? cn(
                          'h-9 w-9 rounded-[7px]',
                          open
                            ? 'bg-[color-mix(in_srgb,var(--color-accent-text)_18%,transparent)] text-[var(--color-accent-text)]'
                            : 'bg-white/[0.05] text-[color-mix(in_srgb,var(--color-accent-text)_75%,transparent)]',
                        )
                      : cn(
                          'h-7 w-7 rounded-md',
                          open ? 'bg-white/[0.09] text-text-primary' : 'bg-white/[0.05] text-text-secondary group-hover:text-text-primary',
                        ),
                  )}
                >
                  {glass ? (
                    <CaretDownIcon
                      size={18}
                      weight="bold"
                      className={cn('transition-transform duration-300', open && 'rotate-180')}
                    />
                  ) : (
                    <PlusIcon
                      size={14}
                      weight="bold"
                      className={cn(
                        'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
                        open && 'rotate-45',
                      )}
                    />
                  )}
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content forceMount asChild>
              <Expand open={open} pullUp={glass ? 4 : 6}>
                <div className={glass ? 'px-5 pb-4 sm:px-6 sm:pb-5' : 'px-4 pb-4 sm:px-5 sm:pb-[18px]'}>
                  <div
                    className={cn(
                      'space-y-2.5 text-text-secondary',
                      glass ? 'text-[14.5px] leading-[1.55] sm:text-[15px]' : 'text-[14.5px] leading-[1.65]',
                    )}
                  >
                    {item.a
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((p, j) => (
                        <p key={j}>{p}</p>
                      ))}
                  </div>
                </div>
              </Expand>
            </Accordion.Content>
          </Accordion.Item>
        )
      })}
    </Accordion.Root>
  )
}

/**
 * The standard FAQ block: one centred H2, at most one short subtitle, then the
 * accordion. Pages emit the matching FAQPage JSON-LD from the same items.
 */
export function FaqSection({
  title,
  sub,
  items,
  className,
  id = 'faq',
}: {
  title: string
  sub?: string
  items: FaqItem[]
  className?: string
  id?: string
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={`${id}-title`} className={cn('mt-12 sm:mt-16', className)}>
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id={`${id}-title`}
          className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]"
        >
          {title}
        </h2>
        {sub && <p className="mt-2 text-[14px] text-text-secondary sm:text-[15px]">{sub}</p>}
      </div>
      <FaqCards items={items} />
    </section>
  )
}
