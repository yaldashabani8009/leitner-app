// Generated from Supabase project lkyqktrpwhzsfkgaqiuo. Do not edit by hand.
// Regenerate after every migration (Supabase MCP: generate_typescript_types).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      card_entries: {
        Row: {
          card_id: string;
          deleted_at: string | null;
          id: string;
          kind: Database['public']['Enums']['entry_kind'];
          position: number;
          text: string;
          updated_at: string;
          user_id: string;
          server_updated_at: string;
        };
        Insert: {
          card_id: string;
          deleted_at?: string | null;
          id: string;
          kind: Database['public']['Enums']['entry_kind'];
          position?: number;
          text: string;
          updated_at?: string;
          user_id?: string;
          server_updated_at?: string;
        };
        Update: {
          card_id?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['entry_kind'];
          position?: number;
          text?: string;
          updated_at?: string;
          user_id?: string;
          server_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'card_entries_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'cards';
            referencedColumns: ['id'];
          },
        ];
      };
      cards: {
        Row: {
          box: number;
          created_at: string;
          deleted_at: string | null;
          due_date: string;
          id: string;
          mastered_at: string | null;
          updated_at: string;
          user_id: string;
          word: string;
          server_updated_at: string;
        };
        Insert: {
          box?: number;
          created_at?: string;
          deleted_at?: string | null;
          due_date: string;
          id: string;
          mastered_at?: string | null;
          updated_at?: string;
          user_id?: string;
          word: string;
          server_updated_at?: string;
        };
        Update: {
          box?: number;
          created_at?: string;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          mastered_at?: string | null;
          updated_at?: string;
          user_id?: string;
          word?: string;
          server_updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          time_zone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      review_logs: {
        Row: {
          box_after: number | null;
          box_before: number;
          card_id: string;
          correct: boolean;
          created_at: string;
          id: string;
          is_practice: boolean;
          reviewed_at: string;
          user_id: string;
          server_updated_at: string;
        };
        Insert: {
          box_after?: number | null;
          box_before: number;
          card_id: string;
          correct: boolean;
          created_at?: string;
          id: string;
          is_practice?: boolean;
          reviewed_at: string;
          user_id?: string;
          server_updated_at?: string;
        };
        Update: {
          box_after?: number | null;
          box_before?: number;
          card_id?: string;
          correct?: boolean;
          created_at?: string;
          id?: string;
          is_practice?: boolean;
          reviewed_at?: string;
          user_id?: string;
          server_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'review_logs_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'cards';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      entry_kind: 'synonym' | 'meaning' | 'sentence';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export const Constants = {
  public: {
    Enums: {
      entry_kind: ['synonym', 'meaning', 'sentence'],
    },
  },
} as const;
