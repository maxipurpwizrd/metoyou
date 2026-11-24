import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NativeHoldToConfirmDialog from "./NativeHoldToConfirmDialog";

vi.mock("react-native", async () => {
  const React = await import("react");
  const animation = { start: vi.fn(), stop: vi.fn() };
  const AnimatedView = ({ children }: { children: ReactNode }) =>
    React.createElement("div", null, children);
  return {
    Animated: {
      Value: class {
        interpolate() {
          return 0;
        }
        setValue() {}
      },
      View: AnimatedView,
      loop: () => animation,
      sequence: () => animation,
      timing: () => animation,
    },
    Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
      visible ? React.createElement("div", null, children) : null,
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
      onPressIn,
      onPressOut,
    }: {
      accessibilityLabel: string;
      children?: ReactNode;
      disabled: boolean;
      onPress?: () => void;
      onPressIn?: () => void;
      onPressOut?: () => void;
    }) => React.createElement("button", {
      "aria-label": accessibilityLabel,
      disabled,
      onClick: onPress,
      onMouseDown: onPressIn,
      onMouseUp: onPressOut,
    }, children),
    StyleSheet: { absoluteFill: {}, create: (styles: object) => styles },
    Text: ({ children }: { children: ReactNode }) => React.createElement("span", null, children),
    View: ({ children }: { children: ReactNode }) => React.createElement("div", null, children),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("react-native-svg", async () => {
  const React = await import("react");
  return {
    Circle: () => React.createElement("circle"),
    default: ({ children }: { children: ReactNode }) => React.createElement("svg", null, children),
    Path: () => React.createElement("path"),
  };
});

vi.mock("./NativeBlurBackdrop", () => ({ default: () => null }));

describe("NativeHoldToConfirmDialog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each scan phase and confirms only after five seconds", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(
      <NativeHoldToConfirmDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        visible
      />,
    );
    const scanner = screen.getByRole("button", { name: "Fingerprint scanner. Hold here to confirm." });

    fireEvent.mouseDown(scanner);
    expect(screen.getByText("Processing")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Initializing")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Verifying")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Confirming")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Done")).toBeTruthy();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels the scan on early release and closes when tapped outside", () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <NativeHoldToConfirmDialog
        onCancel={onCancel}
        onConfirm={onConfirm}
        visible
      />,
    );
    const scanner = screen.getByRole("button", { name: "Fingerprint scanner. Hold here to confirm." });

    fireEvent.mouseDown(scanner);
    act(() => vi.advanceTimersByTime(4_999));
    fireEvent.mouseUp(scanner);
    act(() => vi.advanceTimersByTime(100));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel confirmation" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
