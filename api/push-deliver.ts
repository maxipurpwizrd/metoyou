import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user, client } = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { inviteId } = body ?? {};
    if (!inviteId) return res.status(400).json({ error: 'Missing inviteId' });

    const { data: invite, error: inviteError } = await client
      .from('call_invites')
      .select('*')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError) return res.status(500).json({ error: inviteError.message });
    if (!invite) return res.status(404).json({ error: 'Invitation not found' });
    if (invite.caller_id !== user.id) return res.status(403).json({ error: 'Caller mismatch' });
    if (invite.status !== 'ringing') return res.status(409).json({ error: 'Invitation is no longer active' });

    const { data: deviceTokens, error: deviceError } = await client
      .from('device_registrations')
      .select('device_token, platform, user_id')
      .eq('user_id', invite.callee_id);

    if (deviceError) return res.status(500).json({ error: deviceError.message });

    const expoTokenList = (deviceTokens ?? [])
      .map((device) => device.device_token)
      .filter(Boolean)
      .slice(0, 100);

    if (!expoTokenList.length) {
      return res.status(200).json({ ok: true, delivered: 0, reason: 'no_registered_devices' });
    }

    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN ?? process.env.EXPO_PUSH_TOKEN;
    if (!expoAccessToken) {
      return res.status(503).json({ error: 'Expo push credentials are not configured for this deployment' });
    }

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify({
        to: expoTokenList,
        sound: 'default',
        title: 'Incoming call',
        body: 'Someone is calling you on MeToYou.',
        data: {
          route: 'call-invite',
          inviteId: invite.id,
          callType: invite.call_type,
          senderId: invite.caller_id,
          conversationId: invite.conversation_id,
        },
      }),
    });

    const pushJson = await pushResponse.json().catch(() => ({}));
    if (!pushResponse.ok) {
      return res.status(502).json({ error: 'Push dispatch failed', details: pushJson });
    }

    return res.status(200).json({ ok: true, delivered: expoTokenList.length, result: pushJson });
  } catch (error) {
    console.error('push-deliver error', error);
    return res.status(500).json({ error: 'Unable to dispatch call invitation notification' });
  }
}
