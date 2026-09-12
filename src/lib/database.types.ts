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
    PostgrestVersion: "14.5"
  }
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
      admins: {
        Row: {
          created_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banned_at: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          banned_at?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          banned_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          label: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_tags: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          question_id: string
          sort_order: number
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          question_id: string
          sort_order?: number
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          question_id?: string
          sort_order?: number
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          archived_at: string | null
          config: Json
          created_at: string
          created_by: string | null
          help_text: string | null
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          prompt: string
          required: boolean
          supersedes_id: string | null
        }
        Insert: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          help_text?: string | null
          id?: string
          kind: Database["public"]["Enums"]["question_kind"]
          prompt: string
          required?: boolean
          supersedes_id?: string | null
        }
        Update: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          help_text?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          prompt?: string
          required?: boolean
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_answers: {
        Row: {
          answered_at: string
          question_id: string
          review_id: string
          value_answer: Database["public"]["Enums"]["answer"] | null
          value_bool: boolean | null
          value_number: number | null
          value_option_ids: string[] | null
          value_text: string | null
        }
        Insert: {
          answered_at?: string
          question_id: string
          review_id: string
          value_answer?: Database["public"]["Enums"]["answer"] | null
          value_bool?: boolean | null
          value_number?: number | null
          value_option_ids?: string[] | null
          value_text?: string | null
        }
        Update: {
          answered_at?: string
          question_id?: string
          review_id?: string
          value_answer?: Database["public"]["Enums"]["answer"] | null
          value_bool?: boolean | null
          value_number?: number | null
          value_option_ids?: string[] | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_answers_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          stars: number
          trans_bathroom: Database["public"]["Enums"]["answer"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          stars: number
          trans_bathroom: Database["public"]["Enums"]["answer"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          stars?: number
          trans_bathroom?: Database["public"]["Enums"]["answer"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_ratings"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          slug: string
          sort_order: number
          text_color: string | null
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number
          text_color?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          text_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          venue_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          venue_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_notes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_ratings"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_notes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tags: {
        Row: {
          added_at: string
          added_by: string | null
          tag_id: string
          venue_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          tag_id: string
          venue_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          tag_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_tags_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tags_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_ratings"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_tags_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          google_place_id: string | null
          id: string
          last_synced_at: string | null
          lat: number | null
          lng: number | null
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          last_synced_at?: string | null
          lat?: number | null
          lng?: number | null
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          last_synced_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      venue_ratings: {
        Row: {
          avg_stars: number | null
          review_count: number | null
          trans_bathroom_no: number | null
          trans_bathroom_unsure: number | null
          trans_bathroom_yes: number | null
          venue_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_assign_questions: {
        Args: { p_question_ids: string[]; p_tag_id: string }
        Returns: undefined
      }
      admin_create_question: {
        Args: {
          p_config?: Json
          p_help_text?: string
          p_kind: Database["public"]["Enums"]["question_kind"]
          p_options?: string[]
          p_prompt: string
          p_required?: boolean
          p_tag_ids?: string[]
        }
        Returns: string
      }
      admin_create_tag: {
        Args: {
          p_color: string
          p_description?: string
          p_label: string
          p_slug: string
          p_sort_order?: number
          p_text_color?: string
        }
        Returns: string
      }
      admin_create_venue_note: {
        Args: { p_body: string; p_venue_id: string }
        Returns: string
      }
      admin_delete_question: { Args: { p_id: string }; Returns: undefined }
      admin_delete_tag: { Args: { p_id: string }; Returns: undefined }
      admin_delete_venue: { Args: { p_id: string }; Returns: undefined }
      admin_delete_venue_note: { Args: { p_id: string }; Returns: undefined }
      admin_list_profiles: {
        Args: {
          p_desc?: boolean
          p_joined_after?: string
          p_limit?: number
          p_max_reviews?: number
          p_min_reviews?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: {
          banned_at: string
          created_at: string
          display_name: string
          id: string
          review_count: number
          total_count: number
        }[]
      }
      admin_list_questions: {
        Args: { p_include_archived?: boolean; p_search?: string }
        Returns: {
          answer_count: number
          archived_at: string
          config: Json
          help_text: string
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          options: Json
          prompt: string
          required: boolean
          supersedes_id: string
          tags: Json
        }[]
      }
      admin_list_tag_questions: {
        Args: { p_tag_id: string }
        Returns: {
          answer_count: number
          config: Json
          help_text: string
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          options: Json
          prompt: string
          required: boolean
          sort_order: number
        }[]
      }
      admin_list_tags: {
        Args: { p_include_archived?: boolean }
        Returns: {
          archived_at: string
          color: string
          description: string
          id: string
          label: string
          question_count: number
          slug: string
          sort_order: number
          text_color: string
          venue_count: number
        }[]
      }
      admin_list_venue_notes: {
        Args: { p_venue_id: string }
        Returns: {
          body: string
          id: string
          sort_order: number
          updated_at: string
          updated_by: string
        }[]
      }
      admin_list_venues: {
        Args: {
          p_desc?: boolean
          p_limit?: number
          p_notes?: string
          p_offset?: number
          p_reviews?: string
          p_search?: string
          p_sort?: string
          p_tag_id?: string
          p_tag_state?: string
          p_visibility?: string
        }
        Returns: {
          address: string
          avg_stars: number
          created_at: string
          google_place_id: string
          id: string
          lat: number
          lng: number
          name: string
          note_count: number
          on_map: boolean
          review_count: number
          tags: Json
          total_count: number
        }[]
      }
      admin_reorder_questions: {
        Args: { p_ids: string[]; p_tag_id: string }
        Returns: undefined
      }
      admin_reorder_tags: { Args: { p_ids: string[] }; Returns: undefined }
      admin_reorder_venue_notes: {
        Args: { p_ids: string[]; p_venue_id: string }
        Returns: undefined
      }
      admin_revise_question: {
        Args: {
          p_config?: Json
          p_help_text?: string
          p_kind: Database["public"]["Enums"]["question_kind"]
          p_options?: string[]
          p_prompt: string
          p_question_id: string
          p_required?: boolean
        }
        Returns: string
      }
      admin_set_banned: {
        Args: { p_banned: boolean; p_user: string }
        Returns: string
      }
      admin_set_question_archived: {
        Args: { p_archived: boolean; p_id: string }
        Returns: string
      }
      admin_set_question_tags: {
        Args: { p_question_id: string; p_tag_ids: string[] }
        Returns: undefined
      }
      admin_set_tag_archived: {
        Args: { p_archived: boolean; p_id: string }
        Returns: string
      }
      admin_set_venue_tags: {
        Args: { p_tag_ids: string[]; p_venue_id: string }
        Returns: undefined
      }
      admin_unassign_question: {
        Args: { p_question_id: string; p_tag_id: string }
        Returns: undefined
      }
      admin_update_tag: {
        Args: {
          p_color: string
          p_description?: string
          p_id: string
          p_label: string
          p_sort_order?: number
          p_text_color?: string
        }
        Returns: undefined
      }
      admin_update_venue_note: {
        Args: { p_body: string; p_id: string }
        Returns: undefined
      }
      admin_upsert_venue: {
        Args: {
          p_address?: string
          p_google_place_id?: string
          p_lat?: number
          p_lng?: number
          p_name: string
          p_tag_ids?: string[]
        }
        Returns: {
          created: boolean
          venue_id: string
        }[]
      }
      generate_display_name: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_banned: { Args: { p_user: string }; Returns: boolean }
      question_config_valid: {
        Args: {
          p_config: Json
          p_kind: Database["public"]["Enums"]["question_kind"]
        }
        Returns: boolean
      }
      question_requires_options: {
        Args: { p_kind: Database["public"]["Enums"]["question_kind"] }
        Returns: boolean
      }
      set_question_options: {
        Args: { p_options: string[]; p_question_id: string }
        Returns: undefined
      }
      venue_is_on_map: { Args: { p_venue_id: string }; Returns: boolean }
      venue_questionnaire: {
        Args: { p_venue_id: string }
        Returns: {
          config: Json
          help_text: string
          kind: Database["public"]["Enums"]["question_kind"]
          options: Json
          prompt: string
          question_id: string
          required: boolean
          tag_color: string
          tag_id: string
          tag_label: string
          tag_slug: string
          tag_text_color: string
        }[]
      }
      venues_near: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_meters?: number
        }
        Returns: {
          avg_stars: number
          distance_meters: number
          google_place_id: string
          id: string
          lat: number
          latest_review_at: string
          latest_review_body: string
          lng: number
          name: string
          review_count: number
          tags: Json
        }[]
      }
      venues_search: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_query: string
        }
        Returns: {
          avg_stars: number
          distance_meters: number
          google_place_id: string
          id: string
          lat: number
          latest_review_at: string
          latest_review_body: string
          lng: number
          name: string
          review_count: number
          tags: Json
        }[]
      }
    }
    Enums: {
      answer: "yes" | "no" | "unsure"
      question_kind:
        | "yes_no"
        | "yes_no_unsure"
        | "single_select"
        | "multi_select"
        | "scale"
        | "rating"
        | "number"
        | "currency"
        | "duration"
        | "time_of_day"
        | "time_range"
        | "date"
        | "short_text"
        | "long_text"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      answer: ["yes", "no", "unsure"],
      question_kind: [
        "yes_no",
        "yes_no_unsure",
        "single_select",
        "multi_select",
        "scale",
        "rating",
        "number",
        "currency",
        "duration",
        "time_of_day",
        "time_range",
        "date",
        "short_text",
        "long_text",
      ],
    },
  },
} as const
