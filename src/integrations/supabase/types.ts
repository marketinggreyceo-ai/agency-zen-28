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
      account_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          from_account_id: string
          id: string
          notes: string | null
          started_at: string
          status: string
          to_account_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          from_account_id: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          to_account_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          from_account_id?: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          to_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "model_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "model_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      chatter_accounts: {
        Row: {
          account_name: string
          chatter_id: string | null
          chatter_profile_id: string | null
          commission_pct: number
          created_at: string
          id: string
          is_active: boolean
          model_id: string
          work_hours_end: string | null
          work_hours_start: string | null
        }
        Insert: {
          account_name: string
          chatter_id?: string | null
          chatter_profile_id?: string | null
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model_id: string
          work_hours_end?: string | null
          work_hours_start?: string | null
        }
        Update: {
          account_name?: string
          chatter_id?: string | null
          chatter_profile_id?: string | null
          commission_pct?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model_id?: string
          work_hours_end?: string | null
          work_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatter_accounts_chatter_id_fkey"
            columns: ["chatter_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatter_accounts_chatter_profile_id_fkey"
            columns: ["chatter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatter_accounts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      chatter_daily_sales: {
        Row: {
          amount: number
          chatter_account_id: string
          chatter_id: string | null
          chatter_profile_id: string | null
          created_at: string
          id: string
          month: number
          notes: string | null
          period: string
          sale_date: string
          year: number
        }
        Insert: {
          amount: number
          chatter_account_id: string
          chatter_id?: string | null
          chatter_profile_id?: string | null
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          period: string
          sale_date: string
          year: number
        }
        Update: {
          amount?: number
          chatter_account_id?: string
          chatter_id?: string | null
          chatter_profile_id?: string | null
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          period?: string
          sale_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatter_daily_sales_chatter_account_id_fkey"
            columns: ["chatter_account_id"]
            isOneToOne: false
            referencedRelation: "chatter_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatter_daily_sales_chatter_id_fkey"
            columns: ["chatter_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatter_daily_sales_chatter_profile_id_fkey"
            columns: ["chatter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chatter_periods: {
        Row: {
          chatter_id: string | null
          chatter_profile_id: string | null
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          month: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          period: string
          status: string
          total_sales: number
          year: number
        }
        Insert: {
          chatter_id?: string | null
          chatter_profile_id?: string | null
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period: string
          status?: string
          total_sales?: number
          year: number
        }
        Update: {
          chatter_id?: string | null
          chatter_profile_id?: string | null
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period?: string
          status?: string
          total_sales?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatter_periods_chatter_id_fkey"
            columns: ["chatter_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatter_periods_chatter_profile_id_fkey"
            columns: ["chatter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_months: {
        Row: {
          closed_at: string
          closed_by: string | null
          comment: string | null
          id: string
          month: number
          year: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          comment?: string | null
          id?: string
          month: number
          year: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          comment?: string | null
          id?: string
          month?: number
          year?: number
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
          costume: string | null
          created_at: string
          customer_nickname: string
          description: string | null
          duration: string | null
          fan_description: string | null
          id: string
          media_group_id: string | null
          model_id: string | null
          notes: string | null
          photo_file_ids: Json
          platform: string | null
          price: number | null
          status: string
          telegram_chat_id: string | null
          telegram_message_id: string | null
          updated_at: string
        }
        Insert: {
          chatter?: string | null
          costume?: string | null
          created_at?: string
          customer_nickname: string
          description?: string | null
          duration?: string | null
          fan_description?: string | null
          id?: string
          media_group_id?: string | null
          model_id?: string | null
          notes?: string | null
          photo_file_ids?: Json
          platform?: string | null
          price?: number | null
          status?: string
          telegram_chat_id?: string | null
          telegram_message_id?: string | null
          updated_at?: string
        }
        Update: {
          chatter?: string | null
          costume?: string | null
          created_at?: string
          customer_nickname?: string
          description?: string | null
          duration?: string | null
          fan_description?: string | null
          id?: string
          media_group_id?: string | null
          model_id?: string | null
          notes?: string | null
          photo_file_ids?: Json
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
      finance_settings: {
        Row: {
          chatter_period_mode: string
          currency: string
          default_chatting_percent: number
          id: string
          linjey_chatting_percent: number
          partner_name: string
          partner_split_percent: number
          temik_chatting_percent: number
          updated_at: string
        }
        Insert: {
          chatter_period_mode?: string
          currency?: string
          default_chatting_percent?: number
          id?: string
          linjey_chatting_percent?: number
          partner_name?: string
          partner_split_percent?: number
          temik_chatting_percent?: number
          updated_at?: string
        }
        Update: {
          chatter_period_mode?: string
          currency?: string
          default_chatting_percent?: number
          id?: string
          linjey_chatting_percent?: number
          partner_name?: string
          partner_split_percent?: number
          temik_chatting_percent?: number
          updated_at?: string
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
          chatting_cut: number
          chatting_enabled: boolean
          created_at: string
          english_name: string | null
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
          telegram_chat_id: string | null
          weak_points: string | null
        }
        Insert: {
          agency_cut?: number | null
          chatting_cut?: number
          chatting_enabled?: boolean
          created_at?: string
          english_name?: string | null
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
          telegram_chat_id?: string | null
          weak_points?: string | null
        }
        Update: {
          agency_cut?: number | null
          chatting_cut?: number
          chatting_enabled?: boolean
          created_at?: string
          english_name?: string | null
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
          telegram_chat_id?: string | null
          weak_points?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          agency_cut_override: number | null
          amount: number
          created_at: string
          id: string
          model_id: string | null
          month: number
          notes: string | null
          payment_date: string
          platform: string | null
          updated_at: string
          withdrawal_number: number
          year: number
        }
        Insert: {
          agency_cut_override?: number | null
          amount?: number
          created_at?: string
          id?: string
          model_id?: string | null
          month: number
          notes?: string | null
          payment_date?: string
          platform?: string | null
          updated_at?: string
          withdrawal_number?: number
          year: number
        }
        Update: {
          agency_cut_override?: number | null
          amount?: number
          created_at?: string
          id?: string
          model_id?: string | null
          month?: number
          notes?: string | null
          payment_date?: string
          platform?: string | null
          updated_at?: string
          withdrawal_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
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
          is_approved: boolean
          onboarded_at: string | null
          responsibilities: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["profile_status"]
          telegram_handle: string | null
          telegram_user_id: number | null
          weekly_tasks: string | null
        }
        Insert: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          invited_role?: Database["public"]["Enums"]["app_role"] | null
          is_approved?: boolean
          onboarded_at?: string | null
          responsibilities?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          telegram_handle?: string | null
          telegram_user_id?: number | null
          weekly_tasks?: string | null
        }
        Update: {
          assignee_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_role?: Database["public"]["Enums"]["app_role"] | null
          is_approved?: boolean
          onboarded_at?: string | null
          responsibilities?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          telegram_handle?: string | null
          telegram_user_id?: number | null
          weekly_tasks?: string | null
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
      sop_subcategories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_category: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_category: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_category?: string
        }
        Relationships: []
      }
      sops: {
        Row: {
          category: string
          content: string | null
          created_at: string
          description: string | null
          drive_url: string | null
          id: string
          public_slug: string | null
          subcategory: string | null
          title: string
          updated_at: string
          visible_to: string | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          description?: string | null
          drive_url?: string | null
          id?: string
          public_slug?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string
          visible_to?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          description?: string | null
          drive_url?: string | null
          id?: string
          public_slug?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string
          visible_to?: string | null
        }
        Relationships: []
      }
      task_notification_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient_name: string | null
          status: string
          tasks_sent: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_name?: string | null
          status?: string
          tasks_sent?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_name?: string | null
          status?: string
          tasks_sent?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notification_preferences: {
        Row: {
          created_at: string
          daily_enabled: boolean
          id: string
          telegram_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_enabled?: boolean
          id?: string
          telegram_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_enabled?: boolean
          id?: string
          telegram_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          day_of_week: number | null
          deadline: string | null
          id: string
          is_permanent: boolean
          is_weekly: boolean
          model_id: string | null
          notes: string | null
          status: string | null
          task_type: string | null
          telegram_message_id: string | null
          title: string
          weekly_done_at: string | null
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          day_of_week?: number | null
          deadline?: string | null
          id?: string
          is_permanent?: boolean
          is_weekly?: boolean
          model_id?: string | null
          notes?: string | null
          status?: string | null
          task_type?: string | null
          telegram_message_id?: string | null
          title: string
          weekly_done_at?: string | null
        }
        Update: {
          assignee?: string | null
          created_at?: string
          day_of_week?: number | null
          deadline?: string | null
          id?: string
          is_permanent?: boolean
          is_weekly?: boolean
          model_id?: string | null
          notes?: string | null
          status?: string | null
          task_type?: string | null
          telegram_message_id?: string | null
          title?: string
          weekly_done_at?: string | null
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
          invite_email: string | null
          invited_at: string | null
          is_archived: boolean
          name: string
          profile_id: string | null
          responsibilities: string | null
          role_label: string | null
          telegram_handle: string | null
          telegram_user_id: number | null
          weekly_tasks: string | null
        }
        Insert: {
          assignee_name?: string | null
          id?: string
          invite_email?: string | null
          invited_at?: string | null
          is_archived?: boolean
          name: string
          profile_id?: string | null
          responsibilities?: string | null
          role_label?: string | null
          telegram_handle?: string | null
          telegram_user_id?: number | null
          weekly_tasks?: string | null
        }
        Update: {
          assignee_name?: string | null
          id?: string
          invite_email?: string | null
          invited_at?: string | null
          is_archived?: boolean
          name?: string
          profile_id?: string | null
          responsibilities?: string | null
          role_label?: string | null
          telegram_handle?: string | null
          telegram_user_id?: number | null
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
      telegram_daily_task_lists: {
        Row: {
          created_at: string
          id: string
          profile_id: string | null
          sent_at: string
          task_ids: string[]
          telegram_user_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id?: string | null
          sent_at?: string
          task_ids?: string[]
          telegram_user_id: number
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string | null
          sent_at?: string
          task_ids?: string[]
          telegram_user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_daily_task_lists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          cron_secret: string | null
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
          cron_secret?: string | null
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
          cron_secret?: string | null
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
      voice_generation_log: {
        Row: {
          created_at: string
          id: string
          model_id: string | null
          text_length: number
          user_id: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          model_id?: string | null
          text_length?: number
          user_id: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string | null
          text_length?: number
          user_id?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      voice_generations: {
        Row: {
          audio_file_path: string | null
          created_at: string
          id: string
          model_id: string | null
          text: string
          user_id: string
          voice_id: string
          voice_name: string | null
        }
        Insert: {
          audio_file_path?: string | null
          created_at?: string
          id?: string
          model_id?: string | null
          text: string
          user_id: string
          voice_id: string
          voice_name?: string | null
        }
        Update: {
          audio_file_path?: string | null
          created_at?: string
          id?: string
          model_id?: string | null
          text?: string
          user_id?: string
          voice_id?: string
          voice_name?: string | null
        }
        Relationships: []
      }
      voice_permissions: {
        Row: {
          can_generate_voice: boolean
          char_limit: number
          created_at: string
          daily_limit: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_generate_voice?: boolean
          char_limit?: number
          created_at?: string
          daily_limit?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_generate_voice?: boolean
          char_limit?: number
          created_at?: string
          daily_limit?: number
          id?: string
          updated_at?: string
          user_id?: string
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
      is_strict_owner: { Args: never; Returns: boolean }
      owner_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "production" | "creative" | "va" | "chatter"
      profile_status: "pending" | "active" | "suspended" | "rejected"
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
      app_role: ["owner", "production", "creative", "va", "chatter"],
      profile_status: ["pending", "active", "suspended", "rejected"],
    },
  },
} as const
