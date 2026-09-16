import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { subscription } = body || {};

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }

  try {
    const { user, client } = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const payload = {
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys ?? null,
      expiration_time: subscription.expirationTime ?? null,
    } as any;

    const { data, error } = await client.from('push_subscriptions').upsert(payload, { onConflict: ['endpoint'] }).select().single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err: any) {
    console.error('push-subscribe error', err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
