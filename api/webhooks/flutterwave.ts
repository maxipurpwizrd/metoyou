import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://mncmricrntxkedhfdavd.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;
    if (!rawBody) {
      return res.status(400).json({ error: 'Missing payload' });
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const event = payload?.event || payload?.data?.status;
    const txRef = payload?.data?.tx_ref || payload?.tx_ref;
    const txId = payload?.data?.id || payload?.id;
    const userId = payload?.meta?.userId || payload?.data?.meta?.userId;
    const status = payload?.data?.status || payload?.status;

    if (!txRef || !userId || status !== 'successful') {
      return res.status(200).json({ received: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('profiles').update({
      is_pro: true,
      vibes_pro: true,
      vibes_pro_until: expiresAt,
      flutterwave_tx_id: txId ?? null,
      flutterwave_reference: txRef,
      flutterwave_status: status,
    }).eq('id', userId);

    if (error) {
      console.error('flutterwave webhook update failed', error);
      return res.status(500).json({ error: 'Unable to update profile' });
    }

    return res.status(200).json({ received: true, event });
  } catch (error) {
    console.error('flutterwave webhook error', error);
    return res.status(400).json({ error: 'Invalid Flutterwave webhook payload' });
  }
}
