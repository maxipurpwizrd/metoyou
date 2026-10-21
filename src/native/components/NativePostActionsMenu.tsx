import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeConfirmDialog from "./NativeConfirmDialog";

const REPORT_REASONS = [
  "Bullying or abuse",
  "Adult Content",
  "Fraud or Scam",
  "I don't just wanna see this",
] as const;

type Props = {
  isOwner: boolean;
  isVibesPro: boolean;
  highlighted: boolean;
  isSaved: boolean;
  initialText: string;
  onShare: () => Promise<void>;
  onSave: () => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onHighlight: () => Promise<void>;
  onReport: (reason: string) => Promise<void>;
  onBlock: () => Promise<void>;
};

export default function NativePostActionsMenu(props: Props) {
  const [mode, setMode] = useState<"closed" | "menu" | "edit" | "report">("closed");
  const [editText, setEditText] = useState(props.initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"delete" | "block" | null>(null);
  const premium = props.isVibesPro;

  const execute = async (action: () => Promise<void>, close = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (close) setMode("closed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    setEditText(props.initialText);
    setError(null);
    setMode("menu");
  };

  const openConfirmation = (action: "delete" | "block") => {
    setMode("closed");
    setConfirmAction(action);
  };

  const actions = props.isOwner
    ? [
        { icon: "✎", label: "Edit", onPress: () => setMode("edit") },
        { icon: "↗", label: "Share", onPress: () => void execute(props.onShare) },
        {
          icon: "✦",
          label: props.highlighted ? "Remove highlight" : "Add to highlights",
          onPress: () => void execute(props.onHighlight),
        },
        { icon: "⌫", label: "Delete", danger: true, onPress: () => openConfirmation("delete") },
      ]
    : [
        { icon: "↗", label: "Share", onPress: () => void execute(props.onShare) },
        { icon: "⇩", label: props.isSaved ? "Saved" : "Save", onPress: () => void execute(props.onSave) },
        {
          icon: "↻",
          label: "Repost · coming soon",
          disabled: true,
          onPress: () => undefined,
        },
        { icon: "⚑", label: "Report", onPress: () => setMode("report") },
        { icon: "⊘", label: "Block author", danger: true, onPress: () => openConfirmation("block") },
      ];

  const titleColor = "#0c4a6e";

  return (
    <>
      <Pressable
        accessibilityLabel="More post actions"
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [styles.gridButton, pressed && styles.pressed]}
      >
        <View style={styles.gridIcon}>
          <View style={[styles.gridCell, premium && styles.goldGridCell]} />
          <View style={[styles.gridCell, premium && styles.goldGridCell]} />
          <View style={[styles.gridCell, premium && styles.goldGridCell]} />
          <View style={[styles.gridCell, premium && styles.goldGridCell]} />
        </View>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => !busy && setMode("closed")}
        transparent
        visible={mode !== "closed"}
      >
        <NativeBlurBackdrop
          intensity={mode === "edit" ? 80 : 18}
          overlayColor={mode === "edit" ? "rgba(2,6,23,0.45)" : "rgba(0,0,0,0.35)"}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setMode("closed")}
          style={styles.backdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.menuCard, premium && styles.premiumMenu]}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: titleColor }]}>
                {mode === "edit" ? "Edit Post" : mode === "report" ? "Report Post" : "Post actions"}
              </Text>
              <Pressable
                accessibilityLabel="Close post actions"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setMode("closed")}
                style={styles.closeButton}
              >
                <Text style={[styles.closeText, { color: titleColor }]}>×</Text>
              </Pressable>
            </View>

            {mode === "menu" ? (
              <View style={styles.actionGrid}>
                {actions.map((action) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    disabled={busy || action.disabled}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.actionButton,
                      premium && styles.premiumActionButton,
                      pressed && !action.disabled && styles.pressed,
                      action.disabled && styles.actionDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionIcon,
                        premium && styles.premiumActionText,
                        action.danger && styles.dangerText,
                        action.disabled && styles.disabledText,
                      ]}
                    >
                      {action.icon}
                    </Text>
                    <Text
                      style={[
                        styles.actionLabel,
                        premium && styles.premiumActionText,
                        action.danger && styles.dangerText,
                        action.disabled && styles.disabledText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : mode === "edit" ? (
              <>
                <TextInput
                  accessibilityLabel="Edit post text"
                  maxLength={500}
                  multiline
                  onChangeText={setEditText}
                  placeholder="Drop your vibe 💬"
                  placeholderTextColor={premium ? "#92400e" : "#94a3b8"}
                  style={[styles.editInput, premium && styles.premiumInput]}
                  textAlignVertical="top"
                  value={editText}
                />
                <Text style={styles.characterCount}>{editText.length}/500</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    void execute(async () => {
                      await props.onEdit(editText);
                    })
                  }
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save changes</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <View style={styles.reportOptions}>
                {REPORT_REASONS.map((reason, index) => (
                  <Pressable
                    key={reason}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void execute(() => props.onReport(reason))}
                    style={({ pressed }) => [
                      styles.reportOption,
                      premium && styles.premiumActionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.reportNumber, premium && styles.premiumActionText]}>
                      {index + 1}.
                    </Text>
                    <Text style={[styles.reportText, premium && styles.premiumActionText]}>
                      {reason}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
      <NativeConfirmDialog
        confirmLabel={confirmAction === "delete" ? "Delete" : "Block"}
        destructive
        emoji={confirmAction === "delete" ? "🗑️" : "🫶"}
        message={
          confirmAction === "delete"
            ? "This postcard will be gone for good. Are you sure?"
            : "Their posts will be hidden from your Feed. You can change this later."
        }
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (confirmAction === "delete") await props.onDelete();
          else await props.onBlock();
          setConfirmAction(null);
        }}
        title={confirmAction === "delete" ? "Delete this postcard?" : "Block this author?"}
        visible={confirmAction !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gridButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  gridIcon: { width: 23, height: 23, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  gridCell: { width: 9, height: 9, borderRadius: 2, backgroundColor: "#334155" },
  goldGridCell: { backgroundColor: "#78350f" },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  menuCard: {
    width: "100%",
    maxWidth: 390,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    shadowColor: "#020617",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  premiumMenu: { borderColor: "#bae6fd", backgroundColor: "#ffffff" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "900" },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 27, lineHeight: 31 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    width: "48%",
    minHeight: 82,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  premiumActionButton: { borderColor: "#d97706", backgroundColor: "#fcd34d" },
  actionIcon: { color: "#334155", fontSize: 23, fontWeight: "800" },
  actionLabel: { color: "#334155", fontSize: 12, fontWeight: "700", textAlign: "center" },
  premiumActionText: { color: "#451a03" },
  dangerText: { color: "#be123c" },
  disabledText: { color: "#64748b" },
  actionDisabled: { opacity: 0.7 },
  editInput: {
    minHeight: 150,
    maxHeight: 260,
    padding: 13,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    color: "#334155",
    backgroundColor: "#f8fafc",
    fontSize: 15,
    lineHeight: 22,
  },
  premiumInput: { borderColor: "#d97706", color: "#451a03", backgroundColor: "#fef3c7" },
  characterCount: { marginTop: 6, color: "#64748b", fontSize: 11, textAlign: "right" },
  primaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#0284c7",
  },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  reportOptions: { gap: 8 },
  reportOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  reportNumber: { color: "#94a3b8", fontSize: 13, fontWeight: "800" },
  reportText: { flex: 1, color: "#334155", fontSize: 13, fontWeight: "600" },
  error: { marginTop: 11, color: "#be123c", fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.78 },
});
