import { supabase } from "./supabase";
import { normalizeTimestamp } from "./time";
import type { Conversation, Message, MessageThread } from "../types/chat";
import { resolveOrCreateConversation } from "./conversationResolver";

export function mergeMessages(messages: Message[]): Message[] {
  const unique = new Map<string, Message>();

  for (const message of messages) {
    const existing = unique.get(message.id);
    if (!existing) {
      unique.set(message.id, message);
      continue;
    }

    const existingTime = new Date(existing.created_at).getTime();
    const candidateTime = new Date(message.created_at).getTime();
    if (Number.isFinite(candidateTime) && candidateTime >= existingTime) {
      unique.set(message.id, message);
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return aTime - bTime;
  });
}

export async function getMessageThreads(userId: string): Promise<MessageThread[]> {
  try {
    const { data: conversations, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (conversationError) throw conversationError;
    if (!conversations || conversations.length === 0) return [];

    const otherUserIds = new Set<string>();
    conversations.forEach((conv) => {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;
      otherUserIds.add(otherId);
    });

    const { data: profiles, error: profileError } = await supabase
      .from("public_profiles")
      .select("id, username")
      .in("id", Array.from(otherUserIds));

    if (profileError) throw profileError;

    const profileMap = new Map<string, { username: string }>();
    (profiles || []).forEach((profile) => {
      profileMap.set(profile.id, { username: profile.username });
    });

    const conversationIds = conversations.map((c) => c.id);
    const { data: allMessages, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, text, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messageError) throw messageError;

    const latestMessageMap = new Map<string, { text?: string; created_at: string }>();
    (allMessages || []).forEach((msg) => {
      if (!latestMessageMap.has(msg.conversation_id)) {
        latestMessageMap.set(msg.conversation_id, {
          text: msg.text,
          created_at: msg.created_at,
        });
      }
    });

    const { data: outgoingMessages, error: outgoingError } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender_id", userId);

    if (outgoingError) throw outgoingError;

    const outgoingConversationIds = new Set<string>();
    (outgoingMessages || []).forEach((msg) => {
      if (msg.conversation_id) {
        outgoingConversationIds.add(msg.conversation_id);
      }
    });

    const uniqueConversations = new Map<string, typeof conversations[number]>();
    for (const conv of conversations) {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;
      if (!uniqueConversations.has(otherId)) {
        uniqueConversations.set(otherId, conv);
      }
    }

    return Array.from(uniqueConversations.values()).map((conv) => {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;
      const profile = profileMap.get(otherId);
      const lastMessage = latestMessageMap.get(conv.id);

      return {
        conversationId: conv.id,
        otherId,
        otherUsername: profile?.username ?? "User",
        lastText: lastMessage?.text,
        lastTime: lastMessage?.created_at,
        hasOutgoingMessages: outgoingConversationIds.has(conv.id),
      };
    });
  } catch (e) {
    console.error("getMessageThreads error", e);
    return [];
  }
}

export async function findOrCreateConversation(
  userId1: string,
  userId2: string
): Promise<Conversation | null> {
  try {
    if (!userId1 || !userId2) {
      return null;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionData?.user?.id) {
      console.error("[messageApi] findOrCreateConversation auth session missing", sessionError);
      return null;
    }

    const currentUserId = sessionData.user.id;
    const targetUserId = userId1 === currentUserId ? userId2 : userId2 === currentUserId ? userId1 : null;
    if (!targetUserId) {
      console.error("[messageApi] findOrCreateConversation auth user is not a participant", { currentUserId, userId1, userId2 });
      return null;
    }

    const row = await resolveOrCreateConversation(targetUserId);
    return row as Conversation | null;
  } catch (e) {
    console.error("findOrCreateConversation error", e);
    return null;
  }
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error("fetchMessages conversation check failed", convError);
      throw convError;
    }

    if (!conversation) {
      console.warn("fetchMessages: conversation not found", conversationId);
      return [];
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error && error.code === "42501") {
      console.error("[messageApi] fetchMessages RLS violation", { conversationId, error });
    }

    if (error) {
      console.error("fetchMessages query failed", error);
      throw error;
    }

    return mergeMessages(data ?? []);
  } catch (e) {
    console.error("fetchMessages error", e);
    return [];
  }
}

export async function fetchMessagesPage(
  conversationId: string,
  beforeCreatedAt?: string,
  limit = 30
): Promise<Message[]> {
  try {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error("fetchMessagesPage conversation check failed", convError);
      throw convError;
    }

    if (!conversation) {
      console.warn("fetchMessagesPage: conversation not found", conversationId);
      return [];
    }

    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId);

    if (beforeCreatedAt) {
      query = query.lt("created_at", beforeCreatedAt);
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("fetchMessagesPage query failed", error);
      throw error;
    }

    return mergeMessages(data ?? []);
  } catch (e) {
    console.error("fetchMessagesPage error", e);
    return [];
  }
}

type SendMessageParams = {
  conversationId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  replyToId?: string | null;
  replyToText?: string | null;
};

export async function sendMessage({
  conversationId,
  senderId,
  text,
  imageUrl,
  audioUrl,
  videoUrl,
  messageType,
  metadata,
  replyToId,
  replyToText,
}: SendMessageParams): Promise<Message | null> {
  try {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("user_1, user_2")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) throw convError;
    if (!conversation) {
      console.error("sendMessage: conversation not found", conversationId);
      return null;
    }

    const isParticipant = conversation.user_1 === senderId || conversation.user_2 === senderId;
    if (!isParticipant) {
      console.error("sendMessage: sender not a participant in conversation");
      return null;
    }

    const basePayload: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: senderId,
      text: text ?? null,
      image_url: imageUrl ?? null,
      audio_url: audioUrl ?? null,
      video_url: videoUrl ?? null,
    };

    const fullPayload: Record<string, unknown> = {
      ...basePayload,
      message_type: messageType ?? null,
      metadata: metadata ?? null,
      reply_to_id: replyToId ?? null,
      reply_to_text: replyToText ?? null,
      status: "sent",
    };

    const payloads: Array<Record<string, unknown>> = [fullPayload, basePayload];
    const allowedMessageKeys = new Set([
      "conversation_id",
      "sender_id",
      "text",
      "image_url",
      "audio_url",
      "video_url",
      "message_type",
      "metadata",
      "reply_to_id",
      "reply_to_text",
      "status",
    ]);

    let lastError: Error | null = null;

    for (const initialPayload of payloads) {
      const payload = Object.fromEntries(
        Object.entries(initialPayload).filter(([key]) => allowedMessageKeys.has(key))
      );
      let attempts = 0;
      let shouldRetry = true;

      while (shouldRetry && attempts < 5) {
        attempts += 1;

        const { data, error } = await supabase
          .from("messages")
          .insert(payload)
          .select()
          .single();

        if (!error) {
          return data;
        }

        lastError = error;

        const missingColMatch = /Could not find the '([^']+)' column/.exec(error?.message ?? "");
        if (missingColMatch) {
          const missingCol = missingColMatch[1];
          if (Object.prototype.hasOwnProperty.call(payload, missingCol)) {
            delete payload[missingCol];
            continue;
          }
        }

        if (error?.message?.includes("metadata") || error?.message?.includes("reply_to") || error?.message?.includes("message_type")) {
          delete payload.message_type;
          delete payload.metadata;
          delete payload.reply_to_id;
          delete payload.reply_to_text;
          delete payload.status;
          continue;
        }

        shouldRetry = false;
      }

      if (!shouldRetry && lastError) {
        break;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  } catch (e) {
    console.error("sendMessage error", e);
    return null;
  }
}

export async function markMessagesAsRead(
  conversationId: string,
  currentUserId: string
): Promise<boolean> {
  try {
    const { data: unreadMessages, error: fetchError } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", currentUserId)
      .is("read_at", null);

    if (fetchError) {
      console.error("markMessagesAsRead fetch error", fetchError);
      return false;
    }

    const messageIds = (unreadMessages ?? []).map((message) => message.id);
    if (messageIds.length === 0) {
      return true;
    }

    const { error: rpcError } = await supabase.rpc("mark_messages_read", {
      p_message_ids: messageIds,
    });

    if (rpcError) {
      console.error("markMessagesAsRead RPC error", rpcError);
      return false;
    }

    return true;
  } catch (e) {
    console.error("markMessagesAsRead error", e);
    return false;
  }
}

export async function updateMessageReactions(
  messageId: string,
  reactions: Record<string, string[]>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("messages")
      .update({ reactions })
      .eq("id", messageId);

    if (error) {
      console.error("updateMessageReactions error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("updateMessageReactions error", e);
    return false;
  }
}

export async function updateConversationLastMessageTime(
  conversationId: string,
  timestamp: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("conversations")
      .update({ last_message_at: timestamp })
      .eq("id", conversationId);

    if (error) {
      console.error("updateConversationLastMessageTime error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("updateConversationLastMessageTime error", e);
    return false;
  }
}

export async function editMessage(
  messageId: string,
  newText: string,
  senderId: string
): Promise<Message | null> {
  try {
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!message || message.sender_id !== senderId) {
      console.error("editMessage: sender not authorized");
      return null;
    }

    const { data, error } = await supabase
      .from("messages")
      .update({
        text: newText.trim(),
        edited_at: normalizeTimestamp(new Date()) ?? new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error) {
      console.error("editMessage error", error);
      return null;
    }

    return data;
  } catch (e) {
    console.error("editMessage error", e);
    return null;
  }
}

export async function deleteMessage(
  messageId: string,
  senderId: string
): Promise<boolean> {
  try {
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!message || message.sender_id !== senderId) {
      console.error("deleteMessage: sender not authorized");
      return false;
    }

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("deleteMessage error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("deleteMessage error", e);
    return false;
  }
}
