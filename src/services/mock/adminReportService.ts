import type {
  AdminReportSummary,
  AdminReportedCommentItem,
  AdminReportedMessageItem,
  AdminReportedPostItem,
  AdminReportsService,
  ServiceActionResult,
} from "../adminReportTypes";

type MockReportRow = {
  id: string;
  reason: string | null;
  created_at: string;
  status: string;
  report_type: string;
  post_id?: string | null;
  comment_id?: string | null;
  message_id?: string | null;
  reporter_id?: string | null;
  reported_user_id?: string | null;
};

type MockPost = {
  id: string;
  text: string | null;
  image_url: string | null;
};

type MockProfile = {
  id: string;
  username: string;
  suspended?: boolean;
  banned?: boolean;
};

type MockComment = {
  id: string;
  text: string | null;
  author_id: string | null;
};

type MockMessage = {
  id: string;
  text: string | null;
  sender_id: string | null;
  conversation_id: string | null;
  created_at: string | null;
};

type MockConversation = {
  id: string;
  user_1: string | null;
  user_2: string | null;
};

export type MockAdminReportsState = {
  reports?: MockReportRow[];
  posts?: MockPost[];
  comments?: MockComment[];
  messages?: MockMessage[];
  profiles?: MockProfile[];
  conversations?: MockConversation[];
};

const truncateMessagePreview = (value: string | null | undefined) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Message preview unavailable.";
  if (normalized.length <= 200) return normalized;
  return `${normalized.slice(0, 197)}...`;
};

const buildServiceResult = (success: boolean, message: string): ServiceActionResult => ({ success, message });

export function createMockAdminReportsService(initialState: MockAdminReportsState = {}): AdminReportsService {
  const state = {
    reports: initialState.reports ?? [],
    posts: initialState.posts ?? [],
    comments: initialState.comments ?? [],
    messages: initialState.messages ?? [],
    profiles: initialState.profiles ?? [],
    conversations: initialState.conversations ?? [],
  };

  const getProfileById = (id: string | null) => state.profiles.find((profile) => profile.id === id) ?? null;

  const mapReportRowsToPosts = (reportRows: MockReportRow[]): AdminReportedPostItem[] => {
    const postsById = new Map(state.posts.map((post) => [post.id, post]));

    return reportRows.map((report) => {
      const post = report.post_id ? postsById.get(report.post_id) : null;
      const reporter = getProfileById(report.reporter_id ?? null);
      const reportedUser = getProfileById(report.reported_user_id ?? null);

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
      };
    });
  };

  const mapReportRowsToComments = (reportRows: MockReportRow[]): AdminReportedCommentItem[] => {
    const commentsById = new Map(state.comments.map((comment) => [comment.id, comment]));

    return reportRows.map((report) => {
      const comment = report.comment_id ? commentsById.get(report.comment_id) : null;
      const reporter = getProfileById(report.reporter_id ?? null);
      const commentAuthor = getProfileById(report.reported_user_id ?? null);

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
      };
    });
  };

  const mapReportRowsToMessages = (reportRows: MockReportRow[]): AdminReportedMessageItem[] => {
    const messagesById = new Map(state.messages.map((message) => [message.id, message]));
    const conversationsById = new Map(state.conversations.map((conversation) => [conversation.id, conversation]));

    const receiversByMessageId = new Map<string, string | null>();
    for (const message of state.messages) {
      if (!message.conversation_id) {
        receiversByMessageId.set(message.id, null);
        continue;
      }
      const conversation = conversationsById.get(message.conversation_id) ?? null;
      if (!conversation || !message.sender_id) {
        receiversByMessageId.set(message.id, null);
        continue;
      }
      const receiverId = message.sender_id === conversation.user_1 ? conversation.user_2 : conversation.user_1;
      receiversByMessageId.set(message.id, receiverId ?? null);
    }

    return reportRows.map((report) => {
      const message = report.message_id ? messagesById.get(report.message_id) : null;
      const reporter = getProfileById(report.reporter_id ?? null);
      const sender = getProfileById(report.reported_user_id ?? null);
      const receiverId = message ? receiversByMessageId.get(message.id) : null;
      const receiver = receiverId ? getProfileById(receiverId) : null;

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
      };
    });
  };

  const loadReportedPosts = async () => {
    const pendingReports = state.reports.filter((report) => report.report_type === "post" && report.status === "pending");
    return mapReportRowsToPosts(pendingReports);
  };

  const loadReportedComments = async () => {
    const pendingReports = state.reports.filter((report) => report.report_type === "comment" && report.status === "pending");
    return mapReportRowsToComments(pendingReports);
  };

  const loadReportedMessages = async () => {
    const pendingReports = state.reports.filter((report) => report.report_type === "message" && report.status === "pending");
    return mapReportRowsToMessages(pendingReports);
  };

  const loadReportSummary = async () => {
    const summary = state.reports.reduce<AdminReportSummary>(
      (acc, report) => {
        const status = (report.status ?? "pending").toString().toLowerCase();
        acc.total += 1;
        if (status === "resolved" || status === "reviewed") {
          acc.reviewed += 1;
        } else if (status === "escalated") {
          acc.escalated += 1;
        } else {
          acc.pending += 1;
        }
        return acc;
      },
      { total: 0, pending: 0, reviewed: 0, escalated: 0 }
    );
    return summary;
  };

  const deleteReportedPost = async (item: AdminReportedPostItem) => {
    if (!item.postId) return buildServiceResult(false, "Post id is missing.");
    state.posts = state.posts.filter((post) => post.id !== item.postId);
    state.reports = state.reports.filter((report) => report.post_id !== item.postId);
    return buildServiceResult(true, "Post deleted and linked reports removed.");
  };

  const deleteReportedComment = async (item: AdminReportedCommentItem) => {
    if (!item.commentId) return buildServiceResult(false, "Comment id is missing.");
    state.comments = state.comments.filter((comment) => comment.id !== item.commentId);
    state.reports = state.reports.filter((report) => report.comment_id !== item.commentId);
    return buildServiceResult(true, "Comment deleted and linked reports removed.");
  };

  const dismissReportedPost = async (reportId: string) => {
    const report = state.reports.find((report) => report.id === reportId);
    if (!report) return buildServiceResult(false, "Report id is missing.");
    report.status = "dismissed";
    return buildServiceResult(true, "Report dismissed.");
  };

  const dismissReportedComment = async (reportId: string) => {
    const report = state.reports.find((report) => report.id === reportId);
    if (!report) return buildServiceResult(false, "Report id is missing.");
    report.status = "dismissed";
    return buildServiceResult(true, "Report dismissed.");
  };

  const deleteReportedMessage = async (item: AdminReportedMessageItem) => {
    if (!item.messageId) return buildServiceResult(false, "Message id is missing.");
    state.messages = state.messages.filter((message) => message.id !== item.messageId);
    state.reports = state.reports.filter((report) => report.message_id !== item.messageId);
    return buildServiceResult(true, "Message deleted and linked reports removed.");
  };

  const dismissReportedMessage = async (reportId: string) => {
    const report = state.reports.find((report) => report.id === reportId);
    if (!report) return buildServiceResult(false, "Report id is missing.");
    report.status = "dismissed";
    return buildServiceResult(true, "Report dismissed.");
  };

  const suspendReportedSender = async (item: AdminReportedMessageItem) => {
    if (!item.senderUserId) return buildServiceResult(false, "Sender id is missing.");
    const profile = getProfileById(item.senderUserId);
    if (!profile) return buildServiceResult(false, "Sender not found.");
    profile.suspended = true;
    return buildServiceResult(true, "Sender suspended.");
  };

  const banReportedSender = async (item: AdminReportedMessageItem) => {
    if (!item.senderUserId) return buildServiceResult(false, "Sender id is missing.");
    const profile = getProfileById(item.senderUserId);
    if (!profile) return buildServiceResult(false, "Sender not found.");
    profile.banned = true;
    return buildServiceResult(true, "Sender banned.");
  };

  const suspendReportedUser = async (item: AdminReportedPostItem) => {
    if (!item.reportedUserId) return buildServiceResult(false, "Reported user id is missing.");
    const profile = getProfileById(item.reportedUserId);
    if (!profile) return buildServiceResult(false, "User not found.");
    profile.suspended = true;
    return buildServiceResult(true, "User suspended.");
  };

  const banReportedUser = async (item: AdminReportedPostItem) => {
    if (!item.reportedUserId) return buildServiceResult(false, "Reported user id is missing.");
    const profile = getProfileById(item.reportedUserId);
    if (!profile) return buildServiceResult(false, "User not found.");
    profile.banned = true;
    return buildServiceResult(true, "User banned.");
  };

  const suspendReportedCommentAuthor = async (item: AdminReportedCommentItem) => {
    if (!item.commentAuthorUserId) return buildServiceResult(false, "Comment author id is missing.");
    const profile = getProfileById(item.commentAuthorUserId);
    if (!profile) return buildServiceResult(false, "User not found.");
    profile.suspended = true;
    return buildServiceResult(true, "User suspended.");
  };

  const banReportedCommentAuthor = async (item: AdminReportedCommentItem) => {
    if (!item.commentAuthorUserId) return buildServiceResult(false, "Comment author id is missing.");
    const profile = getProfileById(item.commentAuthorUserId);
    if (!profile) return buildServiceResult(false, "User not found.");
    profile.banned = true;
    return buildServiceResult(true, "User banned.");
  };

  return {
    loadReportedPosts,
    loadReportedComments,
    loadReportedMessages,
    loadReportSummary,
    deleteReportedPost,
    deleteReportedComment,
    dismissReportedPost,
    dismissReportedComment,
    deleteReportedMessage,
    dismissReportedMessage,
    suspendReportedSender,
    banReportedSender,
    suspendReportedUser,
    banReportedUser,
    suspendReportedCommentAuthor,
    banReportedCommentAuthor,
  };
}

export const adminReports = createMockAdminReportsService();
