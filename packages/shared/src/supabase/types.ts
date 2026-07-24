/**
 * Supabase database types
 * TODO: Generate this file from Supabase CLI
 * Run: supabase gen types typescript --linked > packages/shared/src/supabase/types.ts
 */

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          current_tier: 'Apprentice' | 'Adept' | 'Maestro';
          total_xp: number;
          level: number;
          streak_count: number;
          last_active_date: string | null;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      saved_charts: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          is_primary: boolean;
          birth_date: string;
          birth_time: string | null;
          time_known: boolean;
          place_name: string;
          lat: number;
          lon: number;
          iana_timezone: string;
          utc_datetime: string;
          tz_confidence: 'high' | 'medium' | 'low' | null;
          chart_data: Record<string, any>;
          chart_data_version: string;
          house_system: 'Placidus' | 'WholeSign' | 'none';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['saved_charts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['saved_charts']['Insert']>;
      };
      synthesis: {
        Row: {
          id: string;
          user_id: string | null;
          chart_id: string | null;
          synthesis_type: 'natal_overview' | 'placement' | 'transit' | 'synastry';
          placement_key: string | null;
          content: string;
          quality_rating: number | null;
          bookmarked: boolean;
          llm_model: string | null;
          generated_at: string;
          cache_expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['synthesis']['Row'], 'id' | 'generated_at'>;
        Update: Partial<Database['public']['Tables']['synthesis']['Insert']>;
      };
      entitlements: {
        Row: {
          id: string;
          user_id: string;
          tier: 'Free' | 'Interpret' | 'Calendar';
          source: 'stripe' | 'revenuecat_ios' | 'revenuecat_android';
          external_id: string | null;
          status: 'active' | 'canceled' | 'past_due' | 'expired';
          period_start: string | null;
          period_end: string | null;
          will_renew: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['entitlements']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['entitlements']['Insert']>;
      };
      learning_modules: {
        Row: {
          id: string;
          section: 'foundations' | 'planets' | 'signs' | 'houses' | 'aspects' | 'transits';
          title: string;
          description: string | null;
          order_index: number;
          xp_reward: number;
          content_path: string | null;
          quiz_data: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['learning_modules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['learning_modules']['Insert']>;
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          module_id: string;
          completed: boolean;
          quiz_score: number | null;
          xp_earned: number;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['user_progress']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['user_progress']['Insert']>;
      };
    };
    Functions: {
      calculate_tier_from_xp: {
        Args: { xp: number };
        Returns: string;
      };
    };
  };
}
