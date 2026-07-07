import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mncmricrntxkedhfdavd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_o4hnX8-XN7oraua0o0BVDw_qeLCCdpr";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});