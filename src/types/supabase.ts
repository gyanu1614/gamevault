import { Database } from './database.types'

// Main Database type
export type DB = Database

// Table row types for easier imports
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Listing = Database['public']['Tables']['listings']['Row']
export type ListingInsert = Database['public']['Tables']['listings']['Insert']
export type ListingUpdate = Database['public']['Tables']['listings']['Update']

export type Order = Database['public']['Tables']['orders']['Row']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']

export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update']

export type Dispute = Database['public']['Tables']['disputes']['Row']
export type DisputeInsert = Database['public']['Tables']['disputes']['Insert']
export type DisputeUpdate = Database['public']['Tables']['disputes']['Update']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update']

export type Game = Database['public']['Tables']['games']['Row']
export type GameInsert = Database['public']['Tables']['games']['Insert']
export type GameUpdate = Database['public']['Tables']['games']['Update']

export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type InstantDeliveryInventory = Database['public']['Tables']['instant_delivery_inventory']['Row']
export type InstantDeliveryInventoryInsert = Database['public']['Tables']['instant_delivery_inventory']['Insert']
export type InstantDeliveryInventoryUpdate = Database['public']['Tables']['instant_delivery_inventory']['Update']

export type WalletBalance = Database['public']['Tables']['wallet_balances']['Row']
export type WalletBalanceInsert = Database['public']['Tables']['wallet_balances']['Insert']
export type WalletBalanceUpdate = Database['public']['Tables']['wallet_balances']['Update']

export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row']
export type WalletTransactionInsert = Database['public']['Tables']['wallet_transactions']['Insert']
export type WalletTransactionUpdate = Database['public']['Tables']['wallet_transactions']['Update']

export type SellerApplication = Database['public']['Tables']['seller_applications']['Row']
export type SellerApplicationInsert = Database['public']['Tables']['seller_applications']['Insert']
export type SellerApplicationUpdate = Database['public']['Tables']['seller_applications']['Update']

export type OrderCancellationRequest = Database['public']['Tables']['order_cancellation_requests']['Row']
export type OrderCancellationRequestInsert = Database['public']['Tables']['order_cancellation_requests']['Insert']
export type OrderCancellationRequestUpdate = Database['public']['Tables']['order_cancellation_requests']['Update']

export type PromoCode = Database['public']['Tables']['promo_codes']['Row']
export type PromoCodeInsert = Database['public']['Tables']['promo_codes']['Insert']
export type PromoCodeUpdate = Database['public']['Tables']['promo_codes']['Update']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']

// Enums
export type AdminRole = Database['public']['Enums']['admin_role_enum'] | null
export type DisputeReason = Database['public']['Enums']['dispute_reason_enum'] | null
export type DisputeStatus = Database['public']['Enums']['dispute_status_enum'] | null
export type WalletTransactionType = any | null

// Helper types for common query patterns
export type ListingWithRelations = Listing & {
  seller?: Profile
  game?: Game
  category?: Category
}

export type OrderWithRelations = Order & {
  buyer?: Profile
  seller?: Profile
  listing?: ListingWithRelations
  review?: Review
}

export type ReviewWithRelations = Review & {
  reviewer?: Profile
  seller?: Profile
  listing?: Listing
}

export type ConversationWithRelations = Conversation & {
  buyer?: Profile
  seller?: Profile
  order?: Order
  listing?: Listing
}

export type DisputeWithRelations = Dispute & {
  buyer?: Profile
  seller?: Profile
  assigned_to?: Profile
  resolved_by?: Profile
}
