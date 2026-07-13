import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, customerId } = (req.body as { userId?: string; customerId?: string } | undefined) || {};
    if (!userId || !customerId) {
      return res.status(400).json({ error: 'Missing userId or customerId' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/settings?checkout=success`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('customer portal error', error);
    return res.status(500).json({ error: 'Unable to create billing portal session' });
  }
}
