import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

type GlassIntensity = 'light' | 'medium' | 'heavy'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Glass intensity:
   * - light  → bg white/4,  blur 12px (subtle — listing cards, sidebars)
   * - medium → bg white/7,  blur 16px (default — modals, panels)
   * - heavy  → bg white/10, blur 24px (strong — hero overlays, dialogs)
   */
  intensity?: GlassIntensity
  /** Add a violet glow on hover */
  glow?: boolean
  /** Add a violet glow border (animated) */
  glowBorder?: boolean
  /** Rounded corners (default: 'xl') */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Remove padding (default: p-6) */
  noPadding?: boolean
  /** Add a subtle gradient overlay from top */
  gradient?: boolean
  children: React.ReactNode
}

/**
 * GlassCard — a dark glass morphism card with configurable blur, border, and glow.
 *
 * @example
 * <GlassCard intensity="medium" glow>
 *   <CardContent />
 * </GlassCard>
 *
 * <GlassCard intensity="light" noPadding rounded="2xl">
 *   <ListingImage />
 * </GlassCard>
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      intensity = 'medium',
      glow = false,
      glowBorder = false,
      rounded = 'xl',
      noPadding = false,
      gradient = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const intensityClasses: Record<GlassIntensity, string> = {
      light:  'bg-white/[0.04] backdrop-blur-md  border border-white/[0.08]',
      medium: 'bg-white/[0.07] backdrop-blur-lg  border border-white/[0.10]',
      heavy:  'bg-white/[0.10] backdrop-blur-xl  border border-white/[0.14]',
    }

    const roundedClasses: Record<NonNullable<GlassCardProps['rounded']>, string> = {
      sm:    'rounded-sm',
      md:    'rounded-md',
      lg:    'rounded-lg',
      xl:    'rounded-xl',
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
    }

    return (
      <div
        ref={ref}
        className={cn(
          // Base glass
          intensityClasses[intensity],
          roundedClasses[rounded],
          // Padding
          !noPadding && 'p-6',
          // Shadow
          'shadow-card',
          // Hover glow
          glow && [
            'transition-shadow duration-200',
            'hover:shadow-glow hover:border-violet-500/20',
          ],
          // Animated glow border
          glowBorder && [
            'relative before:absolute before:inset-0 before:rounded-[inherit]',
            'before:p-px before:bg-gradient-to-br before:from-violet-500/30 before:via-transparent before:to-cyan-500/20',
            'before:-z-10',
          ],
          // Gradient overlay
          gradient && 'relative overflow-hidden',
          className
        )}
        {...props}
      >
        {gradient && (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent pointer-events-none rounded-[inherit]"
          />
        )}
        {children}
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'

// ─── Compound parts ───────────────────────────────────────────────────────────

export function GlassCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 pb-4 border-b border-white/[0.06]', className)}
      {...props}
    />
  )
}

export function GlassCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display font-semibold text-lg text-foreground leading-tight', className)}
      {...props}
    />
  )
}

export function GlassCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function GlassCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('pt-4', className)} {...props} />
}

export function GlassCardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center pt-4 border-t border-white/[0.06]', className)}
      {...props}
    />
  )
}
