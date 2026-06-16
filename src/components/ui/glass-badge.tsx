import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

type BadgeVariant = 'default' | 'primary' | 'cyan' | 'success' | 'warning' | 'error' | 'muted'
type BadgeSize = 'sm' | 'md' | 'lg'

interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  /** Add a pulsing dot indicator on the left */
  dot?: boolean
  /** Dot is animated (pulsing) — use for live/online status */
  dotPulse?: boolean
  children: React.ReactNode
}

/**
 * GlassBadge — frosted glass status badge with color variants.
 *
 * @example
 * <GlassBadge variant="success" dot dotPulse>Online</GlassBadge>
 * <GlassBadge variant="primary">Gold Seller</GlassBadge>
 * <GlassBadge variant="warning">Awaiting Delivery</GlassBadge>
 */
export const GlassBadge = forwardRef<HTMLSpanElement, GlassBadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, dotPulse = false, className, children, ...props }, ref) => {

    const variantStyles: Record<BadgeVariant, string> = {
      default: 'bg-white/[0.07] text-white/80  border-white/[0.12]',
      primary: 'bg-lime/15 text-lime-text border-lime-tint-border',
      cyan:    'bg-cyan-500/15   text-cyan-300   border-cyan-500/25',
      success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      warning: 'bg-amber-500/15  text-amber-300   border-amber-500/25',
      error:   'bg-red-500/15    text-error     border-red-500/25',
      muted:   'bg-bg-raised text-white/50     border-border-subtle',
    }

    const dotColors: Record<BadgeVariant, string> = {
      default: 'bg-white/60',
      primary: 'bg-violet-400',
      cyan:    'bg-cyan-400',
      success: 'bg-emerald-400',
      warning: 'bg-amber-400',
      error:   'bg-red-400',
      muted:   'bg-white/30',
    }

    const sizeStyles: Record<BadgeSize, string> = {
      sm: 'text-[10px] px-1.5 py-0.5 gap-1',
      md: 'text-xs    px-2   py-1   gap-1.5',
      lg: 'text-sm    px-3   py-1.5 gap-2',
    }

    const dotSizes: Record<BadgeSize, string> = {
      sm: 'w-1.5 h-1.5',
      md: 'w-2   h-2',
      lg: 'w-2.5 h-2.5',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          'backdrop-blur-md border',
          'transition-colors duration-150',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn('relative flex shrink-0', dotSizes[size])}>
            {dotPulse && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                  dotColors[variant]
                )}
              />
            )}
            <span className={cn('relative inline-flex rounded-full', dotSizes[size], dotColors[variant])} />
          </span>
        )}
        {children}
      </span>
    )
  }
)

GlassBadge.displayName = 'GlassBadge'

export default GlassBadge
