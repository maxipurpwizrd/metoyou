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
    const {
      conversationId,
      calleeId,
      callType,
      offer,
      expiresAt,
    } = body ?? {};

    if (!conversationId || !calleeId || !callType || !offer || !expiresAt) {
      return res.status(400).json({ error: 'Missing required call invitation data' });
    }

    if (typeof callType !== 'string' || !['audio', 'video'].includes(callType)) {
      return res.status(400).json({ error: 'Invalid call type' });
    }

    const { data: conversation, error: conversationError } = await client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
      .maybeSingle();

    if (conversationError) return res.status(500).json({ error: conversationError.message });
    if (!conversation) return res.status(403).json({ error: 'Conversation access denied' });

    const recipientIsParticipant = await client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`user_1.eq.${calleeId},user_2.eq.${calleeId}`)
      .maybeSingle();

    if (recipientIsParticipant.error) return res.status(500).json({ error: recipientIsParticipant.error.message });
    if (!recipientIsParticipant.data) return res.status(403).json({ error: 'Recipient is not a participant in the conversation' });

    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'The invitation expiry is invalid' });
    }

    const { data: invite, error: inviteError } = await client
      .from('call_invites')
      .insert({
        conversation_id: conversationId,
        caller_id: user.id,
        callee_id: calleeId,
        call_type: callType,
        status: 'ringing',
        initial_offer: offer,
        expires_at: expiresAtDate.toISOString(),
      })
      .select('*')
      .single();

    if (inviteError) {
      return res.status(500).json({ error: inviteError.message });
    }

    return res.status(200).json({
      ok: true,
      invitation: {
        id: invite.id,
        status: invite.status,
        expiresAt: invite.expires_at,
      },
    });
  } catch (error) {
    console.error('call-invite error', error);
    return res.status(500).json({ error: 'Unable to create call invitation' });
  }
}
