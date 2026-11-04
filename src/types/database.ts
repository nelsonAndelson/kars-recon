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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          vehicle_id: string | null
          what: string
          when: string
          who: string | null
        }
        Insert: {
          vehicle_id?: string | null
          what: string
          when?: string
          who?: string | null
        }
        Update: {
          vehicle_id?: string | null
          what?: string
          when?: string
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_who_fkey"
            columns: ["who"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          checklist: Json
          done_at: string
          done_by: string | null
          keys_count: number
          photos: string[]
          vehicle_id: string
        }
        Insert: {
          checklist?: Json
          done_at?: string
          done_by?: string | null
          keys_count?: number
          photos?: string[]
          vehicle_id: string
        }
        Update: {
          checklist?: Json
          done_at?: string
          done_by?: string | null
          keys_count?: number
          photos?: string[]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          book_hours: number
          category: Database["public"]["Enums"]["job_category"]
          completed_at: string | null
          id: string
          is_comeback: boolean
          notes: string | null
          original_job_id: string | null
          pay_week_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          tech_id: string | null
          title: string
          vehicle_id: string
        }
        Insert: {
          book_hours?: number
          category?: Database["public"]["Enums"]["job_category"]
          completed_at?: string | null
          id?: string
          is_comeback?: boolean
          notes?: string | null
          original_job_id?: string | null
          pay_week_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tech_id?: string | null
          title: string
          vehicle_id: string
        }
        Update: {
          book_hours?: number
          category?: Database["public"]["Enums"]["job_category"]
          completed_at?: string | null
          id?: string
          is_comeback?: boolean
          notes?: string | null
          original_job_id?: string | null
          pay_week_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tech_id?: string | null
          title?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_original_job_id_fkey"
            columns: ["original_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_pay_week_id_fkey"
            columns: ["pay_week_id"]
            isOneToOne: false
            referencedRelation: "pay_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          core_charge_cents: number
          core_due_date: string | null
          core_refund_cents: number
          core_returned_at: string | null
          id: string
          installed_at: string | null
          job_id: string | null
          name: string
          ordered_at: string | null
          ordered_by: string | null
          part_number: string | null
          qty: number
          receipt_photo: string | null
          received_at: string | null
          refund_cents: number
          return_due_date: string | null
          returned_at: string | null
          status: Database["public"]["Enums"]["part_status"]
          unit_cost_cents: number
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          core_charge_cents?: number
          core_due_date?: string | null
          core_refund_cents?: number
          core_returned_at?: string | null
          id?: string
          installed_at?: string | null
          job_id?: string | null
          name: string
          ordered_at?: string | null
          ordered_by?: string | null
          part_number?: string | null
          qty?: number
          receipt_photo?: string | null
          received_at?: string | null
          refund_cents?: number
          return_due_date?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["part_status"]
          unit_cost_cents?: number
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          core_charge_cents?: number
          core_due_date?: string | null
          core_refund_cents?: number
          core_returned_at?: string | null
          id?: string
          installed_at?: string | null
          job_id?: string | null
          name?: string
          ordered_at?: string | null
          ordered_by?: string | null
          part_number?: string | null
          qty?: number
          receipt_photo?: string | null
          received_at?: string | null
          refund_cents?: number
          return_due_date?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["part_status"]
          unit_cost_cents?: number
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_job_id_vehicle_id_fkey"
            columns: ["job_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "parts_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_weeks: {
        Row: {
          id: string
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          week_start: string
        }
        Insert: {
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          week_start: string
        }
        Update: {
          id?: string
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_weeks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          full_name: string
          id: string
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          active?: boolean
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          active?: boolean
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Relationships: []
      }
      settings: {
        Row: {
          budget_warning_pct: number
          default_recon_budget_cents: number
          stage_target_days: Json
          total_target_days: number
        }
        Insert: {
          budget_warning_pct?: number
          default_recon_budget_cents?: number
          stage_target_days?: Json
          total_target_days?: number
        }
        Update: {
          budget_warning_pct?: number
          default_recon_budget_cents?: number
          stage_target_days?: Json
          total_target_days?: number
        }
        Relationships: []
      }
      stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["vehicle_stage"] | null
          to_stage: Database["public"]["Enums"]["vehicle_stage"]
          vehicle_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["vehicle_stage"] | null
          to_stage: Database["public"]["Enums"]["vehicle_stage"]
          vehicle_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["vehicle_stage"] | null
          to_stage?: Database["public"]["Enums"]["vehicle_stage"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sublets: {
        Row: {
          cost_cents: number
          description: string
          returned_at: string | null
          sent_at: string | null
          vehicle_id: string
          vendor: string
        }
        Insert: {
          cost_cents: number
          description: string
          returned_at?: string | null
          sent_at?: string | null
          vehicle_id: string
          vendor: string
        }
        Update: {
          cost_cents?: number
          description?: string
          returned_at?: string | null
          sent_at?: string | null
          vehicle_id?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "sublets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_pay_rates: {
        Row: {
          created_by: string | null
          effective_from: string
          rate_cents_per_hour: number
          tech_id: string
        }
        Insert: {
          created_by?: string | null
          effective_from: string
          rate_cents_per_hour: number
          tech_id: string
        }
        Update: {
          created_by?: string | null
          effective_from?: string
          rate_cents_per_hour?: number
          tech_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_pay_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_pay_rates_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          blocker: Database["public"]["Enums"]["vehicle_blocker"] | null
          blocker_note: string | null
          color: string | null
          created_at: string
          id: string
          make: string
          miles_in: number | null
          model: string
          purchase_date: string
          recon_budget_cents: number
          source: Database["public"]["Enums"]["vehicle_source"]
          stage: Database["public"]["Enums"]["vehicle_stage"]
          stage_entered_at: string
          status: Database["public"]["Enums"]["vehicle_status"]
          stock_number: string
          trim: string | null
          vin: string | null
          year: number
        }
        Insert: {
          blocker?: Database["public"]["Enums"]["vehicle_blocker"] | null
          blocker_note?: string | null
          color?: string | null
          created_at?: string
          id?: string
          make: string
          miles_in?: number | null
          model: string
          purchase_date: string
          recon_budget_cents: number
          source?: Database["public"]["Enums"]["vehicle_source"]
          stage?: Database["public"]["Enums"]["vehicle_stage"]
          stage_entered_at?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number: string
          trim?: string | null
          vin?: string | null
          year: number
        }
        Update: {
          blocker?: Database["public"]["Enums"]["vehicle_blocker"] | null
          blocker_note?: string | null
          color?: string | null
          created_at?: string
          id?: string
          make?: string
          miles_in?: number | null
          model?: string
          purchase_date?: string
          recon_budget_cents?: number
          source?: Database["public"]["Enums"]["vehicle_source"]
          stage?: Database["public"]["Enums"]["vehicle_stage"]
          stage_entered_at?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          stock_number?: string
          trim?: string | null
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_category:
        | "mechanical"
        | "electrical"
        | "body"
        | "tires"
        | "brakes"
        | "detail"
        | "other"
      job_status:
        | "pending"
        | "needs_approval"
        | "approved"
        | "in_progress"
        | "done"
        | "cancelled"
      part_status:
        | "needed"
        | "ordered"
        | "received"
        | "installed"
        | "return_pending"
        | "returned"
      profile_role: "owner" | "tech" | "advisor" | "viewer"
      vehicle_blocker:
        | "waiting_parts"
        | "waiting_approval"
        | "waiting_diagnosis"
        | "at_sublet"
        | "no_tech_available"
        | "other"
      vehicle_source: "ACV" | "Manheim" | "Skipco" | "Akron Auto" | "other"
      vehicle_stage:
        | "purchased"
        | "in_transit"
        | "check_in"
        | "diagnosis"
        | "repair"
        | "qc"
        | "detail"
        | "photos"
        | "frontline"
        | "sold"
      vehicle_status: "active" | "sold" | "wholesaled"
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
  public: {
    Enums: {
      job_category: [
        "mechanical",
        "electrical",
        "body",
        "tires",
        "brakes",
        "detail",
        "other",
      ],
      job_status: [
        "pending",
        "needs_approval",
        "approved",
        "in_progress",
        "done",
        "cancelled",
      ],
      part_status: [
        "needed",
        "ordered",
        "received",
        "installed",
        "return_pending",
        "returned",
      ],
      profile_role: ["owner", "tech", "advisor", "viewer"],
      vehicle_blocker: [
        "waiting_parts",
        "waiting_approval",
        "waiting_diagnosis",
        "at_sublet",
        "no_tech_available",
        "other",
      ],
      vehicle_source: ["ACV", "Manheim", "Skipco", "Akron Auto", "other"],
      vehicle_stage: [
        "purchased",
        "in_transit",
        "check_in",
        "diagnosis",
        "repair",
        "qc",
        "detail",
        "photos",
        "frontline",
        "sold",
      ],
      vehicle_status: ["active", "sold", "wholesaled"],
    },
  },
} as const

