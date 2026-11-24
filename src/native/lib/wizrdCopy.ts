export type WizrdCodeBlockNode = {
  content: string;
  sourceInfo?: string;
};

export function getWizrdCodeBlockContent(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content;
}

export function getWizrdCodeBlockLanguage(
  sourceInfo: string | undefined,
): string | null {
  const language = sourceInfo?.trim().split(/\s+/, 1)[0];
  return language || null;
}

export function canCopyWizrdMessage(input: {
  role: "user" | "assistant";
  isStreaming?: boolean;
  isIncomplete?: boolean;
}): boolean {
  return input.role === "assistant" && !input.isStreaming &&
    !input.isIncomplete;
}
