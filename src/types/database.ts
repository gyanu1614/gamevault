// Database Types
// GENERATED — do not edit the Database interface by hand.
// Regenerate with:  pnpm db:types   (requires the local stack running)
// The helper/convenience aliases below the generated block ARE maintained
// by hand and must be preserved across regenerations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_action_logs: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id: string
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_action_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_action_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_action_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_action_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_action_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          action: string
          action_category: string
          admin_id: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_state: Json | null
          notes: string | null
          previous_state: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          action_category: string
          admin_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_state?: Json | null
          notes?: string | null
          previous_state?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_category?: string
          admin_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_state?: Json | null
          notes?: string | null
          previous_state?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          notification_type: string
          priority: string | null
          read: boolean | null
          read_at: string | null
          read_by: string | null
          specific_admin_id: string | null
          target_roles: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          notification_type: string
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          read_by?: string | null
          specific_admin_id?: string | null
          target_roles?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          notification_type?: string
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          read_by?: string | null
          specific_admin_id?: string | null
          target_roles?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_notifications_specific_admin_id_fkey"
            columns: ["specific_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_notifications_specific_admin_id_fkey"
            columns: ["specific_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_notifications_specific_admin_id_fkey"
            columns: ["specific_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_specific_admin_id_fkey"
            columns: ["specific_admin_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_notifications_specific_admin_id_fkey"
            columns: ["specific_admin_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          failed_login_attempts: number | null
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          last_active_at: string | null
          last_login_at: string | null
          last_login_ip: unknown
          locked_until: string | null
          role: Database["public"]["Enums"]["admin_role_enum"]
          session_timeout_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_login_attempts?: number | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          last_login_at?: string | null
          last_login_ip?: unknown
          locked_until?: string | null
          role: Database["public"]["Enums"]["admin_role_enum"]
          session_timeout_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_login_attempts?: number | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          last_login_at?: string | null
          last_login_ip?: unknown
          locked_until?: string | null
          role?: Database["public"]["Enums"]["admin_role_enum"]
          session_timeout_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      adopt_me_market_raw_listings: {
        Row: {
          collected_at: string
          ended_at: string | null
          id: string
          listing_status: string
          pet_id: string
          price_usd: number
          reviews: number | null
          seller_id: string | null
          seller_rating: number | null
          source: string
          title: string | null
          variant: string
        }
        Insert: {
          collected_at?: string
          ended_at?: string | null
          id?: string
          listing_status?: string
          pet_id: string
          price_usd: number
          reviews?: number | null
          seller_id?: string | null
          seller_rating?: number | null
          source?: string
          title?: string | null
          variant: string
        }
        Update: {
          collected_at?: string
          ended_at?: string | null
          id?: string
          listing_status?: string
          pet_id?: string
          price_usd?: number
          reviews?: number | null
          seller_id?: string | null
          seller_rating?: number | null
          source?: string
          title?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "adopt_me_market_raw_listings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "adopt_me_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      adopt_me_pet_values: {
        Row: {
          average_usd: number | null
          cash_value_usd: number | null
          cheapest_usd: number | null
          confidence: string
          created_at: string
          id: string
          is_estimated: boolean
          last_priced_at: string | null
          listings_tracked: number
          pet_id: string
          price_change_7d: number | null
          reputable_count: number | null
          trade_value: number | null
          updated_at: string
          variant: string
        }
        Insert: {
          average_usd?: number | null
          cash_value_usd?: number | null
          cheapest_usd?: number | null
          confidence?: string
          created_at?: string
          id?: string
          is_estimated?: boolean
          last_priced_at?: string | null
          listings_tracked?: number
          pet_id: string
          price_change_7d?: number | null
          reputable_count?: number | null
          trade_value?: number | null
          updated_at?: string
          variant: string
        }
        Update: {
          average_usd?: number | null
          cash_value_usd?: number | null
          cheapest_usd?: number | null
          confidence?: string
          created_at?: string
          id?: string
          is_estimated?: boolean
          last_priced_at?: string | null
          listings_tracked?: number
          pet_id?: string
          price_change_7d?: number | null
          reputable_count?: number | null
          trade_value?: number | null
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "adopt_me_pet_values_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "adopt_me_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      adopt_me_pets: {
        Row: {
          created_at: string
          demand_rank: number | null
          demand_trend: string | null
          description: string | null
          has_page: boolean | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          obtainability: string
          origin_detail: string | null
          origin_type: string | null
          rarity: string
          released_at: string | null
          retired_at: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demand_rank?: number | null
          demand_trend?: string | null
          description?: string | null
          has_page?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          obtainability?: string
          origin_detail?: string | null
          origin_type?: string | null
          rarity: string
          released_at?: string | null
          retired_at?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demand_rank?: number | null
          demand_trend?: string | null
          description?: string | null
          has_page?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          obtainability?: string
          origin_detail?: string | null
          origin_type?: string | null
          rarity?: string
          released_at?: string | null
          retired_at?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      adopt_me_price_history: {
        Row: {
          cash_value_usd: number | null
          history_date: string
          id: string
          is_estimated: boolean
          pet_id: string
          recorded_at: string
          variant: string
        }
        Insert: {
          cash_value_usd?: number | null
          history_date: string
          id?: string
          is_estimated?: boolean
          pet_id: string
          recorded_at?: string
          variant: string
        }
        Update: {
          cash_value_usd?: number | null
          history_date?: string
          id?: string
          is_estimated?: boolean
          pet_id?: string
          recorded_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "adopt_me_price_history_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "adopt_me_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_conditional_rules: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          operator: string
          trigger_attribute_id: string
          trigger_values: Json
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          operator: string
          trigger_attribute_id: string
          trigger_values?: Json
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          operator?: string
          trigger_attribute_id?: string
          trigger_values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attribute_conditional_rules_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribute_conditional_rules_trigger_attribute_id_fkey"
            columns: ["trigger_attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_options: {
        Row: {
          attribute_id: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          label: string
          metadata: Json
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          label: string
          metadata?: Json
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          label?: string
          metadata?: Json
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_templates: {
        Row: {
          created_at: string
          game_category_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          game_category_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          game_category_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attribute_templates_game_category_id_fkey"
            columns: ["game_category_id"]
            isOneToOne: true
            referencedRelation: "game_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          created_at: string
          default_value: Json | null
          description: string | null
          facet_indexed: boolean
          help_text: string | null
          id: string
          is_required: boolean
          max_length: number | null
          max_value: number | null
          min_value: number | null
          name: string
          parent_attribute_id: string | null
          placeholder: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          template_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          description?: string | null
          facet_indexed?: boolean
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_length?: number | null
          max_value?: number | null
          min_value?: number | null
          name: string
          parent_attribute_id?: string | null
          placeholder?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          template_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          description?: string | null
          facet_indexed?: boolean
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_length?: number | null
          max_value?: number | null
          min_value?: number | null
          name?: string
          parent_attribute_id?: string | null
          placeholder?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          template_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributes_parent_attribute_id_fkey"
            columns: ["parent_attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "attribute_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          request_path: string | null
          success: boolean | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          request_path?: string | null
          success?: boolean | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          request_path?: string | null
          success?: boolean | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      banner_presets: {
        Row: {
          created_at: string | null
          description: string | null
          gradient_direction: string | null
          gradient_from: string
          gradient_to: string
          id: string
          is_premium: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          gradient_direction?: string | null
          gradient_from: string
          gradient_to: string
          id: string
          is_premium?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          gradient_direction?: string | null
          gradient_from?: string
          gradient_to?: string
          id?: string
          is_premium?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          body: Json
          cover_url: string | null
          created_at: string
          excerpt: string
          game_slugs: string[]
          id: string
          post_type: string
          primary_game_slug: string | null
          published_at: string
          read_minutes: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: Json
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          game_slugs?: string[]
          id?: string
          post_type?: string
          primary_game_slug?: string | null
          published_at?: string
          read_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: Json
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          game_slugs?: string[]
          id?: string
          post_type?: string
          primary_game_slug?: string | null
          published_at?: string
          read_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      buyer_waitlist: {
        Row: {
          created_at: string
          email: string
          game_slug: string | null
          id: string
          ip: string | null
          listing_id: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          game_slug?: string | null
          id?: string
          ip?: string | null
          listing_id?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          game_slug?: string | null
          id?: string
          ip?: string | null
          listing_id?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      catalogue_items: {
        Row: {
          created_at: string
          featured_rank: number | null
          game_id: string
          id: string
          image_clean: boolean
          image_path: string | null
          kind: string
          name: string
          slug: string
          unit_label: string | null
          unit_size: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          featured_rank?: number | null
          game_id: string
          id?: string
          image_clean?: boolean
          image_path?: string | null
          kind?: string
          name: string
          slug: string
          unit_label?: string | null
          unit_size?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          featured_rank?: number | null
          game_id?: string
          id?: string
          image_clean?: boolean
          image_path?: string | null
          kind?: string
          name?: string
          slug?: string
          unit_label?: string | null
          unit_size?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          game_id: string | null
          icon: string | null
          icon_emoji: string | null
          icon_type: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          seo_description: string | null
          seo_h1: string | null
          seo_intro: string | null
          seo_title: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          game_id?: string | null
          icon?: string | null
          icon_emoji?: string | null
          icon_type?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          seo_description?: string | null
          seo_h1?: string | null
          seo_intro?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          game_id?: string | null
          icon?: string | null
          icon_emoji?: string | null
          icon_type?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          seo_description?: string | null
          seo_h1?: string | null
          seo_intro?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      category_configs: {
        Row: {
          category_type: string
          config: Json
          created_at: string
          game_id: string
          id: string
          updated_at: string
        }
        Insert: {
          category_type: string
          config?: Json
          created_at?: string
          game_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          config?: Json
          created_at?: string
          game_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_configs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      category_fee_config: {
        Row: {
          base_pct: number
          category: string
          rank_discount: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_pct: number
          category: string
          rank_discount?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_pct?: number
          category?: string
          rank_discount?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_fee_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "category_fee_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "category_fee_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_fee_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "category_fee_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          listing_id: string | null
          order_id: string | null
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          order_id?: string | null
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          order_id?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          attachments: Json | null
          created_at: string
          dispute_id: string
          id: string
          is_internal: boolean | null
          is_system_message: boolean | null
          message: string
          read_by_admin: boolean | null
          read_by_buyer: boolean | null
          read_by_seller: boolean | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          dispute_id: string
          id?: string
          is_internal?: boolean | null
          is_system_message?: boolean | null
          message: string
          read_by_admin?: boolean | null
          read_by_buyer?: boolean | null
          read_by_seller?: boolean | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          dispute_id?: string
          id?: string
          is_internal?: boolean | null
          is_system_message?: boolean | null
          message?: string
          read_by_admin?: boolean | null
          read_by_buyer?: boolean | null
          read_by_seller?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes_with_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      dispute_resolutions: {
        Row: {
          admin_notes: string | null
          created_at: string
          dispute_id: string
          favored_party: string
          id: string
          refund_amount: number | null
          refund_percentage: number | null
          resolution_notes: string | null
          resolution_type: string
          resolved_at: string
          resolved_by: string
          seller_payout_amount: number | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          dispute_id: string
          favored_party: string
          id?: string
          refund_amount?: number | null
          refund_percentage?: number | null
          resolution_notes?: string | null
          resolution_type: string
          resolved_at?: string
          resolved_by: string
          seller_payout_amount?: number | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          dispute_id?: string
          favored_party?: string
          id?: string
          refund_amount?: number | null
          refund_percentage?: number | null
          resolution_notes?: string | null
          resolution_type?: string
          resolved_at?: string
          resolved_by?: string
          seller_payout_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_resolutions_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: true
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_resolutions_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: true
            referencedRelation: "disputes_with_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "dispute_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "dispute_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "dispute_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          buyer_id: string
          created_at: string
          currency: string | null
          description: string
          disputed_amount: number
          escalated_at: string | null
          escalated_by: string | null
          escalation_reason: string | null
          evidence_urls: string[] | null
          first_response_at: string | null
          first_response_deadline: string | null
          id: string
          order_reference: string | null
          priority: string | null
          reason: Database["public"]["Enums"]["dispute_reason_enum"]
          resolution_deadline: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_amount: number | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["dispute_status_enum"]
          title: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          buyer_id: string
          created_at?: string
          currency?: string | null
          description: string
          disputed_amount: number
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_reason?: string | null
          evidence_urls?: string[] | null
          first_response_at?: string | null
          first_response_deadline?: string | null
          id?: string
          order_reference?: string | null
          priority?: string | null
          reason: Database["public"]["Enums"]["dispute_reason_enum"]
          resolution_deadline?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_amount?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["dispute_status_enum"]
          title: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          buyer_id?: string
          created_at?: string
          currency?: string | null
          description?: string
          disputed_amount?: number
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_reason?: string | null
          evidence_urls?: string[] | null
          first_response_at?: string | null
          first_response_deadline?: string | null
          id?: string
          order_reference?: string | null
          priority?: string | null
          reason?: Database["public"]["Enums"]["dispute_reason_enum"]
          resolution_deadline?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_amount?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["dispute_status_enum"]
          title?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      early_seller_signups: {
        Row: {
          created_at: string
          discord: string | null
          email: string
          games: string[] | null
          id: string
          ip: string | null
          monthly_volume: string | null
          note: string | null
          sells: string | null
          source: string | null
          status: string
          user_agent: string | null
          username: string
        }
        Insert: {
          created_at?: string
          discord?: string | null
          email: string
          games?: string[] | null
          id?: string
          ip?: string | null
          monthly_volume?: string | null
          note?: string | null
          sells?: string | null
          source?: string | null
          status?: string
          user_agent?: string | null
          username: string
        }
        Update: {
          created_at?: string
          discord?: string | null
          email?: string
          games?: string[] | null
          id?: string
          ip?: string | null
          monthly_volume?: string | null
          note?: string | null
          sells?: string | null
          source?: string | null
          status?: string
          user_agent?: string | null
          username?: string
        }
        Relationships: []
      }
      fee_config_audit: {
        Row: {
          actor: string | null
          created_at: string
          id: number
          key: string
          new_value: Json | null
          old_value: Json | null
          scope: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: never
          key: string
          new_value?: Json | null
          old_value?: Json | null
          scope: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: never
          key?: string
          new_value?: Json | null
          old_value?: Json | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_config_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "fee_config_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fee_config_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_config_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fee_config_audit_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      founding_notices: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          priority: number
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          priority?: number
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          priority?: number
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          severity: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "fraud_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fraud_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fraud_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      game_categories: {
        Row: {
          available_platforms: Json
          available_regions: Json
          created_at: string
          delivery_modes: string[]
          description: string | null
          extras: Json
          game_id: string
          global_category_id: string
          icon_emoji: string | null
          icon_url: string | null
          id: string
          is_enabled: boolean
          legacy_category_id: string | null
          name: string
          requires_platform: boolean
          requires_region: boolean
          seo_description: string | null
          seo_h1: string | null
          seo_intro: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          sub_types: string[]
          type: string
          updated_at: string
        }
        Insert: {
          available_platforms?: Json
          available_regions?: Json
          created_at?: string
          delivery_modes?: string[]
          description?: string | null
          extras?: Json
          game_id: string
          global_category_id: string
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_enabled?: boolean
          legacy_category_id?: string | null
          name: string
          requires_platform?: boolean
          requires_region?: boolean
          seo_description?: string | null
          seo_h1?: string | null
          seo_intro?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          sub_types?: string[]
          type: string
          updated_at?: string
        }
        Update: {
          available_platforms?: Json
          available_regions?: Json
          created_at?: string
          delivery_modes?: string[]
          description?: string | null
          extras?: Json
          game_id?: string
          global_category_id?: string
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_enabled?: boolean
          legacy_category_id?: string | null
          name?: string
          requires_platform?: boolean
          requires_region?: boolean
          seo_description?: string | null
          seo_h1?: string | null
          seo_intro?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          sub_types?: string[]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_categories_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_categories_global_category_id_fkey"
            columns: ["global_category_id"]
            isOneToOne: false
            referencedRelation: "global_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      game_external_ids: {
        Row: {
          created_at: string
          external_id: string
          game_id: string
          id: string
          platform: string
        }
        Insert: {
          created_at?: string
          external_id: string
          game_id: string
          id?: string
          platform: string
        }
        Update: {
          created_at?: string
          external_id?: string
          game_id?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_external_ids_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_fee_overrides: {
        Row: {
          active: boolean
          category: string
          created_at: string
          game_slug: string
          id: string
          note: string | null
          pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          game_slug: string
          id?: string
          note?: string | null
          pct: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          game_slug?: string
          id?: string
          note?: string | null
          pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_fee_overrides_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "category_fee_config"
            referencedColumns: ["category"]
          },
          {
            foreignKeyName: "game_fee_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "game_fee_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "game_fee_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_fee_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "game_fee_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      game_metrics: {
        Row: {
          captured_at: string
          external_id: string
          favorites: number | null
          id: number
          in_top_trending: boolean
          in_up_and_coming: boolean
          platform: string
          playing: number
          visits: number | null
        }
        Insert: {
          captured_at?: string
          external_id: string
          favorites?: number | null
          id?: never
          in_top_trending?: boolean
          in_up_and_coming?: boolean
          platform: string
          playing?: number
          visits?: number | null
        }
        Update: {
          captured_at?: string
          external_id?: string
          favorites?: number | null
          id?: never
          in_top_trending?: boolean
          in_up_and_coming?: boolean
          platform?: string
          playing?: number
          visits?: number | null
        }
        Relationships: []
      }
      game_metrics_daily: {
        Row: {
          avg_playing: number
          day: string
          external_id: string
          max_playing: number
          platform: string
          samples: number
        }
        Insert: {
          avg_playing: number
          day: string
          external_id: string
          max_playing: number
          platform: string
          samples: number
        }
        Update: {
          avg_playing?: number
          day?: string
          external_id?: string
          max_playing?: number
          platform?: string
          samples?: number
        }
        Relationships: []
      }
      games: {
        Row: {
          blog_cta_image_url: string | null
          content_tier: string
          cover_url: string | null
          created_at: string
          description: string | null
          display_name: string | null
          ecosystem: string | null
          emoji: string | null
          id: string
          image_source: string | null
          image_synced_at: string | null
          image_url: string | null
          is_active: boolean | null
          is_popular: boolean
          is_spotlight: boolean
          name: string
          review_note: string | null
          review_snoozed_until: string | null
          review_status: string
          seo_description: string | null
          seo_h1: string | null
          seo_indexable: boolean | null
          seo_intro: string | null
          seo_noindex_reason: string | null
          seo_title: string | null
          slug: string
          sort_order: number | null
          source: string | null
          trend_detected_at: string | null
          trend_peak_playing: number | null
          updated_at: string | null
        }
        Insert: {
          blog_cta_image_url?: string | null
          content_tier?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          ecosystem?: string | null
          emoji?: string | null
          id?: string
          image_source?: string | null
          image_synced_at?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_popular?: boolean
          is_spotlight?: boolean
          name: string
          review_note?: string | null
          review_snoozed_until?: string | null
          review_status?: string
          seo_description?: string | null
          seo_h1?: string | null
          seo_indexable?: boolean | null
          seo_intro?: string | null
          seo_noindex_reason?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
          source?: string | null
          trend_detected_at?: string | null
          trend_peak_playing?: number | null
          updated_at?: string | null
        }
        Update: {
          blog_cta_image_url?: string | null
          content_tier?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          ecosystem?: string | null
          emoji?: string | null
          id?: string
          image_source?: string | null
          image_synced_at?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_popular?: boolean
          is_spotlight?: boolean
          name?: string
          review_note?: string | null
          review_snoozed_until?: string | null
          review_status?: string
          seo_description?: string | null
          seo_h1?: string | null
          seo_indexable?: boolean | null
          seo_intro?: string | null
          seo_noindex_reason?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
          source?: string | null
          trend_detected_at?: string | null
          trend_peak_playing?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gdpr_requests: {
        Row: {
          completed_at: string | null
          export_url: string | null
          id: string
          notes: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "gdpr_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "gdpr_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "gdpr_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "gdpr_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "gdpr_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "gdpr_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "gdpr_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      global_categories: {
        Row: {
          created_at: string
          default_slug: string
          default_type: string
          description: string | null
          icon_emoji: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_slug: string
          default_type: string
          description?: string | null
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_slug?: string
          default_type?: string
          description?: string | null
          icon_emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "global_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inform_disclosures: {
        Row: {
          address_line1: string
          address_line2: string | null
          bank_last4: string | null
          certified_at: string | null
          certified_by: string | null
          city: string
          consent_ip: string | null
          consented_at: string
          contact_email: string
          contact_phone: string
          country: string
          id: string
          legal_name: string
          postal_code: string
          rejection_reason: string | null
          seller_id: string
          state_province: string
          status: string
          submitted_at: string | null
          superseded_by: string | null
          tax_id_last4: string
          version: number
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          bank_last4?: string | null
          certified_at?: string | null
          certified_by?: string | null
          city: string
          consent_ip?: string | null
          consented_at?: string
          contact_email: string
          contact_phone: string
          country?: string
          id?: string
          legal_name: string
          postal_code: string
          rejection_reason?: string | null
          seller_id: string
          state_province: string
          status?: string
          submitted_at?: string | null
          superseded_by?: string | null
          tax_id_last4: string
          version?: number
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          bank_last4?: string | null
          certified_at?: string | null
          certified_by?: string | null
          city?: string
          consent_ip?: string | null
          consented_at?: string
          contact_email?: string
          contact_phone?: string
          country?: string
          id?: string
          legal_name?: string
          postal_code?: string
          rejection_reason?: string | null
          seller_id?: string
          state_province?: string
          status?: string
          submitted_at?: string | null
          superseded_by?: string | null
          tax_id_last4?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inform_disclosures_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "inform_disclosures_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inform_disclosures_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "inform_disclosures_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inform_disclosures_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "inform_disclosures_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "inform_disclosures"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_delivery_inventory: {
        Row: {
          code_hash: string | null
          created_at: string
          created_by: string | null
          decrypted_at: string | null
          decrypted_by_user_id: string | null
          delivery_data: string
          delivery_type: string
          id: string
          listing_id: string
          sold_at: string | null
          sold_to_order_id: string | null
          status: string
        }
        Insert: {
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          decrypted_at?: string | null
          decrypted_by_user_id?: string | null
          delivery_data: string
          delivery_type?: string
          id?: string
          listing_id: string
          sold_at?: string | null
          sold_to_order_id?: string | null
          status?: string
        }
        Update: {
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          decrypted_at?: string | null
          decrypted_by_user_id?: string | null
          delivery_data?: string
          delivery_type?: string
          id?: string
          listing_id?: string
          sold_at?: string | null
          sold_to_order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_delivery_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_decrypted_by_user_id_fkey"
            columns: ["decrypted_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_decrypted_by_user_id_fkey"
            columns: ["decrypted_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_decrypted_by_user_id_fkey"
            columns: ["decrypted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_decrypted_by_user_id_fkey"
            columns: ["decrypted_by_user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_decrypted_by_user_id_fkey"
            columns: ["decrypted_by_user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_delivery_inventory_sold_to_order_id_fkey"
            columns: ["sold_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_account_kind"]
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount_minor: number
          created_at: string
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_minor: number
          created_at?: string
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_minor?: number
          created_at?: string
          currency?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          event_ref: string | null
          id: string
          idempotency_key: string
          order_id: string | null
        }
        Insert: {
          created_at?: string
          event_ref?: string | null
          id?: string
          idempotency_key: string
          order_id?: string | null
        }
        Update: {
          created_at?: string
          event_ref?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string | null
        }
        Relationships: []
      }
      listing_price_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          listing_id: string
          new_price: number
          old_price: number
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          listing_id: string
          new_price: number
          old_price: number
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          listing_id?: string
          new_price?: number
          old_price?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listing_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listing_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listing_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listing_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_templates: {
        Row: {
          category_id: string | null
          created_at: string
          fields: Json
          game_id: string
          id: string
          is_active: boolean
          template_name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          fields?: Json
          game_id: string
          id?: string
          is_active?: boolean
          template_name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          fields?: Json
          game_id?: string
          id?: string
          is_active?: boolean
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_templates_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bundle_id: string | null
          category_id: string
          changes_requested_at: string | null
          changes_requested_by: string | null
          created_at: string
          currency: string
          delivery_method: string | null
          delivery_method_type: string | null
          delivery_time: string | null
          description: string
          game_category_id: string | null
          game_id: string
          id: string
          images: string[] | null
          is_unlimited: boolean | null
          metadata: Json
          min_quantity: number | null
          moderation_notes: string | null
          offer_number: number | null
          original_price: number | null
          platform: string | null
          price: number
          quantity: number | null
          region: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          sales: number | null
          seller_id: string
          slug: string | null
          status: string | null
          template_data: Json | null
          template_version_used: number | null
          title: string
          updated_at: string
          view_count: number
          views: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bundle_id?: string | null
          category_id: string
          changes_requested_at?: string | null
          changes_requested_by?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string | null
          delivery_method_type?: string | null
          delivery_time?: string | null
          description: string
          game_category_id?: string | null
          game_id: string
          id?: string
          images?: string[] | null
          is_unlimited?: boolean | null
          metadata?: Json
          min_quantity?: number | null
          moderation_notes?: string | null
          offer_number?: number | null
          original_price?: number | null
          platform?: string | null
          price: number
          quantity?: number | null
          region?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sales?: number | null
          seller_id: string
          slug?: string | null
          status?: string | null
          template_data?: Json | null
          template_version_used?: number | null
          title: string
          updated_at?: string
          view_count?: number
          views?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bundle_id?: string | null
          category_id?: string
          changes_requested_at?: string | null
          changes_requested_by?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string | null
          delivery_method_type?: string | null
          delivery_time?: string | null
          description?: string
          game_category_id?: string | null
          game_id?: string
          id?: string
          images?: string[] | null
          is_unlimited?: boolean | null
          metadata?: Json
          min_quantity?: number | null
          moderation_notes?: string | null
          offer_number?: number | null
          original_price?: number | null
          platform?: string | null
          price?: number
          quantity?: number | null
          region?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          sales?: number | null
          seller_id?: string
          slug?: string | null
          status?: string | null
          template_data?: Json | null
          template_version_used?: number | null
          title?: string
          updated_at?: string
          view_count?: number
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_game_category_id_fkey"
            columns: ["game_category_id"]
            isOneToOne: false
            referencedRelation: "game_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listings_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      loyalty_credits: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_credits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "loyalty_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "loyalty_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "loyalty_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: string[] | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachments?: string[] | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachments?: string[] | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_cancellation_requests: {
        Row: {
          admin_id: string | null
          admin_notes: string | null
          buyer_id: string
          created_at: string | null
          id: string
          order_id: string
          processed_at: string | null
          reason: string
          status: string
        }
        Insert: {
          admin_id?: string | null
          admin_notes?: string | null
          buyer_id: string
          created_at?: string | null
          id?: string
          order_id: string
          processed_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          admin_id?: string | null
          admin_notes?: string | null
          buyer_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          processed_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_release_at: string | null
          buyer_confirmed_at: string | null
          buyer_id: string
          cancelled_at: string | null
          chat_active_until: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivering_at: string | null
          delivery_details: Json | null
          delivery_evidence_required: boolean | null
          delivery_evidence_urls: string[] | null
          dispute_reason: string | null
          disputed_at: string | null
          escrow_status: string | null
          id: string
          instant_delivery_code: string | null
          instant_delivery_delivered_at: string | null
          instant_delivery_inventory_id: string | null
          is_guest_order: boolean | null
          listing_id: string
          order_number: string | null
          paid_at: string | null
          payment_expires_at: string | null
          payment_processing_fee: number
          payment_processing_fee_rate: number
          payment_provider: string | null
          platform_fee: number
          platform_fee_rate: number
          promo_code_id: string | null
          promo_discount: number
          protection_until: string | null
          provider_charge_id: string | null
          quantity: number
          release_method: string | null
          seller_id: string
          seller_marked_delivered_at: string | null
          seller_payout: number
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at: string
          vaultshield_level: string | null
          vaultshield_tier_fee: number
          vaultshield_tier_fee_rate: number
          version: number
          wallet_amount_used: number
          warranty_expires_at: string | null
        }
        Insert: {
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id: string
          cancelled_at?: string | null
          chat_active_until?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivering_at?: string | null
          delivery_details?: Json | null
          delivery_evidence_required?: boolean | null
          delivery_evidence_urls?: string[] | null
          dispute_reason?: string | null
          disputed_at?: string | null
          escrow_status?: string | null
          id?: string
          instant_delivery_code?: string | null
          instant_delivery_delivered_at?: string | null
          instant_delivery_inventory_id?: string | null
          is_guest_order?: boolean | null
          listing_id: string
          order_number?: string | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_processing_fee: number
          payment_processing_fee_rate: number
          payment_provider?: string | null
          platform_fee: number
          platform_fee_rate: number
          promo_code_id?: string | null
          promo_discount?: number
          protection_until?: string | null
          provider_charge_id?: string | null
          quantity?: number
          release_method?: string | null
          seller_id: string
          seller_marked_delivered_at?: string | null
          seller_payout: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at?: string
          vaultshield_level?: string | null
          vaultshield_tier_fee?: number
          vaultshield_tier_fee_rate?: number
          version?: number
          wallet_amount_used?: number
          warranty_expires_at?: string | null
        }
        Update: {
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id?: string
          cancelled_at?: string | null
          chat_active_until?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivering_at?: string | null
          delivery_details?: Json | null
          delivery_evidence_required?: boolean | null
          delivery_evidence_urls?: string[] | null
          dispute_reason?: string | null
          disputed_at?: string | null
          escrow_status?: string | null
          id?: string
          instant_delivery_code?: string | null
          instant_delivery_delivered_at?: string | null
          instant_delivery_inventory_id?: string | null
          is_guest_order?: boolean | null
          listing_id?: string
          order_number?: string | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_processing_fee?: number
          payment_processing_fee_rate?: number
          payment_provider?: string | null
          platform_fee?: number
          platform_fee_rate?: number
          promo_code_id?: string | null
          promo_discount?: number
          protection_until?: string | null
          provider_charge_id?: string | null
          quantity?: number
          release_method?: string | null
          seller_id?: string
          seller_marked_delivered_at?: string | null
          seller_payout?: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          subtotal?: number
          total_amount?: number
          unit_price?: number
          updated_at?: string
          vaultshield_level?: string | null
          vaultshield_tier_fee?: number
          vaultshield_tier_fee_rate?: number
          version?: number
          wallet_amount_used?: number
          warranty_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "orders_instant_delivery_inventory_id_fkey"
            columns: ["instant_delivery_inventory_id"]
            isOneToOne: false
            referencedRelation: "instant_delivery_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_reason: string | null
          hold_until: string | null
          id: string
          initiated_at: string
          is_held: boolean
          notes: string | null
          order_id: string | null
          seller_id: string
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          hold_until?: string | null
          id?: string
          initiated_at?: string
          is_held?: boolean
          notes?: string | null
          order_id?: string | null
          seller_id: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          hold_until?: string | null
          id?: string
          initiated_at?: string
          is_held?: boolean
          notes?: string | null
          order_id?: string | null
          seller_id?: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      processed_operations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          operation_type: string
          related_order_id: string | null
          response_body: Json | null
          response_status: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          operation_type: string
          related_order_id?: string | null
          response_body?: Json | null
          response_status?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          operation_type?: string
          related_order_id?: string | null
          response_body?: Json | null
          response_status?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_operations_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processed_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "processed_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "processed_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processed_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "processed_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badges: string[] | null
          banner_preset: string | null
          banner_url: string | null
          bio: string | null
          business_name: string | null
          created_at: string
          email: string | null
          fee_override_expires_at: string | null
          fee_override_pct: number | null
          founding_seller: boolean
          full_name: string | null
          id: string
          inform_status: string | null
          is_founding_applicant: boolean
          is_guest: boolean | null
          is_test: boolean
          is_verified: boolean
          kyc_status: string | null
          kyc_submitted_at: string | null
          lifetime_cashback_earned: number
          lifetime_earnings: number
          loyalty_balance: number
          payout_enabled: boolean | null
          paypal_email: string | null
          pending_balance: number
          positive_reviews: number | null
          referral_code: string | null
          referred_by: string | null
          role: string | null
          seller_balance: number
          seller_rating: number | null
          seller_restricted_at: string | null
          seller_restricted_by: string | null
          seller_restriction_reason: string | null
          seller_status: string | null
          seller_tier: string | null
          shop_banner_position: string | null
          shop_banner_url: string | null
          shop_custom_css: string | null
          shop_layout: string | null
          shop_name: string | null
          shop_name_updated_at: string | null
          shop_primary_color: string | null
          shop_secondary_color: string | null
          shop_slug: string | null
          shop_theme: string | null
          stripe_account_id: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean | null
          stripe_connect_connected_at: string | null
          stripe_connect_onboarding_url: string | null
          stripe_connect_payouts_enabled: boolean | null
          stripe_connect_status: string | null
          tier_pinned: boolean
          tier_strikes: number
          total_reviews: number | null
          total_sales: number | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          badges?: string[] | null
          banner_preset?: string | null
          banner_url?: string | null
          bio?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          fee_override_expires_at?: string | null
          fee_override_pct?: number | null
          founding_seller?: boolean
          full_name?: string | null
          id: string
          inform_status?: string | null
          is_founding_applicant?: boolean
          is_guest?: boolean | null
          is_test?: boolean
          is_verified?: boolean
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          lifetime_cashback_earned?: number
          lifetime_earnings?: number
          loyalty_balance?: number
          payout_enabled?: boolean | null
          paypal_email?: string | null
          pending_balance?: number
          positive_reviews?: number | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string | null
          seller_balance?: number
          seller_rating?: number | null
          seller_restricted_at?: string | null
          seller_restricted_by?: string | null
          seller_restriction_reason?: string | null
          seller_status?: string | null
          seller_tier?: string | null
          shop_banner_position?: string | null
          shop_banner_url?: string | null
          shop_custom_css?: string | null
          shop_layout?: string | null
          shop_name?: string | null
          shop_name_updated_at?: string | null
          shop_primary_color?: string | null
          shop_secondary_color?: string | null
          shop_slug?: string | null
          shop_theme?: string | null
          stripe_account_id?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_connected_at?: string | null
          stripe_connect_onboarding_url?: string | null
          stripe_connect_payouts_enabled?: boolean | null
          stripe_connect_status?: string | null
          tier_pinned?: boolean
          tier_strikes?: number
          total_reviews?: number | null
          total_sales?: number | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          badges?: string[] | null
          banner_preset?: string | null
          banner_url?: string | null
          bio?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          fee_override_expires_at?: string | null
          fee_override_pct?: number | null
          founding_seller?: boolean
          full_name?: string | null
          id?: string
          inform_status?: string | null
          is_founding_applicant?: boolean
          is_guest?: boolean | null
          is_test?: boolean
          is_verified?: boolean
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          lifetime_cashback_earned?: number
          lifetime_earnings?: number
          loyalty_balance?: number
          payout_enabled?: boolean | null
          paypal_email?: string | null
          pending_balance?: number
          positive_reviews?: number | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string | null
          seller_balance?: number
          seller_rating?: number | null
          seller_restricted_at?: string | null
          seller_restricted_by?: string | null
          seller_restriction_reason?: string | null
          seller_status?: string | null
          seller_tier?: string | null
          shop_banner_position?: string | null
          shop_banner_url?: string | null
          shop_custom_css?: string | null
          shop_layout?: string | null
          shop_name?: string | null
          shop_name_updated_at?: string | null
          shop_primary_color?: string | null
          shop_secondary_color?: string | null
          shop_slug?: string | null
          shop_theme?: string | null
          stripe_account_id?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_connected_at?: string | null
          stripe_connect_onboarding_url?: string | null
          stripe_connect_payouts_enabled?: boolean | null
          stripe_connect_status?: string | null
          tier_pinned?: boolean
          tier_strikes?: number
          total_reviews?: number | null
          total_sales?: number | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      promo_code_usages: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          order_id: string | null
          promo_code_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount: number
          id?: string
          order_id?: string | null
          promo_code_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          promo_code_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "promo_code_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "promo_code_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "promo_code_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_amount: number
          per_user_limit: number
          total_used: number
          type: string
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          per_user_limit?: number
          total_used?: number
          type: string
          usage_limit?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          per_user_limit?: number
          total_used?: number
          type?: string
          usage_limit?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          uses?: number | null
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          paid_at: string | null
          referred_user_id: string | null
          referrer_id: string
          status: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          referred_user_id?: string | null
          referrer_id: string
          status?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          referred_user_id?: string | null
          referrer_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      reserve_holds: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          order_id: string
          release_at: string
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["reserve_hold_status"]
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          id?: string
          order_id: string
          release_at: string
          released_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["reserve_hold_status"]
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          release_at?: string
          released_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["reserve_hold_status"]
        }
        Relationships: []
      }
      review_edit_history: {
        Row: {
          edit_reason: string | null
          edited_at: string
          editor_id: string
          id: string
          ip_address: unknown
          new_comment: string | null
          new_rating: number | null
          new_title: string | null
          old_comment: string | null
          old_rating: number | null
          old_title: string | null
          review_id: string
          user_agent: string | null
        }
        Insert: {
          edit_reason?: string | null
          edited_at?: string
          editor_id: string
          id?: string
          ip_address?: unknown
          new_comment?: string | null
          new_rating?: number | null
          new_title?: string | null
          old_comment?: string | null
          old_rating?: number | null
          old_title?: string | null
          review_id: string
          user_agent?: string | null
        }
        Update: {
          edit_reason?: string | null
          edited_at?: string
          editor_id?: string
          id?: string
          ip_address?: unknown
          new_comment?: string | null
          new_rating?: number | null
          new_title?: string | null
          old_comment?: string | null
          old_rating?: number | null
          old_title?: string | null
          review_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_edit_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_edit_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string | null
          edit_count: number | null
          flagged_for_moderation: boolean | null
          game_id: string | null
          id: string
          is_positive: boolean | null
          is_verified_purchase: boolean | null
          is_visible: boolean | null
          last_edited_at: string | null
          listing_id: string
          moderation_reason: string | null
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          seller_responded_at: string | null
          seller_response: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          edit_count?: number | null
          flagged_for_moderation?: boolean | null
          game_id?: string | null
          id?: string
          is_positive?: boolean | null
          is_verified_purchase?: boolean | null
          is_visible?: boolean | null
          last_edited_at?: string | null
          listing_id: string
          moderation_reason?: string | null
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          seller_responded_at?: string | null
          seller_response?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          edit_count?: number | null
          flagged_for_moderation?: boolean | null
          game_id?: string | null
          id?: string
          is_positive?: boolean | null
          is_verified_purchase?: boolean | null
          is_visible?: boolean | null
          last_edited_at?: string | null
          listing_id?: string
          moderation_reason?: string | null
          order_id?: string
          rating?: number
          reviewer_id?: string
          seller_id?: string
          seller_responded_at?: string | null
          seller_response?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      rmt_chart_snapshots: {
        Row: {
          captured_at: string
          id: number
          names: string[]
          source: string
        }
        Insert: {
          captured_at?: string
          id?: never
          names: string[]
          source?: string
        }
        Update: {
          captured_at?: string
          id?: never
          names?: string[]
          source?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["admin_role_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["admin_role_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["admin_role_enum"]
        }
        Relationships: []
      }
      sab_brainrot_aliases: {
        Row: {
          alias: string
          brainrot_id: string
          created_at: string
          id: string
          is_active: boolean
          normalized_alias: string | null
          priority: number
        }
        Insert: {
          alias: string
          brainrot_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_alias?: string | null
          priority?: number
        }
        Update: {
          alias?: string
          brainrot_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_alias?: string | null
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "sab_brainrot_aliases_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_aliases_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_aliases_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_brainrot_aliases_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_aliases_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
        ]
      }
      sab_brainrot_variants: {
        Row: {
          brainrot_id: string
          created_at: string
          exists_count: number | null
          exists_count_source_url: string | null
          exists_count_updated_at: string | null
          id: string
          income_override_per_second: number | null
          is_tradeable: boolean
          mutation_id: string
          needs_review: boolean
          updated_at: string
        }
        Insert: {
          brainrot_id: string
          created_at?: string
          exists_count?: number | null
          exists_count_source_url?: string | null
          exists_count_updated_at?: string | null
          id?: string
          income_override_per_second?: number | null
          is_tradeable?: boolean
          mutation_id: string
          needs_review?: boolean
          updated_at?: string
        }
        Update: {
          brainrot_id?: string
          created_at?: string
          exists_count?: number | null
          exists_count_source_url?: string | null
          exists_count_updated_at?: string | null
          id?: string
          income_override_per_second?: number | null
          is_tradeable?: boolean
          mutation_id?: string
          needs_review?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sab_brainrot_variants_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_brainrot_variants_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_brainrots: {
        Row: {
          acquisition_method: string | null
          aliases: string[]
          base_income_per_second: number | null
          created_at: string
          game_data_last_verified_at: string | null
          id: string
          image_alt_text: string | null
          image_path: string | null
          image_status: string
          ingame_cost: number | null
          is_active: boolean
          is_tradeable: boolean
          name: string
          needs_review: boolean
          obtainability: string
          popularity_rank: number | null
          rarity: string | null
          slug: string
          source_name: string | null
          source_page_id: number | null
          source_payload: Json
          source_revision_id: number | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          acquisition_method?: string | null
          aliases?: string[]
          base_income_per_second?: number | null
          created_at?: string
          game_data_last_verified_at?: string | null
          id?: string
          image_alt_text?: string | null
          image_path?: string | null
          image_status?: string
          ingame_cost?: number | null
          is_active?: boolean
          is_tradeable?: boolean
          name: string
          needs_review?: boolean
          obtainability?: string
          popularity_rank?: number | null
          rarity?: string | null
          slug: string
          source_name?: string | null
          source_page_id?: number | null
          source_payload?: Json
          source_revision_id?: number | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_method?: string | null
          aliases?: string[]
          base_income_per_second?: number | null
          created_at?: string
          game_data_last_verified_at?: string | null
          id?: string
          image_alt_text?: string | null
          image_path?: string | null
          image_status?: string
          ingame_cost?: number | null
          is_active?: boolean
          is_tradeable?: boolean
          name?: string
          needs_review?: boolean
          obtainability?: string
          popularity_rank?: number | null
          rarity?: string | null
          slug?: string
          source_name?: string | null
          source_page_id?: number | null
          source_payload?: Json
          source_revision_id?: number | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sab_external_market_observations: {
        Row: {
          brainrot_id: string
          confidence_score: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          mutation_id: string
          notes: string | null
          observation_type: string
          observed_at: string
          price_high_usd: number | null
          price_low_usd: number | null
          price_usd: number | null
          sample_size: number
          source_name: string
          source_reference: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          brainrot_id: string
          confidence_score?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          mutation_id: string
          notes?: string | null
          observation_type: string
          observed_at: string
          price_high_usd?: number | null
          price_low_usd?: number | null
          price_usd?: number | null
          sample_size?: number
          source_name: string
          source_reference?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          brainrot_id?: string
          confidence_score?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          mutation_id?: string
          notes?: string | null
          observation_type?: string
          observed_at?: string
          price_high_usd?: number | null
          price_low_usd?: number | null
          price_usd?: number | null
          sample_size?: number
          source_name?: string
          source_reference?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_import_runs: {
        Row: {
          completed_at: string | null
          details: Json
          error_message: string | null
          id: string
          pages_seen: number
          records_flagged: number
          records_inserted: number
          records_updated: number
          source_name: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          id?: string
          pages_seen?: number
          records_flagged?: number
          records_inserted?: number
          records_updated?: number
          source_name: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          id?: string
          pages_seen?: number
          records_flagged?: number
          records_inserted?: number
          records_updated?: number
          source_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sab_market_evidence_display: {
        Row: {
          brainrot_id: string
          evidence_count: number | null
          external_listing_id: string | null
          fetched_at: string | null
          id: string
          listing_status: string | null
          listing_type: string | null
          market_tier: string | null
          market_tier_rank: number | null
          median_usd: number | null
          minimum_cash_value_usd: number | null
          mutation_id: string
          observed_at: string | null
          q1_usd: number | null
          q3_usd: number | null
          refreshed_at: string
          relative_iqr: number | null
          source_id: string
          source_name: string | null
          source_slug: string | null
          source_weight: number | null
          unit_price_usd: number | null
        }
        Insert: {
          brainrot_id: string
          evidence_count?: number | null
          external_listing_id?: string | null
          fetched_at?: string | null
          id: string
          listing_status?: string | null
          listing_type?: string | null
          market_tier?: string | null
          market_tier_rank?: number | null
          median_usd?: number | null
          minimum_cash_value_usd?: number | null
          mutation_id: string
          observed_at?: string | null
          q1_usd?: number | null
          q3_usd?: number | null
          refreshed_at?: string
          relative_iqr?: number | null
          source_id: string
          source_name?: string | null
          source_slug?: string | null
          source_weight?: number | null
          unit_price_usd?: number | null
        }
        Update: {
          brainrot_id?: string
          evidence_count?: number | null
          external_listing_id?: string | null
          fetched_at?: string | null
          id?: string
          listing_status?: string | null
          listing_type?: string | null
          market_tier?: string | null
          market_tier_rank?: number | null
          median_usd?: number | null
          minimum_cash_value_usd?: number | null
          mutation_id?: string
          observed_at?: string | null
          q1_usd?: number | null
          q3_usd?: number | null
          refreshed_at?: string
          relative_iqr?: number | null
          source_id?: string
          source_name?: string | null
          source_slug?: string | null
          source_weight?: number | null
          unit_price_usd?: number | null
        }
        Relationships: []
      }
      sab_market_observations: {
        Row: {
          brainrot_id: string
          delivery_time_minutes: number | null
          id: number
          is_valid: boolean
          listing_created_at: string | null
          mutation_id: string | null
          observation_type: string
          observed_at: string
          price_usd: number
          quantity: number
          raw_payload: Json
          rejection_reason: string | null
          seller_identifier_hash: string | null
          seller_rating: number | null
          source_listing_id: string | null
          source_name: string
          source_url: string | null
          unit_price_usd: number | null
        }
        Insert: {
          brainrot_id: string
          delivery_time_minutes?: number | null
          id?: never
          is_valid?: boolean
          listing_created_at?: string | null
          mutation_id?: string | null
          observation_type: string
          observed_at?: string
          price_usd: number
          quantity?: number
          raw_payload?: Json
          rejection_reason?: string | null
          seller_identifier_hash?: string | null
          seller_rating?: number | null
          source_listing_id?: string | null
          source_name: string
          source_url?: string | null
          unit_price_usd?: number | null
        }
        Update: {
          brainrot_id?: string
          delivery_time_minutes?: number | null
          id?: never
          is_valid?: boolean
          listing_created_at?: string | null
          mutation_id?: string | null
          observation_type?: string
          observed_at?: string
          price_usd?: number
          quantity?: number
          raw_payload?: Json
          rejection_reason?: string | null
          seller_identifier_hash?: string | null
          seller_rating?: number | null
          source_listing_id?: string | null
          source_name?: string
          source_url?: string | null
          unit_price_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_market_pricing_policy: {
        Row: {
          cross_source_max_spread_ratio: number
          cross_source_min_samples: number
          id: number
          minimum_trade_price_usd: number
          strong_active_max_iqr_ratio: number
          strong_active_min_samples: number
          strong_cluster_max_source_spread_ratio: number
          supported_active_max_iqr_ratio: number
          supported_active_max_samples: number
          supported_active_min_samples: number
          updated_at: string
        }
        Insert: {
          cross_source_max_spread_ratio: number
          cross_source_min_samples: number
          id: number
          minimum_trade_price_usd: number
          strong_active_max_iqr_ratio: number
          strong_active_min_samples: number
          strong_cluster_max_source_spread_ratio: number
          supported_active_max_iqr_ratio: number
          supported_active_max_samples: number
          supported_active_min_samples: number
          updated_at?: string
        }
        Update: {
          cross_source_max_spread_ratio?: number
          cross_source_min_samples?: number
          id?: number
          minimum_trade_price_usd?: number
          strong_active_max_iqr_ratio?: number
          strong_active_min_samples?: number
          strong_cluster_max_source_spread_ratio?: number
          supported_active_max_iqr_ratio?: number
          supported_active_max_samples?: number
          supported_active_min_samples?: number
          updated_at?: string
        }
        Relationships: []
      }
      sab_market_raw_listings: {
        Row: {
          brainrot_id: string | null
          created_at: string
          currency: string
          description: string | null
          ended_at: string | null
          external_listing_id: string
          fetched_at: string
          id: string
          is_account_listing: boolean
          is_bundle: boolean
          is_duplicate: boolean
          is_inventory_listing: boolean
          is_outlier: boolean
          listed_at: string | null
          listed_price: number
          listing_status: string
          listing_type: string
          listing_url: string | null
          mutation_id: string | null
          observed_at: string
          parse_status: string
          parser_confidence: number | null
          quantity: number
          raw_payload: Json | null
          rejection_reason: string | null
          seller_rating: number | null
          seller_reference: string | null
          seller_sales_count: number | null
          shipping_price: number
          source_id: string
          title: string
          total_price_usd: number
          unit_price_usd: number | null
          updated_at: string
        }
        Insert: {
          brainrot_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ended_at?: string | null
          external_listing_id: string
          fetched_at?: string
          id?: string
          is_account_listing?: boolean
          is_bundle?: boolean
          is_duplicate?: boolean
          is_inventory_listing?: boolean
          is_outlier?: boolean
          listed_at?: string | null
          listed_price: number
          listing_status?: string
          listing_type: string
          listing_url?: string | null
          mutation_id?: string | null
          observed_at?: string
          parse_status?: string
          parser_confidence?: number | null
          quantity?: number
          raw_payload?: Json | null
          rejection_reason?: string | null
          seller_rating?: number | null
          seller_reference?: string | null
          seller_sales_count?: number | null
          shipping_price?: number
          source_id: string
          title: string
          total_price_usd: number
          unit_price_usd?: number | null
          updated_at?: string
        }
        Update: {
          brainrot_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ended_at?: string | null
          external_listing_id?: string
          fetched_at?: string
          id?: string
          is_account_listing?: boolean
          is_bundle?: boolean
          is_duplicate?: boolean
          is_inventory_listing?: boolean
          is_outlier?: boolean
          listed_at?: string | null
          listed_price?: number
          listing_status?: string
          listing_type?: string
          listing_url?: string | null
          mutation_id?: string | null
          observed_at?: string
          parse_status?: string
          parser_confidence?: number | null
          quantity?: number
          raw_payload?: Json | null
          rejection_reason?: string | null
          seller_rating?: number | null
          seller_reference?: string | null
          seller_sales_count?: number | null
          shipping_price?: number
          source_id?: string
          title?: string
          total_price_usd?: number
          unit_price_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sab_market_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sab_market_rejection_patterns: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          normalized_pattern: string | null
          pattern: string
          priority: number
          reason: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_pattern?: string | null
          pattern: string
          priority?: number
          reason: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          normalized_pattern?: string | null
          pattern?: string
          priority?: number
          reason?: string
        }
        Relationships: []
      }
      sab_market_sources: {
        Row: {
          base_url: string | null
          collection_method: string
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
          market_tier: string
          name: string
          slug: string
          source_weight: number
          status: string
          supports_active_listings: boolean
          supports_completed_sales: boolean
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          collection_method: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          market_tier?: string
          name: string
          slug: string
          source_weight?: number
          status?: string
          supports_active_listings?: boolean
          supports_completed_sales?: boolean
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          collection_method?: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          market_tier?: string
          name?: string
          slug?: string
          source_weight?: number
          status?: string
          supports_active_listings?: boolean
          supports_completed_sales?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sab_market_sync_config: {
        Row: {
          id: number
          imports_enabled: boolean
          live_data_start_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          imports_enabled?: boolean
          live_data_start_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          imports_enabled?: boolean
          live_data_start_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sab_market_watchlist: {
        Row: {
          added_by: string
          brainrot_id: string
          consecutive_no_data_checks: number
          created_at: string
          id: string
          last_checked_at: string | null
          last_confidence_label: string | null
          last_market_value_usd: number | null
          minimum_cash_value_usd: number
          mutation_id: string
          next_check_at: string
          priority: number
          reason: string | null
          refresh_interval_hours: number
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string
          brainrot_id: string
          consecutive_no_data_checks?: number
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_confidence_label?: string | null
          last_market_value_usd?: number | null
          minimum_cash_value_usd?: number
          mutation_id: string
          next_check_at?: string
          priority?: number
          reason?: string | null
          refresh_interval_hours?: number
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string
          brainrot_id?: string
          consecutive_no_data_checks?: number
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_confidence_label?: string | null
          last_market_value_usd?: number | null
          minimum_cash_value_usd?: number
          mutation_id?: string
          next_check_at?: string
          priority?: number
          reason?: string | null
          refresh_interval_hours?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sab_market_watchlist_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_watchlist_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_mutation_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          is_active: boolean
          mutation_id: string
          normalized_alias: string | null
          priority: number
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          is_active?: boolean
          mutation_id: string
          normalized_alias?: string | null
          priority?: number
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          is_active?: boolean
          mutation_id?: string
          normalized_alias?: string | null
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "sab_mutation_aliases_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_mutation_aliases_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_mutation_aliases_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_mutation_aliases_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_mutation_price_multipliers: {
        Row: {
          computed_at: string
          mutation_slug: string
          pair_count: number
          price_multiplier: number
        }
        Insert: {
          computed_at?: string
          mutation_slug: string
          pair_count: number
          price_multiplier: number
        }
        Update: {
          computed_at?: string
          mutation_slug?: string
          pair_count?: number
          price_multiplier?: number
        }
        Relationships: []
      }
      sab_mutations: {
        Row: {
          availability: string
          created_at: string
          id: string
          income_multiplier: number
          is_active: boolean
          last_verified_at: string | null
          mutation_type: string
          name: string
          slug: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          availability?: string
          created_at?: string
          id?: string
          income_multiplier?: number
          is_active?: boolean
          last_verified_at?: string | null
          mutation_type?: string
          name: string
          slug: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          id?: string
          income_multiplier?: number
          is_active?: boolean
          last_verified_at?: string | null
          mutation_type?: string
          name?: string
          slug?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sab_price_corrections: {
        Row: {
          anchor_usd: number | null
          average_usd: number | null
          brainrot_id: string
          cheapest_usd: number | null
          cohort_size: number
          computed_at: string
          confidence_label: string
          high_usd: number | null
          is_anchored: boolean
          is_publishable: boolean
          low_usd: number | null
          mutation_id: string
          original_value_usd: number | null
          reason: string
          sample_count: number
          value_usd: number | null
        }
        Insert: {
          anchor_usd?: number | null
          average_usd?: number | null
          brainrot_id: string
          cheapest_usd?: number | null
          cohort_size?: number
          computed_at?: string
          confidence_label: string
          high_usd?: number | null
          is_anchored?: boolean
          is_publishable?: boolean
          low_usd?: number | null
          mutation_id: string
          original_value_usd?: number | null
          reason: string
          sample_count?: number
          value_usd?: number | null
        }
        Update: {
          anchor_usd?: number | null
          average_usd?: number | null
          brainrot_id?: string
          cheapest_usd?: number | null
          cohort_size?: number
          computed_at?: string
          confidence_label?: string
          high_usd?: number | null
          is_anchored?: boolean
          is_publishable?: boolean
          low_usd?: number | null
          mutation_id?: string
          original_value_usd?: number | null
          reason?: string
          sample_count?: number
          value_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_price_corrections_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_corrections_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_corrections_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_corrections_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_corrections_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_corrections_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_price_corrections_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_corrections_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_corrections_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_price_display: {
        Row: {
          anchor_usd: number | null
          average_usd: number | null
          brainrot_id: string
          brainrot_name: string | null
          brainrot_slug: string | null
          cheapest_usd: number | null
          cohort_size: number | null
          confidence_label: string | null
          correction_reason: string | null
          external_sample_size: number | null
          image_url: string | null
          is_anchored: boolean | null
          is_public_estimate: boolean | null
          is_trade_ready: boolean | null
          market_high_usd: number | null
          market_low_usd: number | null
          market_value_usd: number | null
          mutation_id: string
          mutation_name: string | null
          mutation_slug: string
          price_updated_at: string | null
          rarity: string | null
          refreshed_at: string
          source_count: number | null
        }
        Insert: {
          anchor_usd?: number | null
          average_usd?: number | null
          brainrot_id: string
          brainrot_name?: string | null
          brainrot_slug?: string | null
          cheapest_usd?: number | null
          cohort_size?: number | null
          confidence_label?: string | null
          correction_reason?: string | null
          external_sample_size?: number | null
          image_url?: string | null
          is_anchored?: boolean | null
          is_public_estimate?: boolean | null
          is_trade_ready?: boolean | null
          market_high_usd?: number | null
          market_low_usd?: number | null
          market_value_usd?: number | null
          mutation_id: string
          mutation_name?: string | null
          mutation_slug: string
          price_updated_at?: string | null
          rarity?: string | null
          refreshed_at?: string
          source_count?: number | null
        }
        Update: {
          anchor_usd?: number | null
          average_usd?: number | null
          brainrot_id?: string
          brainrot_name?: string | null
          brainrot_slug?: string | null
          cheapest_usd?: number | null
          cohort_size?: number | null
          confidence_label?: string | null
          correction_reason?: string | null
          external_sample_size?: number | null
          image_url?: string | null
          is_anchored?: boolean | null
          is_public_estimate?: boolean | null
          is_trade_ready?: boolean | null
          market_high_usd?: number | null
          market_low_usd?: number | null
          market_value_usd?: number | null
          mutation_id?: string
          mutation_name?: string | null
          mutation_slug?: string
          price_updated_at?: string | null
          rarity?: string | null
          refreshed_at?: string
          source_count?: number | null
        }
        Relationships: []
      }
      sab_price_history: {
        Row: {
          brainrot_id: string
          captured_at: string
          confidence_label: string
          high_usd: number
          history_date: string
          id: string
          is_public_estimate: boolean
          is_trade_ready: boolean
          listing_count: number
          low_usd: number
          median_usd: number
          mutation_id: string
          price_updated_at: string | null
          source_count: number
        }
        Insert: {
          brainrot_id: string
          captured_at?: string
          confidence_label?: string
          high_usd: number
          history_date: string
          id?: string
          is_public_estimate?: boolean
          is_trade_ready?: boolean
          listing_count?: number
          low_usd: number
          median_usd: number
          mutation_id: string
          price_updated_at?: string | null
          source_count?: number
        }
        Update: {
          brainrot_id?: string
          captured_at?: string
          confidence_label?: string
          high_usd?: number
          history_date?: string
          id?: string
          is_public_estimate?: boolean
          is_trade_ready?: boolean
          listing_count?: number
          low_usd?: number
          median_usd?: number
          mutation_id?: string
          price_updated_at?: string | null
          source_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sab_price_history_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_history_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_history_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_history_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_history_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_history_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_price_history_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_history_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_history_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_price_snapshots: {
        Row: {
          active_listing_count: number
          brainrot_id: string
          calculated_at: string
          calculation_version: string
          completed_sale_count: number
          confidence_label: string
          confidence_score: number | null
          id: number
          market_floor_usd: number | null
          mutation_id: string | null
          observed_high_usd: number | null
          observed_low_usd: number | null
          patient_sale_usd: number | null
          quick_sale_usd: number | null
          typical_sale_usd: number | null
          unique_seller_count: number
        }
        Insert: {
          active_listing_count?: number
          brainrot_id: string
          calculated_at?: string
          calculation_version?: string
          completed_sale_count?: number
          confidence_label?: string
          confidence_score?: number | null
          id?: never
          market_floor_usd?: number | null
          mutation_id?: string | null
          observed_high_usd?: number | null
          observed_low_usd?: number | null
          patient_sale_usd?: number | null
          quick_sale_usd?: number | null
          typical_sale_usd?: number | null
          unique_seller_count?: number
        }
        Update: {
          active_listing_count?: number
          brainrot_id?: string
          calculated_at?: string
          calculation_version?: string
          completed_sale_count?: number
          confidence_label?: string
          confidence_score?: number | null
          id?: never
          market_floor_usd?: number | null
          mutation_id?: string | null
          observed_high_usd?: number | null
          observed_low_usd?: number | null
          patient_sale_usd?: number | null
          quick_sale_usd?: number | null
          typical_sale_usd?: number | null
          unique_seller_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_source_mappings: {
        Row: {
          brainrot_id: string | null
          confidence: number | null
          created_at: string
          id: string
          mapping_status: string
          mutation_id: string | null
          normalized_source_item_name: string
          reviewed_at: string | null
          source_item_name: string
          source_name: string
          updated_at: string
        }
        Insert: {
          brainrot_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          mapping_status?: string
          mutation_id?: string | null
          normalized_source_item_name: string
          reviewed_at?: string | null
          source_item_name: string
          source_name: string
          updated_at?: string
        }
        Update: {
          brainrot_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          mapping_status?: string
          mutation_id?: string | null
          normalized_source_item_name?: string
          reviewed_at?: string | null
          source_item_name?: string
          source_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sab_source_mappings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_source_mappings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_source_mappings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_source_mappings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_source_mappings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_source_mappings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_source_mappings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_source_mappings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_source_mappings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      seller_applications: {
        Row: {
          accepted_anti_fraud_policy: boolean | null
          accepted_commission_structure: boolean | null
          accepted_data_processing: boolean | null
          accepted_privacy_policy: boolean | null
          accepted_seller_agreement: boolean | null
          address_verified: boolean | null
          admin_notes: string | null
          alternate_email: string | null
          bank_account_holder_name: string | null
          bank_account_number_encrypted: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_routing_code: string | null
          bank_swift_code: string | null
          business_email: string | null
          business_hours: string | null
          business_phone: string | null
          business_registration_number: string | null
          business_type: string | null
          business_verified: boolean | null
          can_reapply_at: string | null
          city: string | null
          company_address: string | null
          company_legal_name: string | null
          country: string | null
          created_at: string
          crypto_type: string | null
          crypto_wallet_address: string | null
          delivery_timeframe: string | null
          device_fingerprint: string | null
          discord_username: string | null
          display_name: string
          expected_monthly_volume: string | null
          fraud_score: number | null
          full_legal_name: string | null
          games_categories: Json | null
          id: string
          identity_verified: boolean | null
          information_accurate_confirmed: boolean | null
          ip_address: unknown
          is_18_or_older: boolean
          languages_spoken: string[] | null
          other_games: string | null
          payout_currency: string | null
          payout_method: string | null
          paypal_email: string | null
          phone_number: string | null
          phone_verified: boolean | null
          primary_games: string[] | null
          profile_bio: string | null
          profile_picture_path: string | null
          referral_code: string | null
          refund_policy: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_category: string | null
          rejection_count: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_signature: string | null
          seller_signature_image: string | null
          seller_signed_at: string | null
          seller_type: string
          selling_experience: string | null
          shop_name: string | null
          state_province: string | null
          status: string
          submitted_at: string | null
          tax_id_vat: string | null
          tax_residency_country: string | null
          tax_verified: boolean | null
          terms_of_service: string | null
          timezone: string | null
          twitch_channel: string | null
          twitter_handle: string | null
          updated_at: string
          user_id: string
          w8ben_submitted: boolean | null
          w9_submitted: boolean | null
          withdrawal_count: number | null
          withdrawn_at: string | null
          year_established: number | null
          youtube_channel: string | null
        }
        Insert: {
          accepted_anti_fraud_policy?: boolean | null
          accepted_commission_structure?: boolean | null
          accepted_data_processing?: boolean | null
          accepted_privacy_policy?: boolean | null
          accepted_seller_agreement?: boolean | null
          address_verified?: boolean | null
          admin_notes?: string | null
          alternate_email?: string | null
          bank_account_holder_name?: string | null
          bank_account_number_encrypted?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          bank_swift_code?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_phone?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          can_reapply_at?: string | null
          city?: string | null
          company_address?: string | null
          company_legal_name?: string | null
          country?: string | null
          created_at?: string
          crypto_type?: string | null
          crypto_wallet_address?: string | null
          delivery_timeframe?: string | null
          device_fingerprint?: string | null
          discord_username?: string | null
          display_name: string
          expected_monthly_volume?: string | null
          fraud_score?: number | null
          full_legal_name?: string | null
          games_categories?: Json | null
          id?: string
          identity_verified?: boolean | null
          information_accurate_confirmed?: boolean | null
          ip_address?: unknown
          is_18_or_older: boolean
          languages_spoken?: string[] | null
          other_games?: string | null
          payout_currency?: string | null
          payout_method?: string | null
          paypal_email?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          primary_games?: string[] | null
          profile_bio?: string | null
          profile_picture_path?: string | null
          referral_code?: string | null
          refund_policy?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_category?: string | null
          rejection_count?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_signature?: string | null
          seller_signature_image?: string | null
          seller_signed_at?: string | null
          seller_type: string
          selling_experience?: string | null
          shop_name?: string | null
          state_province?: string | null
          status?: string
          submitted_at?: string | null
          tax_id_vat?: string | null
          tax_residency_country?: string | null
          tax_verified?: boolean | null
          terms_of_service?: string | null
          timezone?: string | null
          twitch_channel?: string | null
          twitter_handle?: string | null
          updated_at?: string
          user_id: string
          w8ben_submitted?: boolean | null
          w9_submitted?: boolean | null
          withdrawal_count?: number | null
          withdrawn_at?: string | null
          year_established?: number | null
          youtube_channel?: string | null
        }
        Update: {
          accepted_anti_fraud_policy?: boolean | null
          accepted_commission_structure?: boolean | null
          accepted_data_processing?: boolean | null
          accepted_privacy_policy?: boolean | null
          accepted_seller_agreement?: boolean | null
          address_verified?: boolean | null
          admin_notes?: string | null
          alternate_email?: string | null
          bank_account_holder_name?: string | null
          bank_account_number_encrypted?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          bank_swift_code?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_phone?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          can_reapply_at?: string | null
          city?: string | null
          company_address?: string | null
          company_legal_name?: string | null
          country?: string | null
          created_at?: string
          crypto_type?: string | null
          crypto_wallet_address?: string | null
          delivery_timeframe?: string | null
          device_fingerprint?: string | null
          discord_username?: string | null
          display_name?: string
          expected_monthly_volume?: string | null
          fraud_score?: number | null
          full_legal_name?: string | null
          games_categories?: Json | null
          id?: string
          identity_verified?: boolean | null
          information_accurate_confirmed?: boolean | null
          ip_address?: unknown
          is_18_or_older?: boolean
          languages_spoken?: string[] | null
          other_games?: string | null
          payout_currency?: string | null
          payout_method?: string | null
          paypal_email?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          primary_games?: string[] | null
          profile_bio?: string | null
          profile_picture_path?: string | null
          referral_code?: string | null
          refund_policy?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_category?: string | null
          rejection_count?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_signature?: string | null
          seller_signature_image?: string | null
          seller_signed_at?: string | null
          seller_type?: string
          selling_experience?: string | null
          shop_name?: string | null
          state_province?: string | null
          status?: string
          submitted_at?: string | null
          tax_id_vat?: string | null
          tax_residency_country?: string | null
          tax_verified?: boolean | null
          terms_of_service?: string | null
          timezone?: string | null
          twitch_channel?: string | null
          twitter_handle?: string | null
          updated_at?: string
          user_id?: string
          w8ben_submitted?: boolean | null
          w9_submitted?: boolean | null
          withdrawal_count?: number | null
          withdrawn_at?: string | null
          year_established?: number | null
          youtube_channel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_kyc_documents: {
        Row: {
          application_id: string
          created_at: string
          document_type: string
          expires_at: string | null
          extracted_data: Json | null
          face_match_confidence: number | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          liveness_check_passed: boolean | null
          uploaded_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          document_type: string
          expires_at?: string | null
          extracted_data?: Json | null
          face_match_confidence?: number | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          liveness_check_passed?: boolean | null
          uploaded_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          document_type?: string
          expires_at?: string | null
          extracted_data?: Json | null
          face_match_confidence?: number | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          liveness_check_passed?: boolean | null
          uploaded_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_kyc_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications_with_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_kyc_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_leads: {
        Row: {
          contact: string | null
          created_at: string
          game: string | null
          handle: string
          id: string
          last_contacted: string | null
          next_follow_up: string | null
          notes: string | null
          owner_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          game?: string | null
          handle: string
          id?: string
          last_contacted?: string | null
          next_follow_up?: string | null
          notes?: string | null
          owner_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          game?: string | null
          handle?: string
          id?: string
          last_contacted?: string | null
          next_follow_up?: string | null
          notes?: string | null
          owner_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          read_at: string | null
          related_id: string | null
          related_type: string | null
          seller_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          seller_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          seller_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_notifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_notifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_notifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_notifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_notifications_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          destination: string
          failed_reason: string | null
          id: string
          method: string
          processed_at: string | null
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          destination: string
          failed_reason?: string | null
          id?: string
          method?: string
          processed_at?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          destination?: string
          failed_reason?: string | null
          id?: string
          method?: string
          processed_at?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_presence: {
        Row: {
          is_online: boolean
          last_active_at: string
          last_seen_at: string
          seller_id: string
          status_message: string | null
          store_paused: boolean
          updated_at: string
        }
        Insert: {
          is_online?: boolean
          last_active_at?: string
          last_seen_at?: string
          seller_id: string
          status_message?: string | null
          store_paused?: boolean
          updated_at?: string
        }
        Update: {
          is_online?: boolean
          last_active_at?: string
          last_seen_at?: string
          seller_id?: string
          status_message?: string | null
          store_paused?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_presence_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_presence_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_presence_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_presence_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_presence_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_restrictions: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          restricted_by: string
          restriction_type: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          restricted_by: string
          restriction_type: string
          seller_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          restricted_by?: string
          restriction_type?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_restrictions_restricted_by_fkey"
            columns: ["restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_restrictions_restricted_by_fkey"
            columns: ["restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_restrictions_restricted_by_fkey"
            columns: ["restricted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_restrictions_restricted_by_fkey"
            columns: ["restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_restrictions_restricted_by_fkey"
            columns: ["restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_restrictions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_restrictions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_restrictions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_restrictions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_restrictions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_stats: {
        Row: {
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          orders_count: number | null
          revenue: number | null
          sales_by_game: Json | null
          seller_id: string
          traffic_direct: number | null
          traffic_external: number | null
          traffic_search: number | null
          traffic_social: number | null
          unique_visitors: number | null
          views: number | null
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          orders_count?: number | null
          revenue?: number | null
          sales_by_game?: Json | null
          seller_id: string
          traffic_direct?: number | null
          traffic_external?: number | null
          traffic_search?: number | null
          traffic_social?: number | null
          unique_visitors?: number | null
          views?: number | null
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          orders_count?: number | null
          revenue?: number | null
          sales_by_game?: Json | null
          seller_id?: string
          traffic_direct?: number | null
          traffic_external?: number | null
          traffic_search?: number | null
          traffic_social?: number | null
          unique_visitors?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_tier_config: {
        Row: {
          auto_approve_bulk: boolean
          auto_approve_single: boolean
          badge_color: string
          banner_access: boolean
          bulk_daily_cap: number | null
          commission_rate: number
          created_at: string | null
          description: string | null
          display_name: string
          fee_multiplier: number
          gmv_90d_min: number
          listing_limit: number | null
          min_age_days: number
          min_completion_rate: number | null
          min_rating: number | null
          min_sales: number
          orders_90d_min: number
          positive_rating_min: number | null
          pre_moderation_listings: number
          sort_order: number
          tier: string
        }
        Insert: {
          auto_approve_bulk?: boolean
          auto_approve_single?: boolean
          badge_color?: string
          banner_access?: boolean
          bulk_daily_cap?: number | null
          commission_rate: number
          created_at?: string | null
          description?: string | null
          display_name: string
          fee_multiplier?: number
          gmv_90d_min?: number
          listing_limit?: number | null
          min_age_days?: number
          min_completion_rate?: number | null
          min_rating?: number | null
          min_sales?: number
          orders_90d_min?: number
          positive_rating_min?: number | null
          pre_moderation_listings?: number
          sort_order?: number
          tier: string
        }
        Update: {
          auto_approve_bulk?: boolean
          auto_approve_single?: boolean
          badge_color?: string
          banner_access?: boolean
          bulk_daily_cap?: number | null
          commission_rate?: number
          created_at?: string | null
          description?: string | null
          display_name?: string
          fee_multiplier?: number
          gmv_90d_min?: number
          listing_limit?: number | null
          min_age_days?: number
          min_completion_rate?: number | null
          min_rating?: number | null
          min_sales?: number
          orders_90d_min?: number
          positive_rating_min?: number | null
          pre_moderation_listings?: number
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      seller_tier_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_tier: string
          notes: string | null
          previous_tier: string | null
          reason: string
          seller_rating_at_change: number | null
          total_sales_at_change: number | null
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_tier: string
          notes?: string | null
          previous_tier?: string | null
          reason: string
          seller_rating_at_change?: number | null
          total_sales_at_change?: number | null
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_tier?: string
          notes?: string | null
          previous_tier?: string | null
          reason?: string
          seller_rating_at_change?: number | null
          total_sales_at_change?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_tier_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_tier_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_tier_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_tier_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_tier_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_tier_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_tier_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_tier_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_tier_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_tier_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_verification_logs: {
        Row: {
          action: string
          application_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          is_system_action: boolean | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          application_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          is_system_action?: boolean | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          application_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          is_system_action?: boolean | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_verification_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verification_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications_with_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verification_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_verification_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_verification_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verification_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_verification_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      shop_visits: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          page_path: string | null
          referrer: string | null
          seller_id: string
          session_id: string | null
          user_agent: string | null
          visited_at: string | null
          visitor_id: string | null
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          page_path?: string | null
          referrer?: string | null
          seller_id: string
          session_id?: string | null
          user_agent?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          page_path?: string | null
          referrer?: string | null
          seller_id?: string
          session_id?: string | null
          user_agent?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "shop_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      trend_events: {
        Row: {
          created_at: string
          discord_message_id: string | null
          draft: Json | null
          external_id: string
          flags: Json
          game_id: string | null
          handled_at: string | null
          id: string
          name: string | null
          platform: string
          signal: string
          value: number
        }
        Insert: {
          created_at?: string
          discord_message_id?: string | null
          draft?: Json | null
          external_id: string
          flags?: Json
          game_id?: string | null
          handled_at?: string | null
          id?: string
          name?: string | null
          platform: string
          signal: string
          value?: number
        }
        Update: {
          created_at?: string
          discord_message_id?: string | null
          draft?: Json | null
          external_id?: string
          flags?: Json
          game_id?: string | null
          handled_at?: string | null
          id?: string
          name?: string | null
          platform?: string
          signal?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "trend_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      trustpilot_invitations: {
        Row: {
          buyer_id: string
          created_at: string
          email: string
          id: string
          invitation_token: string | null
          order_id: string
          review_rating: number | null
          review_submitted: boolean
          review_submitted_at: string | null
          review_url: string | null
          scheduled_for: string | null
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          email: string
          id?: string
          invitation_token?: string | null
          order_id: string
          review_rating?: number | null
          review_submitted?: boolean
          review_submitted_at?: string | null
          review_url?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          email?: string
          id?: string
          invitation_token?: string | null
          order_id?: string
          review_rating?: number | null
          review_submitted?: boolean
          review_submitted_at?: string | null
          review_url?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trustpilot_invitations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "trustpilot_invitations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "trustpilot_invitations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trustpilot_invitations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "trustpilot_invitations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "trustpilot_invitations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          lifetime_earned: number
          lifetime_spent: number
          pending_balance: number
          referral_earnings: number
          total_cashback: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          pending_balance?: number
          referral_earnings?: number
          total_cashback?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          pending_balance?: number
          referral_earnings?: number
          total_cashback?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "wallet_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "wallet_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "wallet_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          payment_intent_id: string | null
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_intent_id?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_intent_id?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          id: string
          payload_hash: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          result: Json | null
          status: Database["public"]["Enums"]["webhook_event_status"]
        }
        Insert: {
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["webhook_event_status"]
        }
        Update: {
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["webhook_event_status"]
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_methods: {
        Row: {
          chain: string | null
          coin: string | null
          coming_soon: boolean
          created_at: string | null
          description: string | null
          display_name: string
          fee_currency: string | null
          fee_fixed: number | null
          fee_percentage: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          max_withdrawal: number
          method_name: string
          method_type: string
          min_withdrawal: number
          processing_time: string | null
          requires_kyc: boolean | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          chain?: string | null
          coin?: string | null
          coming_soon?: boolean
          created_at?: string | null
          description?: string | null
          display_name: string
          fee_currency?: string | null
          fee_fixed?: number | null
          fee_percentage?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          max_withdrawal?: number
          method_name: string
          method_type: string
          min_withdrawal?: number
          processing_time?: string | null
          requires_kyc?: boolean | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          chain?: string | null
          coin?: string | null
          coming_soon?: boolean
          created_at?: string | null
          description?: string | null
          display_name?: string
          fee_currency?: string | null
          fee_fixed?: number | null
          fee_percentage?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          max_withdrawal?: number
          method_name?: string
          method_type?: string
          min_withdrawal?: number
          processing_time?: string | null
          requires_kyc?: boolean | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          completed_at: string | null
          created_at: string | null
          fee_amount: number
          fee_percentage: number | null
          id: string
          method_id: string
          method_name: string
          net_amount: number
          payment_details: Json
          payment_reference: string | null
          processed_by: string | null
          rejected_at: string | null
          status: string
          transaction_hash: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          fee_amount?: number
          fee_percentage?: number | null
          id?: string
          method_id: string
          method_name: string
          net_amount: number
          payment_details?: Json
          payment_reference?: string | null
          processed_by?: string | null
          rejected_at?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          fee_amount?: number
          fee_percentage?: number | null
          id?: string
          method_id?: string
          method_name?: string
          net_amount?: number
          payment_details?: Json
          payment_reference?: string | null
          processed_by?: string | null
          rejected_at?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
    }
    Views: {
      admin_review_overview: {
        Row: {
          comment: string | null
          created_at: string | null
          edit_count: number | null
          flagged_for_moderation: boolean | null
          game_name: string | null
          has_seller_response: boolean | null
          id: string | null
          is_positive: boolean | null
          is_visible: boolean | null
          last_edited_at: string | null
          listing_title: string | null
          moderation_reason: string | null
          order_id: string | null
          rating: number | null
          reviewer_email: string | null
          reviewer_id: string | null
          reviewer_username: string | null
          seller_id: string | null
          seller_shop_name: string | null
          seller_username: string | null
          title: string | null
          total_edits: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes_with_users: {
        Row: {
          assigned_admin_name: string | null
          assigned_admin_username: string | null
          assigned_at: string | null
          assigned_to: string | null
          buyer_avatar: string | null
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_username: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          disputed_amount: number | null
          escalated_at: string | null
          escalated_by: string | null
          escalation_reason: string | null
          evidence_urls: string[] | null
          first_response_at: string | null
          first_response_deadline: string | null
          id: string | null
          message_count: number | null
          order_reference: string | null
          priority: string | null
          public_message_count: number | null
          reason: Database["public"]["Enums"]["dispute_reason_enum"] | null
          resolution_deadline: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_amount: number | null
          resolved_at: string | null
          resolved_by: string | null
          seller_avatar: string | null
          seller_email: string | null
          seller_id: string | null
          seller_name: string | null
          seller_username: string | null
          status: Database["public"]["Enums"]["dispute_status_enum"] | null
          title: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "disputes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      failed_operations: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          failures_last_hour: number | null
          id: string | null
          request_path: string | null
          table_name: string | null
          user_email: string | null
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          created_at: string | null
          currency: string | null
          delivery_method: string | null
          delivery_method_type: string | null
          delivery_time: string | null
          description: string | null
          game_id: string | null
          game_name: string | null
          game_slug: string | null
          id: string | null
          images: string[] | null
          min_quantity: number | null
          original_price: number | null
          platform: string | null
          price: number | null
          quantity: number | null
          region: string | null
          rejection_reason: string | null
          sales: number | null
          seller_approved_listings_count: number | null
          seller_email: string | null
          seller_id: string | null
          seller_rating: number | null
          seller_tier: string | null
          seller_total_sales: number | null
          seller_username: string | null
          status: string | null
          template_data: Json | null
          title: string | null
          updated_at: string | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      recent_security_events: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          id: string | null
          ip_address: unknown
          seller_tier: string | null
          success: boolean | null
          table_name: string | null
          user_email: string | null
          user_name: string | null
          user_role: string | null
        }
        Relationships: []
      }
      sab_brainrot_catalog: {
        Row: {
          base_income_per_second: number | null
          id: string | null
          image_alt: string | null
          image_path: string | null
          image_url: string | null
          ingame_cost: number | null
          name: string | null
          obtainability: string | null
          rarity: string | null
          slug: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          base_income_per_second?: number | null
          id?: string | null
          image_alt?: never
          image_path?: string | null
          image_url?: never
          ingame_cost?: number | null
          name?: string | null
          obtainability?: string | null
          rarity?: string | null
          slug?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          base_income_per_second?: number | null
          id?: string | null
          image_alt?: never
          image_path?: string | null
          image_url?: never
          ingame_cost?: number | null
          name?: string | null
          obtainability?: string | null
          rarity?: string | null
          slug?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sab_brainrot_market_catalog: {
        Row: {
          active_listing_count: number | null
          base_income_per_second: number | null
          cheapest_active_price_usd: number | null
          completed_sale_count: number | null
          confidence_label: string | null
          confidence_score: number | null
          display_price_label: string | null
          display_price_source: string | null
          display_price_usd: number | null
          id: string | null
          image_alt: string | null
          image_path: string | null
          image_url: string | null
          ingame_cost: number | null
          market_value_usd: number | null
          name: string | null
          obtainability: string | null
          patient_sale_usd: number | null
          price_updated_at: string | null
          quick_sale_usd: number | null
          rarity: string | null
          slug: string | null
          source_url: string | null
          unique_seller_count: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      sab_brainrot_mutation_calculator: {
        Row: {
          base_income_per_second: number | null
          brainrot_id: string | null
          brainrot_name: string | null
          brainrot_slug: string | null
          calculated_income_per_second: number | null
          exists_count: number | null
          has_known_income: boolean | null
          income_multiplier: number | null
          income_source: string | null
          is_tradeable: boolean | null
          is_verified_variant: boolean | null
          mutation_availability: string | null
          mutation_id: string | null
          mutation_name: string | null
          mutation_slug: string | null
          obtainability: string | null
          rarity: string | null
          verified_variant_id: string | null
        }
        Relationships: []
      }
      sab_external_variant_price_estimates: {
        Row: {
          average_confidence_score: number | null
          brainrot_id: string | null
          confidence_label: string | null
          estimate_usd: number | null
          evidence_rank: number | null
          high_usd: number | null
          latest_observed_at: string | null
          low_usd: number | null
          mutation_id: string | null
          observation_count: number | null
          source_count: number | null
          source_names: string | null
          source_type: string | null
          total_sample_size: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_external_market_observations_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_latest_price_snapshots: {
        Row: {
          active_listing_count: number | null
          brainrot_id: string | null
          calculated_at: string | null
          calculation_version: string | null
          completed_sale_count: number | null
          confidence_label: string | null
          confidence_score: number | null
          id: number | null
          market_floor_usd: number | null
          mutation_id: string | null
          observed_high_usd: number | null
          observed_low_usd: number | null
          patient_sale_usd: number | null
          quick_sale_usd: number | null
          typical_sale_usd: number | null
          unique_seller_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_price_snapshots_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
        ]
      }
      sab_market_clean_listing_evidence: {
        Row: {
          brainrot_id: string | null
          evidence_count: number | null
          external_listing_id: string | null
          fetched_at: string | null
          id: string | null
          listing_status: string | null
          listing_type: string | null
          market_tier: string | null
          market_tier_rank: number | null
          median_usd: number | null
          minimum_cash_value_usd: number | null
          mutation_id: string | null
          observed_at: string | null
          q1_usd: number | null
          q3_usd: number | null
          relative_iqr: number | null
          source_id: string | null
          source_name: string | null
          source_slug: string | null
          source_weight: number | null
          unit_price_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sab_market_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sab_market_listing_candidates: {
        Row: {
          brainrot_id: string | null
          external_listing_id: string | null
          fetched_at: string | null
          id: string | null
          listing_status: string | null
          listing_type: string | null
          market_tier: string | null
          market_tier_rank: number | null
          minimum_cash_value_usd: number | null
          mutation_id: string | null
          observed_at: string | null
          source_id: string | null
          source_name: string | null
          source_slug: string | null
          source_weight: number | null
          unit_price_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_market_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_brainrot_id_fkey"
            columns: ["brainrot_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["brainrot_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_brainrot_mutation_calculator"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_mutation_id_fkey"
            columns: ["mutation_id"]
            isOneToOne: false
            referencedRelation: "sab_trade_price_catalog"
            referencedColumns: ["mutation_id"]
          },
          {
            foreignKeyName: "sab_market_raw_listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sab_market_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sab_market_source_variant_estimates: {
        Row: {
          brainrot_id: string | null
          cluster_spread_ratio: number | null
          evidence_type: string | null
          high_usd: number | null
          is_strong_active_cluster: boolean | null
          latest_observed_at: string | null
          low_usd: number | null
          market_tier: string | null
          market_tier_rank: number | null
          median_usd: number | null
          mutation_id: string | null
          sample_count: number | null
          source_id: string | null
          source_name: string | null
          source_slug: string | null
          source_weight: number | null
        }
        Relationships: []
      }
      sab_market_variant_price_estimates: {
        Row: {
          active_listing_sample_count: number | null
          brainrot_id: string | null
          completed_sale_sample_count: number | null
          confidence_label: string | null
          estimate_usd: number | null
          high_usd: number | null
          is_trade_ready: boolean | null
          latest_observed_at: string | null
          low_usd: number | null
          mutation_id: string | null
          selected_market_tier: string | null
          source_count: number | null
          source_spread_ratio: number | null
          sources_used: string | null
          strong_cluster_source_count: number | null
          supported_cluster_source_count: number | null
          total_sample_count: number | null
        }
        Relationships: []
      }
      sab_mutation_catalog: {
        Row: {
          availability: string | null
          id: string | null
          income_multiplier: number | null
          mutation_type: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          availability?: string | null
          id?: string | null
          income_multiplier?: number | null
          mutation_type?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          availability?: string | null
          id?: string | null
          income_multiplier?: number | null
          mutation_type?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      sab_public_price_catalog: {
        Row: {
          brainrot_id: string | null
          brainrot_name: string | null
          brainrot_slug: string | null
          confidence_label: string | null
          external_sample_size: number | null
          image_url: string | null
          is_public_estimate: boolean | null
          is_trade_ready: boolean | null
          market_high_usd: number | null
          market_low_usd: number | null
          market_value_usd: number | null
          mutation_id: string | null
          mutation_name: string | null
          mutation_slug: string | null
          price_updated_at: string | null
          rarity: string | null
          source_count: number | null
        }
        Relationships: []
      }
      sab_public_price_catalog_corrected: {
        Row: {
          anchor_usd: number | null
          average_usd: number | null
          brainrot_id: string | null
          brainrot_name: string | null
          brainrot_slug: string | null
          cheapest_usd: number | null
          cohort_size: number | null
          confidence_label: string | null
          correction_reason: string | null
          external_sample_size: number | null
          image_url: string | null
          is_anchored: boolean | null
          is_public_estimate: boolean | null
          is_trade_ready: boolean | null
          market_high_usd: number | null
          market_low_usd: number | null
          market_value_usd: number | null
          mutation_id: string | null
          mutation_name: string | null
          mutation_slug: string | null
          price_updated_at: string | null
          rarity: string | null
          source_count: number | null
        }
        Relationships: []
      }
      sab_trade_price_catalog: {
        Row: {
          brainrot_id: string | null
          brainrot_name: string | null
          brainrot_slug: string | null
          confidence_label: string | null
          external_sample_size: number | null
          image_url: string | null
          is_trade_ready: boolean | null
          market_high_usd: number | null
          market_low_usd: number | null
          market_value_usd: number | null
          mutation_id: string | null
          mutation_name: string | null
          mutation_slug: string | null
          price_source_name: string | null
          price_source_type: string | null
          price_updated_at: string | null
          rarity: string | null
        }
        Relationships: []
      }
      seller_applications_with_users: {
        Row: {
          accepted_anti_fraud_policy: boolean | null
          accepted_commission_structure: boolean | null
          accepted_data_processing: boolean | null
          accepted_privacy_policy: boolean | null
          accepted_seller_agreement: boolean | null
          address_verified: boolean | null
          admin_notes: string | null
          alternate_email: string | null
          avatar_url: string | null
          bank_account_holder_name: string | null
          bank_account_number_encrypted: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_routing_code: string | null
          bank_swift_code: string | null
          business_email: string | null
          business_hours: string | null
          business_phone: string | null
          business_registration_number: string | null
          business_type: string | null
          business_verified: boolean | null
          can_reapply_at: string | null
          city: string | null
          company_address: string | null
          company_legal_name: string | null
          country: string | null
          created_at: string | null
          crypto_type: string | null
          crypto_wallet_address: string | null
          delivery_timeframe: string | null
          device_fingerprint: string | null
          discord_username: string | null
          display_name: string | null
          documents_count: number | null
          email: string | null
          expected_monthly_volume: string | null
          fraud_score: number | null
          full_legal_name: string | null
          full_name: string | null
          games_categories: Json | null
          id: string | null
          identity_verified: boolean | null
          information_accurate_confirmed: boolean | null
          ip_address: unknown
          is_18_or_older: boolean | null
          languages_spoken: string[] | null
          other_games: string | null
          payout_currency: string | null
          payout_method: string | null
          paypal_email: string | null
          phone_number: string | null
          phone_verified: boolean | null
          primary_games: string[] | null
          profile_bio: string | null
          profile_picture_path: string | null
          referral_code: string | null
          refund_policy: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_category: string | null
          rejection_count: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_restricted_at: string | null
          seller_restricted_by: string | null
          seller_restriction_reason: string | null
          seller_signature: string | null
          seller_signature_image: string | null
          seller_signed_at: string | null
          seller_status: string | null
          seller_type: string | null
          selling_experience: string | null
          shop_name: string | null
          state_province: string | null
          status: string | null
          submitted_at: string | null
          tax_id_vat: string | null
          tax_residency_country: string | null
          tax_verified: boolean | null
          terms_of_service: string | null
          timezone: string | null
          twitch_channel: string | null
          twitter_handle: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
          verified_documents_count: number | null
          w8ben_submitted: boolean | null
          w9_submitted: boolean | null
          withdrawal_count: number | null
          withdrawn_at: string | null
          year_established: number | null
          youtube_channel: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "profiles_seller_restricted_by_fkey"
            columns: ["seller_restricted_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      seller_dashboard_stats: {
        Row: {
          active_listings: number | null
          completed_orders: number | null
          disputed_orders: number | null
          draft_listings: number | null
          earnings_all_time: number | null
          earnings_month: number | null
          earnings_today: number | null
          earnings_week: number | null
          paused_listings: number | null
          pending_orders: number | null
          processing_orders: number | null
          seller_id: string | null
          seller_rating: number | null
          seller_tier: string | null
          sold_listings: number | null
          total_listing_sales: number | null
          total_sales: number | null
          total_views: number | null
          username: string | null
        }
        Insert: {
          active_listings?: never
          completed_orders?: never
          disputed_orders?: never
          draft_listings?: never
          earnings_all_time?: never
          earnings_month?: never
          earnings_today?: never
          earnings_week?: never
          paused_listings?: never
          pending_orders?: never
          processing_orders?: never
          seller_id?: string | null
          seller_rating?: number | null
          seller_tier?: string | null
          sold_listings?: never
          total_listing_sales?: never
          total_sales?: number | null
          total_views?: never
          username?: string | null
        }
        Update: {
          active_listings?: never
          completed_orders?: never
          disputed_orders?: never
          draft_listings?: never
          earnings_all_time?: never
          earnings_month?: never
          earnings_today?: never
          earnings_week?: never
          paused_listings?: never
          pending_orders?: never
          processing_orders?: never
          seller_id?: string | null
          seller_rating?: number | null
          seller_tier?: string | null
          sold_listings?: never
          total_listing_sales?: never
          total_sales?: number | null
          total_views?: never
          username?: string | null
        }
        Relationships: []
      }
      seller_shop_banners: {
        Row: {
          active_listings_count: number | null
          avatar_url: string | null
          banner_config: Json | null
          is_online: boolean | null
          reviews_count: number | null
          seller_id: string | null
          seller_rating: number | null
          seller_tier: string | null
          shop_name: string | null
          total_sales: number | null
          username: string | null
        }
        Relationships: []
      }
      shop_analytics_summary: {
        Row: {
          active_days_last_30d: number | null
          seller_id: string | null
          total_page_views: number | null
          total_unique_visits: number | null
          unique_registered_visitors: number | null
          visits_last_24h: number | null
          visits_last_30d: number | null
          visits_last_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "admin_review_overview"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_dashboard_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "shop_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_shop_banners"
            referencedColumns: ["seller_id"]
          },
        ]
      }
      trustpilot_stats: {
        Row: {
          average_rating: number | null
          five_star_reviews: number | null
          pending_reviews: number | null
          positive_reviews: number | null
          reviews_submitted: number | null
          total_invitations: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adopt_me_confidence_for: { Args: { listings: number }; Returns: string }
      approve_listing: {
        Args: { admin_id: string; listing_id: string }
        Returns: undefined
      }
      assert_moderator: { Args: never; Returns: undefined }
      auth_p0_guards_version: { Args: never; Returns: number }
      auth_p1_guards_version: { Args: never; Returns: number }
      calculate_reapply_cooldown: {
        Args: { rejection_count_param: number }
        Returns: string
      }
      calculate_withdrawal_fee: {
        Args: { p_amount: number; p_method_id: string }
        Returns: {
          fee_amount: number
          fee_fixed: number
          fee_percentage: number
          net_amount: number
        }[]
      }
      can_edit_review: { Args: { review_id_param: string }; Returns: boolean }
      can_seller_reapply: { Args: { user_id_param: string }; Returns: Json }
      can_upload_custom_banner: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      category_requires_platform: {
        Args: { category_id_param: string }
        Returns: boolean
      }
      category_requires_region: {
        Args: { category_id_param: string }
        Returns: boolean
      }
      check_seller_needs_moderation: {
        Args: { seller_id: string }
        Returns: boolean
      }
      check_seller_tier_eligibility: {
        Args: { p_user_id: string }
        Returns: string
      }
      checkout_wallet_hold_minor: {
        Args: { p_order_id: string }
        Returns: number
      }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      db_p0_guards_version: { Args: never; Returns: number }
      db_p0_posture: { Args: never; Returns: Json }
      decrypt_delivery_data: {
        Args: { p_decryption_key: string; p_encrypted_data: string }
        Returns: string
      }
      encrypt_delivery_data: {
        Args: { p_data: string; p_encryption_key: string }
        Returns: string
      }
      generate_listing_slug: {
        Args: { listing_id: string; title_text: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code: { Args: { p_username: string }; Returns: string }
      generate_shop_slug: { Args: { name: string }; Returns: string }
      get_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role_enum"]
      }
      get_available_inventory_count: {
        Args: { p_listing_id: string }
        Returns: number
      }
      get_category_icon: { Args: { p_category_id: string }; Returns: Json }
      get_category_platforms: {
        Args: { category_id_param: string }
        Returns: Json
      }
      get_category_regions: {
        Args: { category_id_param: string }
        Returns: Json
      }
      get_game_categories: {
        Args: { game_id_param: string }
        Returns: {
          description: string
          display_order: number
          icon: string
          id: string
          metadata: Json
          name: string
          slug: string
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_orders_ready_for_auto_release: {
        Args: never
        Returns: {
          auto_release_at: string | null
          buyer_confirmed_at: string | null
          buyer_id: string
          cancelled_at: string | null
          chat_active_until: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivering_at: string | null
          delivery_details: Json | null
          delivery_evidence_required: boolean | null
          delivery_evidence_urls: string[] | null
          dispute_reason: string | null
          disputed_at: string | null
          escrow_status: string | null
          id: string
          instant_delivery_code: string | null
          instant_delivery_delivered_at: string | null
          instant_delivery_inventory_id: string | null
          is_guest_order: boolean | null
          listing_id: string
          order_number: string | null
          paid_at: string | null
          payment_expires_at: string | null
          payment_processing_fee: number
          payment_processing_fee_rate: number
          payment_provider: string | null
          platform_fee: number
          platform_fee_rate: number
          promo_code_id: string | null
          promo_discount: number
          protection_until: string | null
          provider_charge_id: string | null
          quantity: number
          release_method: string | null
          seller_id: string
          seller_marked_delivered_at: string | null
          seller_payout: number
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at: string
          vaultshield_level: string | null
          vaultshield_tier_fee: number
          vaultshield_tier_fee_rate: number
          version: number
          wallet_amount_used: number
          warranty_expires_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_price_guidance: {
        Args: { p_category_slug: string; p_game_id: string }
        Returns: Json
      }
      get_seller_publish_policy: { Args: { p_user_id: string }; Returns: Json }
      get_seller_tier_info: { Args: { p_user_id: string }; Returns: Json }
      get_user_banner: { Args: { user_id_param: string }; Returns: Json }
      guarded_write_allowed: { Args: never; Returns: boolean }
      has_permission: {
        Args: { required_permission: string }
        Returns: boolean
      }
      inventory_claim_for_order: { Args: { p_order_id: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin_safe: { Args: never; Returns: boolean }
      is_valid_order_transition: {
        Args: { new_status: string; old_status: string }
        Returns: boolean
      }
      ledger_balance: {
        Args: {
          p_currency: string
          p_kind: Database["public"]["Enums"]["ledger_account_kind"]
          p_owner_id: string
          p_owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Returns: number
      }
      ledger_integrity_check: { Args: never; Returns: Json }
      ledger_resolve_account: {
        Args: {
          p_currency: string
          p_kind: Database["public"]["Enums"]["ledger_account_kind"]
          p_owner_id: string
          p_owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Returns: string
      }
      ledger_test_cleanup: { Args: { p_prefix: string }; Returns: number }
      ledger_test_cleanup_by_order: {
        Args: { p_order_id: string }
        Returns: number
      }
      ledger_test_cleanup_by_withdrawal: {
        Args: { p_request_id: string }
        Returns: number
      }
      mark_inactive_sellers_offline: { Args: never; Returns: undefined }
      money_atomicity_version: { Args: never; Returns: number }
      money_fault_hook: { Args: { p_point: string }; Returns: undefined }
      order_cancel_return_wallet: {
        Args: { p_dedupe_key?: string; p_order_id: string }
        Returns: Json
      }
      order_refund_to_wallet: {
        Args: {
          p_amount_minor?: number
          p_dedupe_key?: string
          p_order_id: string
        }
        Returns: Json
      }
      post_journal: {
        Args: {
          p_entries: Json
          p_event_ref?: string
          p_idempotency_key: string
          p_order_id?: string
        }
        Returns: string
      }
      promo_usage_record: {
        Args: {
          p_discount_amount: number
          p_order_id: string
          p_promo_code_id: string
          p_user_id: string
        }
        Returns: Json
      }
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      rate_limits_cleanup: {
        Args: { p_retain_seconds?: number }
        Returns: number
      }
      rate_limits_version: { Args: never; Returns: number }
      reject_listing: {
        Args: { admin_id: string; listing_id: string; reason: string }
        Returns: undefined
      }
      reject_seller_application: {
        Args: {
          admin_id_param: string
          application_id_param: string
          rejection_category_param: string
          rejection_reason_param: string
        }
        Returns: Json
      }
      release_due_reserves: { Args: { p_limit?: number }; Returns: number }
      release_with_reserve: {
        Args: {
          p_dedupe_key?: string
          p_event: string
          p_hold_seconds: number
          p_order_id: string
          p_reserve_pct: number
        }
        Returns: Json
      }
      request_listing_changes: {
        Args: { admin_id: string; changes: string; listing_id: string }
        Returns: undefined
      }
      sab_capture_price_history: { Args: { p_date?: string }; Returns: number }
      sab_import_market_listings: {
        Args: { p_listings: Json; p_source_slug: string }
        Returns: {
          error_count: number
          import_run_id: string
          records_flagged: number
          records_inserted: number
          records_seen: number
          records_updated: number
          source_slug: string
        }[]
      }
      sab_normalize_market_text: {
        Args: { input_text: string }
        Returns: string
      }
      sab_parse_market_title: {
        Args: { input_text: string }
        Returns: {
          brainrot_id: string
          brainrot_name: string
          brainrot_slug: string
          matched_brainrot_alias: string
          matched_mutation_alias: string
          mutation_id: string
          mutation_name: string
          mutation_slug: string
          normalized_text: string
          parse_status: string
          parser_confidence: number
          rejection_category: string
          rejection_reason: string
        }[]
      }
      sab_public_price_catalog_rows: {
        Args: never
        Returns: {
          brainrot_id: string
          brainrot_name: string
          brainrot_slug: string
          confidence_label: string
          external_sample_size: number
          image_url: string
          is_public_estimate: boolean
          is_trade_ready: boolean
          market_high_usd: number
          market_low_usd: number
          market_value_usd: number
          mutation_id: string
          mutation_name: string
          mutation_slug: string
          price_updated_at: string
          rarity: string
          source_count: number
        }[]
      }
      sab_publish_market_estimates: { Args: never; Returns: number }
      sab_recompute_tradeable: { Args: never; Returns: number }
      sab_refresh_evidence_display: { Args: never; Returns: number }
      sab_refresh_price_display: { Args: never; Returns: number }
      sab_refresh_price_snapshots: {
        Args: { p_calculated_at?: string }
        Returns: number
      }
      sab_reparse_market_listings: {
        Args: { p_limit?: number }
        Returns: {
          ambiguous_count: number
          matched_count: number
          processed_count: number
          rejected_count: number
          unmatched_count: number
        }[]
      }
      sab_sync_dropmarket_market_observations: {
        Args: { p_observed_at?: string }
        Returns: Json
      }
      safedrop_target_status: { Args: { p_event: string }; Returns: string }
      safedrop_transition: {
        Args: {
          p_dedupe_key?: string
          p_event: string
          p_order_id: string
          p_refund_minor?: number
          p_release_method?: string
        }
        Returns: Json
      }
      seller_available_balance: {
        Args: { p_currency: string; p_seller_id: string }
        Returns: number
      }
      seller_is_in_payout_hold: {
        Args: { p_seller_id: string }
        Returns: boolean
      }
      upgrade_all_seller_tiers: { Args: never; Returns: number }
      user_wallet_balance: {
        Args: { p_currency: string; p_user_id: string }
        Returns: number
      }
      wallet_credit: {
        Args: {
          p_amount_minor: number
          p_counterparty: Database["public"]["Enums"]["ledger_account_kind"]
          p_currency: string
          p_event_ref?: string
          p_idempotency_key: string
          p_order_id?: string
          p_user_id: string
        }
        Returns: string
      }
      wallet_spend: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_event_ref?: string
          p_idempotency_key: string
          p_order_id?: string
          p_target: Database["public"]["Enums"]["ledger_account_kind"]
          p_user_id: string
        }
        Returns: string
      }
      webhook_event_claim: {
        Args: {
          p_payload_hash?: string
          p_provider: string
          p_provider_event_id: string
        }
        Returns: boolean
      }
      webhook_event_mark: {
        Args: {
          p_provider: string
          p_provider_event_id: string
          p_result?: Json
          p_status: Database["public"]["Enums"]["webhook_event_status"]
        }
        Returns: undefined
      }
      withdraw_seller_application: {
        Args: { application_id_param: string; user_id_param: string }
        Returns: Json
      }
      withdrawal_cancel: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: Json
      }
      withdrawal_debit: {
        Args: {
          p_amount_minor: number
          p_event_ref?: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: string
      }
      withdrawal_payout: { Args: { p_request_id: string }; Returns: string }
      withdrawal_reject: {
        Args: { p_admin_id: string; p_reason: string; p_request_id: string }
        Returns: Json
      }
      withdrawal_reversal: { Args: { p_request_id: string }; Returns: string }
    }
    Enums: {
      admin_role_enum: "super_admin" | "admin" | "moderator" | "support"
      dispute_reason_enum:
        | "item_not_received"
        | "not_as_described"
        | "wrong_item"
        | "partial_delivery"
        | "quality_issue"
        | "account_issue"
        | "unauthorized_transaction"
        | "seller_unresponsive"
        | "other"
      dispute_status_enum:
        | "open"
        | "under_review"
        | "awaiting_seller_response"
        | "awaiting_buyer_response"
        | "escalated"
        | "resolved_buyer_favor"
        | "resolved_seller_favor"
        | "resolved_partial"
        | "closed"
      ledger_account_kind:
        | "buyer_clearing"
        | "escrow_held"
        | "seller_available"
        | "seller_reserve"
        | "platform_commission"
        | "provider_float"
        | "payout_clearing"
        | "refunds"
        | "fx_gain_loss"
        | "rounding"
        | "user_wallet"
        | "genesis_clearing"
        | "external_payout"
      ledger_direction: "debit" | "credit"
      ledger_owner_type:
        | "platform"
        | "seller"
        | "buyer"
        | "provider"
        | "external"
      reserve_hold_status: "held" | "released"
      wallet_transaction_type:
        | "top_up"
        | "purchase"
        | "refund"
        | "cashback"
        | "referral_bonus"
        | "admin_adjustment"
        | "withdrawal"
      webhook_event_status: "received" | "processed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role_enum: ["super_admin", "admin", "moderator", "support"],
      dispute_reason_enum: [
        "item_not_received",
        "not_as_described",
        "wrong_item",
        "partial_delivery",
        "quality_issue",
        "account_issue",
        "unauthorized_transaction",
        "seller_unresponsive",
        "other",
      ],
      dispute_status_enum: [
        "open",
        "under_review",
        "awaiting_seller_response",
        "awaiting_buyer_response",
        "escalated",
        "resolved_buyer_favor",
        "resolved_seller_favor",
        "resolved_partial",
        "closed",
      ],
      ledger_account_kind: [
        "buyer_clearing",
        "escrow_held",
        "seller_available",
        "seller_reserve",
        "platform_commission",
        "provider_float",
        "payout_clearing",
        "refunds",
        "fx_gain_loss",
        "rounding",
        "user_wallet",
        "genesis_clearing",
        "external_payout",
      ],
      ledger_direction: ["debit", "credit"],
      ledger_owner_type: [
        "platform",
        "seller",
        "buyer",
        "provider",
        "external",
      ],
      reserve_hold_status: ["held", "released"],
      wallet_transaction_type: [
        "top_up",
        "purchase",
        "refund",
        "cashback",
        "referral_bonus",
        "admin_adjustment",
        "withdrawal",
      ],
      webhook_event_status: ["received", "processed", "failed"],
    },
  },
} as const


// ─── Helper aliases (hand-maintained, preserved across regeneration) ────────
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
