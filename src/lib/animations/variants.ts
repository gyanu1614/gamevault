/**
 * DropMarket Animation Variants
 * Centralised Framer Motion variants for consistent animations across the app.
 *
 * Philosophy:
 * - Spring physics ONLY for interactive elements (feels alive, not mechanical)
 * - Linear easing ONLY for page exits (quick, doesn't distract)
 * - Stagger children = personality in lists
 * - Blur on enter = depth and polish (Apple-inspired)
 */

import type { Variants } from 'framer-motion'

// ─── Spring Configs ──────────────────────────────────────────────────────────
// Import these for use in whileHover, transition overrides, etc.

export const springs = {
  snappy:  { type: 'spring' as const, damping: 25, stiffness: 300 },
  smooth:  { type: 'spring' as const, damping: 30, stiffness: 200 },
  bouncy:  { type: 'spring' as const, damping: 15, stiffness: 250 },
  slow:    { type: 'spring' as const, damping: 40, stiffness: 150 },
  gentle:  { type: 'spring' as const, damping: 35, stiffness: 180 },
} as const

// ─── Page Transitions ────────────────────────────────────────────────────────

/** Used in page-level layouts. Wrap page content with <PageTransition> */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.42, 0, 1, 1] },
  },
}

// ─── Fade Variants ───────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
}

// ─── Scale Variants ──────────────────────────────────────────────────────────

/** For modals, popovers, dropdowns */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springs.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: [0.42, 0, 1, 1] },
  },
}

export const scaleInFull: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springs.bouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15 },
  },
}

// ─── Slide Variants ──────────────────────────────────────────────────────────

export const slideRight: Variants = {
  initial: { x: '-100%', opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: springs.smooth,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { duration: 0.25, ease: [0.42, 0, 1, 1] },
  },
}

export const slideLeft: Variants = {
  initial: { x: '100%', opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: springs.smooth,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.25, ease: [0.42, 0, 1, 1] },
  },
}

export const slideUp: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: springs.smooth,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.3, ease: [0.42, 0, 1, 1] },
  },
}

export const slideDown: Variants = {
  initial: { y: '-100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: springs.smooth,
  },
  exit: {
    y: '-100%',
    opacity: 0,
    transition: { duration: 0.25, ease: [0.42, 0, 1, 1] },
  },
}

// ─── Stagger Variants ────────────────────────────────────────────────────────

/** Parent container for staggered lists (listing cards, review cards, etc.) */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
}

/** Child item for staggered lists — uses blur for polish */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: springs.smooth,
  },
}

/** Faster stagger for smaller components (badges, pills) */
export const staggerItemFast: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: springs.snappy,
  },
}

/** Horizontal stagger — for grid items, stat cards */
export const staggerItemHorizontal: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: {
    opacity: 1,
    x: 0,
    transition: springs.smooth,
  },
}

// ─── Hover & Tap Interactions ────────────────────────────────────────────────

/** Standard card hover — lift + glow */
export const cardHover = {
  whileHover: {
    y: -4,
    boxShadow: '0 0 24px rgba(139, 92, 246, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
  whileTap: { scale: 0.98, transition: { duration: 0.1 } },
}

/** Button glow hover */
export const buttonHover = {
  whileHover: {
    scale: 1.02,
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
    transition: { duration: 0.2 },
  },
  whileTap: { scale: 0.97, transition: { duration: 0.1 } },
}

/** Subtle hover for list items */
export const listItemHover = {
  whileHover: {
    x: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    transition: { duration: 0.15 },
  },
}

/** Icon hover — spin + scale */
export const iconHover = {
  whileHover: { scale: 1.15, rotate: 5, transition: springs.snappy },
  whileTap:   { scale: 0.9 },
}

// ─── Notification / Toast ────────────────────────────────────────────────────

export const notificationVariants: Variants = {
  initial: { opacity: 0, x: 60, scale: 0.9 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springs.snappy,
  },
  exit: {
    opacity: 0,
    x: 60,
    scale: 0.9,
    transition: { duration: 0.2, ease: [0.42, 0, 1, 1] },
  },
}

// ─── Accordion / Collapse ────────────────────────────────────────────────────

export const collapseVariants: Variants = {
  closed: { height: 0, opacity: 0, overflow: 'hidden' },
  open: {
    height: 'auto',
    opacity: 1,
    overflow: 'hidden',
    transition: { ...springs.smooth, opacity: { duration: 0.2 } },
  },
}

// ─── Overlay / Backdrop ──────────────────────────────────────────────────────

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.25 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
}

// ─── Number Counter ──────────────────────────────────────────────────────────

/** Use with useMotionValue + useTransform for animated number changes */
export const counterTransition = { type: 'spring' as const, damping: 30, stiffness: 100 }

// ─── Scroll Reveal (use with useInView) ──────────────────────────────────────

/** Generic scroll reveal — fade + lift */
export const scrollReveal: Variants = {
  offscreen: { opacity: 0, y: 32 },
  onscreen: {
    opacity: 1,
    y: 0,
    transition: { ...springs.smooth, duration: 0.5 },
  },
}

/** Scroll reveal for images — scale from slightly zoomed */
export const imageReveal: Variants = {
  offscreen: { opacity: 0, scale: 1.05 },
  onscreen: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
}
