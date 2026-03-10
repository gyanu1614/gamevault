import { useRef } from 'react'
import { useInView } from 'framer-motion'

interface UseScrollRevealOptions {
  /** IntersectionObserver threshold 0-1 (default: 0.1) */
  threshold?: number
  /** Margin before element is considered in view (default: '-50px') */
  margin?: string
  /** Only trigger once (default: true) */
  once?: boolean
}

/**
 * useScrollReveal — IntersectionObserver-based scroll reveal hook.
 * Returns a ref to attach to the target element and a boolean for visibility.
 *
 * Use with Framer Motion's `animate` prop for manual control,
 * or use the <FadeIn> and <StaggerList> components for declarative API.
 *
 * @example
 * const { ref, isInView } = useScrollReveal()
 *
 * <motion.div
 *   ref={ref}
 *   initial={{ opacity: 0, y: 20 }}
 *   animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
 * />
 */
export function useScrollReveal({
  threshold = 0.1,
  margin = '-50px',
  once = true,
}: UseScrollRevealOptions = {}) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, {
    once,
    margin: margin as `${number}px`,
    amount: threshold,
  })

  return { ref, isInView }
}

export default useScrollReveal
