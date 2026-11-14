import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Coffee, Heart, Pause, Play, RotateCcw, X, Zap } from "lucide-react-native";
import { LinearGradient as NativeLinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import NativeGameHelp from "./NativeGameHelp";
import {
  activateRallyNitro,
  activateRallyThrusters,
  advanceRally,
  createRallyState,
  getRallySteeringLane,
  getRallyScore,
  getRallyTickInterval,
  steerRallyCar,
  RALLY_LANES,
  RALLY_PLAYER_ROW,
  type RallyState,
} from "../lib/ridiculousRally";

const BEST_SCORE_KEY = "metoyou-tesla-roadster-race-best-score";
const ROADSTER_CARS = [
  { name: "Roadster Red", color: "#d93a40", glass: "#b7d9de" },
  { name: "Roadster Blue", color: "#2578a7", glass: "#b9dce2" },
  { name: "Roadster Volt", color: "#77a52c", glass: "#cde0bd" },
] as const;
const SCENERY = [
  { y: 0.04, side: "left", size: 0.72 }, { y: 0.12, side: "right", size: 0.9 },
  { y: 0.2, side: "left", size: 1.05 }, { y: 0.29, side: "right", size: 0.68 },
  { y: 0.38, side: "left", size: 0.84 }, { y: 0.48, side: "right", size: 1.08 },
  { y: 0.58, side: "left", size: 0.76 }, { y: 0.68, side: "right", size: 0.94 },
  { y: 0.78, side: "left", size: 1.1 }, { y: 0.89, side: "right", size: 0.8 },
] as const;

type RacePhase = "menu" | "countdown" | "playing" | "paused";

function getLaneCenter(lane: number, width: number) {
  const roadWidth = width * 0.82;
  return width / 2 - roadWidth / 2 + roadWidth * (lane + 0.5) / RALLY_LANES;
}

function Roadster({ color, glass, flying, nitro, traffic = false }: { color: string; glass: string; flying: boolean; nitro: boolean; traffic?: boolean }) {
  return (
    <View style={[styles.roadster, flying && styles.flyingCar, nitro && styles.nitroCar, traffic && styles.trafficCar]}>
      <Svg width="100%" height="100%" viewBox="0 0 64 112">
        <Ellipse cx="32" cy="58" rx="27" ry="48" fill="#101315" opacity="0.5" />
        {nitro ? <Path d="M25 108 L32 124 L39 108" fill="#55d5ff" opacity="0.9" /> : null}
        {flying ? <Path d="M16 88 L11 108 L23 96 M48 88 L53 108 L41 96" fill="#ffb02e" /> : null}
        <Rect x="4" y="23" width="9" height="27" rx="4" fill="#17191c" />
        <Rect x="51" y="23" width="9" height="27" rx="4" fill="#17191c" />
        <Rect x="4" y="65" width="9" height="27" rx="4" fill="#17191c" />
        <Rect x="51" y="65" width="9" height="27" rx="4" fill="#17191c" />
        <Path d="M16 13 Q18 6 27 5 L37 5 Q46 6 48 13 L56 35 L58 82 Q57 99 48 104 L16 104 Q7 99 6 82 L8 35 Z" fill={color} stroke="#172026" strokeWidth="2" />
        <Path d="M20 17 Q22 12 28 11 L36 11 Q42 12 44 17 L48 34 L16 34 Z" fill={glass} stroke="#34464c" strokeWidth="2" />
        <Circle cx="18" cy="12" r="2.2" fill="#fff5c8" />
        <Circle cx="46" cy="12" r="2.2" fill="#fff5c8" />
        <Path d="M17 38 Q32 33 47 38 L44 64 Q32 68 20 64 Z" fill="#172329" stroke="#718088" strokeWidth="1.5" />
        <Path d="M20 40 L32 37 L32 63 L21 61 Z" fill="#a9c5cb" opacity="0.32" />
        <Path d="M13 17 Q16 10 21 9 L17 31 L11 33 Z" fill="#ffffff" opacity="0.18" />
        <Path d="M10 78 Q32 84 54 78 L53 91 Q50 102 43 103 L21 103 Q13 101 11 91 Z" fill="#991f29" opacity="0.72" />
        <Rect x="10" y="88" width="10" height="5" rx="2" fill="#ff4c42" />
        <Rect x="44" y="88" width="10" height="5" rx="2" fill="#ff4c42" />
        <Path d="M21 100 L43 100" stroke="#25292c" strokeWidth="2" />
        <Path d="M31 39 L31 62" stroke="#d7e5e8" strokeWidth="1" opacity="0.3" />
      </Svg>
    </View>
  );
}

function RoadTree({ size }: { size: number }) {
  return (
    <Svg width={52 * size} height={66 * size} viewBox="0 0 52 66">
      <Ellipse cx="27" cy="59" rx="19" ry="5" fill="#132616" opacity="0.35" />
      <Path d="M23 58 L23 35 L29 35 L30 58 Z" fill="#68452a" />
      <Ellipse cx="26" cy="38" rx="15" ry="17" fill="#1e552e" />
      <Ellipse cx="19" cy="27" rx="13" ry="15" fill="#347a3d" />
      <Ellipse cx="32" cy="25" rx="13" ry="16" fill="#438c47" />
      <Ellipse cx="25" cy="17" rx="11" ry="14" fill="#579f52" />
      <Ellipse cx="22" cy="13" rx="4" ry="6" fill="#8bc66b" opacity="0.42" />
    </Svg>
  );
}

export default function NativeTeslaRoadsterRace({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const topInset = Math.max(insets.top, 8);
  const bottomInset = Math.max(insets.bottom, 8);
  const trackHeight = Math.max(280, window.height - topInset - bottomInset - 184);
  const trackWidth = window.width;
  const roadWidth = trackWidth * 0.82;
  const rowHeight = trackHeight / (RALLY_PLAYER_ROW + 1);
  const sceneScroll = rowHeight * 0.75;
  const progress = useRef(new Animated.Value(0)).current;
  const progressFraction = useRef(0);
  const carOffset = useRef(new Animated.Value(0)).current;
  const steeringLaneRef = useRef(1);
  const calibrationSamples = useRef(0);
  const calibrationTotal = useRef(0);
  const neutralX = useRef<number | null>(null);
  const filteredTilt = useRef(0);
  const [game, setGame] = useState<RallyState>(() => createRallyState());
  const gameRef = useRef(game);
  const [phase, setPhase] = useState<RacePhase>("menu");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [carIndex, setCarIndex] = useState(0);
  const [tiltAvailable, setTiltAvailable] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const score = getRallyScore(game);
  const scenery = useMemo(() => SCENERY, []);
  const roadPath = useMemo(
    () => `M${(trackWidth - roadWidth) / 2},0 L${(trackWidth + roadWidth) / 2},0 L${(trackWidth + roadWidth) / 2},${trackHeight} L${(trackWidth - roadWidth) / 2},${trackHeight} Z`,
    [roadWidth, trackHeight, trackWidth],
  );
  const animatedDistance = progress.interpolate({ inputRange: [0, 1], outputRange: [0, sceneScroll] });
  const animatedObstacleY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] });
  const nitroActive = game.nitroTicks > 0;
  const flying = game.flightTicks > 0;
  const car = ROADSTER_CARS[carIndex];
  const playerY = rowHeight * RALLY_PLAYER_ROW;
  gameRef.current = game;
  const updateGame = (update: (current: RallyState) => RallyState) => {
    const next = update(gameRef.current);
    gameRef.current = next;
    setGame(next);
  };

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      progressFraction.current = value;
    });
    return () => progress.removeListener(listener);
  }, [progress]);

  useEffect(() => {
    let active = true;
    void Accelerometer.isAvailableAsync()
      .then((available) => { if (active) setTiltAvailable(available); })
      .catch(() => { if (active) setTiltAvailable(false); });
    void AsyncStorage.getItem(BEST_SCORE_KEY)
      .then((value) => {
        const saved = Number(value);
        if (active && Number.isFinite(saved) && saved > 0) setBestScore(saved);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!game.isGameOver || score <= bestScore) return;
    setBestScore(score);
    void AsyncStorage.setItem(BEST_SCORE_KEY, String(score)).catch(() => undefined);
  }, [bestScore, game.isGameOver, score]);

  useEffect(() => {
    if (phase !== "countdown" || countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        setPhase("playing");
      } else setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== "playing" || game.isGameOver || !tiltAvailable) return;
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    const advanceFrame = () => {
      if (!active) return;
      const current = gameRef.current;
      if (current.isGameOver) return;
      const duration = getRallyTickInterval(current.distance, current.nitroTicks > 0);
      const startProgress = progressFraction.current;
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(1, duration * (1 - startProgress)),
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.start(({ finished }) => {
        if (!finished || !active) return;
        progressFraction.current = 0;
        progress.setValue(0);
        const next = advanceRally(steerRallyCar(gameRef.current, steeringLaneRef.current));
        gameRef.current = next;
        setGame(next);
        if (!next.isGameOver) advanceFrame();
      });
    };
    advanceFrame();
    return () => {
      active = false;
      animation?.stop();
      progress.stopAnimation((value) => {
        progressFraction.current = value;
      });
    };
  }, [phase, progress, tiltAvailable]);

  useEffect(() => {
    if ((phase !== "playing" && phase !== "countdown") || !tiltAvailable || game.isGameOver) return;
    Accelerometer.setUpdateInterval(50);
    const subscription = Accelerometer.addListener(({ x }) => {
      if (neutralX.current === null) {
        calibrationTotal.current += x;
        calibrationSamples.current += 1;
        if (calibrationSamples.current >= 12) {
          neutralX.current = calibrationTotal.current / calibrationSamples.current;
        }
        return;
      }
      filteredTilt.current += (x - neutralX.current - filteredTilt.current) * 0.28;
      const tilt = filteredTilt.current;
      if (phase !== "playing") return;
      const targetLane = getRallySteeringLane(tilt);
      steeringLaneRef.current = targetLane;
      carOffset.setValue((targetLane - 1) * (roadWidth / RALLY_LANES));
    });
    return () => subscription.remove();
  }, [carOffset, game.isGameOver, phase, roadWidth, tiltAvailable]);

  const startRun = () => {
    const initialGame = createRallyState();
    gameRef.current = initialGame;
    setGame(initialGame);
    setCountdown(3);
    setPhase("countdown");
    progress.setValue(0);
    progressFraction.current = 0;
    steeringLaneRef.current = 1;
    carOffset.setValue(0);
    calibrationSamples.current = 0;
    calibrationTotal.current = 0;
    neutralX.current = null;
    filteredTilt.current = 0;
  };

  const activateNitro = () => updateGame(activateRallyNitro);
  const activateThrusters = () => updateGame(activateRallyThrusters);
  const abilityButton = (label: string, Icon: typeof Play, fuel: number, minimumFuel: number, active: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${Math.round(fuel)} percent fuel${active ? ", active" : ""}`}
      disabled={fuel < minimumFuel || active || phase !== "playing"}
      onPress={onPress}
      style={({ pressed }) => [styles.abilityButton, { backgroundColor: colors.surface, borderColor: active ? colors.accent : colors.border }, (fuel < minimumFuel || active) && styles.dimmed, pressed && styles.controlPressed]}
    >
      <Icon color={active ? colors.accent : colors.text} size={20} />
      <Text style={[styles.abilityLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.fuelTrack, { backgroundColor: colors.control }]}>
        <View style={[styles.fuelFill, { width: `${fuel}%`, backgroundColor: active ? colors.accent : "#84cc16" }]} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.fullscreen, { backgroundColor: "#133723" }]}>
      <StatusBar hidden />
      <NativeLinearGradient colors={["#408451", "#234f35", "#183e2b"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit Tesla Roadster Race" onPress={onExit} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X color={colors.text} size={19} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>GAME KINGDOM</Text>
          <Text style={[styles.title, { color: colors.text }]}>Tesla Roadster Race</Text>
        </View>
        {phase === "playing" || phase === "paused" ? (
          <Pressable accessibilityRole="button" accessibilityLabel={phase === "paused" ? "Resume race" : "Pause race"} onPress={() => setPhase(phase === "paused" ? "playing" : "paused")} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {phase === "paused" ? <Play color={colors.text} size={18} /> : <Pause color={colors.text} size={18} />}
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>

      {phase === "menu" ? (
        <View style={[styles.menu, { paddingBottom: bottomInset }]}>
          <View style={[styles.previewStage, { borderColor: colors.border, backgroundColor: "rgba(9,24,16,0.42)" }]}>
            <View style={styles.menuTrackLine} />
            <Roadster color={car.color} glass={car.glass} flying={false} nitro={false} />
          </View>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Pick your Roadster</Text>
          <Text style={[styles.menuDescription, { color: colors.muted }]}>A ridiculous road trip at very irresponsible speeds.</Text>
          <View style={styles.carChoices}>
            {ROADSTER_CARS.map((choice, index) => (
              <Pressable
                key={choice.name}
                accessibilityRole="button"
                accessibilityState={{ selected: carIndex === index }}
                accessibilityLabel={`Choose ${choice.name}`}
                onPress={() => setCarIndex(index)}
                style={[styles.carChoice, { backgroundColor: carIndex === index ? colors.control : colors.surface, borderColor: carIndex === index ? colors.accent : colors.border }]}
              >
                <View style={[styles.carSwatch, { backgroundColor: choice.color }]} />
                <Text numberOfLines={1} style={[styles.carName, { color: colors.text }]}>{choice.name.replace("Roadster ", "")}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.tiltInstructions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.tiltTitle, { color: colors.text }]}>Tilt to steer</Text>
            <Text style={[styles.toggleHint, { color: colors.muted }]}>
              {tiltAvailable ? "Hold your phone level at the start, then tilt left or right to steer." : "This device has no motion sensor, so tilt steering is unavailable."}
            </Text>
          </View>
          <NativeGameHelp
            gameTitle="Tesla Roadster Race"
            introduction="Tilt your phone to steer a Roadster down a straight road, avoid traffic, and grab coffee."
            steps={[
              "Hold the phone level during the countdown to calibrate steering.",
              "Tilt left or right to smoothly move between lanes. There are no touch steering controls.",
              "Tap Nitro for a short speed burst. The meter refills while you drive.",
              "Tap Thrusters to fly over hazards for a moment. Thruster fuel also recharges.",
              "Avoid other cars and roadworks, collect coffee, and travel as far as you can.",
            ]}
            colors={colors}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !tiltAvailable }} disabled={!tiltAvailable} onPress={startRun} style={({ pressed }) => [styles.startButton, { backgroundColor: colors.accent }, !tiltAvailable && styles.dimmed, pressed && styles.controlPressed]}>
            <Play color="#07121b" size={19} fill="#07121b" />
            <Text style={styles.startButtonText}>Start race</Text>
          </Pressable>
          <Text style={[styles.bestScoreMenu, { color: colors.muted }]}>BEST DISTANCE  {bestScore} m</Text>
        </View>
      ) : phase === "countdown" ? (
        <View style={styles.countdown}>
          <Roadster color={car.color} glass={car.glass} flying={false} nitro={false} />
          <Text style={[styles.countdownNumber, { color: colors.text }]}>{countdown}</Text>
          <Text style={[styles.countdownText, { color: colors.muted }]}>Hold on. Probably.</Text>
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>DISTANCE</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{score} m</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Coffee color="#fbbf24" size={15} />
              <Text style={[styles.statValue, { color: colors.text }]}>{game.snacks}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Heart color="#fb7185" size={15} />
              <Text style={[styles.statValue, { color: colors.text }]}>{game.lives}</Text>
            </View>
          </View>

          <View style={[styles.trackFrame, { width: trackWidth, height: trackHeight }]}>
            <NativeLinearGradient colors={["#3f8050", "#225638", "#387048"]} style={StyleSheet.absoluteFill} />
            {scenery.map((item, index) => {
              const y = (item.y * trackHeight + game.tick * sceneScroll) % trackHeight;
              const roadLeft = (trackWidth - roadWidth) / 2;
              const left = item.side === "left"
                ? roadLeft - 52 * item.size + 8
                : roadLeft + roadWidth - 8;
              return (
                <Animated.View
                  key={`scenery-${index}`}
                  pointerEvents="none"
                  style={[styles.scenery, { left, top: y, transform: [{ translateY: animatedDistance }] }]}
                >
                  <RoadTree size={item.size} />
                </Animated.View>
              );
            })}
            <Svg pointerEvents="none" width={trackWidth} height={trackHeight} style={StyleSheet.absoluteFill}>
              <Path d={roadPath} fill="#3d494c" stroke="#c2c8a9" strokeWidth={4} />
          </Svg>
          {[1, 2].flatMap((divider) => {
            const x = (trackWidth - roadWidth) / 2 + (roadWidth * divider) / RALLY_LANES;
            return Array.from({ length: Math.ceil(trackHeight / 42) + 1 }, (_, dash) => {
              const y = (dash * 42 + game.tick * sceneScroll) % trackHeight - 22;
              return (
                <Animated.View
                  key={`lane-${divider}-${dash}`}
                  pointerEvents="none"
                  style={[styles.laneDash, { left: x - 1, top: y, transform: [{ translateY: animatedDistance }] }]}
                />
              );
            });
          })}
          {game.obstacles.map((obstacle) => {
            const y = rowHeight * obstacle.row;
            const center = getLaneCenter(obstacle.lane, trackWidth);
            return (
                <Animated.View
                  key={obstacle.id}
                  style={[styles.roadItem, { left: center - 25, top: y - 36, transform: [{ translateY: animatedObstacleY }] }]}
                >
                  {obstacle.type === "coffee" ? <Coffee color="#f7b733" size={32} fill="#8b4e23" /> : obstacle.type === "car" ? (
                    <Roadster
                      color={["#d9b746", "#547caa", "#9d5a40", "#c5c6bf"][obstacle.id % 4]}
                      glass="#a9c5cb"
                      flying={false}
                      nitro={false}
                      traffic
                    />
                  ) : <RoadCone />}
                </Animated.View>
            );
          })}
          <Animated.View style={[styles.playerPosition, { left: trackWidth / 2 - 30, top: playerY - 48, transform: [{ translateX: carOffset }] }]}>
            <Roadster color={car.color} glass={car.glass} flying={flying} nitro={nitroActive} />
          </Animated.View>
            {phase === "paused" || game.isGameOver ? (
              <View style={styles.overlay}>
                <Text style={styles.resultEmoji}>{game.isGameOver ? "💥" : "⏸️"}</Text>
                <Text style={styles.overlayTitle}>{game.isGameOver ? "Road trip over" : "Pit stop"}</Text>
                <Text style={styles.overlayDetail}>{score} m  ·  {game.snacks} coffees</Text>
                {game.isGameOver ? (
                  <Pressable accessibilityRole="button" onPress={startRun} style={[styles.retryButton, { backgroundColor: colors.accent }]}>
                    <RotateCcw color="#07121b" size={17} />
                    <Text style={styles.retryText}>Race again</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {phase === "playing" && !game.isGameOver ? (
            <View style={[styles.controls, { paddingBottom: bottomInset }]}>
              {abilityButton("NITRO", Zap, game.nitroFuel, 40, nitroActive, activateNitro)}
              {abilityButton("FLY", Play, game.thrusterFuel, 50, flying, activateThrusters)}
            </View>
          ) : <View style={[styles.controlSpacer, { height: bottomInset + 60 }]} />}
        </>
      )}
    </View>
  );
}

function RoadCone() {
  return (
    <View style={styles.cone}>
      <View style={styles.coneTop} />
      <View style={styles.coneStripe} />
      <View style={styles.coneBase} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, alignItems: "center", justifyContent: "space-between", overflow: "hidden" },
  header: { zIndex: 5, width: "100%", minHeight: 55, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13 },
  headerButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  heading: { alignItems: "center" },
  kicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  title: { fontSize: 17, fontWeight: "900" },
  menu: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20 },
  previewStage: { width: 122, height: 132, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderRadius: 22 },
  menuTrackLine: { position: "absolute", top: 0, bottom: 0, width: 38, borderLeftWidth: 2, borderRightWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.42)" },
  menuTitle: { fontSize: 23, fontWeight: "900" },
  menuDescription: { maxWidth: 320, fontSize: 12, lineHeight: 17, textAlign: "center" },
  carChoices: { width: "100%", flexDirection: "row", gap: 7 },
  carChoice: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderRadius: 11 },
  carSwatch: { width: 13, height: 20, borderRadius: 6 },
  carName: { fontSize: 9, fontWeight: "800" },
  tiltInstructions: { width: "100%", gap: 4, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 11 },
  tiltTitle: { fontSize: 12, fontWeight: "800" },
  toggleHint: { fontSize: 9 },
  startButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 22, borderRadius: 13 },
  startButtonText: { color: "#07121b", fontSize: 14, fontWeight: "900" },
  bestScoreMenu: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  countdown: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  countdownNumber: { fontSize: 82, fontWeight: "900" },
  countdownText: { fontSize: 13, fontWeight: "800" },
  stats: { zIndex: 3, width: "100%", flexDirection: "row", justifyContent: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 5 },
  stat: { minWidth: 72, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8, borderWidth: 1, borderRadius: 10 },
  statLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  statValue: { fontSize: 11, fontWeight: "900" },
  trackFrame: { position: "relative", overflow: "hidden", flex: 1, backgroundColor: "#315d3b" },
  scenery: { position: "absolute", zIndex: 1 },
  laneDash: { position: "absolute", zIndex: 2, width: 2, height: 22, borderRadius: 1, backgroundColor: "rgba(246,247,231,0.68)" },
  roadItem: { position: "absolute", zIndex: 3, width: 50, height: 72, alignItems: "center", justifyContent: "center" },
  playerPosition: { position: "absolute", zIndex: 4, width: 60, height: 98, alignItems: "center", justifyContent: "center" },
  roadster: { width: 54, height: 94, alignItems: "center", justifyContent: "center", elevation: 8, shadowColor: "#000000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.62, shadowRadius: 6 },
  trafficCar: { width: 39, height: 70, transform: [{ rotate: "180deg" }] },
  flyingCar: { transform: [{ translateY: -18 }, { scale: 1.08 }], elevation: 15, shadowColor: "#fbbf24", shadowOpacity: 0.9 },
  nitroCar: { shadowColor: "#38bdf8", shadowOpacity: 1, shadowRadius: 14 },
  cone: { width: 25, height: 30, alignItems: "center", justifyContent: "flex-end" },
  coneTop: { position: "absolute", top: 0, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 17, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#f97316" },
  coneStripe: { position: "absolute", top: 12, width: 11, height: 3, backgroundColor: "#fff7ed" },
  coneBase: { width: 24, height: 6, borderRadius: 3, backgroundColor: "#ea580c" },
  overlay: { position: "absolute", zIndex: 6, top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(6,17,14,0.79)" },
  overlayTitle: { color: "#ffffff", fontSize: 26, fontWeight: "900" },
  overlayDetail: { marginBottom: 5, color: "rgba(255,255,255,0.8)", fontSize: 12 },
  resultEmoji: { fontSize: 42 },
  retryButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15, borderRadius: 12 },
  retryText: { color: "#07121b", fontSize: 13, fontWeight: "900" },
  controls: { zIndex: 4, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 6, paddingTop: 7, paddingHorizontal: 8 },
  controlButton: { width: 46, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 13 },
  abilityButton: { width: 74, height: 52, alignItems: "center", justifyContent: "center", gap: 1, borderWidth: 1, borderRadius: 12 },
  abilityLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  fuelTrack: { width: "72%", height: 3, overflow: "hidden", borderRadius: 2 },
  fuelFill: { height: 3, borderRadius: 2 },
  controlSpacer: { height: 60 },
  dimmed: { opacity: 0.48 },
  controlPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
