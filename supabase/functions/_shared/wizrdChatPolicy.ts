export type UsageCounts = {
  dailyCount: number;
  recentCount: number;
};

export type UsageLimitDecision = "daily" | "rate" | null;

export type TokenUsageStatus =
  | "pending"
  | "reported"
  | "partial"
  | "unavailable"
  | "failed"
  | "legacy_unverified";

export type CompletedTokenUsageStatus = Exclude<
  TokenUsageStatus,
  "pending" | "failed" | "legacy_unverified"
>;

export const DEFAULT_DAILY_MESSAGE_LIMIT = 20;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 5;

export function extractBearerToken(
  authorization: string | null,
): string | null {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function conversationBelongsTo(
  requestedUserId: string,
  conversationUserId: string | null | undefined,
): boolean {
  return conversationUserId === requestedUserId;
}

export function usageLimitDecision(
  counts: UsageCounts,
  dailyLimit: number,
  rateLimit: number,
): UsageLimitDecision {
  if (counts.dailyCount >= dailyLimit) return "daily";
  if (counts.recentCount >= rateLimit) return "rate";
  return null;
}

export function completedTokenUsageStatus(
  inputTokens: number | null,
  outputTokens: number | null,
): CompletedTokenUsageStatus {
  if (inputTokens !== null && outputTokens !== null) return "reported";
  if (inputTokens !== null || outputTokens !== null) return "partial";
  return "unavailable";
}

export function hasRequiredDatabasePrivileges(
  privileges: Record<string, boolean>,
): boolean {
  const checks = Object.values(privileges);
  return checks.length > 0 && checks.every(Boolean);
}
