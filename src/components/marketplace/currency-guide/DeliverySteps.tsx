'use client'

/**
 * The delivery steps, joined by arrows that keep moving forward (Framer
 * Motion): a row on desktop, a column with down-arrows on a phone. The steps
 * rise in one after another the first time they scroll into view. Every word
 * is in the server HTML; reduced motion keeps everything still.
 */

import { Fragment } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { TicketIcon } from '@phosphor-icons/react/dist/csr/Ticket'
import { LinkIcon } from '@phosphor-icons/react/dist/csr/Link'
import { HandCoinsIcon } from '@phosphor-icons/react/dist/csr/HandCoins'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/csr/ChatCircleDots'
import { GiftIcon } from '@phosphor-icons/react/dist/csr/Gift'
import { KeyIcon } from '@phosphor-icons/react/dist/csr/Key'
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

export type StepIcon = 'pass' | 'link' | 'seller' | 'currency' | 'chat' | 'gift' | 'key' | 'store' | 'check' | 'cart'

export interface DeliveryStep {
  title: string
  body: string
  icon?: StepIcon
}

const ICONS: Record<Exclude<StepIcon, 'currency'>, PhosphorIcon> = {
  pass: TicketIcon,
  link: LinkIcon,
  seller: HandCoinsIcon,
  chat: ChatCircleDotsIcon,
  gift: GiftIcon,
  key: KeyIcon,
  store: StorefrontIcon,
  check: SealCheckIcon,
  cart: ShoppingCartIcon,
}

/** The step's mark: its icon, the currency's own icon, or (no icon set) its number. */
function StepMark({
  step,
  n,
  currencyIconUrl,
  currencyName,
}: {
  step: DeliveryStep
  n: number
  currencyIconUrl?: string | null
  currencyName?: string
}) {
  if (step.icon === 'currency' && currencyIconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded currency icon
      <img src={currencyIconUrl} alt={currencyName ? `${currencyName} icon` : 'Currency icon'} aria-hidden className="mx-auto h-12 w-12 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />
    )
  }
  const Icon = step.icon && step.icon !== 'currency' ? ICONS[step.icon] : null
  return (
    <span aria-hidden className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[rgba(45,212,191,0.12)] text-[#5EEAD4]">
      {Icon ? <Icon size={24} weight="duotone" /> : <span className="text-[15px] font-semibold tabular-nums">{n}</span>}
    </span>
  )
}

const EASE = [0.16, 1, 0.3, 1] as const

function FlowArrow({ vertical, delay }: { vertical: boolean; delay: number }) {
  const reduce = useReducedMotion()
  const Icon = vertical ? CaretDownIcon : CaretRightIcon
  return (
    <span aria-hidden className={vertical ? 'flex h-8 items-center justify-center md:hidden' : 'hidden items-center pt-5 md:flex'}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={vertical ? '-my-1.5 text-[#5EEAD4]' : '-mx-1 text-[#5EEAD4]'}
          initial={{ opacity: 0.15 }}
          animate={reduce ? { opacity: 0.5 } : { opacity: [0.15, 1, 0.15] }}
          transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, delay: delay + i * 0.18, ease: 'easeInOut' }}
        >
          <Icon size={14} weight="bold" />
        </motion.span>
      ))}
    </span>
  )
}

export function DeliverySteps({
  steps,
  currencyIconUrl,
  currencyName,
}: {
  steps: DeliveryStep[]
  currencyIconUrl?: string | null
  currencyName?: string
}) {
  const reduce = useReducedMotion()
  return (
    <ol className="mx-auto mt-8 flex max-w-4xl flex-col items-stretch md:flex-row md:items-start md:justify-center">
      {steps.map((s, i) => (
        <Fragment key={s.title}>
          <motion.li
            className="mx-auto w-full max-w-[16rem] text-center md:mx-0 md:flex-1"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: 0.5, ease: EASE, delay: i * 0.12 }}
          >
            <StepMark step={s} n={i + 1} currencyIconUrl={currencyIconUrl} currencyName={currencyName} />
            <span className="sr-only">Step {i + 1}: </span>
            <p className="mt-3 text-[15px] font-semibold text-text-primary">{s.title}</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-[13.5px] leading-5 text-text-secondary">{s.body}</p>
          </motion.li>
          {i < steps.length - 1 && (
            <li aria-hidden className="contents">
              <FlowArrow vertical delay={i * 0.25} />
              <FlowArrow vertical={false} delay={i * 0.25} />
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  )
}
