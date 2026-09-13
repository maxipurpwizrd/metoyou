import { supabase } from "../../lib/supabase";
import type {
  AdminReportSummary,
  AdminReportedCommentItem,
  AdminReportedMessageItem,
  AdminReportedPostItem,
  AdminReportsService,
  ServiceActionResult,
} from "../adminReportTypes";

const truncateMessagePreview = (value: string | null | undefined) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Message preview unavailable.";
  if (normalized.length <= 200) return normalized;
  return `${normalized.slice(0, 197)}...`;
};

const buildServiceResult = (success: boolean, message: string): ServiceActionResult => ({ success, message });

const mapReportRowsToPosts = (reportRows: any[], posts: any[], reporters: any[], reportedUsers: any[]) => {
  const postsById = new Map((posts ?? []).map((p: any) => [p.id, p]));
  const reportersById = new Map((reporters ?? []).map((p: any) => [p.id, p]));
  const reportedUsersById = new Map((reportedUsers ?? []).map((p: any) => [p.id, p]));

  return reportRows.map((report) => {
    const post = report.post_id ? postsById.get(report.post_id) : null;
    const reporter = report.reporter_id ? reportersById.get(report.reporter_id) : null;
    const reportedUser = report.reported_user_id ? reportedUsersById.get(report.reported_user_id) : null;

    return {
      reportId: report.id,
      reportReason: report.reason ?? "No reason provided",
      reportDate: report.created_at,
      reporterUsername: reporter?.username ?? "Unknown reporter",
      reportedUsername: reportedUser?.username ?? "Unknown user",
      postId: report.post_id ?? null,
      postPreview: post?.text ?? "Post no longer available",
      postImageUrl: post?.image_url ?? null,
      reporterUserId: report.reporter_id ?? null,
      reportedUserId: report.reported_user_id ?? null,
    } as AdminReportedPostItem;
  });
};

const mapReportRowsToComments = (reportRows: any[], comments: any[], reporters: any[], commentAuthors: any[]) => {
  const commentsById = new Map((comments ?? []).map((c: any) => [c.id, c]));
  const reportersById = new Map((reporters ?? []).map((p: any) => [p.id, p]));
  const commentAuthorsById = new Map((commentAuthors ?? []).map((p: any) => [p.id, p]));

  return reportRows.map((report) => {
    const comment = report.comment_id ? commentsById.get(report.comment_id) : null;
    const reporter = report.reporter_id ? reportersById.get(report.reporter_id) : null;
    const commentAuthor = report.reported_user_id ? commentAuthorsById.get(report.reported_user_id) : null;

    return {
      reportId: report.id,
      reportReason: report.reason ?? "No reason provided",
      reportDate: report.created_at,
      reporterUsername: reporter?.username ?? "Unknown reporter",
      commentAuthorUsername: commentAuthor?.username ?? "Unknown user",
      commentId: report.comment_id ?? null,
      commentPreview: comment?.text ?? "Comment no longer available",
      reporterUserId: report.reporter_id ?? null,
      commentAuthorUserId: report.reported_user_id ?? null,
    } as AdminReportedCommentItem;
  });
};

const mapReportRowsToMessages = (
  reportRows: any[],
  messages: any[],
  reporters: any[],
  senders: any[],
  receiversByMessageId: Map<string, string | null>,
  receivers: any[]
) => {
  const messagesById = new Map((messages ?? []).map((m: any) => [m.id, m]));
  const reportersById = new Map((reporters ?? []).map((p: any) => [p.id, p]));
  const sendersById = new Map((senders ?? []).map((p: any) => [p.id, p]));
  const receiversById = new Map((receivers ?? []).map((p: any) => [p.id, p]));

  return reportRows.map((report) => {
    const message = report.message_id ? messagesById.get(report.message_id) : null;
    const reporter = report.reporter_id ? reportersById.get(report.reporter_id) : null;
    const sender = report.reported_user_id ? sendersById.get(report.reported_user_id) : null;
    const receiverId = message ? receiversByMessageId.get(message.id) : null;
    const receiver = receiverId ? receiversById.get(receiverId) : null;

    return {
      reportId: report.id,
      reportReason: report.reason ?? "No reason provided",
      reportDate: report.created_at,
      reporterUsername: reporter?.username ?? "Unknown reporter",
      senderUsername: sender?.username ?? "Unknown sender",
      receiverUsername: receiver?.username ?? "Unknown receiver",
      messageId: report.message_id ?? null,
      messagePreview: truncateMessagePreview(message?.text ?? null),
      fullMessage: message?.text ?? null,
      messageTimestamp: message?.created_at ?? null,
      senderUserId: message?.sender_id ?? null,
      reporterUserId: report.reporter_id ?? null,
    } as AdminReportedMessageItem;
  });
};

export const adminReports: AdminReportsService = {
  async loadReportedPosts() {
    const { data: reportRows, error: reportsError } = await supabase
      .from("reports")
      .select("id, reason, created_at, status, report_type, post_id, reporter_id, reported_user_id")
      .eq("report_type", "post")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reportsError) {
      throw reportsError;
    }

    const pendingReports = (reportRows ?? []) as any[];
    if (pendingReports.length === 0) {
      return [];
    }

    const postIds = pendingReports.map((r) => r.post_id).filter(Boolean) as string[];
    const reporterIds = pendingReports.map((r) => r.reporter_id).filter(Boolean) as string[];
    const reportedUserIds = pendingReports.map((r) => r.reported_user_id).filter(Boolean) as string[];

    const [postsResult, reportersResult, reportedUsersResult] = await Promise.all([
      postIds.length > 0
        ? supabase.from("posts").select("id, text, image_url").in("id", postIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      reporterIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", reporterIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      reportedUserIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", reportedUserIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (postsResult.error) throw postsResult.error;
    if (reportersResult.error) throw reportersResult.error;
    if (reportedUsersResult.error) throw reportedUsersResult.error;

    return mapReportRowsToPosts(pendingReports, postsResult.data, reportersResult.data, reportedUsersResult.data);
  },

  async loadReportedComments() {
    const { data: reportRows, error: reportsError } = await supabase
      .from("reports")
      .select("id, reason, created_at, status, report_type, comment_id, reporter_id, reported_user_id")
      .eq("report_type", "comment")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reportsError) {
      throw reportsError;
    }

    const pendingReports = (reportRows ?? []) as any[];
    if (pendingReports.length === 0) {
      return [];
    }

    const commentIds = pendingReports.map((r) => r.comment_id).filter(Boolean) as string[];
    const reporterIds = pendingReports.map((r) => r.reporter_id).filter(Boolean) as string[];
    const commentAuthorIds = pendingReports.map((r) => r.reported_user_id).filter(Boolean) as string[];

    const [commentsResult, reportersResult, commentAuthorsResult] = await Promise.all([
      commentIds.length > 0
        ? supabase.from("comments").select("id, text, author_id").in("id", commentIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      reporterIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", reporterIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      commentAuthorIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", commentAuthorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (commentsResult.error) throw commentsResult.error;
    if (reportersResult.error) throw reportersResult.error;
    if (commentAuthorsResult.error) throw commentAuthorsResult.error;

    return mapReportRowsToComments(pendingReports, commentsResult.data, reportersResult.data, commentAuthorsResult.data);
  },

  async loadReportedMessages() {
    const { data: reportRows, error: reportsError } = await supabase
      .from("reports")
      .select("id, reason, created_at, status, report_type, message_id, reporter_id, reported_user_id")
      .eq("report_type", "message")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reportsError) {
      throw reportsError;
    }

    const pendingReports = (reportRows ?? []) as any[];
    if (pendingReports.length === 0) {
      return [];
    }

    const messageIds = pendingReports.map((r) => r.message_id).filter(Boolean) as string[];
    const reporterIds = pendingReports.map((r) => r.reporter_id).filter(Boolean) as string[];
    const senderIds = pendingReports.map((r) => r.reported_user_id).filter(Boolean) as string[];

    const [messagesResult, reportersResult, sendersResult] = await Promise.all([
      messageIds.length > 0
        ? supabase.from("messages").select("id, text, sender_id, conversation_id, created_at").in("id", messageIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      reporterIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", reporterIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      senderIds.length > 0
        ? supabase.from("profiles").select("id, username").in("id", senderIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (messagesResult.error) throw messagesResult.error;
    if (reportersResult.error) throw reportersResult.error;
    if (sendersResult.error) throw sendersResult.error;

    const conversationIds = Array.from(
      new Set((messagesResult.data ?? []).map((m: any) => m.conversation_id).filter(Boolean) as string[])
    );

    const conversationsResult = conversationIds.length > 0
      ? await supabase.from("conversations").select("id, user_1, user_2").in("id", conversationIds)
      : { data: [] as any[], error: null };

    if (conversationsResult.error) throw conversationsResult.error;

    const conversationsById = new Map((conversationsResult.data ?? []).map((c: any) => [c.id, c]));
    const receiversByMessageId = new Map<string, string | null>();

    for (const message of messagesResult.data ?? []) {
      const conversation = message.conversation_id ? conversationsById.get(message.conversation_id) : null;
      if (!conversation || !message.sender_id) {
        receiversByMessageId.set(message.id, null);
        continue;
      }

      const receiverId = message.sender_id === conversation.user_1 ? conversation.user_2 : conversation.user_1;
      receiversByMessageId.set(message.id, receiverId ?? null);
    }

    const receiverIds = Array.from(new Set(Array.from(receiversByMessageId.values()).filter(Boolean) as string[]));
    const receiversResult = receiverIds.length > 0
      ? await supabase.from("profiles").select("id, username").in("id", receiverIds)
      : { data: [] as any[], error: null };

    if (receiversResult.error) throw receiversResult.error;

    return mapReportRowsToMessages(
      pendingReports,
      messagesResult.data,
      reportersResult.data,
      sendersResult.data,
      receiversByMessageId,
      receiversResult.data
    );
  },

  async loadReportSummary() {
    const { data, error } = await supabase.from("reports").select("id, status");
    if (error) throw error;

    if (!Array.isArray(data)) {
      return { total: 0, pending: 0, reviewed: 0, escalated: 0 };
    }

    return (data as any[]).reduce<AdminReportSummary>(
      (summary, item) => {
        const status = (item.status ?? "pending").toString().toLowerCase();
        summary.total += 1;
        if (status === "resolved" || status === "reviewed") {
          summary.reviewed += 1;
        } else if (status === "escalated") {
          summary.escalated += 1;
        } else {
          summary.pending += 1;
        }
        return summary;
      },
      { total: 0, pending: 0, reviewed: 0, escalated: 0 }
    );
  },

  async deleteReportedPost(item) {
    if (!item.postId) {
      return buildServiceResult(false, "Post id is missing.");
    }

    const { error: deletePostError } = await supabase.from("posts").delete().eq("id", item.postId);
    if (deletePostError) throw deletePostError;

    const { error: deleteReportsError } = await supabase.from("reports").delete().eq("post_id", item.postId);
    if (deleteReportsError) throw deleteReportsError;

    return buildServiceResult(true, "Post deleted and linked reports removed.");
  },

  async deleteReportedComment(item) {
    if (!item.commentId) {
      return buildServiceResult(false, "Comment id is missing.");
    }

    const { error: deleteCommentError } = await supabase.from("comments").delete().eq("id", item.commentId);
    if (deleteCommentError) throw deleteCommentError;

    const { error: deleteReportsError } = await supabase.from("reports").delete().eq("comment_id", item.commentId);
    if (deleteReportsError) throw deleteReportsError;

    return buildServiceResult(true, "Comment deleted and linked reports removed.");
  },

  async dismissReportedPost(reportId) {
    if (!reportId) {
      return buildServiceResult(false, "Report id is missing.");
    }

    const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
    if (error) throw error;

    return buildServiceResult(true, "Report dismissed.");
  },

  async dismissReportedComment(reportId) {
    if (!reportId) {
      return buildServiceResult(false, "Report id is missing.");
    }

    const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
    if (error) throw error;

    return buildServiceResult(true, "Report dismissed.");
  },

  async deleteReportedMessage(item) {
    if (!item.messageId) {
      return buildServiceResult(false, "Message id is missing.");
    }

    const { error: deleteMessageError } = await supabase.from("messages").delete().eq("id", item.messageId);
    if (deleteMessageError) throw deleteMessageError;

    const { error: deleteReportsError } = await supabase.from("reports").delete().eq("message_id", item.messageId);
    if (deleteReportsError) throw deleteReportsError;

    return buildServiceResult(true, "Message deleted and linked reports removed.");
  },

  async dismissReportedMessage(reportId) {
    if (!reportId) {
      return buildServiceResult(false, "Report id is missing.");
    }

    const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
    if (error) throw error;

    return buildServiceResult(true, "Report dismissed.");
  },

  async suspendReportedSender(item) {
    if (!item.senderUserId) {
      return buildServiceResult(false, "Sender id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.senderUserId);
    if (error) throw error;

    return buildServiceResult(true, "Sender suspended.");
  },

  async banReportedSender(item) {
    if (!item.senderUserId) {
      return buildServiceResult(false, "Sender id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.senderUserId);
    if (error) throw error;

    return buildServiceResult(true, "Sender banned.");
  },

  async suspendReportedUser(item) {
    if (!item.reportedUserId) {
      return buildServiceResult(false, "Reported user id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.reportedUserId);
    if (error) throw error;

    return buildServiceResult(true, "User suspended.");
  },

  async banReportedUser(item) {
    if (!item.reportedUserId) {
      return buildServiceResult(false, "Reported user id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.reportedUserId);
    if (error) throw error;

    return buildServiceResult(true, "User banned.");
  },

  async suspendReportedCommentAuthor(item) {
    if (!item.commentAuthorUserId) {
      return buildServiceResult(false, "Comment author id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.commentAuthorUserId);
    if (error) throw error;

    return buildServiceResult(true, "User suspended.");
  },

  async banReportedCommentAuthor(item) {
    if (!item.commentAuthorUserId) {
      return buildServiceResult(false, "Comment author id is missing.");
    }

    const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.commentAuthorUserId);
    if (error) throw error;

    return buildServiceResult(true, "User banned.");
  },
};
