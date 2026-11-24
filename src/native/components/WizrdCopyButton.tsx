import { useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { Check, Copy } from "lucide-react-native";
import { setStringAsync } from "expo-clipboard";

type Props = {
  content: string;
  kind: "code" | "message";
  color: string;
  mutedColor: string;
};

type CopyState = "idle" | "copied" | "failed";

const FEEDBACK_DURATION_MS = 1600;

export default function WizrdCopyButton({
  content,
  kind,
  color,
  mutedColor,
}: Props) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  const copy = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    let result: CopyState = "copied";
    try {
      if (!await setStringAsync(content)) result = "failed";
    } catch {
      result = "failed";
    } finally {
      busyRef.current = false;
      setBusy(false);
      setCopyState(result);
      feedbackTimerRef.current = setTimeout(() => {
        setCopyState("idle");
        feedbackTimerRef.current = null;
      }, FEEDBACK_DURATION_MS);
    }
  };

  const isCopied = copyState === "copied";
  const label = copyState === "failed"
    ? "Copy failed"
    : isCopied
    ? "Copied"
    : kind === "code"
    ? "Copy code"
    : "Copy";

  return (
    <Pressable
      accessibilityLabel={copyState === "failed"
        ? `Could not copy ${kind === "code" ? "code" : "assistant message"}`
        : isCopied
        ? `Copied ${kind === "code" ? "code" : "assistant message"}`
        : kind === "code"
        ? "Copy code"
        : "Copy assistant message"}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={copy}
      style={({ pressed }) => [
        styles.button,
        kind === "code" ? styles.codeButton : styles.messageButton,
        pressed && styles.pressed,
      ]}
    >
      {isCopied ? <Check color={color} size={14} strokeWidth={2.5} /> : (
        <Copy
          color={copyState === "failed" ? "#fda4af" : mutedColor}
          size={14}
          strokeWidth={2}
        />
      )}
      <Text
        style={[styles.label, {
          color: copyState === "failed" ? "#fda4af" : color,
        }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 9,
  },
  codeButton: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  messageButton: {
    alignSelf: "flex-end",
    marginTop: 4,
    paddingHorizontal: 7,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.65,
  },
});
