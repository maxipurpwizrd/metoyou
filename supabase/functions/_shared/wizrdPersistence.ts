import {
  type CompletedTokenUsageStatus,
  completedTokenUsageStatus,
  type TokenUsageStatus,
} from "./wizrdChatPolicy.ts";

export type PersistedWizrdMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: Date | string;
};

export type WizrdPersistenceOperations = {
  createConversation(userId: string, title: string): Promise<string>;
  touchConversation(userId: string, conversationId: string): Promise<void>;
  insertMessage(
    conversationId: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<PersistedWizrdMessage>;
  completeUsage(
    usageId: string,
    userId: string,
    conversationId: string,
    inputTokens: number | null,
    outputTokens: number | null,
    tokenUsageStatus: CompletedTokenUsageStatus,
    latencyMs: number,
  ): Promise<TokenUsageStatus | null>;
};

export type PersistWizrdConversationInput = {
  userId: string;
  requestedConversationId: string | null;
  message: string;
  assistantText: string;
  usageId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  tokenUsageStatus?: CompletedTokenUsageStatus;
  latencyMs: number;
};

export async function persistWizrdConversation(
  operations: WizrdPersistenceOperations,
  input: PersistWizrdConversationInput,
) {
  let conversationId = input.requestedConversationId;
  if (conversationId === null) {
    const title = input.message.replace(/\s+/g, " ").trim().slice(0, 80) ||
      "New conversation";
    conversationId = await operations.createConversation(input.userId, title);
  } else {
    await operations.touchConversation(input.userId, conversationId);
  }

  const userMessage = await operations.insertMessage(
    conversationId,
    input.userId,
    "user",
    input.message,
  );
  const assistantMessage = await operations.insertMessage(
    conversationId,
    input.userId,
    "assistant",
    input.assistantText,
  );

  const persistedTokenUsageStatus = await operations.completeUsage(
    input.usageId,
    input.userId,
    conversationId,
    input.inputTokens,
    input.outputTokens,
    input.tokenUsageStatus ??
      completedTokenUsageStatus(input.inputTokens, input.outputTokens),
    input.latencyMs,
  );
  if (persistedTokenUsageStatus === null) {
    throw new Error("Usage reservation was no longer pending");
  }

  return {
    conversationId,
    userMessage,
    assistantMessage,
    tokenUsageStatus: persistedTokenUsageStatus,
  };
}
