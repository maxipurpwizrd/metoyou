import { supabase } from "./supabase";
import type { PostReportReason } from "../components/ReportReasonModal";

export async function submitPostReport({
  postId,
  reportedUserId,
  reason,
}: {
  postId: string;
  reportedUserId: string;
  reason: PostReportReason;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication is required to report this post.");

  const { error } = await supabase.from("reports").insert({
    reported_post_id: postId,
    reporter_user_id: authData.user.id,
    reported_user_id: reportedUserId,
    reason,
    status: "pending",
  });

  if (error) throw error;
}
