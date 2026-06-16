import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label displayed above the input */
  label?: string
  /** Helper text below the input */
  hint?: string
  /** Error message (replaces hint, shows red border) */
  error?: string
  /** Icon slot — rendered on the left side of the input */
  leftIcon?: React.ReactNode
  /** Icon/element slot — rendered on the right side */
  rightElement?: React.ReactNode
  /** Size variant */
  inputSize?: 'sm' | 'md' | 'lg'
  /** Full width container (default: true) */
  fullWidth?: boolean
}

/**
 * GlassInput — a glass morphism styled input field with label, hints, and icon slots.
 *
 * @example
 * <GlassInput
 *   label="Search listings"
 *   placeholder="Roblox Robux..."
 *   leftIcon={<Search className="w-4 h-4" />}
 * />
 *
 * <GlassInput
 *   label="Price"
 *   type="number"
 *   leftIcon={<span className="text-xs font-mono">$</span>}
 *   error="Price must be greater than $0"
 * />
 */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightElement,
      inputSize = 'md',
      fullWidth = true,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    const sizeClasses: Record<NonNullable<GlassInputProps['inputSize']>, string> = {
      sm: 'h-8  text-xs px-2.5',
      md: 'h-10 text-sm px-3',
      lg: 'h-12 text-sm px-4',
    }

    const iconPadding: Record<NonNullable<GlassInputProps['inputSize']>, string> = {
      sm: leftIcon ? 'pl-7'  : '',
      md: leftIcon ? 'pl-9'  : '',
      lg: leftIcon ? 'pl-11' : '',
    }

    const rightPadding: Record<NonNullable<GlassInputProps['inputSize']>, string> = {
      sm: rightElement ? 'pr-7'  : '',
      md: rightElement ? 'pr-9'  : '',
      lg: rightElement ? 'pr-11' : '',
    }

    const iconSize: Record<NonNullable<GlassInputProps['inputSize']>, string> = {
      sm: 'left-2   w-3.5 h-3.5',
      md: 'left-2.5 w-4   h-4',
      lg: 'left-3   w-5   h-5',
    }

    const rightIconSize: Record<NonNullable<GlassInputProps['inputSize']>, string> = {
      sm: 'right-2   w-3.5 h-3.5',
      md: 'right-2.5 w-4   h-4',
      lg: 'right-3   w-5   h-5',
    }

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground/80"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center',
                iconSize[inputSize]
              )}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              // Glass base
              'w-full rounded-lg',
              'bg-bg-raised-hover backdrop-blur-sm',
              'border border-white/[0.10]',
              'text-foreground placeholder:text-muted-foreground',
              // Focus
              'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-lime',
              // Disabled
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Transition
              'transition-all duration-150',
              // Size
              sizeClasses[inputSize],
              iconPadding[inputSize],
              rightPadding[inputSize],
              // Error state
              error && 'border-red-500/50 focus:ring-red-500/40 focus:border-red-500/50',
              className
            )}
            {...props}
          />

          {/* Right element */}
          {rightElement && (
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 flex items-center text-muted-foreground',
                rightIconSize[inputSize]
              )}
            >
              {rightElement}
            </span>
          )}
        </div>

        {/* Hint / Error */}
        {(hint || error) && (
          <p className={cn('text-xs', error ? 'text-error' : 'text-muted-foreground')}>
            {error ?? hint}
          </p>
        )}
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'

// ─── Textarea variant ─────────────────────────────────────────────────────────

interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  fullWidth?: boolean
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ label, hint, error, fullWidth = true, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground/80">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg min-h-[80px] px-3 py-2.5 text-sm resize-y',
            'bg-bg-raised-hover backdrop-blur-sm',
            'border border-white/[0.10]',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-lime',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-150',
            error && 'border-red-500/50 focus:ring-red-500/40',
            className
          )}
          {...props}
        />
        {(hint || error) && (
          <p className={cn('text-xs', error ? 'text-error' : 'text-muted-foreground')}>
            {error ?? hint}
          </p>
        )}
      </div>
    )
  }
)

GlassTextarea.displayName = 'GlassTextarea'
