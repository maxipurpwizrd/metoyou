import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Conversation, Message, MessageThread, PresenceState } from "../types/message";

export type { Conversation, Message, MessageThread, PresenceState } from "../types/message";

export async function getMessageThreads(
  userId: string
): Promise<MessageThread[]> {
  try {
    // Query 1: Fetch all conversations for this user, sorted by most recent activity
    const { data: conversations, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (conversationError) throw conversationError;
    if (!conversations || conversations.length === 0) return [];

    // Extract all other user IDs that need profiles
    const otherUserIds = new Set<string>();
    conversations.forEach((conv) => {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;
      otherUserIds.add(otherId);
    });

    // Query 2: Fetch all required profiles in one batch
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", Array.from(otherUserIds));

    if (profileError) throw profileError;

    // Build profile lookup map for O(1) access
    const profileMap = new Map<string, { username: string }>();
    (profiles || []).forEach((profile) => {
      profileMap.set(profile.id, { username: profile.username });
    });

    // Query 3: Fetch the latest message for each conversation in one query
    const conversationIds = conversations.map((c) => c.id);
    const { data: allMessages, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, text, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messageError) throw messageError;

    // Build latest message lookup map (keep only the first/latest per conversation)
    const latestMessageMap = new Map<string, { text?: string; created_at: string }>();
    (allMessages || []).forEach((msg) => {
      if (!latestMessageMap.has(msg.conversation_id)) {
        latestMessageMap.set(msg.conversation_id, {
          text: msg.text,
          created_at: msg.created_at,
        });
      }
    });

    // Assemble threads from memory-cached data (already sorted by last_message_at DESC from query)
    const threads: MessageThread[] = conversations.map((conv) => {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;
      const profile = profileMap.get(otherId);
      const lastMessage = latestMessageMap.get(conv.id);

      return {
        otherId,
        otherUsername: profile?.username ?? "User",
        lastText: lastMessage?.text,
        lastTime: lastMessage?.created_at,
      };
    });

    return threads;
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
    // Normalize user IDs for consistent ordering to prevent duplicates
    const [minId, maxId] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    // Search for conversation with BOTH possible orderings (in case of legacy duplicates)
    const { data: existing, error: selectError } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_1", minId)
      .eq("user_2", maxId)
      .limit(1);

    if (selectError) throw selectError;
    
    // If found with normalized ordering, return immediately
    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Also check reverse ordering (for legacy conversations before normalization)
    const { data: legacyExisting, error: legacyError } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_1", maxId)
      .eq("user_2", minId)
      .limit(1);

    if (legacyError) throw legacyError;

    // If found with reverse ordering, return it (don't normalize existing data)
    if (legacyExisting && legacyExisting.length > 0) {
      return legacyExisting[0];
    }

    // No conversation exists - create with normalized ordering
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_1: minId,
        user_2: maxId,
      })
      .select()
      .single();

    if (error) {
      // Handle race condition: another request already created it
      if (error.code === "23505" || error.message?.includes("unique")) {
        // Retry search - should find it now
        const { data: raceConditionExisting } = await supabase
          .from("conversations")
          .select("*")
          .eq("user_1", minId)
          .eq("user_2", maxId)
          .limit(1);
        
        if (raceConditionExisting && raceConditionExisting.length > 0) {
          return raceConditionExisting[0];
        }

        // Also check reverse ordering
        const { data: raceConditionLegacy } = await supabase
          .from("conversations")
          .select("*")
          .eq("user_1", maxId)
          .eq("user_2", minId)
          .limit(1);
        
        if (raceConditionLegacy && raceConditionLegacy.length > 0) {
          return raceConditionLegacy[0];
        }
      }
      throw error;
    }

    return data;
  } catch (e) {
    console.error("findOrCreateConversation error", e);
    return null;
  }
}

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

export async function fetchMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    // Verify conversation exists first
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

    // Load all messages from the conversation
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

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
  replyToId,
  replyToText,
}: SendMessageParams): Promise<Message | null> {
  try {
    // Verify conversation exists and sender is a participant
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

    const basePayload = {
      conversation_id: conversationId,
      sender_id: senderId,
      text: text ?? null,
      image_url: imageUrl ?? null,
      audio_url: audioUrl ?? null,
      video_url: videoUrl ?? null,
      message_type: messageType ?? null,
      status: "sent",
    };

    const payloads: Array<Record<string, unknown>> = [basePayload];

    if (replyToId || replyToText) {
      payloads.unshift({
        ...basePayload,
        metadata: {
          reply_to_id: replyToId ?? null,
          reply_to_text: replyToText ?? null,
        },
      });
    }

    let lastError: Error | null = null;

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      if (!error) {
        return data;
      }

      lastError = error;
      const isSchemaMismatch = error?.message?.includes("column") || error?.code === "PGRST204";
      if (!isSchemaMismatch) {
        break;
      }
    }

    if (lastError) {
      console.error("sendMessage insert failed", lastError);
      throw lastError;
    }

    return null;
  } catch (e) {
    console.error("sendMessage error", e);
    return null;
  }
}

export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
): RealtimeChannel {
  const channel = supabase.channel(`messages:${conversationId}`);
  
  // Subscribe to both INSERT and UPDATE events in one channel
  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const message = payload.new as Message;
      if (message && message.id) {
        callback(message);
      }
    }
  );

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const message = payload.new as Message;
      if (message && message.id) {
        callback(message);
      }
    }
  );

  channel.on(
    "postgres_changes",
    {
      event: "DELETE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      // Broadcast delete event with a special marker
      const deletedMessage = payload.old as Message;
      if (deletedMessage && deletedMessage.id) {
        // Create a delete marker message
        const deleteMarker: Message = {
          ...deletedMessage,
          id: deletedMessage.id,
          text: undefined,
          image_url: undefined,
          audio_url: undefined,
          video_url: undefined,
          metadata: { deleted: true },
        };
        callback(deleteMarker);
      }
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.debug(`Subscribed to messages for conversation ${conversationId}`);
    } else if (status === "CLOSED") {
      console.debug(`Unsubscribed from messages for conversation ${conversationId}`);
    }
  });

  return channel;
}
export async function sendTypingIndicator(
  conversationId: string,
  senderId: string,
  typing: boolean
): Promise<boolean> {
  try {
    const channel = supabase.channel(`typing:${conversationId}`);
    
    let resolved = false;

    // Set up subscription first
    channel.on(
      "broadcast",
      { event: "typing" },
      () => {
        // Just listen, no response needed
      }
    );

    // Subscribe to the channel
    const subscribePromise = new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && !resolved) {
          resolved = true;
          resolve();
        }
      });
      // Timeout after 2 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 2000);
    });

    await subscribePromise;

    // Send the typing indicator
    const result = await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { sender_id: senderId, typing },
    });

    // Cleanup - don't keep connection open
    await channel.unsubscribe();
    
    return result === "ok";
  } catch (e) {
    console.error("sendTypingIndicator error", e);
    return false;
  }
}

export function subscribeToTyping(
  conversationId: string,
  callback: (payload: { sender_id: string; typing: boolean }) => void
): RealtimeChannel {
  const channel = supabase.channel(`typing:${conversationId}`);
  
  channel.on(
    "broadcast",
    { event: "typing" },
    (evt: { payload: { sender_id: string; typing: boolean } }) => {
      if (evt.payload && evt.payload.sender_id) {
        callback(evt.payload);
      }
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.debug(`Subscribed to typing for conversation ${conversationId}`);
    }
  });

  return channel;
}

// Presence helpers (Supabase Realtime Presence)
export function joinPresence(
  conversationId: string,
  userId: string,
  onPresenceChange: (state: PresenceState) => void,
  meta: Record<string, unknown> = {}
): RealtimeChannel | null {
  try {
    const channel = supabase.channel(`presence:${conversationId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Helper to format and broadcast presence state
    const broadcastPresenceState = () => {
      const presenceState = channel.presenceState() as PresenceState;
      const formattedState: PresenceState = {};
      
      Object.entries(presenceState).forEach(([userId, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          const lastPresence = presences[presences.length - 1] as any;
          formattedState[userId] = {
            last_active: lastPresence.last_active ?? Date.now(),
            username: lastPresence.username,
          };
        }
      });

      onPresenceChange(formattedState);
    };

    // ATTACH ALL LISTENERS BEFORE SUBSCRIBE
    channel.on("presence", { event: "sync" }, () => {
      broadcastPresenceState();
      console.debug(`Presence synced for conversation ${conversationId}`);
    });

    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      broadcastPresenceState();
      console.debug(`User ${key} joined presence`, newPresences);
    });

    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      broadcastPresenceState();
      console.debug(`User ${key} left presence`, leftPresences);
    });

    // Subscribe and track (non-blocking)
    void channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track this user's presence
        const presenceData = {
          last_active: Date.now(),
          username: typeof meta.username === "string" ? meta.username : undefined,
          online_at: new Date().toISOString(),
        };

        await channel.track(presenceData);

        console.debug(`Joined presence for conversation ${conversationId}`);
      }
    });

    return channel;
  } catch (e) {
    console.error("joinPresence error", e);
    return null;
  }
}

export async function leavePresence(
  conversationId: string,
  _userId: string,
  channel?: RealtimeChannel
): Promise<void> {
  try {
    if (!channel) return;
    
    await channel.untrack();
    await channel.unsubscribe();
    console.debug(`Left presence for conversation ${conversationId}`);
  } catch (e) {
    console.error("leavePresence error", e);
  }
}

// Read receipt helpers
export async function markMessagesAsRead(
  conversationId: string,
  currentUserId: string
): Promise<boolean> {
  try {
    // Find all unread incoming messages in this conversation
    const { data: unreadMessages, error: fetchError } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", currentUserId)
      .or(`status.is.null,status.neq.read`);

    if (fetchError) {
      console.error("markMessagesAsRead fetch error", fetchError);
      return false;
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      return true;
    }

    // Mark all unread incoming messages as read
    const messageIds = unreadMessages.map((m) => m.id);
    const { error: updateError } = await supabase
      .from("messages")
      .update({ status: "read" })
      .in("id", messageIds);

    if (updateError) {
      console.error("markMessagesAsRead update error", updateError);
      return false;
    }

    console.debug(`Marked ${messageIds.length} messages as read`);
    return true;
  } catch (e) {
    console.error("markMessagesAsRead error", e);
    return false;
  }
}

// Reaction helpers
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

    console.debug(`Updated reactions for message ${messageId}`);
    return true;
  } catch (e) {
    console.error("updateMessageReactions error", e);
    return false;
  }
}

// Update conversation's last activity timestamp
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

    console.debug(`Updated conversation ${conversationId} last_message_at`);
    return true;
  } catch (e) {
    console.error("updateConversationLastMessageTime error", e);
    return false;
  }
}

// Edit message
export async function editMessage(
  messageId: string,
  newText: string,
  senderId: string
): Promise<Message | null> {
  try {
    // Verify sender is the message author
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
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error) {
      console.error("editMessage error", error);
      return null;
    }

    console.debug(`Edited message ${messageId}`);
    return data;
  } catch (e) {
    console.error("editMessage error", e);
    return null;
  }
}

// Delete message
export async function deleteMessage(
  messageId: string,
  senderId: string
): Promise<boolean> {
  try {
    // Verify sender is the message author
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

    console.debug(`Deleted message ${messageId}`);
    return true;
  } catch (e) {
    console.error("deleteMessage error", e);
    return false;
  }
}


