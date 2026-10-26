import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import type { NativeEntitlementState } from "../lib/entitlement";
import { useNativeEntitlement } from "./NativeEntitlementProvider";
import { useNativeAuth } from "./NativeAuthProvider";

export type NativeTheme = "dark" | "bluesky";

type NativeThemeContextValue = {
  theme: NativeTheme;
  ready: boolean;
  isVibesPro: boolean;
  entitlement: NativeEntitlementState;
  setTheme: (theme: NativeTheme) => Promise<void>;
};

const LEGACY_STORAGE_KEY = "metoyou-native-theme";
const STORAGE_KEY_PREFIX = "metoyou-native-theme:";
const NativeThemeContext = createContext<NativeThemeContextValue | null>(null);

export const NATIVE_THEME_COLORS = {
  dark: {
    background: ["#05070b", "#0b0f16", "#111827"] as const,
    surface: "#10141b",
    raised: "#171c25",
    control: "#252b35",
    border: "#2e3540",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    accent: "#ffffff",
    accentText: "#ffffff",
  },
  bluesky: {
    background: ["#061a3a", "#0b3b78", "#125baA"] as const,
    surface: "#0b2d5b",
    raised: "#104078",
    control: "#155192",
    border: "#3478bd",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    accent: "#54b8ff",
    accentText: "#ffffff",
  },
} satisfies Record<NativeTheme, {
  background: readonly [string, string, string];
  surface: string;
  raised: string;
  control: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
}>;

export function NativeThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useNativeAuth();
  const { entitlement } = useNativeEntitlement();
  const userId = session?.user.id ?? null;
  const isVibesPro = entitlement.status === "vibesPro";
  const [theme, setThemeState] = useState<NativeTheme>("dark");
  const [ready, setReady] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const themeReady = ready && loadedUserId === userId;

  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadedUserId(null);
    setThemeState("dark");
    if (!userId) {
      setReady(true);
      setLoadedUserId(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const userStorageKey = `${STORAGE_KEY_PREFIX}${userId}`;
        let savedTheme = await AsyncStorage.getItem(userStorageKey);
        if (active && (savedTheme === "dark" || savedTheme === "bluesky")) {
          setThemeState(savedTheme);
        }
      } catch (cause: unknown) {
        console.warn("Could not restore the saved native theme.", cause);
      } finally {
        if (active) {
          setLoadedUserId(userId);
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !isVibesPro) return;
    let active = true;
    void (async () => {
      try {
        const userStorageKey = `${STORAGE_KEY_PREFIX}${userId}`;
        if (await AsyncStorage.getItem(userStorageKey) !== null) return;
        const legacyTheme = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (!active || (legacyTheme !== "dark" && legacyTheme !== "bluesky")) return;
        await AsyncStorage.setItem(userStorageKey, legacyTheme);
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
        if (active) setThemeState(legacyTheme);
      } catch (cause: unknown) {
        console.warn("Could not migrate the saved native theme.", cause);
      }
    })();
    return () => {
      active = false;
    };
  }, [isVibesPro, userId]);

  const setTheme = useCallback(async (nextTheme: NativeTheme) => {
    if (!themeReady) throw new Error("The account theme is still loading.");
    if (!userId) throw new Error("Sign in before changing the app theme.");
    if (nextTheme === "bluesky") {
      if (entitlement.status === "loading" || entitlement.status === "unknown") {
        throw new Error("VibesPro access is still loading.");
      }
      if (entitlement.status === "error") throw entitlement.error;
      if (!isVibesPro) throw new Error("BlueSky is available only to VibesPro accounts.");
    }
    await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, nextTheme);
    setThemeState(nextTheme);
  }, [entitlement, isVibesPro, themeReady, userId]);

  const value = useMemo(
    () => ({
      theme: isVibesPro && themeReady ? theme : "dark",
      ready: themeReady,
      isVibesPro,
      entitlement,
      setTheme,
    }),
    [entitlement, isVibesPro, setTheme, theme, themeReady],
  );
  return (
    <NativeThemeContext.Provider value={value}>
      {themeReady ? children : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NATIVE_THEME_COLORS.dark.surface }}>
          <ActivityIndicator color={NATIVE_THEME_COLORS.dark.accent} />
        </View>
      )}
    </NativeThemeContext.Provider>
  );
}

export function useNativeTheme() {
  const context = useContext(NativeThemeContext);
  if (!context) throw new Error("useNativeTheme must be used within NativeThemeProvider");
  return context;
}
