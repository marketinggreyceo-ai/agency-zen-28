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
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string
          id: string
          month: number
          name: string
          notes: string | null
          year: number
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string
          id?: string
          month: number
          name: string
          notes?: string | null
          year: number
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string
          id?: string
          month?: number
          name?: string
          notes?: string | null
          year?: number
        }
        Relationships: []
      }
      model_accounts: {
        Row: {
          account_url: string | null
          followers: number | null
          id: string
          model_id: string | null
          notes: string | null
          platform: string | null
          status: string | null
          va_owner: string | null
        }
        Insert: {
          account_url?: string | null
          followers?: number | null
          id?: string
          model_id?: string | null
          notes?: string | null
          platform?: string | null
          status?: string | null
          va_owner?: string | null
        }
        Update: {
          account_url?: string | null
          followers?: number | null
          id?: string
          model_id?: string | null
          notes?: string | null
          platform?: string | null
          status?: string | null
          va_owner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_accounts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          agency_cut: number | null
          created_at: string
          growth_ideas: string | null
          id: string
          kpi_notes: string | null
          name: string
          notes: string | null
          platform: string | null
          platforms: string[]
          priority: string | null
          status: string | null
          tags: string[]
          weak_points: string | null
        }
        Insert: {
          agency_cut?: number | null
          created_at?: string
          growth_ideas?: string | null
          id?: string
          kpi_notes?: string | null
          name: string
          notes?: string | null
          platform?: string | null
          platforms?: string[]
          priority?: string | null
          status?: string | null
          tags?: string[]
          weak_points?: string | null
        }
        Update: {
          agency_cut?: number | null
          created_at?: string
          growth_ideas?: string | null
          id?: string
          kpi_notes?: string | null
          name?: string
          notes?: string | null
          platform?: string | null
          platforms?: string[]
          priority?: string | null
          status?: string | null
          tags?: string[]
          weak_points?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assignee_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          telegram_handle: string | null
        }
        Insert: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          telegram_handle?: string | null
        }
        Update: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          telegram_handle?: string | null
        }
        Relationships: []
      }
      revenue: {
        Row: {
          agency_cut_override: number | null
          gross_amount: number | null
          id: string
          model_id: string | null
          month: number
          year: number
        }
        Insert: {
          agency_cut_override?: number | null
          gross_amount?: number | null
          id?: string
          model_id?: string | null
          month: number
          year: number
        }
        Update: {
          agency_cut_override?: number | null
          gross_amount?: number | null
          id?: string
          model_id?: string | null
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          category: string
          content: string | null
          created_at: string
          id: string
          public_slug: string | null
          title: string
          updated_at: string
          visible_to: string | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          id?: string
          public_slug?: string | null
          title: string
          updated_at?: string
          visible_to?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          public_slug?: string | null
          title?: string
          updated_at?: string
          visible_to?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee: string | null
          created_at: string
          deadline: string | null
          id: string
          model_id: string | null
          notes: string | null
          status: string | null
          task_type: string | null
          telegram_message_id: string | null
          title: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          status?: string | null
          task_type?: string | null
          telegram_message_id?: string | null
          title: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          status?: string | null
          task_type?: string | null
          telegram_message_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          name: string
          profile_id: string | null
          responsibilities: string | null
          role_label: string | null
          telegram_handle: string | null
          weekly_tasks: string | null
        }
        Insert: {
          id?: string
          name: string
          profile_id?: string | null
          responsibilities?: string | null
          role_label?: string | null
          telegram_handle?: string | null
          weekly_tasks?: string | null
        }
        Update: {
          id?: string
          name?: string
          profile_id?: string | null
          responsibilities?: string | null
          role_label?: string | null
          telegram_handle?: string | null
          weekly_tasks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_owner: { Args: never; Returns: undefined }
      can_read_task: { Args: { _assignee: string }; Returns: boolean }
      can_write_task: { Args: { _assignee: string }; Returns: boolean }
      current_assignee: { Args: never; Returns: string }
      get_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_owner: { Args: never; Returns: boolean }
      owner_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "production" | "creative" | "va"
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
      app_role: ["owner", "production", "creative", "va"],
    },
  },
} as const
