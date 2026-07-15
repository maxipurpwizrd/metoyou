export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          bio: string | null;
          email: string | null;
          profile_pic: string | null;
          date_of_birth: string | null;
          gender: string | null;
          vibes_pro: boolean | null;
          vibes_pro_portrait: string | null;
          vibes_pro_until: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          interests: Json | null;
          language: string | null;
          hommies_count: number | null;
          snapshots_count: number | null;
          vibes_count: number | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          bio?: string | null;
          email?: string | null;
          profile_pic?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          vibes_pro?: boolean | null;
          vibes_pro_portrait?: string | null;
          vibes_pro_until?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          interests?: Json | null;
          language?: string | null;
          hommies_count?: number | null;
          snapshots_count?: number | null;
          vibes_count?: number | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          bio?: string | null;
          email?: string | null;
          profile_pic?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          vibes_pro?: boolean | null;
          vibes_pro_portrait?: string | null;
          vibes_pro_until?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          interests?: Json | null;
          language?: string | null;
          hommies_count?: number | null;
          snapshots_count?: number | null;
          vibes_count?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
