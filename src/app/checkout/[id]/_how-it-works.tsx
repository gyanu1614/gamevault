'use client'

/**
 * How Your Order Works (owner 2026-10-27, "Before you buy" reference): one
 * tinted panel under the seals — an info disc, the title and a chevron —
 * that opens to the four steps. Open by default; the buyer can fold it.
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
      defaultValue="how"
      className="rounded-lg bg-[rgba(18,24,40,0.78)] shadow-[inset_0_0_0_1px_rgba(106,168,255,0.22)] backdrop-blur-xl"
    >
      <Accordion.Item value="how">
        <Accordion.Header className="m-0">
          <Accordion.Trigger className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left sm:px-5">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[rgba(106,168,255,0.16)]">
              <Info size={20} weight="fill" color={TRUST_BLUE} />
            </span>
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-[#E9EDF2]">How Your Order Works</span>
            <CaretDown
              aria-hidden
              size={18}
              weight="bold"
              className="ml-auto shrink-0 text-[#C9D2DC] transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <ol className="mx-4 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-white/[0.08] pb-5 pt-4 sm:mx-5 sm:grid-cols-2">
            {STEPS.map(({ Icon, title, sub }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon aria-hidden size={22} weight="duotone" color={TRUST_BLUE} className="mt-[1px] shrink-0" />
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
