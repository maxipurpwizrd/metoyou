import { nativeSupabase } from "./supabase";

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

export async function fetchNativeCallHistory(userId: string): Promise<NativeCallHistoryRecord[]> {
  const { data, error } = await nativeSupabase
    .from("call_history")
    .select("*")
    .or(`caller_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NativeCallHistoryRecord[];
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
  return data as NativeCallHistoryRecord;
}

export async function updateNativeCallHistory(
  callId: string | null,
  update: Partial<Pick<NativeCallHistoryRecord, "status" | "answered_at" | "ended_at" | "duration_seconds">>,
) {
  if (!callId) return;
  const { error } = await nativeSupabase
    .from("call_history")
    .update(update)
    .eq("id", callId);
  if (error) console.warn("Could not update call history.", error);
}
