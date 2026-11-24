import type { PersistedWizrdMessage } from "./wizrdPersistence.ts";
import type { TokenUsageStatus } from "./wizrdChatPolicy.ts";

export type CompletedWizrdConversation = {
  conversationId: string;
  userMessage: PersistedWizrdMessage;
  assistantMessage: PersistedWizrdMessage;
  tokenUsageStatus: TokenUsageStatus;
};

export type WizrdUsageSummary = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reportedInputTokens: number | null;
  reportedOutputTokens: number | null;
  tokenUsageStatus: TokenUsageStatus;
  latencyMs: number;
};

function isoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid database timestamp");
  }
  return date.toISOString();
}

export function buildWizrdSuccessPayload(
  saved: CompletedWizrdConversation,
  usage:
    & Omit<
      WizrdUsageSummary,
      "inputTokens" | "outputTokens" | "tokenUsageStatus"
    >
    & {
      inputTokens: number | null;
      outputTokens: number | null;
    },
) {
  return {
    conversationId: saved.conversationId,
    userMessage: {
      id: saved.userMessage.id,
      role: saved.userMessage.role,
      content: saved.userMessage.content,
      createdAt: isoTimestamp(saved.userMessage.created_at),
    },
    assistantMessage: {
      id: saved.assistantMessage.id,
      role: saved.assistantMessage.role,
      content: saved.assistantMessage.content,
      createdAt: isoTimestamp(saved.assistantMessage.created_at),
    },
    usage: {
      ...usage,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      tokenUsageStatus: saved.tokenUsageStatus,
    },
  };
}
