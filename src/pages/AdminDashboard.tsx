import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  Heart,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type AdminDashboardStats = {
  users: number;
  posts: number;
  comments: number;
  likes: number;
  reports: number;
  onlineNow: number;
};

type AdminActivityItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
};

type AdminReportSummary = {
  total: number;
  pending: number;
  reviewed: number;
  escalated: number;
};

type AdminReportedPostItem = {
  reportId: string;
  reportReason: string | null;
  reportDate: string;
  reporterUsername: string;
  reportedUsername: string;
  postId: string | null;
  postPreview: string | null;
  postImageUrl: string | null;
  reporterUserId: string | null;
  reportedUserId: string | null;
};

type AdminReportedCommentItem = {
  reportId: string;
  reportReason: string | null;
  reportDate: string;
  reporterUsername: string;
  commentAuthorUsername: string;
  commentId: string | null;
  commentPreview: string | null;
  reporterUserId: string | null;
  commentAuthorUserId: string | null;
};

type AdminReportedMessageItem = {
  reportId: string;
  reportReason: string | null;
  reportDate: string;
  reporterUsername: string;
  senderUsername: string;
  receiverUsername: string;
  messageId: string | null;
  messagePreview: string | null;
  fullMessage: string | null;
  messageTimestamp: string | null;
  senderUserId: string | null;
  reporterUserId: string | null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isLoadingAdminDashboard, setIsLoadingAdminDashboard] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats>({
    users: 0,
    posts: 0,
    comments: 0,
    likes: 0,
    reports: 0,
    onlineNow: 0,
  });
  const [adminActivity, setAdminActivity] = useState<AdminActivityItem[]>([]);
  const [adminReports, setAdminReports] = useState<AdminReportSummary>({
    total: 0,
    pending: 0,
    reviewed: 0,
    escalated: 0,
  });
  const [reportedPosts, setReportedPosts] = useState<AdminReportedPostItem[]>([]);
  const [isLoadingReportedPosts, setIsLoadingReportedPosts] = useState(false);
  const [reportedPostsError, setReportedPostsError] = useState<string | null>(null);
  const [reportedComments, setReportedComments] = useState<AdminReportedCommentItem[]>([]);
  const [isLoadingReportedComments, setIsLoadingReportedComments] = useState(false);
  const [reportedCommentsError, setReportedCommentsError] = useState<string | null>(null);
  const [reportedMessages, setReportedMessages] = useState<AdminReportedMessageItem[]>([]);
  const [isLoadingReportedMessages, setIsLoadingReportedMessages] = useState(false);
  const [reportedMessagesError, setReportedMessagesError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [selectedReportedPost, setSelectedReportedPost] = useState<AdminReportedPostItem | null>(null);
  const [selectedReportedComment, setSelectedReportedComment] = useState<AdminReportedCommentItem | null>(null);
  const [selectedReportedMessage, setSelectedReportedMessage] = useState<AdminReportedMessageItem | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const showActionFeedback = (message: string) => {
    setActionFeedback(message);
    window.setTimeout(() => setActionFeedback(null), 2200);
  };

  const loadReportedPosts = async () => {
    setIsLoadingReportedPosts(true);
    setReportedPostsError(null);

    try {
      const { data: reportRows, error: reportsError } = await supabase
        .from("reports")
        .select("id, reason, created_at, status, report_type, post_id, reporter_id, reported_user_id")
        .eq("report_type", "post")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (reportsError) {
        throw reportsError;
      }

      const pendingReports = (reportRows ?? []) as Array<{
        id: string;
        reason: string | null;
        created_at: string;
        post_id: string | null;
        reporter_id: string | null;
        reported_user_id: string | null;
      }>;

      if (pendingReports.length === 0) {
        setReportedPosts([]);
        return;
      }

      const postIds = pendingReports.map((report) => report.post_id).filter(Boolean) as string[];
      const reporterIds = pendingReports.map((report) => report.reporter_id).filter(Boolean) as string[];
      const reportedUserIds = pendingReports.map((report) => report.reported_user_id).filter(Boolean) as string[];

      const [postsResult, reportersResult, reportedUsersResult] = await Promise.all([
        postIds.length > 0
          ? supabase.from("posts").select("id, text, image_url").in("id", postIds)
          : Promise.resolve({ data: [] as Array<{ id: string; text: string | null; image_url: string | null }>, error: null }),
        reporterIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", reporterIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
        reportedUserIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", reportedUserIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
      ]);

      if (postsResult.error) {
        throw postsResult.error;
      }
      if (reportersResult.error) {
        throw reportersResult.error;
      }
      if (reportedUsersResult.error) {
        throw reportedUsersResult.error;
      }

      const postsById = new Map((postsResult.data ?? []).map((post) => [post.id, post]));
      const reportersById = new Map((reportersResult.data ?? []).map((profile) => [profile.id, profile]));
      const reportedUsersById = new Map((reportedUsersResult.data ?? []).map((profile) => [profile.id, profile]));

      const nextReportedPosts = pendingReports.map((report) => {
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
        } satisfies AdminReportedPostItem;
      });

      setReportedPosts(nextReportedPosts);
    } catch (error) {
      console.error("loadReportedPosts error", error);
      setReportedPosts([]);
      setReportedPostsError("Unable to load reported posts right now.");
    } finally {
      setIsLoadingReportedPosts(false);
    }
  };

  const loadReportedComments = async () => {
    setIsLoadingReportedComments(true);
    setReportedCommentsError(null);

    try {
      const { data: reportRows, error: reportsError } = await supabase
        .from("reports")
        .select("id, reason, created_at, status, report_type, comment_id, reporter_id, reported_user_id")
        .eq("report_type", "comment")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (reportsError) {
        throw reportsError;
      }

      const pendingReports = (reportRows ?? []) as Array<{
        id: string;
        reason: string | null;
        created_at: string;
        comment_id: string | null;
        reporter_id: string | null;
        reported_user_id: string | null;
      }>;

      if (pendingReports.length === 0) {
        setReportedComments([]);
        return;
      }

      const commentIds = pendingReports.map((report) => report.comment_id).filter(Boolean) as string[];
      const reporterIds = pendingReports.map((report) => report.reporter_id).filter(Boolean) as string[];
      const commentAuthorIds = pendingReports.map((report) => report.reported_user_id).filter(Boolean) as string[];

      const [commentsResult, reportersResult, commentAuthorsResult] = await Promise.all([
        commentIds.length > 0
          ? supabase.from("comments").select("id, text, author_id").in("id", commentIds)
          : Promise.resolve({ data: [] as Array<{ id: string; text: string | null; author_id: string | null }>, error: null }),
        reporterIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", reporterIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
        commentAuthorIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", commentAuthorIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
      ]);

      if (commentsResult.error) {
        throw commentsResult.error;
      }
      if (reportersResult.error) {
        throw reportersResult.error;
      }
      if (commentAuthorsResult.error) {
        throw commentAuthorsResult.error;
      }

      const commentsById = new Map((commentsResult.data ?? []).map((comment) => [comment.id, comment]));
      const reportersById = new Map((reportersResult.data ?? []).map((profile) => [profile.id, profile]));
      const commentAuthorsById = new Map((commentAuthorsResult.data ?? []).map((profile) => [profile.id, profile]));

      const nextReportedComments = pendingReports.map((report) => {
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
        } satisfies AdminReportedCommentItem;
      });

      setReportedComments(nextReportedComments);
    } catch (error) {
      console.error("loadReportedComments error", error);
      setReportedComments([]);
      setReportedCommentsError("Unable to load reported comments right now.");
    } finally {
      setIsLoadingReportedComments(false);
    }
  };

  const truncateMessagePreview = (value: string | null | undefined) => {
    const normalized = (value ?? "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "Message preview unavailable.";
    }

    if (normalized.length <= 200) {
      return normalized;
    }

    return `${normalized.slice(0, 197)}...`;
  };

  const loadReportedMessages = async () => {
    setIsLoadingReportedMessages(true);
    setReportedMessagesError(null);

    try {
      const { data: reportRows, error: reportsError } = await supabase
        .from("reports")
        .select("id, reason, created_at, status, report_type, message_id, reporter_id, reported_user_id")
        .eq("report_type", "message")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (reportsError) {
        throw reportsError;
      }

      const pendingReports = (reportRows ?? []) as Array<{
        id: string;
        reason: string | null;
        created_at: string;
        message_id: string | null;
        reporter_id: string | null;
        reported_user_id: string | null;
      }>;

      if (pendingReports.length === 0) {
        setReportedMessages([]);
        return;
      }

      const messageIds = pendingReports.map((report) => report.message_id).filter(Boolean) as string[];
      const reporterIds = pendingReports.map((report) => report.reporter_id).filter(Boolean) as string[];
      const senderIds = pendingReports.map((report) => report.reported_user_id).filter(Boolean) as string[];

      const [messagesResult, reportersResult, sendersResult] = await Promise.all([
        messageIds.length > 0
          ? supabase.from("messages").select("id, text, sender_id, conversation_id, created_at").in("id", messageIds)
          : Promise.resolve({ data: [] as Array<{ id: string; text: string | null; sender_id: string | null; conversation_id: string | null; created_at: string | null }>, error: null }),
        reporterIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", reporterIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
        senderIds.length > 0
          ? supabase.from("profiles").select("id, username").in("id", senderIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }>, error: null }),
      ]);

      if (messagesResult.error) {
        throw messagesResult.error;
      }
      if (reportersResult.error) {
        throw reportersResult.error;
      }
      if (sendersResult.error) {
        throw sendersResult.error;
      }

      const messagesById = new Map((messagesResult.data ?? []).map((message) => [message.id, message]));
      const reportersById = new Map((reportersResult.data ?? []).map((profile) => [profile.id, profile]));
      const sendersById = new Map((sendersResult.data ?? []).map((profile) => [profile.id, profile]));

      const conversationIds = Array.from(new Set((messagesResult.data ?? []).map((message) => message.conversation_id).filter(Boolean) as string[]));
      const conversationsResult = conversationIds.length > 0
        ? await supabase.from("conversations").select("id, user_1, user_2").in("id", conversationIds)
        : { data: [] as Array<{ id: string; user_1: string | null; user_2: string | null }>, error: null };

      if (conversationsResult.error) {
        throw conversationsResult.error;
      }

      const conversationsById = new Map((conversationsResult.data ?? []).map((conversation) => [conversation.id, conversation]));
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
        : { data: [] as Array<{ id: string; username: string | null }>, error: null };

      if (receiversResult.error) {
        throw receiversResult.error;
      }

      const receiversById = new Map((receiversResult.data ?? []).map((profile) => [profile.id, profile]));

      const nextReportedMessages = pendingReports.map((report) => {
        const message = report.message_id ? messagesById.get(report.message_id) : null;
        const reporter = report.reporter_id ? reportersById.get(report.reporter_id) : null;
        const sender = report.reported_user_id ? sendersById.get(report.reported_user_id) : null;
        const receiverId = message?.id ? receiversByMessageId.get(message.id) : null;
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
          senderUserId: message?.sender_id ?? report.reported_user_id ?? null,
          reporterUserId: report.reporter_id ?? null,
        } satisfies AdminReportedMessageItem;
      });

      setReportedMessages(nextReportedMessages);
    } catch (error) {
      console.error("loadReportedMessages error", error);
      setReportedMessages([]);
      setReportedMessagesError("Unable to load reported messages right now.");
    } finally {
      setIsLoadingReportedMessages(false);
    }
  };

  const handleDeleteReportedPost = async (item: AdminReportedPostItem) => {
    if (!item.postId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error: deletePostError } = await supabase.from("posts").delete().eq("id", item.postId);
      if (deletePostError) {
        throw deletePostError;
      }

      const { error: deleteReportsError } = await supabase.from("reports").delete().eq("post_id", item.postId);
      if (deleteReportsError) {
        throw deleteReportsError;
      }

      await loadReportedPosts();
      showActionFeedback("Post deleted and linked reports removed.");
    } catch (error) {
      console.error("handleDeleteReportedPost error", error);
      setReportedPostsError("Failed to delete this post.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDeleteReportedComment = async (item: AdminReportedCommentItem) => {
    if (!item.commentId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error: deleteCommentError } = await supabase.from("comments").delete().eq("id", item.commentId);
      if (deleteCommentError) {
        throw deleteCommentError;
      }

      const { error: deleteReportsError } = await supabase.from("reports").delete().eq("comment_id", item.commentId);
      if (deleteReportsError) {
        throw deleteReportsError;
      }

      await loadReportedComments();
      showActionFeedback("Comment deleted and linked reports removed.");
    } catch (error) {
      console.error("handleDeleteReportedComment error", error);
      setReportedCommentsError("Failed to delete this comment.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDismissReportedPost = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
      if (error) {
        throw error;
      }

      await loadReportedPosts();
      showActionFeedback("Report dismissed.");
    } catch (error) {
      console.error("handleDismissReportedPost error", error);
      setReportedPostsError("Failed to dismiss this report.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDismissReportedComment = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
      if (error) {
        throw error;
      }

      await loadReportedComments();
      showActionFeedback("Report dismissed.");
    } catch (error) {
      console.error("handleDismissReportedComment error", error);
      setReportedCommentsError("Failed to dismiss this report.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDeleteReportedMessage = async (item: AdminReportedMessageItem) => {
    if (!item.messageId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error: deleteMessageError } = await supabase.from("messages").delete().eq("id", item.messageId);
      if (deleteMessageError) {
        throw deleteMessageError;
      }

      const { error: deleteReportsError } = await supabase.from("reports").delete().eq("message_id", item.messageId);
      if (deleteReportsError) {
        throw deleteReportsError;
      }

      await loadReportedMessages();
      showActionFeedback("Message deleted and linked reports removed.");
    } catch (error) {
      console.error("handleDeleteReportedMessage error", error);
      setReportedMessagesError("Failed to delete this message.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDismissReportedMessage = async (reportId: string) => {
    setBusyReportId(reportId);
    try {
      const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
      if (error) {
        throw error;
      }

      await loadReportedMessages();
      showActionFeedback("Report dismissed.");
    } catch (error) {
      console.error("handleDismissReportedMessage error", error);
      setReportedMessagesError("Failed to dismiss this report.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleSuspendReportedSender = async (item: AdminReportedMessageItem) => {
    if (!item.senderUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.senderUserId);
      if (error) {
        throw error;
      }

      await loadReportedMessages();
      showActionFeedback("Sender suspended.");
    } catch (error) {
      console.error("handleSuspendReportedSender error", error);
      setReportedMessagesError("Failed to suspend this sender.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleBanReportedSender = async (item: AdminReportedMessageItem) => {
    if (!item.senderUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.senderUserId);
      if (error) {
        throw error;
      }

      await loadReportedMessages();
      showActionFeedback("Sender banned.");
    } catch (error) {
      console.error("handleBanReportedSender error", error);
      setReportedMessagesError("Failed to ban this sender.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleSuspendReportedUser = async (item: AdminReportedPostItem) => {
    if (!item.reportedUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.reportedUserId);
      if (error) {
        throw error;
      }

      await loadReportedPosts();
      showActionFeedback("User suspended.");
    } catch (error) {
      console.error("handleSuspendReportedUser error", error);
      setReportedPostsError("Failed to suspend this user.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleSuspendReportedCommentAuthor = async (item: AdminReportedCommentItem) => {
    if (!item.commentAuthorUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", item.commentAuthorUserId);
      if (error) {
        throw error;
      }

      await loadReportedComments();
      showActionFeedback("User suspended.");
    } catch (error) {
      console.error("handleSuspendReportedCommentAuthor error", error);
      setReportedCommentsError("Failed to suspend this user.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleBanReportedCommentAuthor = async (item: AdminReportedCommentItem) => {
    if (!item.commentAuthorUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.commentAuthorUserId);
      if (error) {
        throw error;
      }

      await loadReportedComments();
      showActionFeedback("User banned.");
    } catch (error) {
      console.error("handleBanReportedCommentAuthor error", error);
      setReportedCommentsError("Failed to ban this user.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleBanReportedUser = async (item: AdminReportedPostItem) => {
    if (!item.reportedUserId) {
      return;
    }

    setBusyReportId(item.reportId);
    try {
      const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", item.reportedUserId);
      if (error) {
        throw error;
      }

      await loadReportedPosts();
      showActionFeedback("User banned.");
    } catch (error) {
      console.error("handleBanReportedUser error", error);
      setReportedPostsError("Failed to ban this user.");
    } finally {
      setBusyReportId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const verifyAdminAccess = async () => {
      setIsCheckingAccess(true);
      setHasAdminAccess(false);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user?.id) {
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (profileError) {
          return;
        }

        setHasAdminAccess(profileData?.is_admin === true);
      } catch {
        if (isMounted) {
          setHasAdminAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAccess(false);
        }
      }
    };

    void verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasAdminAccess) {
      return;
    }

    const loadAdminDashboard = async () => {
      setIsLoadingAdminDashboard(true);

      try {
        const [usersResult, postsResult, commentsResult, likesResult, reportsResult] = await Promise.allSettled([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase.from("comments").select("*", { count: "exact", head: true }),
          supabase.from("post_likes").select("*", { count: "exact", head: true }),
          supabase.from("reports").select("id, status", { count: "exact", head: true }),
        ]);

        const users = usersResult.status === "fulfilled" ? usersResult.value.count ?? 0 : 0;
        const posts = postsResult.status === "fulfilled" ? postsResult.value.count ?? 0 : 0;
        const comments = commentsResult.status === "fulfilled" ? commentsResult.value.count ?? 0 : 0;
        const likes = likesResult.status === "fulfilled" ? likesResult.value.count ?? 0 : 0;
        const reports = reportsResult.status === "fulfilled" ? reportsResult.value.count ?? 0 : 0;

        let onlineNow = 0;
        try {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", fiveMinutesAgo);
          onlineNow = count ?? 0;
        } catch {
          onlineNow = 0;
        }

        setAdminStats({ users, posts, comments, likes, reports, onlineNow });

        try {
          await loadReportedPosts();
        } catch {
          // reported posts are optional for this dashboard step
        }

        try {
          await loadReportedComments();
        } catch {
          // reported comments are optional for this dashboard step
        }

        try {
          await loadReportedMessages();
        } catch {
          // reported messages are optional for this dashboard step
        }

        try {
          const [postsActivity, commentsActivity, likesActivity] = await Promise.all([
            supabase.from("posts").select("id, created_at, text").order("created_at", { ascending: false }).limit(5),
            supabase.from("comments").select("id, created_at, text").order("created_at", { ascending: false }).limit(5),
            supabase.from("post_likes").select("id, created_at").order("created_at", { ascending: false }).limit(5),
          ]);

          const recentActivity: AdminActivityItem[] = [];
          recentActivity.push(
            ...(postsActivity.data ?? []).map((item: any) => ({
              id: `post-${item.id}`,
              title: "New post",
              description: item.text ? item.text.slice(0, 90) : "A new post was published.",
              timestamp: item.created_at,
            })),
            ...(commentsActivity.data ?? []).map((item: any) => ({
              id: `comment-${item.id}`,
              title: "Comment added",
              description: item.text ? item.text.slice(0, 90) : "A new comment was posted.",
              timestamp: item.created_at,
            })),
            ...(likesActivity.data ?? []).map((item: any) => ({
              id: `like-${item.id}`,
              title: "Post liked",
              description: "A post received a new like.",
              timestamp: item.created_at,
            }))
          );

          recentActivity.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
          setAdminActivity(recentActivity.slice(0, 10));
        } catch {
          setAdminActivity([]);
        }

        try {
          const { data, error } = await supabase.from("reports").select("id, status");
          if (!error && Array.isArray(data)) {
            const nextSummary = data.reduce<AdminReportSummary>(
              (summary, item: any) => {
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
            setAdminReports(nextSummary);
          } else {
            setAdminReports({ total: 0, pending: 0, reviewed: 0, escalated: 0 });
          }
        } catch {
          setAdminReports({ total: 0, pending: 0, reviewed: 0, escalated: 0 });
        }
      } catch {
        setAdminStats({ users: 0, posts: 0, comments: 0, likes: 0, reports: 0, onlineNow: 0 });
        setAdminActivity([]);
        setAdminReports({ total: 0, pending: 0, reviewed: 0, escalated: 0 });
      } finally {
        setIsLoadingAdminDashboard(false);
      }
    };

    void loadAdminDashboard();
  }, [hasAdminAccess]);

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
            <p className="text-lg font-semibold text-slate-900">Checking access…</p>
            <p className="mt-2 text-sm text-slate-600">Please wait while we confirm your admin permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <p className="text-lg font-semibold text-slate-900">Sorry, you're not an admin.</p>
            <p className="mt-2 text-sm text-slate-600">This area is restricted to MeToYou administrators.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" />
          ← Back
        </button>

        <div className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Developer/Admin</p>
              <h1 className="text-3xl font-bold text-slate-950">Admin dashboard</h1>
              <p className="mt-2 text-sm text-slate-600">A safer, dedicated workspace for moderation tools and platform insights.</p>
            </div>
            {isLoadingAdminDashboard && <p className="text-sm text-slate-500">Loading live data…</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Users", value: adminStats.users, icon: User, tone: "from-sky-500 to-blue-500", action: () => navigate("/admin-users") },
              { label: "Posts", value: adminStats.posts, icon: Activity, tone: "from-violet-500 to-fuchsia-500", action: () => navigate("/admin-posts") },
              { label: "Comments", value: adminStats.comments, icon: AlertTriangle, tone: "from-amber-500 to-orange-500" },
              { label: "Likes", value: adminStats.likes, icon: Heart, tone: "from-rose-500 to-pink-500" },
              { label: "Reports", value: adminStats.reports, icon: ShieldAlert, tone: "from-red-500 to-rose-500" },
              { label: "Online now", value: adminStats.onlineNow, icon: UserCheck, tone: "from-emerald-500 to-teal-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.action?.()}
                  className="rounded-2xl border border-white/60 bg-white/80 p-4 text-left shadow-sm transition hover:bg-white"
                >
                  <div className={`mb-3 inline-flex rounded-2xl bg-gradient-to-br ${item.tone} p-2 text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                  <p className="text-sm text-slate-500">{item.label}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  <h2 className="font-semibold text-slate-900">Recent activity</h2>
                </div>
                {adminActivity.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {adminActivity.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-800">{item.title}</p>
                            <p className="text-sm text-slate-500">{item.description}</p>
                          </div>
                          <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-slate-500" />
                  <h2 className="font-semibold text-slate-900">Reports overview</h2>
                </div>
                {adminReports.total === 0 ? (
                  <p className="text-sm text-slate-500">No reports available.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { label: "Total", value: adminReports.total, tone: "bg-slate-100 text-slate-700" },
                      { label: "Pending", value: adminReports.pending, tone: "bg-amber-100 text-amber-700" },
                      { label: "Reviewed", value: adminReports.reviewed, tone: "bg-emerald-100 text-emerald-700" },
                      { label: "Escalated", value: adminReports.escalated, tone: "bg-rose-100 text-rose-700" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-2xl px-3 py-3 ${item.tone}`}>
                        <p className="text-lg font-semibold">{item.value}</p>
                        <p className="text-sm">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Reported posts</p>
                    <span className="text-xs text-slate-500">Pending only</span>
                  </div>

                  {reportedPostsError ? <p className="mb-2 text-sm text-rose-600">{reportedPostsError}</p> : null}
                  {actionFeedback ? <div className="mb-3 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{actionFeedback}</div> : null}

                  {isLoadingReportedPosts ? (
                    <p className="text-sm text-slate-500">Loading reported posts…</p>
                  ) : reportedPosts.length === 0 ? (
                    <p className="text-sm text-slate-500">No pending reported posts.</p>
                  ) : (
                    <div className="space-y-3">
                      {reportedPosts.map((item) => (
                        <div key={item.reportId} className="rounded-2xl border border-slate-100 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.reportReason}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(item.reportDate).toLocaleString()} • Reporter: {item.reporterUsername} • Reported: {item.reportedUsername}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{item.postPreview || "Post preview unavailable."}</p>
                          {item.postImageUrl ? <img src={item.postImageUrl} alt="Reported post" className="mt-3 max-h-48 w-full rounded-xl border border-slate-200 object-cover" /> : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedReportedPost(item)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />View Post</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDeleteReportedPost(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Delete Post</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleSuspendReportedUser(item)} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><UserX className="h-3.5 w-3.5" />Suspend User</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleBanReportedUser(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" />Ban User</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDismissReportedPost(item.reportId)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Dismiss Report</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Reported comments</p>
                    <span className="text-xs text-slate-500">Pending only</span>
                  </div>

                  {reportedCommentsError ? <p className="mb-2 text-sm text-rose-600">{reportedCommentsError}</p> : null}

                  {isLoadingReportedComments ? (
                    <p className="text-sm text-slate-500">Loading reported comments…</p>
                  ) : reportedComments.length === 0 ? (
                    <p className="text-sm text-slate-500">No pending reported comments.</p>
                  ) : (
                    <div className="space-y-3">
                      {reportedComments.map((item) => (
                        <div key={item.reportId} className="rounded-2xl border border-slate-100 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.reportReason}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(item.reportDate).toLocaleString()} • Reporter: {item.reporterUsername} • Author: {item.commentAuthorUsername}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{item.commentPreview || "Comment preview unavailable."}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedReportedComment(item)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />View Comment</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDeleteReportedComment(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Delete Comment</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleSuspendReportedCommentAuthor(item)} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><UserX className="h-3.5 w-3.5" />Suspend User</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleBanReportedCommentAuthor(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" />Ban User</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDismissReportedComment(item.reportId)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Dismiss Report</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Reported messages</p>
                    <span className="text-xs text-slate-500">Pending only</span>
                  </div>

                  {reportedMessagesError ? <p className="mb-2 text-sm text-rose-600">{reportedMessagesError}</p> : null}

                  {isLoadingReportedMessages ? (
                    <p className="text-sm text-slate-500">Loading reported messages…</p>
                  ) : reportedMessages.length === 0 ? (
                    <p className="text-sm text-slate-500">No pending reported messages.</p>
                  ) : (
                    <div className="space-y-3">
                      {reportedMessages.map((item) => (
                        <div key={item.reportId} className="rounded-2xl border border-slate-100 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.reportReason}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(item.reportDate).toLocaleString()} • Reporter: {item.reporterUsername} • Sender: {item.senderUsername} • Receiver: {item.receiverUsername}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{item.messagePreview || "Message preview unavailable."}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedReportedMessage(item)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />View Full Message</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDeleteReportedMessage(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Delete Message</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleSuspendReportedSender(item)} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><UserX className="h-3.5 w-3.5" />Suspend Sender</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleBanReportedSender(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" />Ban Sender</span>
                            </button>
                            <button type="button" disabled={busyReportId === item.reportId} onClick={() => void handleDismissReportedMessage(item.reportId)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
                              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Dismiss Report</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>

      {selectedReportedPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => setSelectedReportedPost(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedReportedPost.reportReason}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(selectedReportedPost.reportDate).toLocaleString()}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selectedReportedPost.postPreview || "Post preview unavailable."}</p>
              {selectedReportedPost.postImageUrl ? <img src={selectedReportedPost.postImageUrl} alt="Reported post" className="mt-3 max-h-72 w-full rounded-xl border border-slate-200 object-cover" /> : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedReportedComment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => setSelectedReportedComment(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedReportedComment.reportReason}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(selectedReportedComment.reportDate).toLocaleString()}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selectedReportedComment.commentPreview || "Comment preview unavailable."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {selectedReportedMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => setSelectedReportedMessage(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedReportedMessage.reportReason}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(selectedReportedMessage.reportDate).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>Sender: {selectedReportedMessage.senderUsername}</span>
                <span>Receiver: {selectedReportedMessage.receiverUsername}</span>
                <span>Time: {selectedReportedMessage.messageTimestamp ? new Date(selectedReportedMessage.messageTimestamp).toLocaleString() : "Unknown"}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selectedReportedMessage.fullMessage || "Message unavailable."}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
