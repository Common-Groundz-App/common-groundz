export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
          api_ref: string | null
          api_source: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          is_verified: boolean | null
          metadata: Json | null
          name: string
          open_graph_data: Json | null
          photo_reference: string | null
          popularity_score: number | null
          slug: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
          venue: string | null
          verification_date: string | null
          website_url: string | null
        }
        Insert: {
          api_ref?: string | null
          api_source?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_verified?: boolean | null
          metadata?: Json | null
          name: string
          open_graph_data?: Json | null
          photo_reference?: string | null
          popularity_score?: number | null
          slug?: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          venue?: string | null
          verification_date?: string | null
          website_url?: string | null
        }
        Update: {
          api_ref?: string | null
          api_source?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_verified?: boolean | null
          metadata?: Json | null
          name?: string
          open_graph_data?: Json | null
          photo_reference?: string | null
          popularity_score?: number | null
          slug?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          venue?: string | null
          verification_date?: string | null
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
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
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
      posts: {
        Row: {
          comment_count: number
          content: string | null
          created_at: string
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
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          id: string
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
          id: string
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
          id?: string
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
          id: string
          is_deleted: boolean
          recommendation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          recommendation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
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
      reviews: {
        Row: {
          category: string
          created_at: string
          description: string | null
          entity_id: string | null
          experience_date: string | null
          id: string
          image_url: string | null
          is_converted: boolean
          media: Json | null
          metadata: Json | null
          rating: number
          recommendation_id: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
          venue: string | null
          visibility: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          id?: string
          image_url?: string | null
          is_converted?: boolean
          media?: Json | null
          metadata?: Json | null
          rating: number
          recommendation_id?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          user_id: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["recommendation_visibility"]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          experience_date?: string | null
          id?: string
          image_url?: string | null
          is_converted?: boolean
          media?: Json | null
          metadata?: Json | null
          rating?: number
          recommendation_id?: string | null
          status?: string
          subtitle?: string | null
          title?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_comment: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_content: string
          p_user_id: string
        }
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
        Args: { bucket_name: string; policy_name: string; definition: string }
        Returns: boolean
      }
      delete_comment: {
        Args: { p_comment_id: string; p_user_id: string; p_item_type: string }
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
      generate_entity_slug: {
        Args: { name: string }
        Returns: string
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
      get_comments_with_profiles: {
        Args: { p_table_name: string; p_id_field: string; p_item_id: string }
        Returns: {
          id: string
          content: string
          created_at: string
          user_id: string
          username: string
          avatar_url: string
        }[]
      }
      get_follower_count_by_user_id: {
        Args: { user_id: string }
        Returns: number
      }
      get_followers_with_profiles: {
        Args: { profile_user_id: string; current_user_id: string }
        Returns: {
          id: string
          username: string
          avatar_url: string
          is_following: boolean
        }[]
      }
      get_following_count_by_user_id: {
        Args: { user_id: string }
        Returns: number
      }
      get_following_with_profiles: {
        Args: { profile_user_id: string; current_user_id: string }
        Returns: {
          id: string
          username: string
          avatar_url: string
          is_following: boolean
        }[]
      }
      get_post_likes_by_posts: {
        Args: { p_post_ids: string[] }
        Returns: {
          post_id: string
          like_count: number
        }[]
      }
      get_recommendation_likes_by_ids: {
        Args: { p_recommendation_ids: string[] }
        Returns: {
          recommendation_id: string
          like_count: number
        }[]
      }
      get_review_likes_batch: {
        Args: { p_review_ids: string[] }
        Returns: {
          review_id: string
          like_count: number
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
        Args: { table_name: string; item_id: string }
        Returns: undefined
      }
      increment_recommendation_view: {
        Args: { rec_id: string; viewer_id: string }
        Returns: undefined
      }
      insert_post_entity: {
        Args: { p_post_id: string; p_entity_id: string }
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
      is_query_fresh: {
        Args: { query_text: string; ttl_hours?: number }
        Returns: boolean
      }
      mark_notifications_as_read: {
        Args: { notification_ids: string[] }
        Returns: string[]
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
      update_comment: {
        Args: {
          p_comment_id: string
          p_content: string
          p_user_id: string
          p_item_type: string
        }
        Returns: boolean
      }
      update_profile_preferences: {
        Args: { user_id: string; preferences: Json }
        Returns: boolean
      }
    }
    Enums: {
      entity_type: "book" | "movie" | "place" | "product" | "food"
      post_type: "story" | "routine" | "project" | "note"
      recommendation_category: "food" | "movie" | "product" | "book" | "place"
      recommendation_visibility: "public" | "private" | "circle_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
    },
  },
} as const
