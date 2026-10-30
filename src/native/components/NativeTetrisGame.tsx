import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Grid2X2, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import NativeGameHelp from "./NativeGameHelp";
import {
  createTetrisState,
  dropTetrisPiece,
  getTetrisDropInterval,
  moveTetrisPiece,
  rotateTetrisPiece,
  softDropTetrisPiece,
  stepTetris,
  TETRIS_COLUMNS,
  TETRIS_LEVELS,
  TETRIS_ROWS,
  type TetrisCell,
  type TetrisState,
} from "../lib/tetris";

const BEST_SCORE_KEY = "metoyou-tetris-best-score";
type TetrisPhase = "menu" | "countdown" | "playing" | "paused";

function renderBoard(state: TetrisState): TetrisCell[][] {
  const board = state.board.map((row) => [...row]);
  state.piece.shape.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
    if (!filled) return;
    const x = state.piece.x + columnIndex;
    const y = state.piece.y + rowIndex;
    if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLUMNS) board[y][x] = state.piece.color;
  }));
  return board;
}

export default function NativeTetrisGame({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const [game, setGame] = useState(() => createTetrisState());
  const [phase, setPhase] = useState<TetrisPhase>("menu");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const cellBoard = useMemo(() => renderBoard(game), [game]);
  const boardWidth = Math.max(190, Math.min(window.width - 36, (window.height - insets.top - insets.bottom - 230) / 2));

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(BEST_SCORE_KEY)
      .then((value) => {
        const score = Number(value);
        if (active && Number.isFinite(score) && score > 0) setBestScore(score);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (phase !== "playing" || game.isGameOver) return;
    const timer = setInterval(() => setGame((current) => stepTetris(current)), getTetrisDropInterval(game.level));
    return () => clearInterval(timer);
  }, [game.isGameOver, game.level, phase]);

  useEffect(() => {
    if (phase !== "countdown" || countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        setPhase("playing");
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  useEffect(() => {
    if (game.score <= bestScore) return;
    setBestScore(game.score);
    void AsyncStorage.setItem(BEST_SCORE_KEY, String(game.score)).catch(() => undefined);
  }, [bestScore, game.score]);

  const changeGame = (update: (current: TetrisState) => TetrisState) => {
    if (phase !== "playing" || game.isGameOver) return;
    setGame(update);
  };

  const startLevel = (level: number) => {
    setSelectedLevel(level);
    setGame(createTetrisState(Math.random, level));
    setCountdown(3);
    setPhase("countdown");
  };

  const controlButton = (
    label: string,
    Icon: typeof ArrowLeft,
    onPress: () => void,
    accessibilityHint?: string,
  ) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.control, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.controlPressed]}
    >
      <Icon color={colors.text} size={21} strokeWidth={2.5} />
    </Pressable>
  );

  return (
    <LinearGradient colors={colors.background} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Exit Tetris" accessibilityRole="button" onPress={onExit} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X color={colors.text} size={20} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>GAME KINGDOM</Text>
          <Text style={[styles.title, { color: colors.text }]}>Tetris</Text>
        </View>
        {phase === "playing" || phase === "paused" ? (
          <Pressable
            accessibilityLabel={phase === "paused" ? "Resume game" : "Pause game"}
            accessibilityRole="button"
            disabled={game.isGameOver}
            onPress={() => setPhase(phase === "paused" ? "playing" : "paused")}
            style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }, game.isGameOver && styles.disabledControl]}
          >
            {phase === "paused" ? <Play color={colors.text} size={19} /> : <Pause color={colors.text} size={19} />}
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>

      {phase === "menu" ? (
        <View style={styles.levelMenu}>
          <View style={styles.menuHeading}>
            <Grid2X2 color={colors.accent} size={31} />
            <Text style={[styles.menuTitle, { color: colors.text }]}>Choose a level</Text>
            <Text style={[styles.menuDescription, { color: colors.muted }]}>Stack falling blocks, clear rows, and level up as the pieces speed up.</Text>
            <NativeGameHelp
              gameTitle="Tetris"
              introduction="Arrange falling blocks to complete horizontal rows and keep the board from filling to the top."
              steps={[
                "Choose a starting level. Higher levels make pieces fall faster.",
                "Use the left and right buttons to move a piece; tap rotate to turn it.",
                "Use down for a soft drop or double-down for an instant hard drop.",
                "Complete rows to clear them. Clear 5 lines to advance one level.",
              ]}
              colors={colors}
            />
          </View>
          <View style={styles.levelGrid}>
            {Array.from({ length: TETRIS_LEVELS }, (_, index) => index + 1).map((level) => {
              const selected = selectedLevel === level;
              return (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Select level ${level}`}
                  onPress={() => setSelectedLevel(level)}
                  style={[styles.levelButton, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}
                >
                  <Text style={[styles.levelButtonText, { color: selected ? "#07121b" : colors.text }]}>{level}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.bestOnMenu, { color: colors.muted }]}>BEST SCORE  {bestScore}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => startLevel(selectedLevel)}
            style={({ pressed }) => [styles.startButton, { backgroundColor: colors.accent }, pressed && styles.controlPressed]}
          >
            <Play color="#07121b" size={20} fill="#07121b" />
            <Text style={styles.startButtonText}>Start Level {selectedLevel}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>SCORE</Text>
              <Text numberOfLines={1} style={[styles.statValue, { color: colors.text }]}>{game.score}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>BEST</Text>
              <Text numberOfLines={1} style={[styles.statValue, { color: colors.text }]}>{bestScore}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>LEVEL</Text>
              <Text numberOfLines={1} style={[styles.statValue, { color: colors.accent }]}>{game.level}/{TETRIS_LEVELS}</Text>
            </View>
          </View>

          <View style={[styles.boardFrame, { width: boardWidth, borderColor: colors.border, backgroundColor: "#090d14" }]}>
            {cellBoard.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.boardRow}>
                {row.map((cell, columnIndex) => (
                  <View
                    key={`${rowIndex}-${columnIndex}`}
                    style={[
                      styles.cell,
                      { backgroundColor: cell ?? "#111722", borderColor: "#1c2633" },
                      cell !== null && { backgroundColor: cell, borderColor: "rgba(255,255,255,0.28)" },
                    ]}
                  />
                ))}
              </View>
            ))}
            {countdown !== null || phase === "paused" || game.isGameOver ? (
              <View style={styles.overlay}>
                <Text style={[styles.overlayTitle, countdown !== null && styles.countdownNumber]}>
                  {countdown !== null ? countdown : phase === "paused" ? "Paused" : "Game over"}
                </Text>
                <Text style={styles.overlayDetail}>
                  {countdown !== null ? "Get ready" : phase === "paused" ? "Take a breather." : `${game.lines} lines cleared`}
                </Text>
                {game.isGameOver ? (
                  <View style={styles.gameOverActions}>
                    <Pressable accessibilityRole="button" onPress={() => startLevel(game.startingLevel)} style={[styles.restartButton, { backgroundColor: colors.accent }]}>
                      <RotateCcw color="#07121b" size={17} />
                      <Text style={styles.restartText}>Play again</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setPhase("menu")} style={[styles.chooseLevelButton, { borderColor: colors.border }]}>
                      <Text style={[styles.chooseLevelText, { color: colors.text }]}>Choose level</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {phase === "playing" ? (
            <View style={styles.controls}>
              {controlButton("Move left", ArrowLeft, () => changeGame((current) => moveTetrisPiece(current, -1)))}
              {controlButton("Rotate piece", RotateCw, () => changeGame(rotateTetrisPiece))}
              {controlButton("Move right", ArrowRight, () => changeGame((current) => moveTetrisPiece(current, 1)))}
              {controlButton("Soft drop", ArrowDown, () => changeGame((current) => softDropTetrisPiece(current)))}
              {controlButton("Hard drop", ChevronsDown, () => changeGame((current) => dropTetrisPiece(current)))}
            </View>
          ) : <View style={styles.controlSpacer} />}
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  header: { width: "100%", minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15 },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  heading: { alignItems: "center" },
  kicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: "900" },
  stats: { width: "100%", flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  stat: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 7, borderWidth: 1, borderRadius: 10 },
  statLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  statValue: { marginTop: 2, fontSize: 15, fontWeight: "900" },
  boardFrame: { aspectRatio: TETRIS_COLUMNS / TETRIS_ROWS, overflow: "hidden", borderWidth: 2, borderRadius: 6 },
  boardRow: { flex: 1, flexDirection: "row" },
  cell: { flex: 1, aspectRatio: 1, borderWidth: 0.5 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,8,14,0.82)" },
  overlayTitle: { color: "#ffffff", fontSize: 25, fontWeight: "900" },
  countdownNumber: { fontSize: 68 },
  overlayDetail: { marginTop: 5, marginBottom: 15, color: "rgba(255,255,255,0.75)", fontSize: 13 },
  restartButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15, borderRadius: 12 },
  restartText: { color: "#07121b", fontSize: 13, fontWeight: "900" },
  gameOverActions: { width: "100%", alignItems: "center", gap: 8 },
  chooseLevelButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 11 },
  chooseLevelText: { fontSize: 12, fontWeight: "800" },
  levelMenu: { flex: 1, width: "100%", justifyContent: "center", gap: 22, paddingHorizontal: 20 },
  menuHeading: { alignItems: "center", gap: 8 },
  menuTitle: { fontSize: 22, fontWeight: "900" },
  menuDescription: { maxWidth: 280, fontSize: 13, lineHeight: 19, textAlign: "center" },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  levelButton: { width: "17%", height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  levelButtonText: { fontSize: 16, fontWeight: "900" },
  bestOnMenu: { fontSize: 10, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  startButton: { width: "100%", minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 14 },
  startButtonText: { color: "#07121b", fontSize: 15, fontWeight: "900" },
  controls: { width: "100%", flexDirection: "row", justifyContent: "center", gap: 7, paddingHorizontal: 10, paddingBottom: 8 },
  controlSpacer: { height: 60 },
  control: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  disabledControl: { opacity: 0.4 },
});