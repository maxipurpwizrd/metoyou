import type { MessageThread } from "../../types/message";
import { nativeSupabase } from "./supabase";

export type NativeConversationRequestStatus = {
  isMutualFollow: boolean;
  hasOutgoingMessages: boolean;
  hasIncomingMessages: boolean;
};

export async function fetchNativeConversationMessageActivity(
  conversationId: string,
  userId: string,
  otherId: string,
) {
  const { data: latestMessage, error: latestMessageError } = await nativeSupabase
    .from("messages")
    .select("sender_id, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestMessageError) throw latestMessageError;
  if (!latestMessage) {
    return {
      latestMessage: null,
      hasOutgoingMessages: false,
      hasIncomingMessages: false,
    };
  }

  let hasOutgoingMessages = latestMessage.sender_id === userId;
  let hasIncomingMessages = latestMessage.sender_id === otherId;
  const oppositeSenderId = latestMessage.sender_id === userId ? otherId : userId;
  const { data: earlierMessage, error: earlierMessageError } = await nativeSupabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("sender_id", oppositeSenderId)
    .limit(1)
    .maybeSingle();
  if (earlierMessageError) throw earlierMessageError;
  if (oppositeSenderId === userId) hasOutgoingMessages = Boolean(earlierMessage);
  else hasIncomingMessages = Boolean(earlierMessage);

  return { latestMessage, hasOutgoingMessages, hasIncomingMessages };
}

export async function fetchNativeConversationRequestStatus(
  conversationId: string,
  userId: string,
  otherId: string,
): Promise<NativeConversationRequestStatus> {
  const [activity, followingResult, followedByResult] = await Promise.all([
    fetchNativeConversationMessageActivity(conversationId, userId, otherId),
    nativeSupabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", userId)
      .eq("following_id", otherId)
      .limit(1)
      .maybeSingle(),
    nativeSupabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", otherId)
      .eq("following_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);
  if (followingResult.error) throw followingResult.error;
  if (followedByResult.error) throw followedByResult.error;

  return {
    ...activity,
    isMutualFollow: Boolean(followingResult.data && followedByResult.data),
  };
}

export async function fetchNativeMessageThreads(userId: string): Promise<MessageThread[]> {
  const { data: conversations, error: conversationsError } = await nativeSupabase
    .from("conversations")
    .select("id, user_1, user_2, last_message_at")
    .or(`user_1.eq.${userId},user_2.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (conversationsError) throw conversationsError;
  if (!conversations?.length) return [];

  const latestConversationByOtherId = new Map<string, (typeof conversations)[number]>();
  for (const conversation of conversations) {
    const otherId = conversation.user_1 === userId ? conversation.user_2 : conversation.user_1;
    if (!latestConversationByOtherId.has(otherId)) {
      latestConversationByOtherId.set(otherId, conversation);
    }
  }
  const latestConversations = [...latestConversationByOtherId.values()];
  const otherIds = [...latestConversationByOtherId.keys()];

  const [{ data: followedUsers, error: followedUsersError }, { data: followers, error: followersError }] = await Promise.all([
    nativeSupabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", otherIds),
    nativeSupabase
      .from("followers")
      .select("follower_id")
      .eq("following_id", userId)
      .in("follower_id", otherIds),
  ]);
  if (followedUsersError) throw followedUsersError;
  if (followersError) throw followersError;
  const followedUserIds = new Set((followedUsers ?? []).map((row) => row.following_id as string));
  const followerIds = new Set((followers ?? []).map((row) => row.follower_id as string));

  const profilesPromise = nativeSupabase
    .from("public_profiles")
    .select("id, username")
    .in("id", otherIds);
  const activityByConversation = new Map<string, Awaited<ReturnType<typeof fetchNativeConversationMessageActivity>>>();
  const previewConcurrency = 8;

  for (let start = 0; start < latestConversations.length; start += previewConcurrency) {
    const batch = latestConversations.slice(start, start + previewConcurrency);
    const activities = await Promise.all(batch.map(async (conversation) => {
      const otherId = conversation.user_1 === userId ? conversation.user_2 : conversation.user_1;
      return [
        conversation.id,
        await fetchNativeConversationMessageActivity(conversation.id, userId, otherId),
      ] as const;
    }));
    for (const [conversationId, activity] of activities) activityByConversation.set(conversationId, activity);
  }

  const { data: profiles, error: profilesError } = await profilesPromise;
  if (profilesError) throw profilesError;

  const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));

  return latestConversations.map((conversation) => {
    const otherId = conversation.user_1 === userId ? conversation.user_2 : conversation.user_1;
    const activity = activityByConversation.get(conversation.id);
    const isMutualFollow = followedUserIds.has(otherId) && followerIds.has(otherId);
    return {
      conversationId: conversation.id,
      otherId,
      otherUsername: usernameById.get(otherId) || "User",
      lastText: activity?.latestMessage?.text,
      lastTime: activity?.latestMessage?.created_at ?? conversation.last_message_at ?? undefined,
      hasOutgoingMessages: activity?.hasOutgoingMessages ?? false,
      hasIncomingMessages: activity?.hasIncomingMessages ?? false,
      isSpam: !isMutualFollow && Boolean(activity?.hasIncomingMessages && !activity.hasOutgoingMessages),
    };
  });
}
