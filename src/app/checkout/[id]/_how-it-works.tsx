'use client'

/**
 * How Your Order Works (owner 2026-10-27, "Before you buy" reference): one
 * slim tinted bar under the seals — an info tile, the title and a chevron —
 * that opens to the four steps. Closed by default (owner: "closed on
 * default", "sleek and rectangular", less padding).
 * The old "Chat / Fast Delivery / 24/7 Support" card folded into the steps.
 * Radix Accordion for the disclosure (keyboard, aria-expanded), the house
 * accordion-down/up keyframes for the height.
 */
import * as Accordion from '@radix-ui/react-accordion'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Info } from '@phosphor-icons/react/dist/ssr/Info'
import { CaretDown } from '@phosphor-icons/react/dist/ssr/CaretDown'
import { CreditCard } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { Package } from '@phosphor-icons/react/dist/ssr/Package'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/ssr/ArrowCounterClockwise'

import { TRUST_BLUE } from './_surfaces'

const STEPS: Array<{ Icon: PhosphorIcon; title: string; sub: string }> = [
  { Icon: CreditCard, title: 'Choose Payment Method', sub: 'Every payment is encryption-protected.' },
  { Icon: Package, title: 'Wait for Delivery', sub: 'Most orders arrive within minutes. Chat with your seller anytime.' },
  { Icon: CheckCircle, title: 'Order Delivered', sub: 'Check your items and confirm delivery.' },
  { Icon: ArrowCounterClockwise, title: 'Item Not Received?', sub: '100% refund, guaranteed. Real people help 24/7.' },
]

export function HowItWorks() {
  return (
    <Accordion.Root
      type="single"
      collapsible
      className="rounded-md bg-[rgba(18,24,40,0.78)] shadow-[inset_0_0_0_1px_rgba(106,168,255,0.22)] backdrop-blur-xl"
    >
      <Accordion.Item value="how">
        <Accordion.Header className="m-0">
          <Accordion.Trigger className="group flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02] sm:px-4">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[rgba(106,168,255,0.16)]">
              <Info size={17} weight="fill" color={TRUST_BLUE} />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#E9EDF2]">How Your Order Works</span>
            <CaretDown
              aria-hidden
              size={16}
              weight="bold"
              className="ml-auto shrink-0 text-[#C9D2DC] transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <ol className="mx-3.5 grid grid-cols-1 gap-x-8 gap-y-3.5 border-t border-white/[0.08] pb-4 pt-3.5 sm:mx-4 sm:grid-cols-2">
            {STEPS.map(({ Icon, title, sub }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon aria-hidden size={20} weight="duotone" color={TRUST_BLUE} className="mt-[1px] shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-snug text-[#E9EDF2]">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#9AA6B3]">{sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}
