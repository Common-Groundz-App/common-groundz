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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      cached_photos: {
        Row: {
          cache_quality_score: number | null
          cached_url: string
          content_type: string | null
          created_at: string | null
          entity_id: string
          expires_at: string | null
          file_size: number | null
          height: number | null
          id: string
          is_primary: boolean | null
          original_reference: string | null
          original_url: string | null
          source: string
          thumbnail_url: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          cache_quality_score?: number | null
          cached_url: string
          content_type?: string | null
          created_at?: string | null
          entity_id: string
          expires_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          is_primary?: boolean | null
          original_reference?: string | null
          original_url?: string | null
          source: string
          thumbnail_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          cache_quality_score?: number | null
          cached_url?: string
          content_type?: string | null
          created_at?: string | null
          entity_id?: string
          expires_at?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          is_primary?: boolean | null
          original_reference?: string | null
          original_url?: string | null
          source?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cached_photos_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_products: {
        Row: {
          api_ref: string | null
          api_source: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          metadata: Json
          name: string
          query_id: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          api_ref?: string | null
          api_source: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          name: string
          query_id: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          api_ref?: string | null
          api_source?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          name?: string
          query_id?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cached_products_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "cached_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_queries: {
        Row: {
          created_at: string
          id: string
          last_fetched: string
          query: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_fetched?: string
          query: string
        }
        Update: {
          created_at?: string
          id?: string
          last_fetched?: string
          query?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_entities: {
        Row: {
          collection_id: string
          created_at: string | null
          entity_id: string
          id: string
          position: number | null
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          entity_id: string
          id?: string
          position?: number | null
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          entity_id?: string
          id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_entities_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "entity_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_entities_log: {
        Row: {
          api_ref: string | null
          api_source: string | null
          id: string | null
          name: string | null
          photo_reference: string | null
          post_entity_count: number | null
          recommendation_count: number | null
          review_count: number | null
          type: Database["public"]["Enums"]["entity_type"] | null
        }
        Insert: {
          api_ref?: string | null
          api_source?: string | null
          id?: string | null
          name?: string | null
          photo_reference?: string | null
          post_entity_count?: number | null
          recommendation_count?: number | null
          review_count?: number | null
          type?: Database["public"]["Enums"]["entity_type"] | null
        }
        Update: {
          api_ref?: string | null
          api_source?: string | null
          id?: string | null
          name?: string | null
          photo_reference?: string | null
          post_entity_count?: number | null
          recommendation_count?: number | null
          review_count?: number | null
          type?: Database["public"]["Enums"]["entity_type"] | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          ai_dynamic_review_summary: string | null
          ai_dynamic_review_summary_last_generated_at: string | null
          ai_dynamic_review_summary_model_used: string | null
          api_ref: string | null
          api_source: string | null
          authors: string[] | null
          cast_crew: Json | null
          category_id: string | null
          created_at: string
          created_by: string | null
          data_quality_score: number | null
          description: string | null
          enrichment_source: string | null
          external_ratings: Json | null
          geographic_boost: number | null
          id: string
          image_url: string | null
          ingredients: string[] | null
          is_claimed: boolean
          is_deleted: boolean
          is_verified: boolean | null
          isbn: string | null
          languages: string[] | null
          last_enriched_at: string | null
          last_trending_update: string | null
          metadata: Json | null
          name: string
          nutritional_info: Json | null
          open_graph_data: Json | null
          parent_id: string | null
          photo_reference: string | null
          popularity_score: number | null
          price_info: Json | null
          publication_year: number | null
          recent_likes_24h: number | null
          recent_recommendations_24h: number | null
          recent_views_24h: number | null
          seasonal_boost: number | null
          slug: string | null
          specifications: Json | null
          trending_score: number | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
          venue: string | null
          verification_date: string | null
          view_velocity: number | null
          website_url: string | null
        }
        Insert: {
          ai_dynamic_review_summary?: string | null
          ai_dynamic_review_summary_last_generated_at?: string | null
          ai_dynamic_review_summary_model_used?: string | null
          api_ref?: string | null
          api_source?: string | null
          authors?: string[] | null
          cast_crew?: Json | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          data_quality_score?: number | null
          description?: string | null
          enrichment_source?: string | null
          external_ratings?: Json | null
          geographic_boost?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string[] | null
          is_claimed?: boolean
          is_deleted?: boolean
          is_verified?: boolean | null
          isbn?: string | null
          languages?: string[] | null
          last_enriched_at?: string | null
          last_trending_update?: string | null
          metadata?: Json | null
          name: string
          nutritional_info?: Json | null
          open_graph_data?: Json | null
          parent_id?: string | null
          photo_reference?: string | null
          popularity_score?: number | null
          price_info?: Json | null
          publication_year?: number | null
          recent_likes_24h?: number | null
          recent_recommendations_24h?: number | null
          recent_views_24h?: number | null
          seasonal_boost?: number | null
          slug?: string | null
          specifications?: Json | null
          trending_score?: number | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          venue?: string | null
          verification_date?: string | null
          view_velocity?: number | null
          website_url?: string | null
        }
        Update: {
          ai_dynamic_review_summary?: string | null
          ai_dynamic_review_summary_last_generated_at?: string | null
          ai_dynamic_review_summary_model_used?: string | null
          api_ref?: string | null
          api_source?: string | null
          authors?: string[] | null
          cast_crew?: Json | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          data_quality_score?: number | null
          description?: string | null
          enrichment_source?: string | null
          external_ratings?: Json | null
          geographic_boost?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string[] | null
          is_claimed?: boolean
          is_deleted?: boolean
          is_verified?: boolean | null
          isbn?: string | null
          languages?: string[] | null
          last_enriched_at?: string | null
          last_trending_update?: string | null
          metadata?: Json | null
          name?: string
          nutritional_info?: Json | null
          open_graph_data?: Json | null
          parent_id?: string | null
          photo_reference?: string | null
          popularity_score?: number | null
          price_info?: Json | null
          publication_year?: number | null
          recent_likes_24h?: number | null
          recent_recommendations_24h?: number | null
          recent_views_24h?: number | null
          seasonal_boost?: number | null
          slug?: string | null
          specifications?: Json | null
          trending_score?: number | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          venue?: string | null
          verification_date?: string | null
          view_velocity?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities_backup: {
        Row: {
          api_ref: string | null
          api_source: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_deleted: boolean | null
          is_verified: boolean | null
          metadata: Json | null
          name: string | null
          open_graph_data: Json | null
          popularity_score: number | null
          slug: string | null
          type: Database["public"]["Enums"]["entity_type"] | null
          updated_at: string | null
          venue: string | null
          verification_date: string | null
          website_url: string | null
        }
        Insert: {
          api_ref?: string | null
          api_source?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          metadata?: Json | null
          name?: string | null
          open_graph_data?: Json | null
          popularity_score?: number | null
          slug?: string | null
          type?: Database["public"]["Enums"]["entity_type"] | null
          updated_at?: string | null
          venue?: string | null
          verification_date?: string | null
          website_url?: string | null
        }
        Update: {
          api_ref?: string | null
          api_source?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          metadata?: Json | null
          name?: string | null
          open_graph_data?: Json | null
          popularity_score?: number | null
          slug?: string | null
          type?: Database["public"]["Enums"]["entity_type"] | null
          updated_at?: string | null
          venue?: string | null
          verification_date?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      entity_collections: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          priority: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          priority?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          priority?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      entity_enrichment_queue: {
        Row: {
          created_at: string | null
          entity_id: string | null
          error_message: string | null
          id: string
          priority: number | null
          processed_at: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_enrichment_queue_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_follows: {
        Row: {
          created_at: string | null
          entity_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_follows_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_photos: {
        Row: {
          alt_text: string | null
          caption: string | null
          category: string
          content_type: string | null
          created_at: string
          entity_id: string
          file_size: number | null
          height: number | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          status: string
          updated_at: string
          url: string
          user_id: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          category?: string
          content_type?: string | null
          created_at?: string
          entity_id: string
          file_size?: number | null
          height?: number | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          status?: string
          updated_at?: string
          url: string
          user_id: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          category?: string
          content_type?: string | null
          created_at?: string
          entity_id?: string
          file_size?: number | null
          height?: number | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_photos_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_products: {
        Row: {
          buy_link: string | null
          created_at: string | null
          description: string | null
          entity_id: string
          id: string
          image_url: string | null
          name: string
          price: string | null
          updated_at: string | null
        }
        Insert: {
          buy_link?: string | null
          created_at?: string | null
          description?: string | null
          entity_id: string
          id?: string
          image_url?: string | null
          name: string
          price?: string | null
          updated_at?: string | null
        }
        Update: {
          buy_link?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_products_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_saves: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_saves_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_suggestions: {
        Row: {
          admin_notes: string | null
          applied_at: string | null
          context: string | null
          created_at: string
          duplicate_of_entity_id: string | null
          entity_id: string
          id: string
          is_business_closed: boolean | null
          is_duplicate: boolean | null
          priority_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          suggested_changes: Json
          suggested_images: Json | null
          updated_at: string
          user_id: string
          user_is_owner: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          applied_at?: string | null
          context?: string | null
          created_at?: string
          duplicate_of_entity_id?: string | null
          entity_id: string
          id?: string
          is_business_closed?: boolean | null
          is_duplicate?: boolean | null
          priority_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_changes?: Json
          suggested_images?: Json | null
          updated_at?: string
          user_id: string
          user_is_owner?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          applied_at?: string | null
          context?: string | null
          created_at?: string
          duplicate_of_entity_id?: string | null
          entity_id?: string
          id?: string
          is_business_closed?: boolean | null
          is_duplicate?: boolean | null
          priority_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_changes?: Json
          suggested_images?: Json | null
          updated_at?: string
          user_id?: string
          user_is_owner?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_suggestions_duplicate_of_entity_id_fkey"
            columns: ["duplicate_of_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_suggestions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_views: {
        Row: {
          created_at: string | null
          entity_id: string
          id: string
          interaction_type: string | null
          metadata: Json | null
          session_id: string | null
          user_id: string | null
          view_duration: number | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          id?: string
          interaction_type?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
          view_duration?: number | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          id?: string
          interaction_type?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
          view_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_views_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name_norm: string
          name_original: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name_norm: string
          name_original: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name_norm?: string
          name_original?: string
        }
        Relationships: []
      }
      image_health_results: {
        Row: {
          checked_at: string
          consecutive_failures: number
          created_at: string
          entity_id: string
          error_type: string | null
          id: string
          image_url: string
          is_healthy: boolean
          session_id: string | null
        }
        Insert: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          entity_id: string
          error_type?: string | null
          id?: string
          image_url: string
          is_healthy: boolean
          session_id?: string | null
        }
        Update: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          entity_id?: string
          error_type?: string | null
          id?: string
          image_url?: string
          is_healthy?: boolean
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_health_results_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "image_health_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      image_health_sessions: {
        Row: {
          broken_count: number
          completed_at: string | null
          created_at: string
          error_breakdown: Json
          healthy_count: number
          id: string
          started_at: string
          total_checked: number
        }
        Insert: {
          broken_count?: number
          completed_at?: string | null
          created_at?: string
          error_breakdown?: Json
          healthy_count?: number
          id?: string
          started_at?: string
          total_checked?: number
        }
        Update: {
          broken_count?: number
          completed_at?: string | null
          created_at?: string
          error_breakdown?: Json
          healthy_count?: number
          id?: string
          started_at?: string
          total_checked?: number
        }
        Relationships: []
      }
      image_migration_results: {
        Row: {
          created_at: string
          entity_id: string
          entity_name: string
          error_message: string | null
          id: string
          migrated_at: string
          new_url: string | null
          original_url: string
          session_id: string
          success: boolean
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_name: string
          error_message?: string | null
          id?: string
          migrated_at?: string
          new_url?: string | null
          original_url: string
          session_id: string
          success: boolean
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_name?: string
          error_message?: string | null
          id?: string
          migrated_at?: string
          new_url?: string | null
          original_url?: string
          session_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_migration_results_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "image_migration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      image_migration_sessions: {
        Row: {
          already_processed_count: number
          completed_at: string | null
          created_at: string
          failed_count: number
          id: string
          migrated_count: number
          skipped_count: number
          started_at: string
          status: string
          total_entities: number
        }
        Insert: {
          already_processed_count?: number
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          migrated_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          total_entities?: number
        }
        Update: {
          already_processed_count?: number
          completed_at?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          migrated_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          total_entities?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          metadata: Json | null
          sender_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          sender_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          sender_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photo_cache_sessions: {
        Row: {
          cache_errors: number | null
          completed_at: string | null
          entity_id: string
          id: string
          photos_cached: number | null
          session_status: string | null
          started_at: string | null
          total_photos_found: number | null
        }
        Insert: {
          cache_errors?: number | null
          completed_at?: string | null
          entity_id: string
          id?: string
          photos_cached?: number | null
          session_status?: string | null
          started_at?: string | null
          total_photos_found?: number | null
        }
        Update: {
          cache_errors?: number | null
          completed_at?: string | null
          entity_id?: string
          id?: string
          photos_cached?: number | null
          session_status?: string | null
          started_at?: string | null
          total_photos_found?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_cache_sessions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_reports: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string | null
          id: string
          photo_source: string
          photo_url: string
          reason: string
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          photo_source: string
          photo_url: string
          reason: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          photo_source?: string
          photo_url?: string
          reason?: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_reports_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_entities: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_entities_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_entities_backup: {
        Row: {
          created_at: string | null
          entity_id: string | null
          id: string | null
          post_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          id?: string | null
          post_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          id?: string | null
          post_id?: string | null
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_recommendations: {
        Row: {
          created_at: string
          created_by: string
          display_order: number
          entity_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          display_order?: number
          entity_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          display_order?: number
          entity_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_recommendations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_recommendations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_user_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comment_count: number
          content: string | null
          created_at: string
          entity_id: string | null
          id: string
          is_deleted: boolean
          media: Json | null
          post_type: Database["public"]["Enums"]["post_type"]
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          view_count: number
          visibility: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Insert: {
          comment_count?: number
          content?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          is_deleted?: boolean
          media?: Json | null
          post_type?: Database["public"]["Enums"]["post_type"]
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Update: {
          comment_count?: number
          content?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          is_deleted?: boolean
          media?: Json | null
          post_type?: Database["public"]["Enums"]["post_type"]
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          location: string | null
          preferences: Json | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          location?: string | null
          preferences?: Json | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          preferences?: Json | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      recommendation_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          recommendation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          recommendation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          recommendation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_comments_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_explanations: {
        Row: {
          algorithm_used: string
          confidence_score: number
          created_at: string
          entity_id: string
          expires_at: string
          explanation_text: string
          explanation_type: string
          id: string
          user_id: string
        }
        Insert: {
          algorithm_used: string
          confidence_score?: number
          created_at?: string
          entity_id: string
          expires_at?: string
          explanation_text: string
          explanation_type: string
          id?: string
          user_id: string
        }
        Update: {
          algorithm_used?: string
          confidence_score?: number
          created_at?: string
          entity_id?: string
          expires_at?: string
          explanation_text?: string
          explanation_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendation_likes: {
        Row: {
          created_at: string
          id: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_likes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_quality_scores: {
        Row: {
          created_at: string
          entity_id: string | null
          freshness_score: number
          id: string
          last_calculated: string
          quality_score: number
          recommendation_id: string | null
          relevance_score: number
          social_proof_score: number
          spam_score: number
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          freshness_score?: number
          id?: string
          last_calculated?: string
          quality_score?: number
          recommendation_id?: string | null
          relevance_score?: number
          social_proof_score?: number
          spam_score?: number
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          freshness_score?: number
          id?: string
          last_calculated?: string
          quality_score?: number
          recommendation_id?: string | null
          relevance_score?: number
          social_proof_score?: number
          spam_score?: number
        }
        Relationships: []
      }
      recommendation_saves: {
        Row: {
          created_at: string
          id: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_saves_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          category: Database["public"]["Enums"]["recommendation_category"]
          comment_count: number
          created_at: string
          description: string | null
          entity_id: string | null
          id: string
          image_url: string | null
          is_certified: boolean
          rating: number
          title: string
          updated_at: string
          user_id: string
          venue: string | null
          view_count: number
          visibility: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Insert: {
          category: Database["public"]["Enums"]["recommendation_category"]
          comment_count?: number
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          image_url?: string | null
          is_certified?: boolean
          rating: number
          title: string
          updated_at?: string
          user_id: string
          venue?: string | null
          view_count?: number
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Update: {
          category?: Database["public"]["Enums"]["recommendation_category"]
          comment_count?: number
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          image_url?: string | null
          is_certified?: boolean
          rating?: number
          title?: string
          updated_at?: string
          user_id?: string
          venue?: string | null
          view_count?: number
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations_backup: {
        Row: {
          category:
            | Database["public"]["Enums"]["recommendation_category"]
            | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          entity_id: string | null
          id: string | null
          image_url: string | null
          is_certified: boolean | null
          rating: number | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          venue: string | null
          view_count: number | null
          visibility:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Insert: {
          category?:
            | Database["public"]["Enums"]["recommendation_category"]
            | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string | null
          image_url?: string | null
          is_certified?: boolean | null
          rating?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue?: string | null
          view_count?: number | null
          visibility?:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Update: {
          category?:
            | Database["public"]["Enums"]["recommendation_category"]
            | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string | null
          image_url?: string | null
          is_certified?: boolean | null
          rating?: number | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue?: string | null
          view_count?: number | null
          visibility?:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Relationships: []
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_saves: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_saves_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_updates: {
        Row: {
          comment: string
          created_at: string
          id: string
          media: Json | null
          rating: number | null
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          media?: Json | null
          rating?: number | null
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          media?: Json | null
          rating?: number | null
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_updates_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_summary: string | null
          ai_summary_last_generated_at: string | null
          ai_summary_model_used: string | null
          category: string
          created_at: string
          description: string | null
          entity_id: string | null
          experience_date: string | null
          has_timeline: boolean | null
          id: string
          image_url: string | null
          is_converted: boolean
          is_recommended: boolean | null
          is_verified: boolean | null
          latest_rating: number | null
          media: Json | null
          metadata: Json | null
          rating: number
          recommendation_id: string | null
          status: string
          subtitle: string | null
          timeline_count: number | null
          title: string
          trust_score: number | null
          updated_at: string
          user_id: string
          venue: string | null
          visibility: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_last_generated_at?: string | null
          ai_summary_model_used?: string | null
          category: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          has_timeline?: boolean | null
          id?: string
          image_url?: string | null
          is_converted?: boolean
          is_recommended?: boolean | null
          is_verified?: boolean | null
          latest_rating?: number | null
          media?: Json | null
          metadata?: Json | null
          rating: number
          recommendation_id?: string | null
          status?: string
          subtitle?: string | null
          timeline_count?: number | null
          title: string
          trust_score?: number | null
          updated_at?: string
          user_id: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Update: {
          ai_summary?: string | null
          ai_summary_last_generated_at?: string | null
          ai_summary_model_used?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          has_timeline?: boolean | null
          id?: string
          image_url?: string | null
          is_converted?: boolean
          is_recommended?: boolean | null
          is_verified?: boolean | null
          latest_rating?: number | null
          media?: Json | null
          metadata?: Json | null
          rating?: number
          recommendation_id?: string | null
          status?: string
          subtitle?: string | null
          timeline_count?: number | null
          title?: string
          trust_score?: number | null
          updated_at?: string
          user_id?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_backup: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          entity_id: string | null
          experience_date: string | null
          id: string | null
          image_url: string | null
          is_converted: boolean | null
          media: Json | null
          metadata: Json | null
          rating: number | null
          recommendation_id: string | null
          status: string | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          venue: string | null
          visibility:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          id?: string | null
          image_url?: string | null
          is_converted?: boolean | null
          media?: Json | null
          metadata?: Json | null
          rating?: number | null
          recommendation_id?: string | null
          status?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue?: string | null
          visibility?:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          id?: string | null
          image_url?: string | null
          is_converted?: boolean | null
          media?: Json | null
          metadata?: Json | null
          rating?: number | null
          recommendation_id?: string | null
          status?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          venue?: string | null
          visibility?:
            | Database["public"]["Enums"]["recommendation_visibility"]
            | null
        }
        Relationships: []
      }
      social_influence_scores: {
        Row: {
          category: string
          created_at: string
          engagement_rate: number
          expertise_score: number
          follower_count: number
          id: string
          influence_score: number
          last_calculated: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          engagement_rate?: number
          expertise_score?: number
          follower_count?: number
          id?: string
          influence_score?: number
          last_calculated?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          engagement_rate?: number
          expertise_score?: number
          follower_count?: number
          id?: string
          influence_score?: number
          last_calculated?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_patterns: {
        Row: {
          activity_score: number | null
          category: string
          created_at: string | null
          day_of_week: number | null
          entity_type: string
          id: string
          interaction_velocity: number | null
          last_interaction: string | null
          time_of_day: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_score?: number | null
          category: string
          created_at?: string | null
          day_of_week?: number | null
          entity_type: string
          id?: string
          interaction_velocity?: number | null
          last_interaction?: string | null
          time_of_day?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_score?: number | null
          category?: string
          created_at?: string | null
          day_of_week?: number | null
          entity_type?: string
          id?: string
          interaction_velocity?: number | null
          last_interaction?: string | null
          time_of_day?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_patterns: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          last_updated: string
          pattern_data: Json
          pattern_type: string
          user_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          pattern_data?: Json
          pattern_type: string
          user_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          last_updated?: string
          pattern_data?: Json
          pattern_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          category: string
          created_at: string | null
          entity_type: string
          id: string
          interaction_count: number | null
          interest_score: number | null
          last_interaction: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          entity_type: string
          id?: string
          interaction_count?: number | null
          interest_score?: number | null
          last_interaction?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          entity_type?: string
          id?: string
          interaction_count?: number | null
          interest_score?: number | null
          last_interaction?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_similarities: {
        Row: {
          created_at: string
          id: string
          last_calculated: string
          similarity_score: number
          similarity_type: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_calculated?: string
          similarity_score?: number
          similarity_type?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_calculated?: string
          similarity_score?: number
          similarity_type?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_comment: {
        Args: {
          p_content: string
          p_item_id: string
          p_item_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      calculate_enhanced_trending_score: {
        Args: { p_entity_id: string }
        Returns: number
      }
      calculate_social_influence_score: {
        Args: { p_category: string; p_user_id: string }
        Returns: number
      }
      calculate_trending_hashtags: {
        Args: { result_limit?: number; time_window_hours?: number }
        Returns: {
          created_at: string
          id: string
          name_norm: string
          name_original: string
          post_count: number
          trending_score: number
        }[]
      }
      calculate_trending_score: {
        Args: { p_entity_id: string }
        Returns: number
      }
      calculate_trust_score: {
        Args: { p_review_id: string }
        Returns: number
      }
      calculate_user_similarity: {
        Args: { user_a_id: string; user_b_id: string }
        Returns: number
      }
      check_admin_permission: {
        Args: { required_permission?: string }
        Returns: boolean
      }
      check_entity_save: {
        Args: { p_entity_id: string; p_user_id: string }
        Returns: boolean
      }
      check_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      check_post_save: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      create_storage_helper_functions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_storage_open_policy: {
        Args: { bucket_id: string }
        Returns: boolean
      }
      create_storage_policy: {
        Args: { bucket_name: string; definition: string; policy_name: string }
        Returns: boolean
      }
      delete_comment: {
        Args: { p_comment_id: string; p_item_type: string; p_user_id: string }
        Returns: boolean
      }
      delete_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: undefined
      }
      delete_post_save: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: undefined
      }
      fix_duplicate_slugs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      generate_entity_slug: {
        Args: { current_entity_id?: string; name: string } | { name: string }
        Returns: string
      }
      get_admin_analytics: {
        Args: Record<PropertyKey, never>
        Returns: {
          entities_with_dynamic_reviews: number
          recent_ai_generations: number
          reviews_with_ai_summary: number
          total_entities: number
          total_reviews: number
        }[]
      }
      get_cached_products: {
        Args: { query_text: string }
        Returns: {
          api_ref: string | null
          api_source: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          metadata: Json
          name: string
          query_id: string
          updated_at: string
          venue: string | null
        }[]
      }
      get_child_entities: {
        Args: { parent_uuid: string }
        Returns: {
          description: string
          id: string
          image_url: string
          name: string
          type: Database["public"]["Enums"]["entity_type"]
        }[]
      }
      get_circle_rating: {
        Args: { p_entity_id: string; p_user_id: string }
        Returns: number
      }
      get_circle_recommendation_count: {
        Args: { p_entity_id: string; p_user_id: string }
        Returns: number
      }
      get_comments_with_profiles: {
        Args: { p_id_field: string; p_item_id: string; p_table_name: string }
        Returns: {
          avatar_url: string
          content: string
          created_at: string
          edited_at: string
          id: string
          user_id: string
          username: string
        }[]
      }
      get_dynamic_rating: {
        Args: { p_entity_id: string }
        Returns: number
      }
      get_entity_follower_names: {
        Args: { follower_limit?: number; input_entity_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          last_name: string
          username: string
        }[]
      }
      get_entity_followers_count: {
        Args: { input_entity_id: string }
        Returns: number
      }
      get_entity_followers_with_context: {
        Args: {
          current_user_id?: string
          follower_limit?: number
          follower_offset?: number
          input_entity_id: string
          relationship_filter?: string
          search_query?: string
        }
        Returns: {
          avatar_url: string
          first_name: string
          followed_at: string
          id: string
          is_following: boolean
          is_mutual: boolean
          last_name: string
          username: string
        }[]
      }
      get_entity_saves_count: {
        Args: { p_entity_id: string }
        Returns: number
      }
      get_entity_suggestion_stats: {
        Args: { entity_uuid: string }
        Returns: {
          approved_count: number
          pending_count: number
          rejected_count: number
        }[]
      }
      get_follower_count_by_user_id: {
        Args: { user_id: string }
        Returns: number
      }
      get_followers_with_profiles: {
        Args: { current_user_id: string; profile_user_id: string }
        Returns: {
          avatar_url: string
          id: string
          is_following: boolean
          username: string
        }[]
      }
      get_following_count_by_user_id: {
        Args: { user_id: string }
        Returns: number
      }
      get_following_with_profiles: {
        Args: { current_user_id: string; profile_user_id: string }
        Returns: {
          avatar_url: string
          id: string
          is_following: boolean
          username: string
        }[]
      }
      get_overall_rating: {
        Args: { p_entity_id: string }
        Returns: number
      }
      get_personalized_entities: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          entity_id: string
          personalization_score: number
          reason: string
        }[]
      }
      get_post_likes_by_posts: {
        Args: { p_post_ids: string[] }
        Returns: {
          like_count: number
          post_id: string
        }[]
      }
      get_recommendation_count: {
        Args: { p_entity_id: string }
        Returns: number
      }
      get_recommendation_likes_by_ids: {
        Args: { p_recommendation_ids: string[] }
        Returns: {
          like_count: number
          recommendation_id: string
        }[]
      }
      get_review_likes_batch: {
        Args: { p_review_ids: string[] }
        Returns: {
          like_count: number
          review_id: string
        }[]
      }
      get_user_post_likes: {
        Args: { p_post_ids: string[]; p_user_id: string }
        Returns: {
          post_id: string
        }[]
      }
      get_user_post_saves: {
        Args: { p_post_ids: string[]; p_user_id: string }
        Returns: {
          post_id: string
        }[]
      }
      get_user_recommendation_likes: {
        Args: { p_recommendation_ids: string[]; p_user_id: string }
        Returns: {
          recommendation_id: string
        }[]
      }
      get_user_review_likes: {
        Args: { p_review_ids: string[]; p_user_id: string }
        Returns: {
          review_id: string
        }[]
      }
      get_user_review_saves: {
        Args: { p_review_ids: string[]; p_user_id: string }
        Returns: {
          review_id: string
        }[]
      }
      increment_comment_count: {
        Args: { item_id: string; table_name: string }
        Returns: undefined
      }
      increment_recommendation_view: {
        Args: { rec_id: string; viewer_id: string }
        Returns: undefined
      }
      insert_post_entity: {
        Args: { p_entity_id: string; p_post_id: string }
        Returns: undefined
      }
      insert_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: undefined
      }
      insert_post_save: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: undefined
      }
      insert_user_mention: {
        Args: { mentioned_user_id: string; post_id: string }
        Returns: undefined
      }
      is_admin_user: {
        Args: { user_email: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_query_fresh: {
        Args: { query_text: string; ttl_hours?: number }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      mark_notifications_as_read: {
        Args: { notification_ids: string[] }
        Returns: string[]
      }
      toggle_entity_save: {
        Args: { p_entity_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_post_save: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_recommendation_like: {
        Args: { p_recommendation_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_review_like: {
        Args: { p_review_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_review_save: {
        Args: { p_review_id: string; p_user_id: string }
        Returns: boolean
      }
      update_all_trending_scores: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      update_comment: {
        Args: {
          p_comment_id: string
          p_content: string
          p_item_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      update_profile_preferences: {
        Args: { preferences: Json; user_id: string }
        Returns: boolean
      }
      user_has_pending_suggestion: {
        Args: { entity_uuid: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      entity_type: "book" | "movie" | "place" | "product" | "food"
      post_type: "story" | "routine" | "project" | "note"
      recommendation_category: "food" | "movie" | "product" | "book" | "place"
      recommendation_visibility: "public" | "private" | "circle_only"
      suggestion_status: "pending" | "approved" | "rejected" | "applied"
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
      entity_type: ["book", "movie", "place", "product", "food"],
      post_type: ["story", "routine", "project", "note"],
      recommendation_category: ["food", "movie", "product", "book", "place"],
      recommendation_visibility: ["public", "private", "circle_only"],
      suggestion_status: ["pending", "approved", "rejected", "applied"],
    },
  },
} as const
