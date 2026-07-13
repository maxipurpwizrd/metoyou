import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mncmricrntxkedhfdavd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_o4hnX8-XN7oraua0o0BVDw_qeLCCdpr';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

function buildAuthClient(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

function buildDataClient() {
  if (supabaseServiceRoleKey) {
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const conversationId = Array.isArray(req.query.conversationId)
      ? req.query.conversationId[0]
      : req.query.conversationId;

    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversationId' });
    }

    const supabase = buildDataClient();
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
    const authClient = buildAuthClient(req);
    const dataClient = buildDataClient();
    const { data: userData, error: userError } = await authClient.auth.getUser();

    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { action, conversationId, userId1, userId2, senderId, text, imageUrl, audioUrl, videoUrl, messageType, userId } = body || {};

    if (action === 'getThreads') {
      const { data: conversations, error: conversationError } = await dataClient
        .from('conversations')
        .select('*')
        .or(`user_1.eq.${userId},user_2.eq.${userId}`);

      if (conversationError) {
        return res.status(500).json({ error: conversationError.message });
      }

      if (!conversations || conversations.length === 0) {
        return res.status(200).json([]);
      }

      const threads: Array<{ otherId: string; otherUsername: string; lastText?: string | null; lastTime?: string }> = [];

      for (const conv of conversations) {
        const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;

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

    if (userData.user.id !== senderId) {
      return res.status(403).json({ error: 'Sender does not match authenticated user' });
    }

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
