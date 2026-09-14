import { supabase } from "./supabase";

export type CallHistoryStatus = "ringing" | "connected" | "completed" | "missed" | "declined" | "failed";
export type CallHistoryType = "audio" | "video";

export type CallHistoryRecord = {
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

type CreateCallHistoryParams = {
  conversationId: string;
  callerId: string;
  recipientId: string;
  callType: CallHistoryType;
};

export async function createCallHistory(params: CreateCallHistoryParams): Promise<CallHistoryRecord | null> {
  const { data, error } = await supabase
    .from("call_history")
    .insert({
      conversation_id: params.conversationId,
      caller_id: params.callerId,
      recipient_id: params.recipientId,
      call_type: params.callType,
      status: "ringing",
    })
    .select()
    .single();

  if (error) {
    console.warn("createCallHistory failed", error);
    return null;
  }

  return data as CallHistoryRecord;
}

export async function updateCallHistory(
  callId: string | null,
  update: Partial<Pick<CallHistoryRecord, "status" | "answered_at" | "ended_at" | "duration_seconds">>
): Promise<boolean> {
  if (!callId) return false;

  const { error } = await supabase
    .from("call_history")
    .update(update)
    .eq("id", callId);

  if (error) {
    console.warn("updateCallHistory failed", error);
    return false;
  }

  return true;
}

export async function getCallHistory(userId: string): Promise<CallHistoryRecord[]> {
  const { data, error } = await supabase
    .from("call_history")
    .select("*")
    .or(`caller_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getCallHistory failed", error);
    return [];
  }

  return (data ?? []) as CallHistoryRecord[];
}
