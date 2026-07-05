import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  status?: string | null;
  message_type?: string | null;
  metadata?: Record<string, unknown> | null;
  reactions?: Record<string, string[]>;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_1: string;
  user_2: string;
  created_at: string;
};

export type MessageThread = {
  otherId: string;
  otherUsername: string;
  lastText?: string | null;
  lastTime?: string;
};

export async function getMessageThreads(
  userId: string
): Promise<MessageThread[]> {
  try {
    const { data: conversations, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`);

    if (conversationError) throw conversationError;
    if (!conversations || conversations.length === 0) return [];

    const threads: MessageThread[] = [];

    for (const conv of conversations) {
      const otherId = conv.user_1 === userId ? conv.user_2 : conv.user_1;

      // Get the other user's profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", otherId)
        .maybeSingle();

      // Get the last message in this conversation
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("text, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      threads.push({
        otherId,
        otherUsername: profile?.username ?? "User",
        lastText: lastMessage?.text,
        lastTime: lastMessage?.created_at,
      });
    }

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
    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(
        `and(user_1.eq.${userId1},user_2.eq.${userId2}),and(user_1.eq.${userId2},user_2.eq.${userId1})`
      )
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_1: userId1,
        user_2: userId2,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (e) {
    console.error("findOrCreateConversation error", e);
    return null;
  }
}

export async function fetchMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return data ?? [];
  } catch (e) {
    console.error("fetchMessages error", e);
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
};

export async function sendMessage({
  conversationId,
  senderId,
  text,
  imageUrl,
  audioUrl,
  videoUrl,
  messageType,
}: SendMessageParams): Promise<Message | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
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

    if (error) throw error;

    return data;
  } catch (e) {
    console.error("sendMessage error", e);
    return null;
  }
}

export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();
}

// Typing indicator helpers (broadcast channel)
export async function sendTypingIndicator(
  conversationId: string,
  senderId: string,
  typing: boolean
): Promise<boolean> {
  try {
    const channel = supabase.channel(`typing:${conversationId}`);
    // send a lightweight broadcast payload — runtime may vary by client lib
    try {
      const sender = channel as unknown as { send?: (msg: { type: string; event: string; payload: unknown }) => void };
      if (sender.send) {
        sender.send({ type: "broadcast", event: "typing", payload: { sender_id: senderId, typing } });
      }
    } catch (err) {
      console.warn("typing broadcast failed", err);
    }
    return true;
  } catch (e) {
    console.error("sendTypingIndicator error", e);
    return false;
  }
}

export function subscribeToTyping(
  conversationId: string,
  callback: (payload: { sender_id: string; typing: boolean }) => void
): RealtimeChannel {
  return supabase
    .channel(`typing:${conversationId}`)
    .on("broadcast", { event: "typing" }, (evt: { payload: { sender_id: string; typing: boolean } }) => {
      callback(evt.payload);
    })
    .subscribe();
}

// Presence helpers (lightweight local presence MVP)
function getPresenceStorageKey(conversationId: string) {
  return `metoyou:presence:${conversationId}`;
}

function readPresenceState(conversationId: string) {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(getPresenceStorageKey(conversationId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, { last_active?: number; username?: string }>;
  } catch (err) {
    console.warn("readPresenceState error", err);
    return {};
  }
}

function writePresenceState(conversationId: string, state: Record<string, { last_active?: number; username?: string }>) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getPresenceStorageKey(conversationId), JSON.stringify(state));
  window.dispatchEvent(new Event("metoyou-presence-updated"));
}

export async function joinPresence(
  conversationId: string,
  userId: string,
  meta: Record<string, unknown> = {}
): Promise<RealtimeChannel | null> {
  try {
    const channel = supabase.channel(`presence:${conversationId}`);
    const state = readPresenceState(conversationId);
    state[userId] = {
      last_active: Date.now(),
      username: typeof meta.username === "string" ? meta.username : undefined,
    };
    writePresenceState(conversationId, state);
    await channel.subscribe();
    return channel;
  } catch (e) {
    console.error("joinPresence error", e);
    return null;
  }
}

export async function leavePresence(conversationId: string, userId: string): Promise<void> {
  try {
    const state = readPresenceState(conversationId);
    delete state[userId];
    writePresenceState(conversationId, state);
  } catch (e) {
    console.error("leavePresence error", e);
  }
}

export function subscribeToPresence(
  conversationId: string,
  callback: (state: Record<string, { last_active?: number; username?: string }>) => void
): RealtimeChannel {
  const channel = supabase.channel(`presence:${conversationId}`);

  const sync = () => {
    callback(readPresenceState(conversationId));
  };

  if (typeof window !== "undefined") {
    window.addEventListener("metoyou-presence-updated", sync);
  }

  sync();
  return channel;
}
