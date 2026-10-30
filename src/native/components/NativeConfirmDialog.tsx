import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import NativeBlurBackdrop from "./NativeBlurBackdrop";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  emoji: string;
  destructive?: boolean;
  vibesPro?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export default function NativeConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  emoji,
  destructive = false,
  vibesPro = false,
  onCancel,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onCancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <NativeBlurBackdrop
          intensity={28}
          overlayColor={vibesPro ? "rgba(0,0,0,0.68)" : "rgba(15,23,42,0.34)"}
        />
        <Pressable
          accessibilityLabel="Dismiss confirmation"
          disabled={busy}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[styles.card, vibesPro && styles.vibesProCard]}>
          <View style={[styles.emojiBubble, destructive && styles.destructiveBubble, vibesPro && styles.vibesProBubble]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <Text style={[styles.title, vibesPro && styles.vibesProTitle]}>{title}</Text>
          <Text style={[styles.message, vibesPro && styles.vibesProMessage]}>{message}</Text>
          {error ? <Text style={[styles.error, vibesPro && styles.vibesProError]}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                vibesPro && styles.vibesProCancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.cancelText, vibesPro && styles.vibesProCancelText]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void confirm()}
              style={({ pressed }) => [
                styles.confirmButton,
                destructive && !vibesPro && styles.destructiveButton,
                vibesPro && styles.vibesProConfirmButton,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.confirmText, vibesPro && styles.vibesProConfirmText]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 28,
    backgroundColor: "#ffffff",
    shadowColor: "#075985",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  vibesProCard: {
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "#111111",
    shadowColor: "#000000",
  },
  emojiBubble: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#e0f2fe",
  },
  destructiveBubble: { backgroundColor: "#fff1f2" },
  vibesProBubble: { backgroundColor: "rgba(212,175,55,0.18)" },
  emoji: { fontSize: 28 },
  title: { marginTop: 14, color: "#0c4a6e", fontSize: 19, fontWeight: "900", textAlign: "center" },
  vibesProTitle: { color: "#ffffff" },
  message: { marginTop: 7, color: "#64748b", fontSize: 14, lineHeight: 20, textAlign: "center" },
  vibesProMessage: { color: "rgba(255,255,255,0.72)" },
  error: { marginTop: 10, color: "#be123c", fontSize: 12, lineHeight: 17, textAlign: "center" },
  vibesProError: { color: "#fda4af" },
  actions: { flexDirection: "row", alignSelf: "stretch", gap: 10, marginTop: 21 },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 15,
    backgroundColor: "#f0f9ff",
  },
  vibesProCancelButton: { borderColor: "rgba(255,255,255,0.2)", backgroundColor: "#202020" },
  confirmButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#0284c7",
  },
  destructiveButton: { backgroundColor: "#e11d48" },
  vibesProConfirmButton: { backgroundColor: "#D4AF37" },
  cancelText: { color: "#0369a1", fontSize: 14, fontWeight: "800" },
  vibesProCancelText: { color: "#ffffff" },
  confirmText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  vibesProConfirmText: { color: "#0B0B0B" },
  pressed: { opacity: 0.8 },
});
