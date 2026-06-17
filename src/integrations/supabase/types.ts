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
      account_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          agency_name: string
          created_at: string
          currency_symbol: string
          date_format: string
          id: string
          timezone: string
          updated_at: string
          weekly_report_day: string
          weekly_report_time: string
        }
        Insert: {
          agency_name?: string
          created_at?: string
          currency_symbol?: string
          date_format?: string
          id?: string
          timezone?: string
          updated_at?: string
          weekly_report_day?: string
          weekly_report_time?: string
        }
        Update: {
          agency_name?: string
          created_at?: string
          currency_symbol?: string
          date_format?: string
          id?: string
          timezone?: string
          updated_at?: string
          weekly_report_day?: string
          weekly_report_time?: string
        }
        Relationships: []
      }
      custom_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customs: {
        Row: {
          chatter: string | null
          created_at: string
          customer_nickname: string
          description: string | null
          id: string
          model_id: string | null
          notes: string | null
          platform: string | null
          price: number | null
          status: string
          telegram_chat_id: string | null
          telegram_message_id: string | null
          updated_at: string
        }
        Insert: {
          chatter?: string | null
          created_at?: string
          customer_nickname: string
          description?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          platform?: string | null
          price?: number | null
          status?: string
          telegram_chat_id?: string | null
          telegram_message_id?: string | null
          updated_at?: string
        }
        Update: {
          chatter?: string | null
          created_at?: string
          customer_nickname?: string
          description?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          platform?: string | null
          price?: number | null
          status?: string
          telegram_chat_id?: string | null
          telegram_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string
          date: string | null
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
          date?: string | null
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
          date?: string | null
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
          account_name: string | null
          account_url: string | null
          followers: number | null
          id: string
          linkinbio_url: string | null
          model_id: string | null
          notes: string | null
          pixel_phone: string | null
          platform: string | null
          status: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          va_owner: string | null
        }
        Insert: {
          account_name?: string | null
          account_url?: string | null
          followers?: number | null
          id?: string
          linkinbio_url?: string | null
          model_id?: string | null
          notes?: string | null
          pixel_phone?: string | null
          platform?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          va_owner?: string | null
        }
        Update: {
          account_name?: string | null
          account_url?: string | null
          followers?: number | null
          id?: string
          linkinbio_url?: string | null
          model_id?: string | null
          notes?: string | null
          pixel_phone?: string | null
          platform?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
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
      model_brain_blocks: {
        Row: {
          color: string
          connections: string[]
          content: string
          created_at: string
          id: string
          model_id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string
          connections?: string[]
          content?: string
          created_at?: string
          id?: string
          model_id: string
          position?: number
          title?: string
          updated_at?: string
        }
        Update: {
          color?: string
          connections?: string[]
          content?: string
          created_at?: string
          id?: string
          model_id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_brain_blocks_model_id_fkey"
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
          is_archived: boolean
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
          is_archived?: boolean
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
          is_archived?: boolean
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
      platforms: {
        Row: {
          created_at: string
          icon_name: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_name?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_name?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
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
          invited_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          telegram_handle: string | null
        }
        Insert: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          invited_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          telegram_handle?: string | null
        }
        Update: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
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
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sop_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      task_types: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
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
          assignee_name: string | null
          id: string
          is_archived: boolean
          name: string
          profile_id: string | null
          responsibilities: string | null
          role_label: string | null
          telegram_handle: string | null
          weekly_tasks: string | null
        }
        Insert: {
          assignee_name?: string | null
          id?: string
          is_archived?: boolean
          name: string
          profile_id?: string | null
          responsibilities?: string | null
          role_label?: string | null
          telegram_handle?: string | null
          weekly_tasks?: string | null
        }
        Update: {
          assignee_name?: string | null
          id?: string
          is_archived?: boolean
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
      telegram_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          title: string | null
          type: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          title?: string | null
          type?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      telegram_logs: {
        Row: {
          chat_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_text: string | null
          parsed_action: string | null
          success: boolean
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_text?: string | null
          parsed_action?: string | null
          success?: boolean
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_text?: string | null
          parsed_action?: string | null
          success?: boolean
        }
        Relationships: []
      }
      telegram_settings: {
        Row: {
          auto_tasks_enabled: boolean
          bot_token: string | null
          created_at: string
          id: string
          updated_at: string
          weekly_report_chat_id: string | null
          weekly_report_day: string
          weekly_report_enabled: boolean
          weekly_report_time: string
        }
        Insert: {
          auto_tasks_enabled?: boolean
          bot_token?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          weekly_report_chat_id?: string | null
          weekly_report_day?: string
          weekly_report_enabled?: boolean
          weekly_report_time?: string
        }
        Update: {
          auto_tasks_enabled?: boolean
          bot_token?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          weekly_report_chat_id?: string | null
          weekly_report_day?: string
          weekly_report_enabled?: boolean
          weekly_report_time?: string
        }
        Relationships: []
      }
      telegram_task_log: {
        Row: {
          chat_id: string | null
          chat_name: string | null
          created_at: string
          id: string
          message_text: string
          parsed: Json | null
          task_id: string | null
        }
        Insert: {
          chat_id?: string | null
          chat_name?: string | null
          created_at?: string
          id?: string
          message_text: string
          parsed?: Json | null
          task_id?: string | null
        }
        Update: {
          chat_id?: string | null
          chat_name?: string | null
          created_at?: string
          id?: string
          message_text?: string
          parsed?: Json | null
          task_id?: string | null
        }
        Relationships: []
      }
      weekly_goal_types: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      weekly_goals: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          goal_type: string
          id: string
          model_id: string | null
          progress: number
          status: string
          title: string
          updated_at: string
          week_start: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_type: string
          id?: string
          model_id?: string | null
          progress?: number
          status?: string
          title: string
          updated_at?: string
          week_start: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          model_id?: string | null
          progress?: number
          status?: string
          title?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_goals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
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
      profile_status: "pending" | "active" | "suspended"
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
      profile_status: ["pending", "active", "suspended"],
    },
  },
} as const
