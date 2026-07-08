import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

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

  const sig = req.headers['stripe-signature'];
  const rawBody = req.body;

  if (!sig || !rawBody) {
    return res.status(400).json({ error: 'Missing Stripe signature or payload' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody as Buffer,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (error) {
    console.error('webhook signature verification failed', error);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const customerId = session.customer as string | null;
    const subscriptionId = session.subscription as string | null;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId in session metadata' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('profiles').update({
      vibes_pro: true,
      vibes_pro_until: expiresAt,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    }).eq('id', userId);

    if (error) {
      console.error('profile update failed', error);
      return res.status(500).json({ error: 'Unable to update profile' });
    }
  }

  return res.status(200).json({ received: true });
}
