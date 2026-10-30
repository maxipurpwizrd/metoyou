import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CircleHelp, X } from "lucide-react-native";

type HelpColors = {
  surface: string;
  control: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
};

export default function NativeGameHelp({
  gameTitle,
  introduction,
  steps,
  colors,
}: {
  gameTitle: string;
  introduction: string;
  steps: string[];
  colors: HelpColors;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Help: how to play ${gameTitle}`}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.helpButton, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
      >
        <CircleHelp color={colors.accent} size={18} />
        <Text style={[styles.helpButtonText, { color: colors.text }]}>Help</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <View style={[styles.dialogIcon, { backgroundColor: colors.control }]}>
                <CircleHelp color={colors.accent} size={22} />
              </View>
              <View style={styles.heading}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>GAME GUIDE</Text>
                <Text style={[styles.title, { color: colors.text }]}>{gameTitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close game guide"
                onPress={() => setVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.control }]}
              >
                <X color={colors.muted} size={19} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>INTRO</Text>
              <Text style={[styles.introduction, { color: colors.text }]}>{introduction}</Text>
              <Text style={[styles.sectionLabel, styles.howToLabel, { color: colors.accent }]}>HOW TO PLAY</Text>
              {steps.map((step, index) => (
                <View key={`${index}-${step}`} style={styles.stepRow}>
                  <Text style={[styles.stepNumber, { color: colors.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={[styles.stepText, { color: colors.muted }]}>{step}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.doneText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  helpButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15, borderWidth: 1, borderRadius: 12 },
  helpButtonText: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.76 },
  backdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(2,6,12,0.72)" },
  dialog: { width: "100%", maxWidth: 420, maxHeight: "82%", alignSelf: "center", borderWidth: 1, borderRadius: 20, padding: 18 },
  dialogHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.18)" },
  dialogIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  heading: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: 18, fontWeight: "900" },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  content: { paddingTop: 16, paddingBottom: 12 },
  sectionLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  introduction: { marginTop: 7, fontSize: 15, lineHeight: 22 },
  howToLabel: { marginTop: 20, marginBottom: 10 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 11 },
  stepNumber: { width: 22, paddingTop: 1, fontSize: 10, fontWeight: "900" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  doneButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  doneText: { color: "#07121b", fontSize: 13, fontWeight: "900" },
});
