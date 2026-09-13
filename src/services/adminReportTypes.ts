export type AdminReportedPostItem = {
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

export type AdminReportedCommentItem = {
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

export type AdminReportedMessageItem = {
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

export type AdminReportSummary = {
  total: number;
  pending: number;
  reviewed: number;
  escalated: number;
};

export type ServiceActionResult = {
  success: boolean;
  message: string;
};

export interface AdminReportsService {
  loadReportedPosts(): Promise<AdminReportedPostItem[]>;
  loadReportedComments(): Promise<AdminReportedCommentItem[]>;
  loadReportedMessages(): Promise<AdminReportedMessageItem[]>;
  loadReportSummary(): Promise<AdminReportSummary>;
  deleteReportedPost(item: AdminReportedPostItem): Promise<ServiceActionResult>;
  deleteReportedComment(item: AdminReportedCommentItem): Promise<ServiceActionResult>;
  dismissReportedPost(reportId: string): Promise<ServiceActionResult>;
  dismissReportedComment(reportId: string): Promise<ServiceActionResult>;
  deleteReportedMessage(item: AdminReportedMessageItem): Promise<ServiceActionResult>;
  dismissReportedMessage(reportId: string): Promise<ServiceActionResult>;
  suspendReportedSender(item: AdminReportedMessageItem): Promise<ServiceActionResult>;
  banReportedSender(item: AdminReportedMessageItem): Promise<ServiceActionResult>;
  suspendReportedUser(item: AdminReportedPostItem): Promise<ServiceActionResult>;
  banReportedUser(item: AdminReportedPostItem): Promise<ServiceActionResult>;
  suspendReportedCommentAuthor(item: AdminReportedCommentItem): Promise<ServiceActionResult>;
  banReportedCommentAuthor(item: AdminReportedCommentItem): Promise<ServiceActionResult>;
}
