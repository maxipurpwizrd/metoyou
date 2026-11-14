import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import type { NativeEntitlementState } from "../lib/entitlement";
import { useNativeEntitlement } from "./NativeEntitlementProvider";
import { useNativeAuth } from "./NativeAuthProvider";

export type NativeTheme =
  | "dark"
  | "bluesky"
  | "white"
  | "black"
  | "pink"
  | "purple"
  | "red"
  | "rainbow"
  | "liquidGlass";

export const NATIVE_THEME_OPTIONS: Array<{
  value: NativeTheme;
  label: string;
  swatch: readonly [string, string, ...string[]];
}> = [
  { value: "dark", label: "Dark", swatch: ["#05070b", "#111827"] },
  { value: "bluesky", label: "BlueSky", swatch: ["#0b3b78", "#54b8ff"] },
  { value: "white", label: "White", swatch: ["#ffffff", "#cbd5e1"] },
  { value: "black", label: "Black", swatch: ["#09090b", "#52525b"] },
  { value: "pink", label: "Pink", swatch: ["#9d174d", "#ec4899"] },
  { value: "purple", label: "Purple", swatch: ["#3b0764", "#7c3aed"] },
  { value: "red", label: "Red", swatch: ["#7f1d1d", "#dc2626"] },
  { value: "rainbow", label: "Rainbow", swatch: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"] },
  { value: "liquidGlass", label: "Liquid Glass", swatch: ["#454a4e", "#aeb5b9", "#edf0f1"] },
];

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

export type NativeThemePalette = {
  background: readonly [string, string, string];
  surface: string;
  raised: string;
  control: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
};

export const NATIVE_TYPE_SCALE = {
  screenTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 } as const,
  sectionTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.15 } as const,
  body: { fontSize: 14, lineHeight: 20 } as const,
  caption: { fontSize: 12, lineHeight: 17 } as const,
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 } as const,
};

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
    accentText: "#05070b",
  },
  white: {
    background: ["#f8fafc", "#e2e8f0", "#cbd5e1"] as const,
    surface: "#ffffff",
    raised: "#f1f5f9",
    control: "#e2e8f0",
    border: "#cbd5e1",
    text: "#0f172a",
    muted: "#475569",
    accent: "#0369a1",
    accentText: "#ffffff",
  },
  black: {
    background: ["#000000", "#09090b", "#18181b"] as const,
    surface: "#09090b",
    raised: "#18181b",
    control: "#27272a",
    border: "#52525b",
    text: "#fafafa",
    muted: "#d4d4d8",
    accent: "#e4e4e7",
    accentText: "#18181b",
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
    accentText: "#061a3a",
  },
  pink: {
    background: ["#500724", "#9d174d", "#ec4899"] as const,
    surface: "#831843",
    raised: "#9d174d",
    control: "#be185d",
    border: "#f9a8d4",
    text: "#fff1f7",
    muted: "#fbcfe8",
    accent: "#f9a8d4",
    accentText: "#500724",
  },
  purple: {
    background: ["#2e1065", "#5b21b6", "#7c3aed"] as const,
    surface: "#3b0764",
    raised: "#4c1d95",
    control: "#5b21b6",
    border: "#a78bfa",
    text: "#f5f3ff",
    muted: "#ddd6fe",
    accent: "#c4b5fd",
    accentText: "#2e1065",
  },
  red: {
    background: ["#450a0a", "#991b1b", "#dc2626"] as const,
    surface: "#7f1d1d",
    raised: "#991b1b",
    control: "#b91c1c",
    border: "#fca5a5",
    text: "#fff1f2",
    muted: "#fecdd3",
    accent: "#fca5a5",
    accentText: "#450a0a",
  },
  rainbow: {
    background: ["#7f1d1d", "#7c2d12", "#3b0764"] as const,
    surface: "#27213d",
    raised: "#33244f",
    control: "#433067",
    border: "#c4b5fd",
    text: "#ffffff",
    muted: "#e9d5ff",
    accent: "#f0abfc",
    accentText: "#3b0764",
  },
  liquidGlass: {
    background: ["transparent", "transparent", "transparent"] as const,
    surface: "rgba(30,32,34,0.42)",
    raised: "rgba(30,32,34,0.5)",
    control: "rgba(30,32,34,0.58)",
    border: "rgba(230,235,237,0.54)",
    text: "#ffffff",
    muted: "rgba(241,244,245,0.76)",
    accent: "#e8edef",
    accentText: "#202325",
  },
} satisfies Record<NativeTheme, NativeThemePalette>;

export function NativeThemeProvider({ children }: { children: ReactNode }) {
  const { cacheUserId } = useNativeAuth();
  const { entitlement } = useNativeEntitlement();
  const userId = cacheUserId;
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
        const restoredTheme = NATIVE_THEME_OPTIONS.find((option) => option.value === savedTheme)?.value;
        if (active && restoredTheme) {
          setThemeState(restoredTheme);
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
    if (nextTheme !== "dark") {
      if (entitlement.status === "loading" || entitlement.status === "unknown") {
        throw new Error("VibesPro access is still loading.");
      }
      if (entitlement.status === "error") throw entitlement.error;
      if (!isVibesPro) throw new Error("App themes are available only to VibesPro accounts.");
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
