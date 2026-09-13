import { useCallback, useState } from "react";
import { adminReports } from "../services/supabase/adminReportService";
import type {
  AdminReportSummary,
  AdminReportedCommentItem,
  AdminReportedMessageItem,
  AdminReportedPostItem,
  AdminReportsService,
  ServiceActionResult,
} from "../services/adminReportTypes";

export type {
  AdminReportSummary,
  AdminReportedCommentItem,
  AdminReportedMessageItem,
  AdminReportedPostItem,
  AdminReportsService,
  ServiceActionResult,
};

export function useAdminReports(service: AdminReportsService = adminReports) {
  const [reportedPosts, setReportedPosts] = useState<AdminReportedPostItem[]>([]);
  const [isLoadingReportedPosts, setIsLoadingReportedPosts] = useState(false);
  const [reportedPostsError, setReportedPostsError] = useState<string | null>(null);

  const [reportedComments, setReportedComments] = useState<AdminReportedCommentItem[]>([]);
  const [isLoadingReportedComments, setIsLoadingReportedComments] = useState(false);
  const [reportedCommentsError, setReportedCommentsError] = useState<string | null>(null);

  const [reportedMessages, setReportedMessages] = useState<AdminReportedMessageItem[]>([]);
  const [isLoadingReportedMessages, setIsLoadingReportedMessages] = useState(false);
  const [reportedMessagesError, setReportedMessagesError] = useState<string | null>(null);

  const [reportSummary, setReportSummary] = useState<AdminReportSummary>({
    total: 0,
    pending: 0,
    reviewed: 0,
    escalated: 0,
  });
  const [isLoadingReportSummary, setIsLoadingReportSummary] = useState(false);
  const [reportSummaryError, setReportSummaryError] = useState<string | null>(null);

  const wrapAction = useCallback(
    async <T extends (...args: any[]) => Promise<any>>(
      action: T,
      onSuccess: (value: Awaited<ReturnType<T>>) => void,
      onError: (message: string) => void
    ) => {
      try {
        const result = await action();
        onSuccess(result);
      } catch (error) {
        console.error("useAdminReports action error", error);
        onError("Unable to complete this operation right now.");
      }
    },
    []
  );

  const loadReportedPosts = useCallback(async () => {
    setIsLoadingReportedPosts(true);
    setReportedPostsError(null);

    await wrapAction(
      () => service.loadReportedPosts(),
      (items) => setReportedPosts(items),
      (message) => {
        setReportedPosts([]);
        setReportedPostsError(message);
      }
    );

    setIsLoadingReportedPosts(false);
  }, [service, wrapAction]);

  const loadReportedComments = useCallback(async () => {
    setIsLoadingReportedComments(true);
    setReportedCommentsError(null);

    await wrapAction(
      () => service.loadReportedComments(),
      (items) => setReportedComments(items),
      (message) => {
        setReportedComments([]);
        setReportedCommentsError(message);
      }
    );

    setIsLoadingReportedComments(false);
  }, [service, wrapAction]);

  const loadReportedMessages = useCallback(async () => {
    setIsLoadingReportedMessages(true);
    setReportedMessagesError(null);

    await wrapAction(
      () => service.loadReportedMessages(),
      (items) => setReportedMessages(items),
      (message) => {
        setReportedMessages([]);
        setReportedMessagesError(message);
      }
    );

    setIsLoadingReportedMessages(false);
  }, [service, wrapAction]);

  const loadReportSummary = useCallback(async () => {
    setIsLoadingReportSummary(true);
    setReportSummaryError(null);

    await wrapAction(
      () => service.loadReportSummary(),
      (summary) => setReportSummary(summary),
      (message) => {
        setReportSummary({ total: 0, pending: 0, reviewed: 0, escalated: 0 });
        setReportSummaryError(message);
      }
    );

    setIsLoadingReportSummary(false);
  }, [service, wrapAction]);

  const wrapServiceAction = useCallback(
    async <T extends (...args: any[]) => Promise<ServiceActionResult>>(
      action: T,
      ...args: Parameters<T>
    ) => {
      try {
        return await action(...args);
      } catch (error) {
        console.error("useAdminReports action error", error);
        return { success: false, message: "Unable to complete this operation right now." };
      }
    },
    []
  );

  const deleteReportedPost = useCallback(async (item: AdminReportedPostItem) => {
    const result = await wrapServiceAction(service.deleteReportedPost, item);
    if (result.success) {
      await loadReportedPosts();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedPosts, loadReportSummary, wrapServiceAction]);

  const deleteReportedComment = useCallback(async (item: AdminReportedCommentItem) => {
    const result = await wrapServiceAction(service.deleteReportedComment, item);
    if (result.success) {
      await loadReportedComments();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedComments, loadReportSummary, wrapServiceAction]);

  const dismissReportedPost = useCallback(async (reportId: string) => {
    const result = await wrapServiceAction(service.dismissReportedPost, reportId);
    if (result.success) {
      await loadReportedPosts();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedPosts, loadReportSummary, wrapServiceAction]);

  const dismissReportedComment = useCallback(async (reportId: string) => {
    const result = await wrapServiceAction(service.dismissReportedComment, reportId);
    if (result.success) {
      await loadReportedComments();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedComments, loadReportSummary, wrapServiceAction]);

  const deleteReportedMessage = useCallback(async (item: AdminReportedMessageItem) => {
    const result = await wrapServiceAction(service.deleteReportedMessage, item);
    if (result.success) {
      await loadReportedMessages();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedMessages, loadReportSummary, wrapServiceAction]);

  const dismissReportedMessage = useCallback(async (reportId: string) => {
    const result = await wrapServiceAction(service.dismissReportedMessage, reportId);
    if (result.success) {
      await loadReportedMessages();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedMessages, loadReportSummary, wrapServiceAction]);

  const suspendReportedSender = useCallback(async (item: AdminReportedMessageItem) => {
    const result = await wrapServiceAction(service.suspendReportedSender, item);
    if (result.success) {
      await loadReportedMessages();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedMessages, loadReportSummary, wrapServiceAction]);

  const banReportedSender = useCallback(async (item: AdminReportedMessageItem) => {
    const result = await wrapServiceAction(service.banReportedSender, item);
    if (result.success) {
      await loadReportedMessages();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedMessages, loadReportSummary, wrapServiceAction]);

  const suspendReportedUser = useCallback(async (item: AdminReportedPostItem) => {
    const result = await wrapServiceAction(service.suspendReportedUser, item);
    if (result.success) {
      await loadReportedPosts();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedPosts, loadReportSummary, wrapServiceAction]);

  const banReportedUser = useCallback(async (item: AdminReportedPostItem) => {
    const result = await wrapServiceAction(service.banReportedUser, item);
    if (result.success) {
      await loadReportedPosts();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedPosts, loadReportSummary, wrapServiceAction]);

  const suspendReportedCommentAuthor = useCallback(async (item: AdminReportedCommentItem) => {
    const result = await wrapServiceAction(service.suspendReportedCommentAuthor, item);
    if (result.success) {
      await loadReportedComments();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedComments, loadReportSummary, wrapServiceAction]);

  const banReportedCommentAuthor = useCallback(async (item: AdminReportedCommentItem) => {
    const result = await wrapServiceAction(service.banReportedCommentAuthor, item);
    if (result.success) {
      await loadReportedComments();
      await loadReportSummary();
    }
    return result;
  }, [service, loadReportedComments, loadReportSummary, wrapServiceAction]);

  return {
    reportedPosts,
    isLoadingReportedPosts,
    reportedPostsError,
    loadReportedPosts,
    reportedComments,
    isLoadingReportedComments,
    reportedCommentsError,
    loadReportedComments,
    reportedMessages,
    isLoadingReportedMessages,
    reportedMessagesError,
    loadReportedMessages,
    reportSummary,
    isLoadingReportSummary,
    reportSummaryError,
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

export default useAdminReports;
