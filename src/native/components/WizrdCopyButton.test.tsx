import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeWizrdCodeBlockRenderer } from "./NativeWizrdCodeBlock";
import WizrdCopyButton from "./WizrdCopyButton";

const mocks = vi.hoisted(() => ({
  setStringAsync: vi.fn(),
}));

vi.mock("expo-clipboard", () => ({
  setStringAsync: mocks.setStringAsync,
}));

vi.mock("lucide-react-native", async () => {
  const React = await import("react");
  const Icon = ({ color }: { color?: string }) =>
    React.createElement("span", { style: { color } });
  return { Check: Icon, Copy: Icon };
});

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Platform: { OS: "ios" },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel: string;
      children: React.ReactNode;
      disabled: boolean;
      onPress: (event: { stopPropagation: () => void }) => void;
    }) =>
      React.createElement(
        "button",
        {
          "aria-label": accessibilityLabel,
          disabled,
          onClick: (event: { stopPropagation: () => void }) =>
            onPress({ stopPropagation: () => event.stopPropagation() }),
        },
        children,
      ),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement("span", null, children),
    View: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

const colors = {
  text: "#ffffff",
  muted: "#a1a1aa",
  control: "#20202a",
  border: "#444455",
};

function renderCodeBlocks(
  blocks: Array<{ content: string; language?: string }>,
) {
  const renderer = createNativeWizrdCodeBlockRenderer(colors);
  return render(
    <>
      {blocks.map((block, index) =>
        renderer(
          {
            content: block.content,
            sourceInfo: block.language,
            key: `block-${index}`,
            type: "fence",
            sourceType: "fence",
            markup: "```",
            tokenIndex: index,
            index,
            attributes: {},
            children: [],
          } as import("react-native-markdown-display").ASTNode & {
            sourceInfo?: string;
          },
          [],
          [],
          {},
        )
      )}
    </>,
  );
}

describe("WiZrd copy controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setStringAsync.mockResolvedValue(true);
  });

  it.each([
    ["tsx", "  const value: number = 1;\n  console.log(value);"],
    ["javascript", "  const value = 1;\n  console.log(value);"],
    ["", "  const value = 1;\n  console.log(value);"],
  ])(
    "copies a %s code block without its fence or language label",
    async (language, code) => {
      renderCodeBlocks([{
        content: `${code}\n`,
        language: language || undefined,
      }]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
      });

      expect(mocks.setStringAsync).toHaveBeenCalledWith(code);
    },
  );

  it("copies two code blocks independently and keeps the language label separate", async () => {
    const first = "function first() {\n  return 1;\n}";
    const second = "  const second = [\n    1,\n    2,\n  ];";
    renderCodeBlocks([
      { content: `${first}\n`, language: "ts" },
      { content: `${second}\n`, language: "js" },
    ]);

    const buttons = screen.getAllByRole("button", { name: "Copy code" });
    expect(screen.getByText("ts")).toBeTruthy();
    expect(screen.getByText("js")).toBeTruthy();
    await act(async () => {
      fireEvent.click(buttons[1]);
    });

    expect(mocks.setStringAsync).toHaveBeenCalledTimes(1);
    expect(mocks.setStringAsync).toHaveBeenCalledWith(second);
  });

  it("copies the complete original assistant Markdown, including long content", async () => {
    const response = `First paragraph.\n\n\`\`\`ts\n${
      "  code();\n".repeat(1400)
    }\`\`\`\n\n- item one\n- item two`;
    render(
      <WizrdCopyButton
        color="#ffffff"
        content={response}
        kind="message"
        mutedColor="#a1a1aa"
      />,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy assistant message" }),
      );
    });

    expect(mocks.setStringAsync).toHaveBeenCalledWith(response);
    expect(response.length).toBeGreaterThan(10_000);
    expect(screen.getByRole("button", { name: "Copied assistant message" }))
      .toBeTruthy();
  });

  it("blocks duplicate taps while the clipboard operation is pending", async () => {
    let resolveCopy!: (result: boolean) => void;
    mocks.setStringAsync.mockImplementation(() =>
      new Promise<boolean>((resolve) => {
        resolveCopy = resolve;
      })
    );
    render(
      <WizrdCopyButton
        color="#ffffff"
        content="same content"
        kind="code"
        mutedColor="#a1a1aa"
      />,
    );

    const button = screen.getByRole("button", { name: "Copy code" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.setStringAsync).toHaveBeenCalledTimes(1);

    await act(async () => resolveCopy(true));
    expect(screen.getByRole("button", { name: "Copied code" })).toBeTruthy();
  });

  it("shows a recoverable failure state when clipboard writing rejects", async () => {
    mocks.setStringAsync.mockRejectedValue(new Error("Clipboard unavailable"));
    render(
      <WizrdCopyButton
        color="#ffffff"
        content="code"
        kind="code"
        mutedColor="#a1a1aa"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });

    expect(screen.getByRole("button", { name: "Could not copy code" }))
      .toBeTruthy();
    expect(screen.getByText("Copy failed")).toBeTruthy();
  });

  it("restores the original copy label after the confirmation interval", async () => {
    vi.useFakeTimers();
    try {
      render(
        <WizrdCopyButton
          color="#ffffff"
          content="code"
          kind="code"
          mutedColor="#a1a1aa"
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
      });
      expect(screen.getByRole("button", { name: "Copied code" })).toBeTruthy();

      act(() => vi.advanceTimersByTime(1600));
      expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops a copy tap from propagating to a parent interaction", async () => {
    const parentPress = vi.fn();
    render(
      <div onClick={parentPress}>
        <WizrdCopyButton
          color="#ffffff"
          content="code"
          kind="code"
          mutedColor="#a1a1aa"
        />
      </div>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });

    expect(parentPress).not.toHaveBeenCalled();
  });
});
