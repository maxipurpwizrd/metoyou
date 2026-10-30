import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Car, Dice5, Gamepad2, Grid2X2, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import NativeSurfaceDock from "./NativeSurfaceDock";
import NativeBubbleShooterGame from "./NativeBubbleShooterGame";
import NativeTeslaRoadsterRace from "./NativeTeslaRoadsterRace";
import NativeTetrisGame from "./NativeTetrisGame";
import NativeYahtzeeGame from "./NativeYahtzeeGame";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";

type GamesTab = "list" | "feed";

const UPCOMING_GAMES = [
  {
    name: "Tetris",
    detail: "10 levels · classic block puzzle",
    status: "FIRST UP",
    colors: ["#0e7490", "#164e63"] as const,
    icon: Grid2X2,
  },
  {
    name: "Bubble Shooter",
    detail: "Aim, match, and clear the board",
    status: "COMING NEXT",
    colors: ["#be185d", "#831843"] as const,
    icon: Sparkles,
  },
  {
    name: "Yahtzee",
    detail: "Five dice · 13 scoring categories",
    status: "PLAY OFFLINE",
    colors: ["#a16207", "#713f12"] as const,
    icon: Dice5,
  },
  {
    name: "Tesla Roadster Race",
    detail: "Wind through scenic roads · nitro · thrusters",
    status: "PLAY OFFLINE",
    colors: ["#65a30d", "#166534"] as const,
    icon: Car,
  },
];

export default function NativeGamesScreen() {
  const [tab, setTab] = useState<GamesTab>("list");
  const [playingTetris, setPlayingTetris] = useState(false);
  const [playingBubbleShooter, setPlayingBubbleShooter] = useState(false);
  const [playingYahtzee, setPlayingYahtzee] = useState(false);
  const [playingRally, setPlayingRally] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];

  if (playingTetris) {
    return (
      <NativeTetrisGame
        onExit={() => setPlayingTetris(false)}
      />
    );
  }

  if (playingBubbleShooter) {
    return <NativeBubbleShooterGame onExit={() => setPlayingBubbleShooter(false)} />;
  }

  if (playingYahtzee) {
    return <NativeYahtzeeGame onExit={() => setPlayingYahtzee(false)} />;
  }

  if (playingRally) {
    return <NativeTeslaRoadsterRace onExit={() => setPlayingRally(false)} />;
  }

  return (
    <LinearGradient colors={colors.background} style={styles.root}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: colors.accent }]}>GAME KINGDOM</Text>
            <Text style={[styles.title, { color: colors.text }]}>Games</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: colors.control, borderColor: colors.border }]}>
            <Gamepad2 color={colors.accent} size={22} />
          </View>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "list" }}
            onPress={() => setTab("list")}
            style={[styles.tab, tab === "list" && { backgroundColor: colors.control }]}
          >
            <Grid2X2 color={tab === "list" ? colors.accent : colors.muted} size={17} />
            <Text style={[styles.tabText, { color: tab === "list" ? colors.text : colors.muted }]}>Games List</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "feed" }}
            onPress={() => setTab("feed")}
            style={[styles.tab, tab === "feed" && { backgroundColor: colors.control }]}
          >
            <Sparkles color={tab === "feed" ? colors.accent : colors.muted} size={17} />
            <Text style={[styles.tabText, { color: tab === "feed" ? colors.text : colors.muted }]}>Game Feed</Text>
          </Pressable>
        </View>

        {tab === "list" ? (
          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: 92 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Offline games</Text>
            <Text style={[styles.sectionDescription, { color: colors.muted }]}>Small games you can play without an internet connection.</Text>

            {UPCOMING_GAMES.map((game) => {
              const Icon = game.icon;
              return (
                <Pressable
                  key={game.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${game.name} offline`}
                  onPress={() => {
                    if (game.name === "Tetris") setPlayingTetris(true);
                    if (game.name === "Bubble Shooter") setPlayingBubbleShooter(true);
                    if (game.name === "Yahtzee") setPlayingYahtzee(true);
                    if (game.name === "Tesla Roadster Race") setPlayingRally(true);
                  }}
                  style={({ pressed }) => [
                    styles.gameRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.gamePressed,
                  ]}
                >
                  <LinearGradient colors={game.colors} style={styles.gameArtwork}>
                    <Icon color="#ffffff" size={32} strokeWidth={2.2} />
                  </LinearGradient>
                  <View style={styles.gameDetails}>
                    <Text style={[styles.gameStatus, { color: colors.accent }]}>PLAY OFFLINE</Text>
                    <Text style={[styles.gameName, { color: colors.text }]}>{game.name}</Text>
                    <Text style={[styles.gameDescription, { color: colors.muted }]}>{game.detail}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.feedPlaceholder}>
            <View style={[styles.placeholderIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Gamepad2 color={colors.accent} size={34} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>We are building Game Kingdom</Text>
            <Text style={[styles.placeholderDescription, { color: colors.muted }]}>Check back later.</Text>
          </View>
        )}

        <NativeSurfaceDock
          activeSurface="gaming"
          bottomInset={insets.bottom}
          onFeedPress={() => router.navigate("/(app)/(tabs)")}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  kicker: { marginBottom: 3, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { fontSize: 28, fontWeight: "900" },
  headerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 13 },
  tabs: { flexDirection: "row", gap: 5, marginHorizontal: 14, marginTop: 8, padding: 5, borderWidth: 1, borderRadius: 15 },
  tab: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 11 },
  tabText: { fontSize: 13, fontWeight: "800" },
  listContent: { paddingHorizontal: 15, paddingTop: 24, gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "900" },
  sectionDescription: { marginTop: -7, marginBottom: 4, fontSize: 13, lineHeight: 19 },
  gameRow: { minHeight: 116, flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderWidth: 1, borderRadius: 16 },
  gameArtwork: { width: 88, height: 88, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  gameDetails: { flex: 1, gap: 4 },
  gameStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  gameName: { fontSize: 18, fontWeight: "900" },
  gameDescription: { fontSize: 12, lineHeight: 17 },
  gamePressed: { opacity: 0.78 },
  gameUnavailable: { opacity: 0.62 },
  feedPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingBottom: 60 },
  placeholderIcon: { width: 76, height: 76, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderRadius: 24 },
  placeholderTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  placeholderDescription: { marginTop: 8, fontSize: 14, textAlign: "center" },
});