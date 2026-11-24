import { describe, expect, it } from "vitest";
import {
  canCopyWizrdMessage,
  getWizrdCodeBlockContent,
  getWizrdCodeBlockLanguage,
} from "./wizrdCopy";

describe("WiZrd copy content", () => {
  it.each([
    ["tsx", "  const value: number = 1;\n  console.log(value);", "tsx"],
    ["javascript", "  const value = 1;\n  console.log(value);", "javascript"],
    ["", "  const value = 1;\n  console.log(value);", null],
  ])(
    "copies fenced %s code without changing its text",
    (language, code, expectedLanguage) => {
      const block = {
        content: `${code}\n`,
        sourceInfo: language || undefined,
      };

      expect(getWizrdCodeBlockLanguage(block.sourceInfo)).toBe(
        expectedLanguage,
      );
      expect(getWizrdCodeBlockContent(block.content)).toBe(code);
    },
  );

  it("preserves whitespace and extracts multiple blocks independently", () => {
    const first = "function first() {\n    return 1;\n}";
    const second = "  const second = [\n    1,\n    2,\n  ];";
    const blocks = [
      { content: `${first}\n`, sourceInfo: "ts" },
      { content: `${second}\n`, sourceInfo: "js" },
    ];

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => getWizrdCodeBlockContent(block.content)))
      .toEqual([
        first,
        second,
      ]);
  });

  it("does not truncate long code or assistant message content", () => {
    const longCode = Array.from(
      { length: 1200 },
      (_, index) => `  line${index};`,
    ).join("\n");
    const block = { content: `${longCode}\n`, sourceInfo: "js" };
    const fullMessage = `Intro\n\n\`\`\`js\n${longCode}\n\`\`\`\n\nConclusion`;

    expect(getWizrdCodeBlockContent(block.content)).toBe(longCode);
    expect(fullMessage).toContain(longCode);
    expect(fullMessage.length).toBeGreaterThan(10_000);
  });

  it("allows copy only for complete assistant messages", () => {
    expect(canCopyWizrdMessage({ role: "assistant" })).toBe(true);
    expect(canCopyWizrdMessage({ role: "user" })).toBe(false);
    expect(canCopyWizrdMessage({ role: "assistant", isStreaming: true })).toBe(
      false,
    );
    expect(canCopyWizrdMessage({ role: "assistant", isIncomplete: true })).toBe(
      false,
    );
  });
});
