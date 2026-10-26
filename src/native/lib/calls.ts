import { nativeSupabase } from "./supabase";
import { nativeQueryClient } from "./queryClient";
import { nativeCallHistoryQueryKey } from "./queryKeys";

function invalidateCallHistory(userIds: string[]) {
  return Promise.all([...new Set(userIds)].filter(Boolean).map((userId) =>
    nativeQueryClient.invalidateQueries({
      queryKey: nativeCallHistoryQueryKey(userId),
      exact: true,
    }),
  ));
}

export type CallHistoryStatus = "ringing" | "connected" | "completed" | "missed" | "declined" | "failed";
export type CallHistoryType = "audio" | "video";

export type NativeCallHistoryRecord = {
  id: string;
  conversation_id: string;
  caller_id: string;
  recipient_id: string;
  call_type: CallHistoryType;
  status: CallHistoryStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export const NATIVE_CALL_HISTORY_PAGE_SIZE = 50;

export type NativeCallHistoryCursor = {
  createdAt: string;
  id: string;
};

export async function fetchNativeCallHistoryPage(
  userId: string,
  before?: NativeCallHistoryCursor,
): Promise<{ records: NativeCallHistoryRecord[]; hasMore: boolean }> {
  let query = nativeSupabase
    .from("call_history")
    .select("id, conversation_id, caller_id, recipient_id, call_type, status, started_at, answered_at, ended_at, duration_seconds, created_at")
    .or(`caller_id.eq.${userId},recipient_id.eq.${userId}`);
  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(NATIVE_CALL_HISTORY_PAGE_SIZE + 1);
  if (error) throw error;
  const page = (data ?? []) as NativeCallHistoryRecord[];
  return {
    records: page.slice(0, NATIVE_CALL_HISTORY_PAGE_SIZE),
    hasMore: page.length > NATIVE_CALL_HISTORY_PAGE_SIZE,
  };
}

export async function fetchNativeCallParticipantNames(userIds: string[]): Promise<Record<string, string>> {
  if (!userIds.length) return {};
  const { data, error } = await nativeSupabase
    .from("public_profiles")
    .select("id, username")
    .in("id", userIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.username ?? "MeToYou user"]));
}

export async function createNativeCallHistory(input: {
  conversationId: string;
  callerId: string;
  recipientId: string;
  callType: CallHistoryType;
}): Promise<NativeCallHistoryRecord | null> {
  const { data, error } = await nativeSupabase
    .from("call_history")
    .insert({
      conversation_id: input.conversationId,
      caller_id: input.callerId,
      recipient_id: input.recipientId,
      call_type: input.callType,
      status: "ringing",
    })
    .select("*")
    .single();

  if (error) {
    console.warn("Could not create call history.", error);
    return null;
  }
  void invalidateCallHistory([input.callerId, input.recipientId]);
  return data as NativeCallHistoryRecord;
}

export async function updateNativeCallHistory(
  callId: string | null,
  update: Partial<Pick<NativeCallHistoryRecord, "status" | "answered_at" | "ended_at" | "duration_seconds">>,
  userIds: string[] = [],
) {
  if (!callId) return;
  const { error } = await nativeSupabase
    .from("call_history")
    .update(update)
    .eq("id", callId);
  if (error) console.warn("Could not update call history.", error);
  else void invalidateCallHistory(userIds);
}
