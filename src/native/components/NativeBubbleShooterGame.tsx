import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, CircleDot, Pause, Play, RotateCcw, Target, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import NativeGameHelp from "./NativeGameHelp";
import {
  BUBBLE_COLUMNS,
  BUBBLE_LEVELS,
  BUBBLE_RADIUS_RATIO,
  BUBBLE_ROWS,
  createBubbleShooterState,
  getBubblePosition,
  sinkBubbleBoard,
  shootBubble,
  traceBubbleShot,
  type BubbleColor,
  type BubbleShotTrace,
  type BubbleShooterState,
} from "../lib/bubbleShooter";

const BEST_SCORE_KEY = "metoyou-bubble-shooter-best-score";
type BubblePhase = "menu" | "countdown" | "playing" | "paused";

export default function NativeBubbleShooterGame({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const radius = Math.max(10, Math.min((window.width - 34) / 17, (window.height - insets.top - insets.bottom - 235) / 24));
  const boardWidth = radius * 17;
  const boardHeight = radius * 24;
  const [game, setGame] = useState<BubbleShooterState>(() => createBubbleShooterState());
  const [phase, setPhase] = useState<BubblePhase>("menu");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [angle, setAngle] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [sinkCountdown, setSinkCountdown] = useState(30);
  const sinkCountdownRef = useRef(30);
  const [shotTrace, setShotTrace] = useState<BubbleShotTrace | null>(null);
  const shotProgress = useRef(new Animated.Value(0)).current;
  const shotInProgress = useRef(false);
  const bubbles = useMemo(() => game.board.flatMap((row, rowIndex) => row.flatMap((bubble, columnIndex) => {
    if (!bubble) return [];
    return [{ bubble, row: rowIndex, column: columnIndex, position: getBubblePosition(rowIndex, columnIndex, radius) }];
  })), [game.board, radius]);
  const remainingBubbles = bubbles.length;
  const levelCleared = game.isWon && remainingBubbles === 0;
  const aimTrace = useMemo(
    () => phase === "playing" && !shotTrace
      ? traceBubbleShot(game, angle, boardWidth, boardHeight, radius)
      : null,
    [angle, boardHeight, boardWidth, game, phase, radius, shotTrace],
  );
  const aimSegments = useMemo(() => aimTrace?.path.slice(1).map((point, index) => {
    const previous = aimTrace.path[index];
    const width = Math.hypot(point.x - previous.x, point.y - previous.y);
    return {
      key: `aim-${index}`,
      left: (point.x + previous.x - width) / 2,
      top: (point.y + previous.y) / 2,
      width,
      rotation: Math.atan2(point.y - previous.y, point.x - previous.x),
    };
  }) ?? [], [aimTrace]);
  const projectileStyle = useMemo(() => {
    if (!shotTrace || shotTrace.path.length < 2) return null;
    const lastIndex = shotTrace.path.length - 1;
    const inputRange = shotTrace.path.map((_, index) => index / lastIndex);
    return {
      translateX: shotProgress.interpolate({ inputRange, outputRange: shotTrace.path.map((point) => point.x - shotTrace.path[0].x) }),
      translateY: shotProgress.interpolate({ inputRange, outputRange: shotTrace.path.map((point) => point.y - shotTrace.path[0].y) }),
    };
  }, [shotProgress, shotTrace]);

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
    if (game.score <= bestScore) return;
    setBestScore(game.score);
    void AsyncStorage.setItem(BEST_SCORE_KEY, String(game.score)).catch(() => undefined);
  }, [bestScore, game.score]);

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
    if (phase !== "playing" || shotTrace || game.isGameOver || game.isWon) return;
    const timer = setInterval(() => {
      if (sinkCountdownRef.current <= 1) {
        sinkCountdownRef.current = 30;
        setSinkCountdown(30);
        setGame((current) => sinkBubbleBoard(current));
      } else {
        sinkCountdownRef.current -= 1;
        setSinkCountdown(sinkCountdownRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [game.isGameOver, game.isWon, phase, shotTrace]);

  useEffect(() => () => shotProgress.stopAnimation(), [shotProgress]);

  const startLevel = (level: number) => {
    setSelectedLevel(level);
    setGame(createBubbleShooterState(level));
    setAngle(0);
    sinkCountdownRef.current = 30;
    setSinkCountdown(30);
    setCountdown(3);
    setPhase("countdown");
  };

  const fire = () => {
    if (phase !== "playing" || game.isGameOver || game.isWon || shotInProgress.current) return;
    const trace = traceBubbleShot(game, angle, boardWidth, boardHeight, radius);
    if (trace.path.length < 2) {
      setGame((current) => shootBubble(current, angle, boardWidth, boardHeight, radius));
      return;
    }
    shotInProgress.current = true;
    setShotTrace(trace);
    shotProgress.setValue(0);
    Animated.timing(shotProgress, {
      toValue: 1,
      duration: Math.min(1150, Math.max(280, trace.path.length * 22)),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setGame((current) => shootBubble(current, angle, boardWidth, boardHeight, radius));
      shotInProgress.current = false;
      setShotTrace(null);
    });
  };

  const colorBubble = (color: BubbleColor, position: { left: number; top: number }, size = radius * 2) => (
    <View
      key={`${position.left}-${position.top}-${color}`}
      style={[styles.bubble, { left: position.left, top: position.top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    >
      <View style={[styles.bubbleHighlight, { width: size * 0.34, height: size * 0.16, borderRadius: size }]} />
    </View>
  );

  const actionButton = (label: string, Icon: typeof ArrowLeft, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.aimButton, { backgroundColor: colors.surface, borderColor: colors.border }, disabled && styles.disabledControl, pressed && styles.controlPressed]}
    >
      <Icon color={colors.text} size={21} strokeWidth={2.5} />
    </Pressable>
  );

  return (
    <LinearGradient colors={colors.background} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Exit Bubble Shooter" accessibilityRole="button" onPress={onExit} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X color={colors.text} size={20} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>GAME KINGDOM</Text>
          <Text style={[styles.title, { color: colors.text }]}>Bubble Shooter</Text>
        </View>
        {phase === "playing" || phase === "paused" ? (
          <Pressable
            accessibilityLabel={phase === "paused" ? "Resume game" : "Pause game"}
            accessibilityRole="button"
            disabled={game.isGameOver || game.isWon}
            onPress={() => setPhase(phase === "paused" ? "playing" : "paused")}
            style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }, (game.isGameOver || game.isWon) && styles.disabledControl]}
          >
            {phase === "paused" ? <Play color={colors.text} size={19} /> : <Pause color={colors.text} size={19} />}
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>

      {phase === "menu" ? (
        <View style={styles.levelMenu}>
          <View style={styles.menuHeading}>
            <Target color={colors.accent} size={32} />
            <Text style={[styles.menuTitle, { color: colors.text }]}>Choose a level</Text>
            <Text style={[styles.menuDescription, { color: colors.muted }]}>Line up color matches, clear the field, and stay ahead of the sinking bubbles.</Text>
            <NativeGameHelp
              gameTitle="Bubble Shooter"
              introduction="Clear the bubble field by making color matches while the rows gradually sink toward the bottom."
              steps={[
                "Choose a level. Higher levels begin with more bubbles and more colors.",
                "Use Aim left and Aim right to line up a shot. The guide previews wall bounces and the landing spot.",
                "Shoot to attach your bubble. Match at least 3 of the same color to pop that group.",
                "Bubbles no longer connected to the ceiling fall away too.",
                "The field sinks one row every 30 seconds. Clear every bubble before it reaches the bottom.",
              ]}
              colors={colors}
            />
          </View>
          <View style={styles.levelGrid}>
            {Array.from({ length: BUBBLE_LEVELS }, (_, index) => index + 1).map((level) => {
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
              <Text numberOfLines={1} style={[styles.statValue, { color: colors.accent }]}>{game.level}/{BUBBLE_LEVELS}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>SINK IN</Text>
              <Text numberOfLines={1} style={[styles.statValue, { color: sinkCountdown <= 5 ? "#fb7185" : colors.text }]}>{sinkCountdown}s</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>BUBBLES</Text>
              <Text numberOfLines={1} style={[styles.statValue, { color: colors.text }]}>{remainingBubbles}</Text>
            </View>
          </View>

          <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
            {bubbles.map(({ bubble, row, column, position }) => colorBubble(bubble, { left: position.x - radius, top: position.y - radius }))}
            {aimSegments.map((segment) => (
              <View
                key={segment.key}
                pointerEvents="none"
                style={[styles.aimSegment, { left: segment.left, top: segment.top - 1, width: segment.width, transform: [{ rotate: `${segment.rotation}rad` }] }]}
              />
            ))}
            {aimTrace?.attachment ? (() => {
              const target = getBubblePosition(aimTrace.attachment[0], aimTrace.attachment[1], radius);
              return <View pointerEvents="none" style={[styles.targetMarker, { left: target.x - radius, top: target.y - radius, width: radius * 2, height: radius * 2, borderRadius: radius }]} />;
            })() : null}
            {!shotTrace && !levelCleared && !game.isGameOver ? colorBubble(game.currentColor, { left: boardWidth / 2 - radius, top: boardHeight - radius * 2.5 }) : null}
            {shotTrace && projectileStyle ? (
              <Animated.View style={[styles.projectile, { left: boardWidth / 2 - radius, top: boardHeight - radius * 2.5, width: radius * 2, height: radius * 2, borderRadius: radius, backgroundColor: game.currentColor, transform: [{ translateX: projectileStyle.translateX }, { translateY: projectileStyle.translateY }] }]}>
                <View style={[styles.bubbleHighlight, { width: radius * 0.68, height: radius * 0.32, borderRadius: radius }]} />
              </Animated.View>
            ) : null}
            {!levelCleared && !game.isGameOver ? (
              <View style={[styles.nextBubble, { right: radius * 0.4, bottom: radius * 0.35 }]}>
                <Text style={styles.nextLabel}>NEXT</Text>
                {colorBubble(game.nextColor, { left: 0, top: 16 }, radius * 1.25)}
              </View>
            ) : null}
            {countdown !== null || phase === "paused" || levelCleared || game.isGameOver ? (
              <View style={styles.overlay}>
                <Text style={[styles.overlayTitle, countdown !== null && styles.countdownNumber]}>
                  {countdown !== null ? countdown : phase === "paused" ? "Paused" : levelCleared ? (game.level === BUBBLE_LEVELS ? "All levels cleared" : "Level cleared") : "Game over"}
                </Text>
                <Text style={styles.overlayDetail}>
                  {countdown !== null ? "Get ready" : phase === "paused" ? "Take a breather." : `${game.shots} shots · ${game.score} points`}
                </Text>
                {levelCleared || game.isGameOver ? (
                  <View style={styles.overlayActions}>
                    {levelCleared && game.level < BUBBLE_LEVELS ? (
                      <Pressable accessibilityRole="button" onPress={() => startLevel(game.level + 1)} style={[styles.restartButton, { backgroundColor: colors.accent }]}>
                        <Play color="#07121b" size={17} fill="#07121b" />
                        <Text style={styles.restartText}>Next level</Text>
                      </Pressable>
                    ) : null}
                    <Pressable accessibilityRole="button" onPress={() => startLevel(game.level)} style={[styles.restartButton, { backgroundColor: colors.accent }]}>
                      <RotateCcw color="#07121b" size={17} />
                      <Text style={styles.restartText}>{levelCleared ? "Play again" : "Retry level"}</Text>
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
              {actionButton("Aim left", ArrowLeft, () => setAngle((value) => Math.max(-1.25, value - 0.12)), shotTrace !== null)}
              <Pressable
                accessibilityLabel="Shoot bubble"
                accessibilityRole="button"
                disabled={shotTrace !== null}
                onPress={fire}
                style={({ pressed }) => [styles.fireButton, { backgroundColor: colors.accent }, pressed && styles.controlPressed]}
              >
                <CircleDot color="#07121b" size={21} strokeWidth={2.5} />
                <Text style={styles.fireText}>SHOOT</Text>
              </Pressable>
              {actionButton("Aim right", ArrowRight, () => setAngle((value) => Math.min(1.25, value + 0.12)), shotTrace !== null)}
              {actionButton("Reset aim", Target, () => setAngle(0), shotTrace !== null)}
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
  title: { color: "#ffffff", fontSize: 19, fontWeight: "900" },
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
  stats: { width: "100%", flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  stat: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 7, borderWidth: 1, borderRadius: 10 },
  statLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  statValue: { marginTop: 2, fontSize: 15, fontWeight: "900" },
  board: { overflow: "hidden", borderRadius: 10, backgroundColor: "#08121c", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  bubble: { position: "absolute", alignItems: "center", justifyContent: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  bubbleHighlight: { marginTop: "13%", backgroundColor: "rgba(255,255,255,0.55)" },
  aimSegment: { position: "absolute", height: 2, backgroundColor: "rgba(255,255,255,0.5)" },
  targetMarker: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.92)", backgroundColor: "rgba(255,255,255,0.12)" },
  projectile: { position: "absolute", alignItems: "center", justifyContent: "flex-start", borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", zIndex: 2 },
  nextBubble: { position: "absolute", width: 35, height: 48, alignItems: "center" },
  nextLabel: { color: "rgba(255,255,255,0.65)", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(4,8,14,0.78)" },
  overlayTitle: { color: "#ffffff", fontSize: 25, fontWeight: "900" },
  countdownNumber: { fontSize: 68 },
  overlayDetail: { marginTop: 2, marginBottom: 8, color: "rgba(255,255,255,0.75)", fontSize: 12 },
  overlayActions: { width: "100%", alignItems: "center", gap: 8, paddingHorizontal: 18 },
  restartButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15, borderRadius: 12 },
  restartText: { color: "#07121b", fontSize: 13, fontWeight: "900" },
  chooseLevelButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 11 },
  chooseLevelText: { fontSize: 12, fontWeight: "800" },
  controls: { width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingBottom: 8 },
  aimButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  fireButton: { minWidth: 112, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, borderRadius: 14 },
  fireText: { color: "#07121b", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  controlSpacer: { height: 60 },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  disabledControl: { opacity: 0.4 },
});
