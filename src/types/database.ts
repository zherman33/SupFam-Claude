export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          invite_code: string | null
          plan_tier: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          plan_id: string
          is_founding: boolean
          trial_ends_at: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string | null
          plan_tier?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          plan_id?: string
          is_founding?: boolean
          trial_ends_at?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string | null
          plan_tier?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          plan_id?: string
          is_founding?: boolean
          trial_ends_at?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          id: string
          family_id: string | null
          stripe_event_id: string
          event_type: string
          payload: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id?: string | null
          stripe_event_id: string
          event_type: string
          payload?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string | null
          stripe_event_id?: string
          event_type?: string
          payload?: unknown | null
          created_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          id: string
          family_id: string
          user_id: string
          display_name: string
          role: 'admin' | 'member'
          avatar_color: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          display_name: string
          role: 'admin' | 'member'
          avatar_color?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          display_name?: string
          role?: 'admin' | 'member'
          avatar_color?: string | null
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'family_members_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      connected_calendars: {
        Row: {
          id: string
          family_member_id: string
          provider: 'google' | 'outlook' | 'apple' | 'ical'
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          calendar_id: string
          calendar_name: string | null
          color: string | null
          is_visible: boolean
          is_quick_toggle: boolean
          last_synced_at: string | null
          created_at: string
          ics_url: string | null
          account_email: string | null
        }
        Insert: {
          id?: string
          family_member_id: string
          provider: 'google' | 'outlook' | 'apple' | 'ical'
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id: string
          calendar_name?: string | null
          color?: string | null
          is_visible?: boolean
          is_quick_toggle?: boolean
          last_synced_at?: string | null
          created_at?: string
          ics_url?: string | null
          account_email?: string | null
        }
        Update: {
          id?: string
          family_member_id?: string
          provider?: 'google' | 'outlook' | 'apple' | 'ical'
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id?: string
          calendar_name?: string | null
          color?: string | null
          is_visible?: boolean
          is_quick_toggle?: boolean
          last_synced_at?: string | null
          created_at?: string
          ics_url?: string | null
          account_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'connected_calendars_family_member_id_fkey'
            columns: ['family_member_id']
            isOneToOne: false
            referencedRelation: 'family_members'
            referencedColumns: ['id']
          },
        ]
      }
      calendar_events: {
        Row: {
          id: string
          family_id: string
          source_calendar_id: string | null
          external_event_id: string | null
          title: string
          description: string | null
          location: string | null
          start_at: string
          end_at: string
          all_day: boolean
          color: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          source_calendar_id?: string | null
          external_event_id?: string | null
          title: string
          description?: string | null
          location?: string | null
          start_at: string
          end_at: string
          all_day?: boolean
          color?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          source_calendar_id?: string | null
          external_event_id?: string | null
          title?: string
          description?: string | null
          location?: string | null
          start_at?: string
          end_at?: string
          all_day?: boolean
          color?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calendar_events_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          family_id: string
          assigned_to: string | null
          title: string
          notes: string | null
          due_date: string | null
          is_complete: boolean
          is_recurring: boolean
          recurrence_rule: string | null
          created_by: string
          created_at: string
          google_task_id: string | null
          google_tasklist_id: string | null
          position: number | null
        }
        Insert: {
          id?: string
          family_id: string
          assigned_to?: string | null
          title: string
          notes?: string | null
          due_date?: string | null
          is_complete?: boolean
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_by: string
          created_at?: string
          google_task_id?: string | null
          google_tasklist_id?: string | null
          position?: number | null
        }
        Update: {
          id?: string
          family_id?: string
          assigned_to?: string | null
          title?: string
          notes?: string | null
          due_date?: string | null
          is_complete?: boolean
          is_recurring?: boolean
          recurrence_rule?: string | null
          created_by?: string
          created_at?: string
          google_task_id?: string | null
          google_tasklist_id?: string | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      grocery_items: {
        Row: {
          id: string
          family_id: string
          title: string
          category: string | null
          is_checked: boolean
          added_by: string | null
          source: string
          meal_plan_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          title: string
          category?: string | null
          is_checked?: boolean
          added_by?: string | null
          source?: string
          meal_plan_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          title?: string
          category?: string | null
          is_checked?: boolean
          added_by?: string | null
          source?: string
          meal_plan_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grocery_items_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grocery_items_meal_plan_id_fkey'
            columns: ['meal_plan_id']
            isOneToOne: false
            referencedRelation: 'meal_plans'
            referencedColumns: ['id']
          },
        ]
      }
      meal_plans: {
        Row: {
          id: string
          family_id: string
          week_start: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          week_start: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          week_start?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meal_plans_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
      meals: {
        Row: {
          id: string
          meal_plan_id: string
          day_index: number
          slot: string
          title: string
          notes: string | null
          recipe_url: string | null
          servings: number
          created_at: string
        }
        Insert: {
          id?: string
          meal_plan_id: string
          day_index: number
          slot?: string
          title: string
          notes?: string | null
          recipe_url?: string | null
          servings?: number
          created_at?: string
        }
        Update: {
          id?: string
          meal_plan_id?: string
          day_index?: number
          slot?: string
          title?: string
          notes?: string | null
          recipe_url?: string | null
          servings?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meals_meal_plan_id_fkey'
            columns: ['meal_plan_id']
            isOneToOne: false
            referencedRelation: 'meal_plans'
            referencedColumns: ['id']
          },
        ]
      }
      meal_ingredients: {
        Row: {
          id: string
          meal_id: string
          name: string
          quantity: number | null
          unit: string | null
          category: string | null
          position: number
        }
        Insert: {
          id?: string
          meal_id: string
          name: string
          quantity?: number | null
          unit?: string | null
          category?: string | null
          position?: number
        }
        Update: {
          id?: string
          meal_id?: string
          name?: string
          quantity?: number | null
          unit?: string | null
          category?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'meal_ingredients_meal_id_fkey'
            columns: ['meal_id']
            isOneToOne: false
            referencedRelation: 'meals'
            referencedColumns: ['id']
          },
        ]
      }
      notes: {
        Row: {
          id: string
          family_id: string
          title: string | null
          content: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          title?: string | null
          content: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          title?: string | null
          content?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notes_family_id_fkey'
            columns: ['family_id']
            isOneToOne: false
            referencedRelation: 'families'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
