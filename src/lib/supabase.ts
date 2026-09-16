import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mncmricrntxkedhfdavd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_o4hnX8-XN7oraua0o0BVDw_qeLCCdpr";

const tracedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isAuthUserRequest = url.includes("/auth/v1/user");
  const isProfileRequest = url.includes("/rest/v1/profiles");
  const shouldTrace = import.meta.env.DEV && (isAuthUserRequest || isProfileRequest);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

  if (shouldTrace) {
    console.debug("[SupabaseTrace] request start", {
      endpoint: isAuthUserRequest ? "auth/user" : "profiles",
      hasAuthorization: Boolean(headers.get("authorization")),
    });
  }

  const response = await fetch(input, init);

  if (shouldTrace) {
    console.debug("[SupabaseTrace] request end", {
      endpoint: isAuthUserRequest ? "auth/user" : "profiles",
      status: response.status,
    });
  }

  return response;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: tracedFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});