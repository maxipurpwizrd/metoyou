import { NATIVE_OFFLINE_MESSAGE } from "../lib/networkStatus";
import { useNativeConnectivity } from "../contexts/NativeQueryProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Activity, Gamepad2, Music2, WifiOff, X } from "lucide-react-native";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { useNativeMusic } from "../contexts/NativeMusicProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeBlurBackdrop from "./NativeBlurBackdrop";

type PromptMode = "offline" | null;

const HIDE_CONNECTION_HICCUP_KEY = "metoyou-native-hide-connection-hiccup";
const CONNECTION_RECOVERY_STABILITY_MS = 10_000;

export default function NativeOfflinePrompt() {
  const router = useRouter();
  const { status } = useNativeAuth();
  const music = useNativeMusic();
  const { isConnectivityOffline, isSlow } = useNativeConnectivity();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PromptMode>(null);
  const [hideConnectionHiccup, setHideConnectionHiccup] = useState<boolean | null>(null);
  const [preferenceSaveFailed, setPreferenceSaveFailed] = useState(false);
  const outageHandled = useRef(false);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowOfflineMessage = isConnectivityOffline || status === "offlineDeferred";

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(HIDE_CONNECTION_HICCUP_KEY)
      .then((value) => {
        if (active) setHideConnectionHiccup(value === "true");
      })
      .catch((cause: unknown) => {
        console.warn("Could not restore the connection-message preference.", cause);
        if (active) setHideConnectionHiccup(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (shouldShowOfflineMessage) {
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
      }
      if (hideConnectionHiccup === null) return;
      if (hideConnectionHiccup) {
        outageHandled.current = true;
        setMode(null);
        return;
      }
      if (!outageHandled.current) {
        outageHandled.current = true;
        setMode("offline");
      }
      return;
    }

    setMode(null);
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    recoveryTimer.current = setTimeout(() => {
      outageHandled.current = false;
      recoveryTimer.current = null;
    }, CONNECTION_RECOVERY_STABILITY_MS);
    return () => {
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
      }
    };
  }, [hideConnectionHiccup, shouldShowOfflineMessage]);

  useEffect(() => () => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
  }, []);

  const close = () => setMode(null);
  const hideConnectionMessage = async () => {
    setPreferenceSaveFailed(false);
    try {
      await AsyncStorage.setItem(HIDE_CONNECTION_HICCUP_KEY, "true");
      outageHandled.current = true;
      setHideConnectionHiccup(true);
      setMode(null);
    } catch (cause) {
      console.warn("Could not save the connection-message preference.", cause);
      setPreferenceSaveFailed(true);
    }
  };

  return (
    <>
        {!shouldShowOfflineMessage && isSlow ? (
        <View pointerEvents="none" style={[styles.slowNotice, { top: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Activity color={colors.accent} size={17} />
          <Text style={[styles.slowNoticeText, { color: colors.text }]}>Connection is taking longer than usual.</Text>
        </View>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={mode !== null}
      >
        <View style={styles.backdrop}>
          <NativeBlurBackdrop intensity={18} overlayColor="rgba(3,10,20,0.48)" />
          <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              accessibilityLabel="Close connection message"
              accessibilityRole="button"
              onPress={close}
              style={[styles.closeButton, { backgroundColor: colors.control }]}
            >
              <X color={colors.muted} size={19} />
            </Pressable>
            <View style={[styles.iconWrap, { backgroundColor: colors.control }]}>
              <WifiOff color={colors.accent} size={27} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Connection hiccup</Text>
            <Text style={[styles.message, { color: colors.muted }]}>{NATIVE_OFFLINE_MESSAGE}</Text>
            <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    if (music.currentTrack?.id.startsWith("device:")) {
                      router.navigate("/(app)/(tabs)/tracks");
                    } else {
                      router.navigate({ pathname: "/(app)/(tabs)/tracks", params: { openDeviceFiles: "1" } });
                    }
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.accent }]}
                >
                  <Music2 color={colors.accentText} size={19} />
                  <Text style={[styles.actionText, { color: colors.accentText }]}>Music</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    router.navigate("/(app)/games");
                  }}
                  style={[styles.actionButton, styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.control }]}
                >
                  <Gamepad2 color={colors.text} size={19} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Play offline</Text>
                </Pressable>
            </View>
            {preferenceSaveFailed ? (
              <Text accessibilityRole="alert" style={[styles.preferenceError, { color: colors.muted }]}>
                Could not save this preference. Please try again.
              </Text>
            ) : null}
            <View style={styles.promptFooter}>
              <Pressable accessibilityRole="button" onPress={close} style={styles.footerButton}>
                <Text style={[styles.notNowText, { color: colors.muted }]}>Not now</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void hideConnectionMessage()} style={styles.footerButton}>
                <Text style={[styles.dontShowText, { color: colors.accent }]}>Don’t show again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  slowNotice: {
    position: "absolute",
    zIndex: 20,
    alignSelf: "center",
    maxWidth: "90%",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    elevation: 3,
  },
  slowNoticeText: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(3,10,20,0.56)",
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    borderWidth: 1,
    borderRadius: 22,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  iconWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderRadius: 29,
  },
  title: {
    marginBottom: 9,
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
  },
  secondaryButton: { borderWidth: 1 },
  actionText: { fontSize: 15, fontWeight: "800" },
  preferenceError: {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
  },
  promptFooter: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  footerButton: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  notNowText: { fontSize: 14, fontWeight: "700" },
  dontShowText: { fontSize: 14, fontWeight: "700" },
});