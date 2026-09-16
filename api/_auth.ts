import type { VercelRequest } from '@vercel/node';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mncmricrntxkedhfdavd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_o4hnX8-XN7oraua0o0BVDw_qeLCCdpr';

export function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getAuthenticatedUser(req: VercelRequest): Promise<{ user: User | null; client: ReturnType<typeof createClient> }> {
  const token = getBearerToken(req);
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

  if (!token) return { user: null, client };
  const { data, error } = await client.auth.getUser(token);
  return { user: error ? null : data.user ?? null, client };
}
