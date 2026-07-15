import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1R8oU3K7sUqJRKZ4OQjY0p6J';
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: email || undefined,
      metadata: { userId },
      success_url: `${SITE_URL}/vibes-pro/success`,
      cancel_url: `${SITE_URL}/settings?checkout=cancel`,
      payment_method_collection: 'if_required',
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('checkout error', error);
    return res.status(500).json({ error: 'Unable to create checkout session' });
  }
}
