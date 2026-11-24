import { Platform, StyleSheet, Text, View } from "react-native";
import type { ASTNode, RenderFunction } from "react-native-markdown-display";
import {
  getWizrdCodeBlockContent,
  getWizrdCodeBlockLanguage,
  type WizrdCodeBlockNode,
} from "../lib/wizrdCopy";
import WizrdCopyButton from "./WizrdCopyButton";

type Colors = {
  text: string;
  muted: string;
  control: string;
  border: string;
};

const styles = StyleSheet.create({
  container: { overflow: "hidden", marginVertical: 5, borderRadius: 9 },
  toolbar: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingLeft: 10,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  language: { flex: 1, fontSize: 10, fontWeight: "700" },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});

export function createNativeWizrdCodeBlockRenderer(
  colors: Colors,
): RenderFunction {
  return (node) => {
    const codeBlock = node as ASTNode & WizrdCodeBlockNode;
    const content = getWizrdCodeBlockContent(codeBlock.content);
    const language = getWizrdCodeBlockLanguage(codeBlock.sourceInfo);

    return (
      <View
        key={codeBlock.key}
        style={[styles.container, { backgroundColor: colors.control }]}
      >
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          {language
            ? (
              <Text style={[styles.language, { color: colors.muted }]}>
                {language}
              </Text>
            )
            : <View />}
          <WizrdCopyButton
            color={colors.text}
            content={content}
            kind="code"
            mutedColor={colors.muted}
          />
        </View>
        <Text selectable style={[styles.content, { color: colors.text }]}>
          {content}
        </Text>
      </View>
    );
  };
}
