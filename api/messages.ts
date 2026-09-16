import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const conversationId = Array.isArray(req.query.conversationId)
      ? req.query.conversationId[0]
      : req.query.conversationId;

    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversationId' });
    }

    const { user, client: supabase } = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
      .maybeSingle();
    if (conversationError) return res.status(500).json({ error: conversationError.message });
    if (!conversation) return res.status(403).json({ error: 'Conversation access denied' });

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data ?? []);
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { user, client: dataClient } = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { action, conversationId, userId1, userId2, senderId, text, imageUrl, audioUrl, videoUrl, messageType } = body || {};

    if (action === 'getThreads') {
      const { data: conversations, error: conversationError } = await dataClient
        .from('conversations')
        .select('*')
        .or(`user_1.eq.${user.id},user_2.eq.${user.id}`);

      if (conversationError) {
        return res.status(500).json({ error: conversationError.message });
      }

      if (!conversations || conversations.length === 0) {
        return res.status(200).json([]);
      }

      const threads: Array<{ otherId: string; otherUsername: string; lastText?: string | null; lastTime?: string }> = [];

      for (const conv of conversations) {
        const otherId = conv.user_1 === user.id ? conv.user_2 : conv.user_1;

        const { data: profile } = await dataClient
          .from('profiles')
          .select('username')
          .eq('id', otherId)
          .maybeSingle();

        const { data: lastMessage } = await dataClient
          .from('messages')
          .select('text, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        threads.push({
          otherId,
          otherUsername: profile?.username ?? 'User',
          lastText: lastMessage?.text,
          lastTime: lastMessage?.created_at,
        });
      }

      return res.status(200).json(threads);
    }

    if (action === 'findOrCreateConversation') {
      if (![userId1, userId2].includes(user.id)) {
        return res.status(403).json({ error: 'Conversation participant mismatch' });
      }
      const { data: existing } = await dataClient
        .from('conversations')
        .select('*')
        .or(
          `and(user_1.eq.${userId1},user_2.eq.${userId2}),and(user_1.eq.${userId2},user_2.eq.${userId1})`
        )
        .maybeSingle();

      if (existing) {
        return res.status(200).json(existing);
      }

      const { data, error } = await dataClient
        .from('conversations')
        .insert({ user_1: userId1, user_2: userId2 })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    }

    if (!conversationId || !senderId) {
      return res.status(400).json({ error: 'Missing conversationId or senderId' });
    }

    if (user.id !== senderId) {
      return res.status(403).json({ error: 'Sender does not match authenticated user' });
    }

    const { data: conversation, error: conversationError } = await dataClient
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
      .maybeSingle();
    if (conversationError) return res.status(500).json({ error: conversationError.message });
    if (!conversation) return res.status(403).json({ error: 'Conversation access denied' });

    const { data, error } = await dataClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text: text ?? null,
        image_url: imageUrl ?? null,
        audio_url: audioUrl ?? null,
        video_url: videoUrl ?? null,
        message_type: messageType ?? null,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
