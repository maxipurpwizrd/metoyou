import { supabase } from "./supabase";

export type AccountStatus = "normal" | "limited" | "restricted" | "suspended";
export type ActionType = "warning" | "limited" | "restricted" | "suspended" | "content_removed";

export type ModerationStatus = {
  account_status: AccountStatus;
  reason: string | null;
  effective_at: string | null;
  action_type: ActionType | null;
  affected_content: Record<string, unknown> | null;
  appeal_id: string | null;
  appeal_status: "pending" | "reviewing" | "approved" | "rejected" | null;
  appeal_created_at: string | null;
};

export async function getMyModerationStatus(): Promise<ModerationStatus> {
  const { data, error } = await supabase.rpc("get_my_moderation_status");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    account_status: row?.account_status ?? "normal",
    reason: row?.reason ?? null,
    effective_at: row?.effective_at ?? null,
    action_type: row?.action_type ?? null,
    affected_content: row?.affected_content ?? null,
    appeal_id: row?.appeal_id ?? null,
    appeal_status: row?.appeal_status ?? null,
    appeal_created_at: row?.appeal_created_at ?? null,
  };
}

export async function createUserReport(input: {
  reportedUserId: string;
  reportedPostId?: string;
  reason: string;
  details?: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const { error } = await supabase.from("reports").insert({
    reporter_user_id: authData.user.id,
    reported_user_id: input.reportedUserId,
    reported_post_id: input.reportedPostId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
    status: "pending",
  });
  if (error) throw error;
}

export async function blockUser(blockedUserId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const { error } = await supabase.from("user_blocks").insert({
    blocker_user_id: authData.user.id,
    blocked_user_id: blockedUserId,
  });
  if (error && error.code !== "23505") throw error;
}

export async function unblockUser(blockedUserId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_user_id", authData.user.id)
    .eq("blocked_user_id", blockedUserId);
  if (error) throw error;
}

export type BlockedUser = {
  id: string;
  username: string;
  profile_pic: string | null;
};

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc("get_my_blocked_users");
  if (error) throw error;

  return (data ?? []).map((user: { id: string; username: string | null; profile_pic: string | null }) => ({
    id: user.id,
    username: user.username ?? `User ${user.id.slice(0, 8)}`,
    profile_pic: user.profile_pic ?? null,
  }));
}

export async function createAppeal(details: string) {
  const { data: status } = await supabase.rpc("get_my_moderation_status");
  const row = Array.isArray(status) ? status[0] : status;
  if (!row?.appeal_id) throw new Error("No appeal is currently available.");

  const { error } = await supabase.from("moderation_appeals").update({ details }).eq("id", row.appeal_id);
  if (error) throw error;
}

export const SUPPORT_CATEGORIES = ["app_crash", "messages", "calls", "feed", "profile", "payments", "media", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export async function createSupportTicket(input: {
  category: SupportCategory;
  description: string;
  file?: File;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: authData.user.id,
      category: input.category,
      description: input.description.trim(),
      status: "open",
      technical_context: {
        app_version: import.meta.env.VITE_APP_VERSION ?? "unknown",
        platform: navigator.platform,
        browser_or_device: navigator.userAgent,
        route: window.location.pathname,
        language: document.documentElement.lang || "unknown",
        timestamp: new Date().toISOString(),
      },
    })
    .select("id")
    .single();
  if (error || !ticket) throw error ?? new Error("Unable to create support ticket.");

  if (input.file) {
    const path = `${authData.user.id}/${ticket.id}/${input.file.name}`;
    const upload = await supabase.storage.from("support-reports").upload(path, input.file, { upsert: false });
    if (upload.error) throw upload.error;

    const attachment = await supabase.from("support_attachments").insert({
      ticket_id: ticket.id,
      user_id: authData.user.id,
      storage_path: path,
      filename: input.file.name,
      mime_type: input.file.type,
      size_bytes: input.file.size,
    });
    if (attachment.error) throw attachment.error;
  }
}

export async function isUserBlockedBetween(userId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const { data, error } = await supabase.rpc("is_user_blocked_between", {
    p_user_a: authData.user.id,
    p_user_b: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getBlockState(targetUserId: string): Promise<{ blocked: boolean; canUnblock: boolean }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required.");

  const blocked = await isUserBlockedBetween(targetUserId);
  if (!blocked) return { blocked: false, canUnblock: false };

  const { data: ownBlock, error: ownBlockError } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_user_id", authData.user.id)
    .eq("blocked_user_id", targetUserId)
    .maybeSingle();
  if (ownBlockError) throw ownBlockError;

  return { blocked: true, canUnblock: Boolean(ownBlock) };
}