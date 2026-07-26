'use client'

/**
 * Animated "How selling works" flow for the /sell landing pages.
 *
 * Client component (framer-motion) so the server page.tsx can stay a
 * data-fetching server component. Three steps read as a left→right flow:
 * connector arrows between columns on desktop, a staggered fade-up reveal
 * when the row scrolls into view, and a soft accent glow + hover lift on
 * each icon — richer than bare text, but still "floating" (no boxed cards).
 * Respects prefers-reduced-motion.
 */

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Tag, ShieldCheck, Wallet, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: Tag,
    title: 'List it free',
    desc: 'Create your listing in minutes. No upfront cost — you only pay commission when it sells.',
  },
  {
    icon: ShieldCheck,
    title: 'Buyer pays into SafeDrop',
    desc: 'The buyer pays up front before you deliver. You never hand over goods hoping to get paid.',
  },
  {
    icon: Wallet,
    title: 'Get paid safely',
    desc: 'Once the buyer confirms, your proceeds are released — protected from chargebacks.',
  },
] as const

export function HowSellingWorks() {
  const reduce = useReducedMotion()

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.14, delayChildren: 0.05 },
    },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  }
  const arrow: Variants = {
    hidden: { opacity: 0, scale: 0.7 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      className="mx-auto grid max-w-4xl items-start gap-y-10 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-x-2"
    >
      {STEPS.map((step, i) => (
        <div key={step.title} className="contents">
          <motion.div variants={item} className="group text-center sm:px-2">
            {/* Icon with a soft accent glow — floating, not a boxed card. */}
            <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-lime/15 blur-lg transition-all duration-300 group-hover:bg-lime/25"
              />
              <motion.span
                aria-hidden
                whileHover={reduce ? undefined : { scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="relative grid h-14 w-14 place-items-center rounded-full ring-1 ring-lime/25"
              >
                <step.icon className="h-6 w-6 text-lime-text" strokeWidth={2} />
              </motion.span>
            </div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-text/70">
              Step {i + 1}
            </span>
            <h3 className="mb-1.5 text-[16px] font-semibold text-foreground">{step.title}</h3>
            <p className="mx-auto max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
              {step.desc}
            </p>
          </motion.div>

          {/* Connector arrow between steps (desktop only). */}
          {i < STEPS.length - 1 && (
            <motion.div
              variants={arrow}
              aria-hidden
              className="hidden items-center self-center pt-2 sm:flex"
            >
              <motion.span
                animate={reduce ? undefined : { x: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="text-lime-text/50"
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
              </motion.span>
            </motion.div>
          )}
        </div>
      ))}
    </motion.div>
  )
}
