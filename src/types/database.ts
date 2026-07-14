// Database Types
// Generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          email: string | null
          role: 'buyer' | 'seller' | 'admin' | null
          is_verified: boolean
          created_at: string
          updated_at: string
          seller_tier: 'bronze' | 'silver' | 'gold' | 'platinum'
          total_sales: number
          seller_rating: number
          total_reviews: number
          positive_reviews: number
          kyc_status: 'pending' | 'approved' | 'rejected'
          kyc_submitted_at: string | null
          stripe_account_id: string | null
          payout_enabled: boolean
          shop_name: string | null
          shop_slug: string | null
          shop_name_updated_at: string | null
          business_name: string | null
          paypal_email: string | null
          // Stripe Connect Express fields (added via migration 20260217_stripe_connect.sql)
          stripe_connect_account_id: string | null
          stripe_connect_status: 'not_connected' | 'pending' | 'restricted' | 'active' | 'disabled' | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_payouts_enabled: boolean
          stripe_connect_onboarding_url: string | null
          stripe_connect_connected_at: string | null
          seller_balance: number
          pending_balance: number
          lifetime_earnings: number
          // P5.1 — Referral program (added via 20260218_referral_program.sql)
          referral_code: string | null
          referred_by: string | null
          // P5.2 — Loyalty & cashback (added via 20260218_loyalty_program.sql)
          loyalty_balance: number
          lifetime_cashback_earned: number
          // P6.4 — INFORM Act (optional — column has DB DEFAULT, narrow selects may omit it)
          inform_status?: 'not_required' | 'required' | 'submitted' | 'certified' | 'rejected'
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          role?: 'buyer' | 'seller' | 'admin' | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
          seller_tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
          total_sales?: number
          seller_rating?: number
          total_reviews?: number
          positive_reviews?: number
          kyc_status?: 'pending' | 'approved' | 'rejected'
          kyc_submitted_at?: string | null
          stripe_account_id?: string | null
          payout_enabled?: boolean
          shop_name?: string | null
          shop_slug?: string | null
          shop_name_updated_at?: string | null
          business_name?: string | null
          paypal_email?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: 'not_connected' | 'pending' | 'restricted' | 'active' | 'disabled' | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_connect_onboarding_url?: string | null
          stripe_connect_connected_at?: string | null
          seller_balance?: number
          pending_balance?: number
          lifetime_earnings?: number
          referral_code?: string | null
          referred_by?: string | null
          loyalty_balance?: number
          lifetime_cashback_earned?: number
          inform_status?: 'not_required' | 'required' | 'submitted' | 'certified' | 'rejected'
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          role?: 'buyer' | 'seller' | 'admin' | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
          seller_tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
          total_sales?: number
          seller_rating?: number
          total_reviews?: number
          positive_reviews?: number
          kyc_status?: 'pending' | 'approved' | 'rejected'
          kyc_submitted_at?: string | null
          stripe_account_id?: string | null
          payout_enabled?: boolean
          shop_name?: string | null
          shop_slug?: string | null
          shop_name_updated_at?: string | null
          business_name?: string | null
          paypal_email?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: 'not_connected' | 'pending' | 'restricted' | 'active' | 'disabled' | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_connect_onboarding_url?: string | null
          stripe_connect_connected_at?: string | null
          seller_balance?: number
          pending_balance?: number
          lifetime_earnings?: number
          referral_code?: string | null
          referred_by?: string | null
          loyalty_balance?: number
          lifetime_cashback_earned?: number
          inform_status?: 'not_required' | 'required' | 'submitted' | 'certified' | 'rejected'
        }
      }
      games: {
        Row: {
          id: string
          name: string
          slug: string
          emoji: string | null
          image_url: string | null
          description: string | null
          is_active: boolean
          is_featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          emoji?: string | null
          image_url?: string | null
          description?: string | null
          is_active?: boolean
          is_featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          emoji?: string | null
          image_url?: string | null
          description?: string | null
          is_active?: boolean
          is_featured?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          icon?: string | null
          created_at?: string
        }
      }
      listings: {
        Row: {
          id: string
          seller_id: string
          game_id: string
          category_id: string
          slug?: string | null
          title: string
          description: string
          price: number
          original_price: number | null
          currency: string
          quantity: number
          is_unlimited: boolean
          status: 'draft' | 'active' | 'sold' | 'archived' | 'suspended'
          images: string[]
          delivery_time: string
          delivery_method: string
          views: number
          sales: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          game_id: string
          category_id: string
          title: string
          description: string
          price: number
          original_price?: number | null
          currency?: string
          quantity?: number
          is_unlimited?: boolean
          status?: 'draft' | 'active' | 'sold' | 'archived' | 'suspended'
          images?: string[]
          delivery_time?: string
          delivery_method?: string
          views?: number
          sales?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          game_id?: string
          category_id?: string
          title?: string
          description?: string
          price?: number
          original_price?: number | null
          currency?: string
          quantity?: number
          is_unlimited?: boolean
          status?: 'draft' | 'active' | 'sold' | 'archived' | 'suspended'
          images?: string[]
          delivery_time?: string
          delivery_method?: string
          views?: number
          sales?: number
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          buyer_id: string
          seller_id: string
          listing_id: string
          quantity: number
          unit_price: number
          subtotal: number
          platform_fee_rate: number
          payment_processing_fee_rate: number
          platform_fee: number
          payment_processing_fee: number
          total_amount: number
          seller_payout: number
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          status:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'completed'
            | 'disputed'
            | 'refunded'
            | 'cancelled'
          protection_until: string | null
          delivery_details: Json | null
          delivered_at: string | null
          dispute_reason: string | null
          disputed_at: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          // SafeDrop tier columns (P4.1)
          vaultshield_level: 'standard' | 'enhanced' | 'premium' | null
          vaultshield_tier_fee_rate: number
          vaultshield_tier_fee: number
          warranty_expires_at: string | null
          escrow_status: 'held' | 'released' | 'refunded' | 'frozen' | null
          auto_release_at: string | null
          release_method: 'auto' | 'buyer_confirmed' | 'admin' | 'dispute_resolved' | null
          delivery_evidence_required: boolean | null
          delivery_evidence_urls: string[] | null
          buyer_confirmed_at: string | null
          seller_marked_delivered_at: string | null
          is_guest_order: boolean | null
          version: number | null
          cancelled_at: string | null
          // P5.3 — Promo codes
          promo_code_id: string | null
          promo_discount: number
        }
        Insert: {
          id?: string
          buyer_id: string
          seller_id: string
          listing_id: string
          quantity?: number
          unit_price: number
          subtotal: number
          platform_fee_rate: number
          payment_processing_fee_rate: number
          platform_fee: number
          payment_processing_fee: number
          total_amount: number
          seller_payout: number
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          status?:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'completed'
            | 'disputed'
            | 'refunded'
            | 'cancelled'
          protection_until?: string | null
          delivery_details?: Json | null
          delivered_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          // SafeDrop tier columns (P4.1)
          vaultshield_level?: 'standard' | 'enhanced' | 'premium' | null
          vaultshield_tier_fee_rate?: number
          vaultshield_tier_fee?: number
          warranty_expires_at?: string | null
          escrow_status?: 'held' | 'released' | 'refunded' | 'frozen' | null
          auto_release_at?: string | null
          release_method?: 'auto' | 'buyer_confirmed' | 'admin' | 'dispute_resolved' | null
          delivery_evidence_required?: boolean | null
          delivery_evidence_urls?: string[] | null
          buyer_confirmed_at?: string | null
          seller_marked_delivered_at?: string | null
          is_guest_order?: boolean | null
          version?: number | null
          cancelled_at?: string | null
          promo_code_id?: string | null
          promo_discount?: number
        }
        Update: {
          id?: string
          buyer_id?: string
          seller_id?: string
          listing_id?: string
          quantity?: number
          unit_price?: number
          subtotal?: number
          platform_fee_rate?: number
          payment_processing_fee_rate?: number
          platform_fee?: number
          payment_processing_fee?: number
          total_amount?: number
          seller_payout?: number
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          status?:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'completed'
            | 'disputed'
            | 'refunded'
            | 'cancelled'
          protection_until?: string | null
          delivery_details?: Json | null
          delivered_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          // SafeDrop tier columns (P4.1)
          vaultshield_level?: 'standard' | 'enhanced' | 'premium' | null
          vaultshield_tier_fee_rate?: number
          vaultshield_tier_fee?: number
          warranty_expires_at?: string | null
          escrow_status?: 'held' | 'released' | 'refunded' | 'frozen' | null
          auto_release_at?: string | null
          release_method?: 'auto' | 'buyer_confirmed' | 'admin' | 'dispute_resolved' | null
          delivery_evidence_required?: boolean | null
          delivery_evidence_urls?: string[] | null
          buyer_confirmed_at?: string | null
          seller_marked_delivered_at?: string | null
          is_guest_order?: boolean | null
          version?: number | null
          cancelled_at?: string | null
          promo_code_id?: string | null
          promo_discount?: number
        }
      }
      conversations: {
        Row: {
          id: string
          order_id: string
          buyer_id: string
          seller_id: string
          last_message_at: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          buyer_id: string
          seller_id: string
          last_message_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          buyer_id?: string
          seller_id?: string
          last_message_at?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          attachments: string[]
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          attachments?: string[]
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          attachments?: string[]
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          order_id: string
          reviewer_id: string
          seller_id: string
          listing_id: string
          game_id: string | null
          rating: number
          title: string | null
          comment: string
          is_positive: boolean
          seller_response: string | null
          seller_responded_at: string | null
          is_verified_purchase: boolean
          is_visible: boolean
          flagged_for_moderation: boolean
          moderation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          reviewer_id: string
          seller_id: string
          listing_id: string
          game_id?: string | null
          rating: number
          title?: string | null
          comment: string
          seller_response?: string | null
          seller_responded_at?: string | null
          is_verified_purchase?: boolean
          is_visible?: boolean
          flagged_for_moderation?: boolean
          moderation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          reviewer_id?: string
          seller_id?: string
          listing_id?: string
          game_id?: string | null
          rating?: number
          title?: string | null
          comment?: string
          is_positive?: boolean
          seller_response?: string | null
          seller_responded_at?: string | null
          is_verified_purchase?: boolean
          is_visible?: boolean
          flagged_for_moderation?: boolean
          moderation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Added via 20260217_stripe_connect.sql
      payouts: {
        Row: {
          id: string
          seller_id: string
          stripe_transfer_id: string | null
          amount: number
          status: 'pending' | 'paid' | 'failed' | 'held'
          order_id: string | null
          hold_until: string | null
          is_held: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          stripe_transfer_id?: string | null
          amount: number
          status?: 'pending' | 'paid' | 'failed' | 'held'
          order_id?: string | null
          hold_until?: string | null
          is_held?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          stripe_transfer_id?: string | null
          amount?: number
          status?: 'pending' | 'paid' | 'failed' | 'held'
          order_id?: string | null
          hold_until?: string | null
          is_held?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      // Added via 20260217_idempotency.sql
      processed_operations: {
        Row: {
          id: string
          idempotency_key: string
          operation_type: string
          user_id: string | null
          response_status: number
          response_body: Json
          related_order_id: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          operation_type: string
          user_id?: string | null
          response_status: number
          response_body: Json
          related_order_id?: string | null
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          operation_type?: string
          user_id?: string | null
          response_status?: number
          response_body?: Json
          related_order_id?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      // P5.3 — Added via 20260218_promo_codes.sql
      promo_codes: {
        Row: {
          id: string
          code: string
          type: 'percentage' | 'flat'
          value: number
          description: string
          min_order_amount: number
          max_discount: number | null
          usage_limit: number | null
          per_user_limit: number
          total_used: number
          expires_at: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          type: 'percentage' | 'flat'
          value: number
          description?: string
          min_order_amount?: number
          max_discount?: number | null
          usage_limit?: number | null
          per_user_limit?: number
          total_used?: number
          expires_at?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          type?: 'percentage' | 'flat'
          value?: number
          description?: string
          min_order_amount?: number
          max_discount?: number | null
          usage_limit?: number | null
          per_user_limit?: number
          total_used?: number
          expires_at?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      promo_code_usages: {
        Row: {
          id: string
          promo_code_id: string
          user_id: string | null
          order_id: string | null
          discount_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          user_id?: string | null
          order_id?: string | null
          discount_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          user_id?: string | null
          order_id?: string | null
          discount_amount?: number
          created_at?: string
        }
      }
      // P5.2 — Added via 20260218_loyalty_program.sql
      loyalty_credits: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          type: 'earned' | 'redeemed' | 'bonus' | 'expired'
          amount: number
          balance_after: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id?: string | null
          type: 'earned' | 'redeemed' | 'bonus' | 'expired'
          amount: number
          balance_after?: number
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_id?: string | null
          type?: 'earned' | 'redeemed' | 'bonus' | 'expired'
          amount?: number
          balance_after?: number
          description?: string
          created_at?: string
        }
      }
      // Added via 20260218_referral_program.sql
      referral_earnings: {
        Row: {
          id: string
          referrer_id: string
          referred_user_id: string | null
          order_id: string | null
          type: 'signup_bonus' | 'purchase_commission'
          amount: number
          status: 'pending' | 'paid' | 'cancelled'
          created_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          referrer_id: string
          referred_user_id?: string | null
          order_id?: string | null
          type: 'signup_bonus' | 'purchase_commission'
          amount?: number
          status?: 'pending' | 'paid' | 'cancelled'
          created_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          referrer_id?: string
          referred_user_id?: string | null
          order_id?: string | null
          type?: 'signup_bonus' | 'purchase_commission'
          amount?: number
          status?: 'pending' | 'paid' | 'cancelled'
          created_at?: string
          paid_at?: string | null
        }
      }

      // P6.5 — gdpr_requests
      gdpr_requests: {
        Row: {
          id:               string
          user_id:          string
          type:             'export' | 'deletion'
          status:           'pending' | 'processing' | 'completed' | 'rejected'
          requested_at:     string
          completed_at:     string | null
          processed_by:     string | null
          rejection_reason: string | null
          export_url:       string | null
          notes:            string | null
        }
        Insert: {
          id?:               string
          user_id:           string
          type:              'export' | 'deletion'
          status?:           'pending' | 'processing' | 'completed' | 'rejected'
          requested_at?:     string
          completed_at?:     string | null
          processed_by?:     string | null
          rejection_reason?: string | null
          export_url?:       string | null
          notes?:            string | null
        }
        Update: {
          id?:               string
          user_id?:          string
          type?:             'export' | 'deletion'
          status?:           'pending' | 'processing' | 'completed' | 'rejected'
          requested_at?:     string
          completed_at?:     string | null
          processed_by?:     string | null
          rejection_reason?: string | null
          export_url?:       string | null
          notes?:            string | null
        }
      }

      // P6.4 — inform_disclosures
      inform_disclosures: {
        Row: {
          id:               string
          seller_id:        string
          legal_name:       string
          address_line1:    string
          address_line2:    string | null
          city:             string
          state_province:   string
          postal_code:      string
          country:          string
          tax_id_last4:     string
          bank_last4:       string | null
          contact_email:    string
          contact_phone:    string
          consented_at:     string
          consent_ip:       string | null
          status:           'submitted' | 'certified' | 'rejected' | 'needs_update'
          submitted_at:     string | null
          certified_at:     string | null
          certified_by:     string | null
          rejection_reason: string | null
          version:          number
          superseded_by:    string | null
        }
        Insert: {
          id?:               string
          seller_id:         string
          legal_name:        string
          address_line1:     string
          address_line2?:    string | null
          city:              string
          state_province:    string
          postal_code:       string
          country?:          string
          tax_id_last4:      string
          bank_last4?:       string | null
          contact_email:     string
          contact_phone:     string
          consented_at?:     string
          consent_ip?:       string | null
          status?:           'submitted' | 'certified' | 'rejected' | 'needs_update'
          submitted_at?:     string | null
          certified_at?:     string | null
          certified_by?:     string | null
          rejection_reason?: string | null
          version?:          number
          superseded_by?:    string | null
        }
        Update: {
          id?:               string
          seller_id?:        string
          legal_name?:       string
          address_line1?:    string
          address_line2?:    string | null
          city?:             string
          state_province?:   string
          postal_code?:      string
          country?:          string
          tax_id_last4?:     string
          bank_last4?:       string | null
          contact_email?:    string
          contact_phone?:    string
          consented_at?:     string
          consent_ip?:       string | null
          status?:           'submitted' | 'certified' | 'rejected' | 'needs_update'
          submitted_at?:     string | null
          certified_at?:     string | null
          certified_by?:     string | null
          rejection_reason?: string | null
          version?:          number
          superseded_by?:    string | null
        }
      }

      // P6.3 — fraud_flags
      fraud_flags: {
        Row: {
          id:           string
          user_id:      string | null
          rule_id:      string
          severity:     'low' | 'medium' | 'high'
          description:  string
          metadata:     Json
          status:       'open' | 'resolved' | 'dismissed'
          created_at:   string
          resolved_at:  string | null
          resolved_by:  string | null
        }
        Insert: {
          id?:          string
          user_id?:     string | null
          rule_id:      string
          severity:     'low' | 'medium' | 'high'
          description:  string
          metadata?:    Json
          status?:      'open' | 'resolved' | 'dismissed'
          created_at?:  string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          id?:          string
          user_id?:     string | null
          rule_id?:     string
          severity?:    'low' | 'medium' | 'high'
          description?: string
          metadata?:    Json
          status?:      'open' | 'resolved' | 'dismissed'
          created_at?:  string
          resolved_at?: string | null
          resolved_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // Added via 20260217_stripe_connect.sql
      release_escrow_to_seller_balance: {
        Args: { p_order_id: string; p_seller_id: string; p_amount: number }
        Returns: Json
      }
      seller_is_in_payout_hold: {
        Args: { p_seller_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Extra helper types for new tables
export type Payout = Database['public']['Tables']['payouts']['Row']
export type ProcessedOperation = Database['public']['Tables']['processed_operations']['Row']
export type ReferralEarning  = Database['public']['Tables']['referral_earnings']['Row']
export type LoyaltyCredit   = Database['public']['Tables']['loyalty_credits']['Row']
export type PromoCode       = Database['public']['Tables']['promo_codes']['Row']
export type PromoCodeUsage  = Database['public']['Tables']['promo_code_usages']['Row']
export type FraudFlag         = Database['public']['Tables']['fraud_flags']['Row']
export type InformDisclosure  = Database['public']['Tables']['inform_disclosures']['Row']
export type GdprRequest       = Database['public']['Tables']['gdpr_requests']['Row']

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Listing = Database['public']['Tables']['listings']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']

// Listing with relations
export type ListingWithRelations = Listing & {
  seller: Profile
  game: Game
  category: Category
}

// Order with relations
export type OrderWithRelations = Order & {
  buyer: Profile
  seller: Profile
  listing: Listing
}

// Message with relations
export type MessageWithSender = Message & {
  sender: Profile
}

// Conversation with relations
export type ConversationWithDetails = Conversation & {
  buyer: Profile
  seller: Profile
  order: Order
  messages?: MessageWithSender[]
}

// Review with relations
export type ReviewWithRelations = Review & {
  buyer?: Profile
  seller?: Profile
  listing?: Listing
  game?: Game
  order?: Order
}
