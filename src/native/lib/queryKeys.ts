export const nativeFeedQueryKey = (userId: string) =>
  ["native", "feed", userId] as const;

export const nativeFeedPostQueryKey = (userId: string, postId: string) =>
  ["native", "feed", userId, "post", postId] as const;

export const nativeFeedLikesQueryKey = (userId: string, postIds: string[]) =>
  ["native", "feed", userId, "likes", ...postIds] as const;

export const nativeStoriesQueryKey = (userId: string) =>
  ["native", "stories", userId] as const;

export const nativeEntitlementQueryKey = (userId: string) =>
  ["native", "entitlement", userId] as const;

export const nativeMessageThreadsQueryKey = (userId: string) =>
  ["native", "messages", userId, "threads"] as const;

export const nativeConversationActionsQueryKey = (userId: string) =>
  ["native", "messages", userId, "conversation-actions"] as const;

export const nativeChatConversationQueryKey = (userId: string, recipientId: string) =>
  ["native", "messages", userId, "recipient", recipientId] as const;

export const nativeConversationMessagesQueryKey = (userId: string, conversationId: string) =>
  ["native", "messages", userId, "conversation", conversationId] as const;

export const nativeProfileQueryKey = (viewerId: string, profileKey: string) =>
  ["native", "profile", viewerId, profileKey] as const;

export const nativeProfilePostsQueryKey = (viewerId: string, profileId: string) =>
  ["native", "profile", viewerId, profileId, "posts"] as const;

export const nativeFollowInfoQueryKey = (viewerId: string, profileId: string) =>
  ["native", "profile", viewerId, profileId, "follow"] as const;

export const nativeProfileConnectionsQueryKey = (profileId: string, tab: string) =>
  ["native", "profile", profileId, "connections", tab] as const;

export const nativeCallHistoryQueryKey = (userId: string) =>
  ["native", "calls", userId] as const;

export const nativeCallParticipantProfilesQueryKey = (userId: string, profileIds: string[]) =>
  ["native", "calls", userId, "participants", ...[...profileIds].sort()] as const;

export const nativeAccountQueryFilter = (userId: string) => ({
  predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === "native" && query.queryKey[2] === userId,
});
