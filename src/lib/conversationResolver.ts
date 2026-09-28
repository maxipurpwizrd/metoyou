import { supabase } from "./supabase";

export type ResolvedConversation = {
  id: string;
  user_1?: string | null;
  user_2?: string | null;
  conversation_key?: string | null;
};

export async function resolveOrCreateConversation(otherUserId: string): Promise<ResolvedConversation | null> {
  if (!otherUserId) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) return null;

  const currentUserId = authData.user.id;
  if (otherUserId === currentUserId) return null;

  const { data, error } = await supabase.rpc("resolve_or_create_conversation", {
    p_other_user_id: otherUserId,
  });

  if (error) {
    console.error("resolveOrCreateConversation RPC error", error);
    return null;
  }

  if (!data) return null;

  const conversationId = typeof data === "string" ? data : data?.id;
  if (!conversationId) return null;

  const { data: row, error: lookupError } = await supabase
    .from("conversations")
    .select("id, user_1, user_2, conversation_key")
    .eq("id", conversationId)
    .maybeSingle();

  if (lookupError) {
    console.error("resolveOrCreateConversation lookup error", lookupError);
    return null;
  }

  if (!row) {
    return { id: conversationId };
  }

  return row as ResolvedConversation;
}
