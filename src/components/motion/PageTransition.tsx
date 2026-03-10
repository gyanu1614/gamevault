'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { pageVariants } from '@/lib/animations/variants'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * PageTransition — wraps page content with enter/exit animation.
 * Place inside a layout.tsx that wraps page routes.
 *
 * NOTE: AnimatePresence needs the `key` to be the current route.
 * The component reads the pathname automatically.
 *
 * @example
 * // In a layout.tsx
 * <PageTransition>
 *   {children}
 * </PageTransition>
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn('min-h-screen', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default PageTransition
