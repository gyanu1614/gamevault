/**
 * Cart Hook
 * @deprecated Cart system removed in favor of direct "Buy Now" checkout (Feb 2026).
 * This file is kept for backwards compatibility but should not be used in new code.
 * See: progress/24feb/03_CHECKOUT_VAULTSHIELD_CART_FIXES.md
 *
 * Legacy code - DO NOT USE
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'

export interface CartItem {
  listingId: string
  title: string
  price: number
  image: string
  sellerId: string
  sellerUsername: string
  gameSlug: string
  categorySlug: string
  listingSlug: string
  quantity: number
  maxQuantity: number
  isUnlimited: boolean
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (listingId: string) => void
  updateQuantity: (listingId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const items = get().items
        const existingItem = items.find((i) => i.listingId === item.listingId)

        if (existingItem) {
          // Update quantity if item already in cart
          const newQuantity = existingItem.quantity + 1
          if (!item.isUnlimited && newQuantity > item.maxQuantity) {
            toast.error(`Maximum ${item.maxQuantity} items available`)
            return
          }
          set({
            items: items.map((i) =>
              i.listingId === item.listingId
                ? { ...i, quantity: newQuantity }
                : i
            ),
          })
          toast.success('Quantity updated in cart')
        } else {
          // Add new item
          set({
            items: [...items, { ...item, quantity: 1 }],
          })
          toast.success('Added to cart')
        }
      },

      removeItem: (listingId) => {
        set({
          items: get().items.filter((i) => i.listingId !== listingId),
        })
        toast.success('Removed from cart')
      },

      updateQuantity: (listingId, quantity) => {
        const items = get().items
        const item = items.find((i) => i.listingId === listingId)

        if (!item) return

        if (quantity < 1) {
          get().removeItem(listingId)
          return
        }

        if (!item.isUnlimited && quantity > item.maxQuantity) {
          toast.error(`Maximum ${item.maxQuantity} items available`)
          return
        }

        set({
          items: items.map((i) =>
            i.listingId === listingId ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => {
        set({ items: [] })
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
    }
  )
)
