import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.117.3';

export type AdminClient = SupabaseClient;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export type AuthContext = {
  user: User;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
  accessToken: string;
};

export async function authenticateUser(request: Request): Promise<AuthContext | Response> {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(401, { error: 'Authentication required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(503, { error: 'Native call backend is not configured' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser(accessToken);
  if (error || !user) return jsonResponse(401, { error: 'Authentication required' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user, userClient, adminClient, accessToken };
}

export async function authenticateServiceRole(request: Request): Promise<AdminClient | Response> {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(401, { error: 'Service authentication required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(503, { error: 'Native call backend is not configured' });
  }

  const verifier = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getClaims(accessToken);
  if (error || data?.claims?.role !== 'service_role') {
    return jsonResponse(401, { error: 'Service authentication required' });
  }
  return verifier;
}

export function isResponse(value: AuthContext | AdminClient | Response): value is Response {
  return value instanceof Response;
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string'
    && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
