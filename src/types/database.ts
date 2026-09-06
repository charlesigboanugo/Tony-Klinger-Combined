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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_user_id: string | null
          content: string | null
          cover_resource_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          content?: string | null
          cover_resource_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string | null
          cover_resource_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          bookable_id: string
          bookable_type: Database["public"]["Enums"]["bookable_type"]
          cancelled_at: string | null
          created_at: string
          ends_at: string | null
          entitlement_id: string | null
          id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bookable_id: string
          bookable_type: Database["public"]["Enums"]["bookable_type"]
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          entitlement_id?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bookable_id?: string
          bookable_type?: Database["public"]["Enums"]["bookable_type"]
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          entitlement_id?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_item_resources: {
        Row: {
          catalogue_item_id: string
          position: number
          resource_id: string
        }
        Insert: {
          catalogue_item_id: string
          position?: number
          resource_id: string
        }
        Update: {
          catalogue_item_id?: string
          position?: number
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_item_resources_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_item_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_items: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["catalogue_category"]
          cover_resource_id: string | null
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          is_external: boolean
          position: number
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category: Database["public"]["Enums"]["catalogue_category"]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_external?: boolean
          position?: number
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: Database["public"]["Enums"]["catalogue_category"]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_external?: boolean
          position?: number
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_items_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_workshops: {
        Row: {
          cohort_id: string
          created_at: string
          ends_at: string
          id: string
          meeting_url: string | null
          position: number
          recording_resource_id: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          ends_at: string
          id?: string
          meeting_url?: string | null
          position?: number
          recording_resource_id?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          meeting_url?: string | null
          position?: number
          recording_resource_id?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_workshops_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_workshops_recording_resource_id_fkey"
            columns: ["recording_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          benefits: string[]
          capacity: number | null
          cohort_level: Database["public"]["Enums"]["cohort_level"]
          cover_resource_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          product_id: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          benefits?: string[]
          capacity?: number | null
          cohort_level: Database["public"]["Enums"]["cohort_level"]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          product_id?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          benefits?: string[]
          capacity?: number | null
          cohort_level?: Database["public"]["Enums"]["cohort_level"]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          product_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string
          name: string
          status: string
          subject: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          status?: string
          subject?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          status?: string
          subject?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_resource_id: string | null
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_name: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_name?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template?: string
          to_email?: string
          to_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          grant_reason: string | null
          granted_by: string | null
          id: string
          quantity: number | null
          quantity_used: number
          resource_id: string | null
          resource_type: Database["public"]["Enums"]["entitlement_resource"]
          source_id: string | null
          source_type: Database["public"]["Enums"]["entitlement_source"]
          starts_at: string
          status: Database["public"]["Enums"]["entitlement_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          quantity?: number | null
          quantity_used?: number
          resource_id?: string | null
          resource_type: Database["public"]["Enums"]["entitlement_resource"]
          source_id?: string | null
          source_type: Database["public"]["Enums"]["entitlement_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["entitlement_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          quantity?: number | null
          quantity_used?: number
          resource_id?: string | null
          resource_type?: Database["public"]["Enums"]["entitlement_resource"]
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["entitlement_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["entitlement_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_free: boolean
          location: string | null
          name: string
          product_id: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean
          location?: string | null
          name: string
          product_id?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean
          location?: string | null
          name?: string
          product_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      group_coaching_series: {
        Row: {
          cover_resource_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          product_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          syllabus: string[]
          updated_at: string
        }
        Insert: {
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          product_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          syllabus?: string[]
          updated_at?: string
        }
        Update: {
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          product_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          syllabus?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_coaching_series_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_coaching_series_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      group_coaching_sessions: {
        Row: {
          capacity: number
          coach_id: string | null
          created_at: string
          ends_at: string
          id: string
          meeting_url: string | null
          recording_resource_id: string | null
          series_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          coach_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          meeting_url?: string | null
          recording_resource_id?: string | null
          series_id: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          coach_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          meeting_url?: string | null
          recording_resource_id?: string | null
          series_id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_coaching_sessions_recording_resource_id_fkey"
            columns: ["recording_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_coaching_sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "group_coaching_series"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          created_at: string
          id: string
          module_id: string
          position: number
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          video_duration_seconds: number | null
          video_hash: string | null
          video_id: string | null
          video_provider: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          module_id: string
          position?: number
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_hash?: string | null
          video_id?: string | null
          video_provider?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          module_id?: string
          position?: number
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_hash?: string | null
          video_id?: string | null
          video_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_consents: {
        Row: {
          consent_text: string | null
          consent_url: string | null
          created_at: string
          email: string
          granted_at: string
          id: string
          notes: string | null
          source: Database["public"]["Enums"]["consent_source"]
          updated_at: string
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          consent_text?: string | null
          consent_url?: string | null
          created_at?: string
          email: string
          granted_at?: string
          id?: string
          notes?: string | null
          source: Database["public"]["Enums"]["consent_source"]
          updated_at?: string
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          consent_text?: string | null
          consent_url?: string | null
          created_at?: string
          email?: string
          granted_at?: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["consent_source"]
          updated_at?: string
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      masterclasses: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          meeting_url: string | null
          product_id: string | null
          recording_resource_id: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          meeting_url?: string | null
          product_id?: string | null
          recording_resource_id?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          meeting_url?: string | null
          product_id?: string | null
          recording_resource_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "masterclasses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "masterclasses_recording_resource_id_fkey"
            columns: ["recording_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          active: boolean
          benefits: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          product_id: string | null
          rank: number
          slug: string
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          product_id?: string | null
          rank: number
          slug: string
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          product_id?: string | null
          rank?: number
          slug?: string
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_claim_tokens: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          expires_at: string
          id: string
          order_id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_claim_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          order_id: string
          price_id: string | null
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          total_amount: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          price_id?: string | null
          product_id?: string | null
          product_name_snapshot: string
          quantity?: number
          total_amount: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          price_id?: string | null
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          total_amount?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          discount_total: number
          external_reference: string | null
          guest_email: string | null
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_total?: number
          external_reference?: string | null
          guest_email?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          discount_total?: number
          external_reference?: string | null
          guest_email?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          paid_at: string | null
          provider: string
          provider_payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          provider?: string
          provider_payment_id: string
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          active: boolean
          amount: number
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at: string
          currency: string
          id: string
          interval: Database["public"]["Enums"]["billing_interval"] | null
          product_id: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"] | null
          product_id: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          billing_type?: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"] | null
          product_id?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      private_coaching_services: {
        Row: {
          benefits: string[]
          cover_resource_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          product_id: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          benefits?: string[]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          product_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          benefits?: string[]
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          product_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_coaching_services_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_coaching_services_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          event_id: string
          id: string
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          id?: string
          processed_at?: string
          provider: string
        }
        Update: {
          event_id?: string
          id?: string
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
          status: string
          updated_at: string
          user_id: string
          welcomed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
          welcomed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          welcomed_at?: string | null
        }
        Relationships: []
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
      resources: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          resource_type: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          resource_type: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          resource_type?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      retreat_applications: {
        Row: {
          answers: Json
          created_at: string
          id: string
          retreat_id: string
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          retreat_id: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          retreat_id?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retreat_applications_retreat_id_fkey"
            columns: ["retreat_id"]
            isOneToOne: false
            referencedRelation: "retreats"
            referencedColumns: ["id"]
          },
        ]
      }
      retreats: {
        Row: {
          capacity: number | null
          cover_resource_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          product_id: string | null
          requires_application: boolean
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          product_id?: string | null
          requires_application?: boolean
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          cover_resource_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          product_id?: string | null
          requires_application?: boolean
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retreats_cover_resource_id_fkey"
            columns: ["cover_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retreats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_ends_at: string | null
          id: string
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          price_id: string | null
          product_id: string | null
          provider: string
          provider_subscription_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          price_id?: string | null
          product_id?: string | null
          provider?: string
          provider_subscription_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          price_id?: string | null
          product_id?: string | null
          provider?: string
          provider_subscription_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          name: string
          photo_resource_id: string | null
          position: number
          role: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          photo_resource_id?: string | null
          position?: number
          role?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_resource_id?: string | null
          position?: number
          role?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_photo_resource_id_fkey"
            columns: ["photo_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          attributed_to: string | null
          attribution_detail: string | null
          context: string | null
          created_at: string
          featured: boolean
          id: string
          position: number
          quote: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          attributed_to?: string | null
          attribution_detail?: string | null
          context?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          position?: number
          quote: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          attributed_to?: string | null
          attribution_detail?: string | null
          context?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          position?: number
          quote?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_member_emails: {
        Row: {
          email: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_entitlement: {
        Args: {
          p_entitlement_id: string
          p_expires_at?: string
          p_quantity?: number
          p_reason: string
        }
        Returns: Json
      }
      admin_grant_entitlement: {
        Args: {
          p_expires_at?: string
          p_quantity?: number
          p_reason: string
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["entitlement_resource"]
          p_user_id: string
        }
        Returns: Json
      }
      admin_record_mfa_reset: {
        Args: { p_reason: string; p_user_id: string }
        Returns: Json
      }
      admin_record_user_invite: {
        Args: { p_email: string; p_reason: string; p_user_id: string }
        Returns: Json
      }
      admin_revoke_entitlement: {
        Args: { p_entitlement_id: string; p_reason: string }
        Returns: Json
      }
      admin_set_role: {
        Args: {
          p_grant: boolean
          p_reason: string
          p_role_name: string
          p_user_id: string
        }
        Returns: Json
      }
      assert_admin_action: {
        Args: { p_permission: string }
        Returns: undefined
      }
      book_group_session: { Args: { p_session_id: string }; Returns: Json }
      cancel_booking: {
        Args: { p_booking_id: string; p_window_hours?: number }
        Returns: Json
      }
      claim_email_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_name: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_order: { Args: { p_token_hash: string }; Returns: Json }
      claim_welcome: { Args: never; Returns: boolean }
      cleanup_expired_tokens: { Args: never; Returns: Json }
      cleanup_rate_limits: { Args: never; Returns: number }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      current_aal: { Args: never; Returns: string }
      enqueue_email: {
        Args: {
          p_idempotency_key: string
          p_payload?: Json
          p_template: string
          p_to_email: string
          p_to_name?: string
        }
        Returns: string
      }
      expire_lapsed_entitlements: { Args: never; Returns: Json }
      fulfil_order: {
        Args: {
          p_amount?: number
          p_order_id: string
          p_provider_payment_id?: string
        }
        Returns: Json
      }
      grant_entitlements_for_order: {
        Args: { p_order_id: string }
        Returns: number
      }
      has_aal2: { Args: never; Returns: boolean }
      has_active_entitlement: {
        Args: {
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["entitlement_resource"]
        }
        Returns: boolean
      }
      has_permission: { Args: { permission_name: string }; Returns: boolean }
      has_role: { Args: { role_name: string }; Returns: boolean }
      has_session_credits: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mark_email_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      mark_email_sent: {
        Args: { p_id: string; p_provider_id: string }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: string[] }
      my_roles: { Args: never; Returns: string[] }
      orders_awaiting_reconciliation: {
        Args: { p_older_than?: string }
        Returns: {
          created_at: string
          currency: string
          discount_total: number
          external_reference: string | null
          guest_email: string | null
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_marketing_consent: {
        Args: {
          p_consent_text?: string
          p_consent_url?: string
          p_email: string
          p_source: Database["public"]["Enums"]["consent_source"]
          p_user_id?: string
        }
        Returns: string
      }
      requires_mfa: { Args: never; Returns: boolean }
      verified_factor_count: { Args: never; Returns: number }
      withdraw_marketing_consent: { Args: { p_email: string }; Returns: number }
    }
    Enums: {
      billing_interval: "month" | "year"
      billing_type: "one_time" | "recurring"
      bookable_type:
        | "group_coaching_session"
        | "cohort_workshop"
        | "private_coaching"
        | "retreat"
        | "event"
        | "masterclass"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      catalogue_category:
        | "books"
        | "films"
        | "audio"
        | "interviews"
        | "stories-from-the-front-line"
        | "podcasts"
        | "watch"
      cohort_level: "silver" | "gold" | "platinum"
      consent_source:
        | "newsletter_form"
        | "checkout"
        | "account_settings"
        | "import"
      content_status: "draft" | "published" | "archived"
      email_status: "pending" | "sent" | "failed" | "cancelled"
      entitlement_resource:
        | "course"
        | "group_coaching_series"
        | "group_coaching_session"
        | "cohort"
        | "retreat"
        | "event"
        | "masterclass"
        | "resource"
        | "release"
        | "partner_discount"
      entitlement_source:
        | "purchase"
        | "membership"
        | "bundle"
        | "promotion"
        | "admin_grant"
        | "other"
      entitlement_status: "active" | "expired" | "consumed" | "revoked"
      membership_tier: "silver" | "gold" | "platinum" | "ultimate"
      order_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
      product_status: "draft" | "active" | "paused" | "archived"
      product_type:
        | "membership"
        | "course"
        | "group_coaching"
        | "cohort"
        | "private_coaching"
        | "retreat"
        | "event"
        | "masterclass"
        | "bundle"
        | "other"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
        | "incomplete"
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
      billing_interval: ["month", "year"],
      billing_type: ["one_time", "recurring"],
      bookable_type: [
        "group_coaching_session",
        "cohort_workshop",
        "private_coaching",
        "retreat",
        "event",
        "masterclass",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      catalogue_category: [
        "books",
        "films",
        "audio",
        "interviews",
        "stories-from-the-front-line",
        "podcasts",
        "watch",
      ],
      cohort_level: ["silver", "gold", "platinum"],
      consent_source: [
        "newsletter_form",
        "checkout",
        "account_settings",
        "import",
      ],
      content_status: ["draft", "published", "archived"],
      email_status: ["pending", "sent", "failed", "cancelled"],
      entitlement_resource: [
        "course",
        "group_coaching_series",
        "group_coaching_session",
        "cohort",
        "retreat",
        "event",
        "masterclass",
        "resource",
        "release",
        "partner_discount",
      ],
      entitlement_source: [
        "purchase",
        "membership",
        "bundle",
        "promotion",
        "admin_grant",
        "other",
      ],
      entitlement_status: ["active", "expired", "consumed", "revoked"],
      membership_tier: ["silver", "gold", "platinum", "ultimate"],
      order_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded",
      ],
      product_status: ["draft", "active", "paused", "archived"],
      product_type: [
        "membership",
        "course",
        "group_coaching",
        "cohort",
        "private_coaching",
        "retreat",
        "event",
        "masterclass",
        "bundle",
        "other",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
        "incomplete",
      ],
    },
  },
} as const

