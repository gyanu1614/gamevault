'use client'

import { Heart, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useWishlist } from '@/hooks/use-wishlist'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'

interface WishlistButtonProps {
  listingId: string
  variant?: 'default' | 'compact' | 'card'
  className?: string
  showLabel?: boolean
}

export default function WishlistButton({
  listingId,
  variant = 'default',
  className,
  showLabel = false,
}: WishlistButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { isInWishlist, toggleWishlist, isAddingToWishlist, isRemovingFromWishlist } = useWishlist()

  const isWishlisted = isInWishlist(listingId)
  const isLoading = isAddingToWishlist || isRemovingFromWishlist

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    await toggleWishlist(listingId)
  }

  // Variant styles
  const variantStyles = {
    default: {
      container: 'p-2.5 hover:bg-white/[0.08] rounded-xl',
      icon: 'h-5 w-5',
    },
    compact: {
      container: 'p-2 hover:bg-white/[0.08] rounded-lg',
      icon: 'h-4 w-4',
    },
    card: {
      container: 'p-2 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-lg',
      icon: 'h-4 w-4',
    },
  }

  const styles = variantStyles[variant]

  return (
    <motion.button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'relative flex items-center gap-2 transition-all duration-200',
        styles.container,
        isLoading && 'cursor-not-allowed opacity-50',
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Loader2 className={cn(styles.icon, 'animate-spin text-violet-400')} />
          </motion.div>
        ) : (
          <motion.div
            key={`heart-${isWishlisted}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 15
            }}
            className="relative"
          >
            <motion.div
              animate={isWishlisted ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart
                className={cn(
                  styles.icon,
                  'transition-colors duration-200',
                  isWishlisted
                    ? 'fill-violet-500 text-violet-500'
                    : 'text-white hover:text-violet-400'
                )}
              />
            </motion.div>

            {/* Pulse animation when added */}
            {isWishlisted && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Heart className={cn(styles.icon, 'fill-violet-500 text-violet-500')} />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showLabel && (
        <span className="text-sm font-medium text-white">
          {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
        </span>
      )}

      {/* Tooltip for compact variants */}
      {!showLabel && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
          <div className="bg-gray-900 text-white text-xs py-1.5 px-3 rounded-lg whitespace-nowrap shadow-lg border border-white/10">
            {isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          </div>
        </div>
      )}
    </motion.button>
  )
}
