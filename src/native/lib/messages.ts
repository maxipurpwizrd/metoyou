import type { MessageThread } from "../../types/message";
import { nativeSupabase } from "./supabase";

export async function fetchNativeMessageThreads(userId: string): Promise<MessageThread[]> {
  const { data: conversations, error: conversationsError } = await nativeSupabase
    .from("conversations")
    .select("id, user_1, user_2, last_message_at")
    .or(`user_1.eq.${userId},user_2.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (conversationsError) throw conversationsError;
  if (!conversations?.length) return [];

  const otherIds = new Set<string>();
  for (const conversation of conversations) {
    otherIds.add(conversation.user_1 === userId ? conversation.user_2 : conversation.user_1);
  }
  const conversationIds = conversations.map((conversation) => conversation.id);

  const [
    { data: profiles, error: profilesError },
    { data: messages, error: messagesError },
    { data: outgoingMessages, error: outgoingError },
  ] = await Promise.all([
    nativeSupabase.from("public_profiles").select("id, username").in("id", [...otherIds]),
    nativeSupabase
      .from("messages")
      .select("conversation_id, text, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    nativeSupabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender_id", userId),
  ]);
  if (profilesError) throw profilesError;
  if (messagesError) throw messagesError;
  if (outgoingError) throw outgoingError;

  const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));
  const latestMessageByConversation = new Map<string, { text: string | null; created_at: string }>();
  for (const message of messages ?? []) {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, {
        text: message.text,
        created_at: message.created_at,
      });
    }
  }
  const outgoingConversationIds = new Set(
    (outgoingMessages ?? []).map((message) => message.conversation_id),
  );
  const seenOtherIds = new Set<string>();

  return conversations.flatMap((conversation) => {
    const otherId = conversation.user_1 === userId ? conversation.user_2 : conversation.user_1;
    if (seenOtherIds.has(otherId)) return [];
    seenOtherIds.add(otherId);
    const latestMessage = latestMessageByConversation.get(conversation.id);
    return [{
      conversationId: conversation.id,
      otherId,
      otherUsername: usernameById.get(otherId) || "User",
      lastText: latestMessage?.text,
      lastTime: latestMessage?.created_at ?? conversation.last_message_at ?? undefined,
      hasOutgoingMessages: outgoingConversationIds.has(conversation.id),
    }];
  });
}
