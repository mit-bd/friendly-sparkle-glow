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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      budget_alerts: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          level: string
          period_start: string
          used_amount: number
          utilization: number
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          level: string
          period_start: string
          used_amount?: number
          utilization?: number
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          level?: string
          period_start?: string
          used_amount?: number
          utilization?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          budget_number: string
          budget_type: string
          category_id: string | null
          created_at: string
          created_by: string | null
          critical_threshold: number
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          period_end: string
          period_start: string
          restored_at: string | null
          restored_by: string | null
          subcategory_id: string | null
          target_type: string
          updated_at: string
          updated_by: string | null
          warning_threshold: number
        }
        Insert: {
          amount?: number
          budget_number?: string
          budget_type?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          restored_at?: string | null
          restored_by?: string | null
          subcategory_id?: string | null
          target_type?: string
          updated_at?: string
          updated_by?: string | null
          warning_threshold?: number
        }
        Update: {
          amount?: number
          budget_number?: string
          budget_type?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          restored_at?: string | null
          restored_by?: string | null
          subcategory_id?: string | null
          target_type?: string
          updated_at?: string
          updated_by?: string | null
          warning_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "expense_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile: {
        Row: {
          address: string | null
          bin_number: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          facebook: string | null
          id: string
          logo_url: string | null
          mobile: string | null
          name: string
          tin_number: string | null
          trade_license: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bin_number?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          logo_url?: string | null
          mobile?: string | null
          name?: string
          tin_number?: string | null
          trade_license?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bin_number?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          logo_url?: string | null
          mobile?: string | null
          name?: string
          tin_number?: string | null
          trade_license?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          symbol: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          symbol?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          symbol?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      damage_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          damage_id: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          damage_id: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          damage_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_attachments_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      damage_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          damage_id: string
          from_status: Database["public"]["Enums"]["expense_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["expense_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          damage_id: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          damage_id?: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_events_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_types: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      damages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          damage_date: string
          damage_number: string
          damage_value: number
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          product_name: string
          quantity: number
          rejected_at: string | null
          rejected_by: string | null
          restored_at: string | null
          restored_by: string | null
          status: Database["public"]["Enums"]["expense_status"]
          submitted_at: string | null
          submitted_by: string | null
          type_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          damage_date?: string
          damage_number: string
          damage_value?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          quantity?: number
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          damage_date?: string
          damage_number?: string
          damage_value?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          quantity?: number
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damages_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "damage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          expense_id: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expense_id: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expense_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          restored_at: string | null
          restored_by: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          restored_at?: string | null
          restored_by?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restored_at?: string | null
          restored_by?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      expense_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          expense_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          expense_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          expense_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_comments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      expense_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          expense_id: string
          from_status: Database["public"]["Enums"]["expense_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["expense_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          expense_id: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          expense_id?: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          restored_at: string | null
          restored_by: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          restored_at?: string | null
          restored_by?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restored_at?: string | null
          restored_by?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          campaign_name: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          exchange_rate: number
          expense_date: string
          expense_number: string
          fc_paid_amount: number
          fc_settlement_status: string | null
          fixed_cost_template_id: string | null
          id: string
          is_fixed_cost: boolean
          is_marketing: boolean
          notes: string | null
          original_amount: number | null
          period_month: string | null
          platform_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          restored_at: string | null
          restored_by: string | null
          status: Database["public"]["Enums"]["expense_status"]
          subcategory_id: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          campaign_name?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          expense_number: string
          fc_paid_amount?: number
          fc_settlement_status?: string | null
          fixed_cost_template_id?: string | null
          id?: string
          is_fixed_cost?: boolean
          is_marketing?: boolean
          notes?: string | null
          original_amount?: number | null
          period_month?: string | null
          platform_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          campaign_name?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          expense_number?: string
          fc_paid_amount?: number
          fc_settlement_status?: string | null
          fixed_cost_template_id?: string | null
          id?: string
          is_fixed_cost?: boolean
          is_marketing?: boolean
          notes?: string | null
          original_amount?: number | null
          period_month?: string | null
          platform_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_fixed_cost_template_id_fkey"
            columns: ["fixed_cost_template_id"]
            isOneToOne: false
            referencedRelation: "fixed_cost_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "marketing_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "expense_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      field_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_label: string | null
          entity_type: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_label?: string | null
          entity_type: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      fixed_cost_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          expense_id: string
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          notes: string | null
          payment_date: string
          reference_number: string | null
          size_bytes: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          expense_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payment_date?: string
          reference_number?: string | null
          size_bytes?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          expense_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payment_date?: string
          reference_number?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_cost_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_cost_templates: {
        Row: {
          auto_generate: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          effective_from: string
          id: string
          is_active: boolean
          monthly_amount: number
          name: string
          notes: string | null
          subcategory_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_generate?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          name: string
          notes?: string | null
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_generate?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          name?: string
          notes?: string | null
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_cost_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_cost_templates_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "expense_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_platforms: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          channel: string
          enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          damage_id: string | null
          expense_id: string | null
          id: string
          payable_id: string | null
          read_at: string | null
          receivable_id: string | null
          return_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          damage_id?: string | null
          expense_id?: string | null
          id?: string
          payable_id?: string | null
          read_at?: string | null
          receivable_id?: string | null
          return_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          damage_id?: string | null
          expense_id?: string | null
          id?: string
          payable_id?: string | null
          read_at?: string | null
          receivable_id?: string | null
          return_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "damages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          payable_id: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          payable_id: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          payable_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_attachments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      payable_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          payable_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          payable_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          payable_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_events_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          notes: string | null
          payable_id: string
          payment_date: string
          size_bytes: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payable_id: string
          payment_date?: string
          size_bytes?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          payable_id?: string
          payment_date?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_amount: number | null
          due_date: string | null
          email: string | null
          id: string
          mobile: string | null
          notes: string | null
          paid_amount: number
          party_name: string
          party_type: string
          payable_number: string
          reference_number: string | null
          rejected_at: string | null
          rejected_by: string | null
          restored_at: string | null
          restored_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_amount?: number | null
          due_date?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          paid_amount?: number
          party_name: string
          party_type?: string
          payable_number?: string
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_amount?: number | null
          due_date?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          paid_amount?: number
          party_name?: string
          party_type?: string
          payable_number?: string
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qa_checklist_items: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          id: string
          module: string
          notes: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module?: string
          notes?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module?: string
          notes?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      receivable_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          receivable_id: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          receivable_id: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          receivable_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receivable_attachments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_collections: {
        Row: {
          amount: number
          collection_date: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          notes: string | null
          receivable_id: string
          size_bytes: number | null
        }
        Insert: {
          amount: number
          collection_date?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          receivable_id: string
          size_bytes?: number | null
        }
        Update: {
          amount?: number
          collection_date?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          receivable_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receivable_collections_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      receivable_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          receivable_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          receivable_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          receivable_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivable_events_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          collected_amount: number
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_amount: number | null
          due_date: string | null
          email: string | null
          id: string
          mobile: string | null
          notes: string | null
          party_name: string
          party_type: string
          receivable_number: string
          reference_number: string | null
          rejected_at: string | null
          rejected_by: string | null
          restored_at: string | null
          restored_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          collected_amount?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_amount?: number | null
          due_date?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          party_name: string
          party_type?: string
          receivable_number?: string
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          collected_amount?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_amount?: number | null
          due_date?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          party_name?: string
          party_type?: string
          receivable_number?: string
          reference_number?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      report_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          created_at: string
          expense_count: number
          filters: Json
          generated_by: string | null
          id: string
          range_from: string | null
          range_to: string | null
          report_number: string
          report_type: string
          title: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          expense_count?: number
          filters?: Json
          generated_by?: string | null
          id?: string
          range_from?: string | null
          range_to?: string | null
          report_number: string
          report_type: string
          title: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          expense_count?: number
          filters?: Json
          generated_by?: string | null
          id?: string
          range_from?: string | null
          range_to?: string | null
          report_number?: string
          report_type?: string
          title?: string
          total_amount?: number
        }
        Relationships: []
      }
      return_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          return_id: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          return_id: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          return_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "return_attachments_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
        }
        Relationships: []
      }
      return_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["expense_status"] | null
          id: string
          notes: string | null
          return_id: string
          to_status: Database["public"]["Enums"]["expense_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          return_id: string
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["expense_status"] | null
          id?: string
          notes?: string | null
          return_id?: string
          to_status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "return_events_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_reasons: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          customer_notes: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          loss_amount: number
          net_loss_amount: number | null
          notes: string | null
          product_name: string
          quantity: number
          reason_id: string | null
          recoverable_amount: number
          rejected_at: string | null
          rejected_by: string | null
          restored_at: string | null
          restored_by: string | null
          return_date: string
          return_number: string
          status: Database["public"]["Enums"]["expense_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          loss_amount?: number
          net_loss_amount?: number | null
          notes?: string | null
          product_name?: string
          quantity?: number
          reason_id?: string | null
          recoverable_amount?: number
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          return_date?: string
          return_number: string
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          loss_amount?: number
          net_loss_amount?: number | null
          notes?: string | null
          product_name?: string
          quantity?: number
          reason_id?: string | null
          recoverable_amount?: number
          rejected_at?: string | null
          rejected_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
          return_date?: string
          return_number?: string
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "return_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_approve: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_approve?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_approve?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      signatories: {
        Row: {
          created_at: string
          created_by: string | null
          designation: string
          full_name: string
          id: string
          signature_url: string | null
          type: Database["public"]["Enums"]["signatory_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          designation?: string
          full_name?: string
          id?: string
          signature_url?: string | null
          type: Database["public"]["Enums"]["signatory_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          designation?: string
          full_name?: string
          id?: string
          signature_url?: string | null
          type?: Database["public"]["Enums"]["signatory_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      budget_generate_alerts: { Args: never; Returns: number }
      budget_used_amount: {
        Args: { b: Database["public"]["Tables"]["budgets"]["Row"] }
        Returns: number
      }
      finance_mark_overdue: { Args: never; Returns: number }
      generate_fixed_costs: { Args: { _month?: string }; Returns: number }
      get_company_branding: {
        Args: never
        Returns: {
          address: string
          description: string
          email: string
          facebook: string
          id: string
          logo_url: string
          mobile: string
          name: string
          website: string
          whatsapp: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      list_directory: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          status: string
        }[]
      }
      log_activity: {
        Args: {
          _action: string
          _entity_id: string
          _entity_label: string
          _entity_type: string
          _metadata: Json
        }
        Returns: undefined
      }
      log_report_export: {
        Args: {
          _expense_count: number
          _filters: Json
          _range_from: string
          _range_to: string
          _report_type: string
          _title: string
          _total_amount: number
        }
        Returns: {
          created_at: string
          expense_count: number
          filters: Json
          generated_by: string | null
          id: string
          range_from: string | null
          range_to: string | null
          report_number: string
          report_type: string
          title: string
          total_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "report_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_budget_number: { Args: never; Returns: string }
      next_damage_number: { Args: never; Returns: string }
      next_expense_number: { Args: never; Returns: string }
      next_payable_number: { Args: never; Returns: string }
      next_receivable_number: { Args: never; Returns: string }
      next_report_number: { Args: never; Returns: string }
      next_return_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager" | "accountant" | "viewer"
      expense_status:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "deleted"
        | "revision_requested"
      signatory_type: "accountant" | "manager" | "ceo"
      user_status: "active" | "inactive"
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
      app_role: ["admin", "manager", "accountant", "viewer"],
      expense_status: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "deleted",
        "revision_requested",
      ],
      signatory_type: ["accountant", "manager", "ceo"],
      user_status: ["active", "inactive"],
    },
  },
} as const
