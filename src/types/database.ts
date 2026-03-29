export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          invite_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string | null
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
          provider: 'google' | 'outlook' | 'apple'
          access_token: string
          refresh_token: string | null
          token_expires_at: string | null
          calendar_id: string
          calendar_name: string | null
          color: string | null
          is_visible: boolean
          last_synced_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_member_id: string
          provider: 'google' | 'outlook' | 'apple'
          access_token: string
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id: string
          calendar_name?: string | null
          color?: string | null
          is_visible?: boolean
          last_synced_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_member_id?: string
          provider?: 'google' | 'outlook' | 'apple'
          access_token?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          calendar_id?: string
          calendar_name?: string | null
          color?: string | null
          is_visible?: boolean
          last_synced_at?: string | null
          created_at?: string
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
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          title: string
          category?: string | null
          is_checked?: boolean
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          title?: string
          category?: string | null
          is_checked?: boolean
          added_by?: string | null
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
