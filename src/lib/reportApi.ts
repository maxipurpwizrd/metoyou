import { supabase } from "./supabase";
import type { PostReportReason } from "../components/ReportReasonModal";

export async function submitPostReport({
  postId,
  reporterId,
  reportedUserId,
  reason,
}: {
  postId: string;
  reporterId: string;
  reportedUserId: string;
  reason: PostReportReason;
}) {
  const { error } = await supabase.from("reports").insert({
    report_type: "post",
    post_id: postId,
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
    status: "pending",
  });

  if (error) throw error;
}
