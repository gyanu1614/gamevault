'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MagneticButtonProps {
  children: React.ReactNode
  className?: string
  /** Magnetic pull strength — 0 to 1 (default: 0.3) */
  strength?: number
  /** Disable magnetic effect (e.g. on mobile) */
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
}

/**
 * MagneticButton — a button that subtly follows the cursor on hover.
 * Gives the Apple/premium "alive" feel to primary CTAs.
 * The effect is subtle by default — strength 0.3 = 30% of cursor offset.
 *
 * @example
 * <MagneticButton className="bg-lime text-text-inverse px-6 py-3 rounded-xl">
 *   Buy Now
 * </MagneticButton>
 */
export function MagneticButton({
  children,
  className,
  strength = 0.3,
  disabled = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const offsetX = (e.clientX - centerX) * strength
    const offsetY = (e.clientY - centerY) * strength
    setPosition({ x: offsetX, y: offsetY })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative inline-flex items-center justify-center cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      {children}
    </motion.button>
  )
}

export default MagneticButton
