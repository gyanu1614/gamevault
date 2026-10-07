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

export interface DeliveryStep {
  title: string
  body: string
}

const EASE = [0.16, 1, 0.3, 1] as const

function FlowArrow({ vertical, delay }: { vertical: boolean; delay: number }) {
  const reduce = useReducedMotion()
  const Icon = vertical ? CaretDownIcon : CaretRightIcon
  return (
    <span aria-hidden className={vertical ? 'flex h-8 items-center justify-center md:hidden' : 'hidden items-center pt-4 md:flex'}>
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

export function DeliverySteps({ steps }: { steps: DeliveryStep[] }) {
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
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[rgba(45,212,191,0.12)] text-[15px] font-semibold tabular-nums text-[#5EEAD4]">
              {i + 1}
            </span>
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
