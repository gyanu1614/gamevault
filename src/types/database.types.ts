export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
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
      games: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          emoji: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
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
          category_id: string
          created_at: string
          currency: string
          delivery_method: string | null
          delivery_method_type: string | null
          delivery_time: string | null
          description: string
          game_id: string
          id: string
          images: string[] | null
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
          title: string
          updated_at: string
          view_count: number
          views: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          created_at?: string
          currency?: string
          delivery_method?: string | null
          delivery_method_type?: string | null
          delivery_time?: string | null
          description: string
          game_id: string
          id?: string
          images?: string[] | null
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
          title: string
          updated_at?: string
          view_count?: number
          views?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          created_at?: string
          currency?: string
          delivery_method?: string | null
          delivery_method_type?: string | null
          delivery_time?: string | null
          description?: string
          game_id?: string
          id?: string
          images?: string[] | null
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
          completed_at: string | null
          created_at: string
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
          payment_processing_fee: number
          payment_processing_fee_rate: number
          platform_fee: number
          platform_fee_rate: number
          promo_code_id: string | null
          promo_discount: number
          protection_until: string | null
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
          completed_at?: string | null
          created_at?: string
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
          payment_processing_fee: number
          payment_processing_fee_rate: number
          platform_fee: number
          platform_fee_rate: number
          promo_code_id?: string | null
          promo_discount?: number
          protection_until?: string | null
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
          completed_at?: string | null
          created_at?: string
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
          payment_processing_fee?: number
          payment_processing_fee_rate?: number
          platform_fee?: number
          platform_fee_rate?: number
          promo_code_id?: string | null
          promo_discount?: number
          protection_until?: string | null
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
          full_name: string | null
          id: string
          inform_status: string | null
          is_guest: boolean | null
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
          full_name?: string | null
          id: string
          inform_status?: string | null
          is_guest?: boolean | null
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
          full_name?: string | null
          id?: string
          inform_status?: string | null
          is_guest?: boolean | null
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
          country: string
          created_at: string
          crypto_wallet_address: string | null
          crypto_type: string | null
          delivery_timeframe: string | null
          device_fingerprint: string | null
          discord_username: string | null
          display_name: string
          expected_monthly_volume: string | null
          fraud_score: number | null
          full_legal_name: string
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
          phone_number: string
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
          country: string
          created_at?: string
          crypto_wallet_address?: string | null
          crypto_type?: string | null
          delivery_timeframe?: string | null
          device_fingerprint?: string | null
          discord_username?: string | null
          display_name: string
          expected_monthly_volume?: string | null
          fraud_score?: number | null
          full_legal_name: string
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
          phone_number: string
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
          country?: string
          created_at?: string
          crypto_wallet_address?: string | null
          crypto_type?: string | null
          delivery_timeframe?: string | null
          device_fingerprint?: string | null
          discord_username?: string | null
          display_name?: string
          expected_monthly_volume?: string | null
          fraud_score?: number | null
          full_legal_name?: string
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
          phone_number?: string
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
          updated_at: string
        }
        Insert: {
          is_online?: boolean
          last_active_at?: string
          last_seen_at?: string
          seller_id: string
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          is_online?: boolean
          last_active_at?: string
          last_seen_at?: string
          seller_id?: string
          status_message?: string | null
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
          badge_color: string
          banner_access: boolean
          commission_rate: number
          created_at: string | null
          description: string | null
          display_name: string
          listing_limit: number | null
          min_age_days: number
          min_completion_rate: number | null
          min_rating: number | null
          min_sales: number
          sort_order: number
          tier: string
        }
        Insert: {
          badge_color?: string
          banner_access?: boolean
          commission_rate: number
          created_at?: string | null
          description?: string | null
          display_name: string
          listing_limit?: number | null
          min_age_days?: number
          min_completion_rate?: number | null
          min_rating?: number | null
          min_sales?: number
          sort_order?: number
          tier: string
        }
        Update: {
          badge_color?: string
          banner_access?: boolean
          commission_rate?: number
          created_at?: string | null
          description?: string | null
          display_name?: string
          listing_limit?: number | null
          min_age_days?: number
          min_completion_rate?: number | null
          min_rating?: number | null
          min_sales?: number
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
          sent_at: string
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
          sent_at?: string
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
          sent_at?: string
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
          crypto_wallet_address: string | null
          crypto_type: string | null
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
          id: string | null
          identity_verified: boolean | null
          information_accurate_confirmed: boolean | null
          ip_address: unknown
          is_18_or_older: boolean | null
          languages_spoken: string[] | null
          payout_method: string | null
          paypal_email: string | null
          phone_number: string | null
          phone_verified: boolean | null
          primary_games: string[] | null
          profile_bio: string | null
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
          seller_status: string | null
          seller_type: string | null
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
      approve_listing: {
        Args: { admin_id: string; listing_id: string }
        Returns: undefined
      }
      calculate_reapply_cooldown: {
        Args: { rejection_count_param: number }
        Returns: string
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
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_old_audit_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      decrypt_delivery_data: {
        Args: { p_decryption_key: string; p_encrypted_data: string }
        Returns: string
      }
      encrypt_delivery_data: {
        Args: { p_data: string; p_encryption_key: string }
        Returns: string
      }
      freeze_escrow: { Args: { order_id: string }; Returns: undefined }
      generate_listing_slug: {
        Args: { listing_id: string; title_text: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
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
      get_listings_pending_moderation: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: string | null
          category_id: string
          created_at: string
          currency: string
          delivery_method: string | null
          delivery_method_type: string | null
          delivery_time: string | null
          description: string
          game_id: string
          id: string
          images: string[] | null
          min_quantity: number | null
          moderation_notes: string | null
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
          title: string
          updated_at: string
          view_count: number
          views: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: false
          isSetofReturn: true
        }
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
          completed_at: string | null
          created_at: string
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
          payment_processing_fee: number
          payment_processing_fee_rate: number
          platform_fee: number
          platform_fee_rate: number
          promo_code_id: string | null
          promo_discount: number
          protection_until: string | null
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
      get_pending_trustpilot_invitations: {
        Args: never
        Returns: {
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
          sent_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trustpilot_invitations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_seller_tier_info: { Args: { p_user_id: string }; Returns: Json }
      get_user_banner: { Args: { user_id_param: string }; Returns: Json }
      get_user_role: { Args: { user_id?: string }; Returns: string }
      has_permission: {
        Args: { required_permission: string }
        Returns: boolean
      }
      has_role: {
        Args: { required_role: string; user_id?: string }
        Returns: boolean
      }
      increment_listing_views: {
        Args: { listing_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin_safe: { Args: never; Returns: boolean }
      is_valid_order_transition: {
        Args: { new_status: string; old_status: string }
        Returns: boolean
      }
      mark_inactive_sellers_offline: { Args: never; Returns: undefined }
      mark_trustpilot_invitation_sent: {
        Args: { invitation_id: string }
        Returns: undefined
      }
      refund_escrow: { Args: { order_id: string }; Returns: undefined }
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
      release_escrow: {
        Args: { method?: string; order_id: string }
        Returns: undefined
      }
      release_escrow_to_seller_balance: {
        Args: { p_amount: number; p_order_id: string; p_seller_id: string }
        Returns: undefined
      }
      seller_is_in_payout_hold: {
        Args: { p_seller_id: string }
        Returns: boolean
      }
      upgrade_all_seller_tiers: { Args: never; Returns: number }
      withdraw_seller_application: {
        Args: { application_id_param: string; user_id_param: string }
        Returns: Json
      }
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
      wallet_transaction_type:
        | "top_up"
        | "purchase"
        | "refund"
        | "cashback"
        | "referral_bonus"
        | "admin_adjustment"
        | "withdrawal"
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
      wallet_transaction_type: [
        "top_up",
        "purchase",
        "refund",
        "cashback",
        "referral_bonus",
        "admin_adjustment",
        "withdrawal",
      ],
    },
  },
} as const
