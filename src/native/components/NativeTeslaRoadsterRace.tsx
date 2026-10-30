import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { Animated, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, Coffee, Heart, Pause, Play, RotateCcw, X, Zap } from "lucide-react-native";
import { LinearGradient as NativeLinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import NativeGameHelp from "./NativeGameHelp";
import {
  activateRallyNitro,
  activateRallyThrusters,
  advanceRally,
  createRallyState,
  getRallyScore,
  getRallyTickInterval,
  moveRallyCar,
  RALLY_LANES,
  RALLY_PLAYER_ROW,
  type RallyState,
} from "../lib/ridiculousRally";

const BEST_SCORE_KEY = "metoyou-tesla-roadster-race-best-score";
const ROADSTER_CARS = [
  { name: "Roadster Red", color: "#f04452", glass: "#d8fbff" },
  { name: "Roadster Blue", color: "#36b9e8", glass: "#e2fbff" },
  { name: "Roadster Volt", color: "#a5e844", glass: "#f2ffe1" },
] as const;
const SCENERY = [
  { y: 0.04, side: "left", icon: "🌲" }, { y: 0.1, side: "right", icon: "🏠" },
  { y: 0.18, side: "left", icon: "🚶" }, { y: 0.24, side: "right", icon: "🌳" },
  { y: 0.33, side: "left", icon: "🏡" }, { y: 0.4, side: "right", icon: "🚶" },
  { y: 0.49, side: "left", icon: "🌳" }, { y: 0.56, side: "right", icon: "🏠" },
  { y: 0.65, side: "left", icon: "🚶" }, { y: 0.73, side: "right", icon: "🌲" },
  { y: 0.82, side: "left", icon: "🏡" }, { y: 0.91, side: "right", icon: "🚶" },
] as const;

type RacePhase = "menu" | "countdown" | "playing" | "paused";

function getRoadWidthAt(y: number, height: number, roadWidth: number) {
  return roadWidth * (0.78 + 0.22 * Math.max(0, Math.min(1, y / height)));
}

function getRoadCenterAt(y: number, height: number, width: number) {
  const progress = y / height;
  return width / 2 + Math.sin(progress * Math.PI * 2.2 + 0.2) * width * 0.115 + Math.sin(progress * Math.PI * 4.8) * width * 0.025;
}

function getRoadPath(width: number, height: number, roadWidth: number) {
  const samples = 32;
  const left: string[] = [];
  const right: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const y = (height * index) / samples;
    const center = getRoadCenterAt(y, height, width);
    const halfRoad = getRoadWidthAt(y, height, roadWidth) / 2;
    left.push(`${index === 0 ? "M" : "L"}${(center - halfRoad).toFixed(1)},${y.toFixed(1)}`);
    right.push(`${(center + halfRoad).toFixed(1)},${y.toFixed(1)}`);
  }
  return `${left.join(" ")} ${right.reverse().map((point) => `L${point}`).join(" ")} Z`;
}

function getLaneCenter(lane: number, y: number, width: number, height: number, roadWidth: number) {
  const roadWidthAtY = getRoadWidthAt(y, height, roadWidth);
  return getRoadCenterAt(y, height, width) - roadWidthAtY / 2 + roadWidthAtY * (lane + 0.5) / RALLY_LANES;
}

function Roadster({ color, glass, flying, nitro }: { color: string; glass: string; flying: boolean; nitro: boolean }) {
  return (
    <View style={[styles.roadster, { backgroundColor: color }, flying && styles.flyingCar, nitro && styles.nitroCar]}>
      <View style={[styles.carWindshield, { backgroundColor: glass }]} />
      <View style={[styles.carRoof, { backgroundColor: color }]} />
      <View style={[styles.carHood, { backgroundColor: color }]} />
      <View style={styles.carFrontLightLeft} />
      <View style={styles.carFrontLightRight} />
      <View style={styles.carWheelLeftFront} />
      <View style={styles.carWheelRightFront} />
      <View style={styles.carWheelLeftRear} />
      <View style={styles.carWheelRightRear} />
      {flying ? <View style={styles.thrusterFlame}><Text style={styles.flameEmoji}>🔥</Text></View> : null}
      {nitro ? <View style={styles.nitroStreak} /> : null}
    </View>
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
  const roadWidth = trackWidth * 0.74;
  const rowHeight = trackHeight / (RALLY_PLAYER_ROW + 1);
  const sceneScroll = rowHeight * 0.75;
  const progress = useRef(new Animated.Value(0)).current;
  const tiltGate = useRef(false);
  const [game, setGame] = useState<RallyState>(() => createRallyState());
  const [phase, setPhase] = useState<RacePhase>("menu");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [carIndex, setCarIndex] = useState(0);
  const [tiltEnabled, setTiltEnabled] = useState(true);
  const [tiltAvailable, setTiltAvailable] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const score = getRallyScore(game);
  const scenery = useMemo(() => SCENERY, []);
  const roadPath = useMemo(() => getRoadPath(trackWidth, trackHeight, roadWidth), [roadWidth, trackHeight, trackWidth]);
  const animatedDistance = progress.interpolate({ inputRange: [0, 1], outputRange: [0, sceneScroll] });
  const animatedObstacleY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] });
  const nitroActive = game.nitroTicks > 0;
  const flying = game.flightTicks > 0;
  const car = ROADSTER_CARS[carIndex];
  const playerY = rowHeight * RALLY_PLAYER_ROW;

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
    if (phase !== "playing" || game.isGameOver) return;
    const duration = getRallyTickInterval(game.distance, game.nitroTicks > 0);
    progress.stopAnimation();
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true });
    animation.start();
    const tick = setTimeout(() => setGame((current) => advanceRally(current)), duration);
    return () => {
      clearTimeout(tick);
      animation.stop();
    };
  }, [game.distance, game.isGameOver, game.nitroTicks, game.tick, phase, progress]);

  useEffect(() => {
    if (phase !== "playing" || !tiltEnabled || !tiltAvailable) return;
    Accelerometer.setUpdateInterval(80);
    const subscription = Accelerometer.addListener(({ x }) => {
      if (Math.abs(x) < 0.14) {
        tiltGate.current = false;
        return;
      }
      if (tiltGate.current || Math.abs(x) < 0.28) return;
      tiltGate.current = true;
      setGame((current) => moveRallyCar(current, x > 0 ? 1 : -1));
    });
    return () => subscription.remove();
  }, [phase, tiltAvailable, tiltEnabled]);

  const startRun = () => {
    setGame(createRallyState());
    setCountdown(3);
    setPhase("countdown");
    tiltGate.current = false;
  };

  const activateNitro = () => setGame((current) => activateRallyNitro(current));
  const activateThrusters = () => setGame((current) => activateRallyThrusters(current));
  const laneButton = (label: string, direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => setGame((current) => moveRallyCar(current, direction))}
      style={({ pressed }) => [styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.controlPressed]}
    >
      {direction === -1 ? <ArrowLeft color={colors.text} size={24} /> : <ArrowRight color={colors.text} size={24} />}
    </Pressable>
  );
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
          <View style={[styles.toggleRow, { borderColor: colors.border }]}>
            <View style={styles.toggleText}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Tilt steering</Text>
              <Text style={[styles.toggleHint, { color: colors.muted }]}>{tiltAvailable ? "Tilt to change lanes" : "Motion sensor unavailable; use steering buttons"}</Text>
            </View>
            <Switch value={tiltEnabled && tiltAvailable} onValueChange={setTiltEnabled} disabled={!tiltAvailable} trackColor={{ false: colors.control, true: colors.accent }} />
          </View>
          <NativeGameHelp
            gameTitle="Tesla Roadster Race"
            introduction="Steer a forward-facing Roadster along a winding scenic road while dodging traffic and grabbing coffee."
            steps={[
              "Choose your Roadster and turn on tilt steering, or use the on-screen arrows.",
              "Tap Nitro for a short speed burst. The meter refills while you drive.",
              "Tap Thrusters to fly over hazards for a moment. Thruster fuel also recharges.",
              "Avoid roadworks, collect coffee, and travel as far as you can. The road gets faster over time.",
            ]}
            colors={colors}
          />
          <Pressable accessibilityRole="button" onPress={startRun} style={({ pressed }) => [styles.startButton, { backgroundColor: colors.accent }, pressed && styles.controlPressed]}>
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
              const roadEdge = getRoadCenterAt(y, trackHeight, trackWidth) + (item.side === "left" ? -1 : 1) * getRoadWidthAt(y, trackHeight, roadWidth) / 2;
              const left = item.side === "left" ? roadEdge - 35 : roadEdge + 5;
              const nextY = y + sceneScroll;
              const nextRoadEdge = getRoadCenterAt(nextY, trackHeight, trackWidth) + (item.side === "left" ? -1 : 1) * getRoadWidthAt(nextY, trackHeight, roadWidth) / 2;
              const nextLeft = item.side === "left" ? nextRoadEdge - 35 : nextRoadEdge + 5;
              const sceneryX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, nextLeft - left] });
              return (
                <Animated.Text
                  key={`scenery-${index}`}
                  style={[styles.scenery, { left, top: y, transform: [{ translateX: sceneryX }, { translateY: animatedDistance }] }]}
                >
                  {item.icon}
                </Animated.Text>
              );
            })}
            <Svg pointerEvents="none" width={trackWidth} height={trackHeight} style={StyleSheet.absoluteFill}>
              <Path d={roadPath} fill="#3d494c" stroke="#c2c8a9" strokeWidth={4} />
              {[1, 2].map((divider) => {
                const points = Array.from({ length: 28 }, (_, index) => {
                  const y = (trackHeight * index) / 27;
                  const widthAtY = getRoadWidthAt(y, trackHeight, roadWidth);
                  const center = getRoadCenterAt(y, trackHeight, trackWidth);
                  return `${index === 0 ? "M" : "L"}${(center - widthAtY / 2 + widthAtY * divider / RALLY_LANES).toFixed(1)},${y.toFixed(1)}`;
                }).join(" ");
                return <Path key={divider} d={points} fill="none" stroke="rgba(246,247,231,0.62)" strokeWidth={2} strokeDasharray="15 19" strokeDashoffset={game.tick * 4} />;
              })}
            </Svg>
            {game.obstacles.map((obstacle) => {
              const y = rowHeight * obstacle.row;
              const center = getLaneCenter(obstacle.lane, y, trackWidth, trackHeight, roadWidth);
              const nextCenter = getLaneCenter(obstacle.lane, y + rowHeight, trackWidth, trackHeight, roadWidth);
              const obstacleX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, nextCenter - center] });
              return (
                <Animated.View
                  key={obstacle.id}
                  style={[styles.roadItem, { left: center - 18, top: y - 18, transform: [{ translateX: obstacleX }, { translateY: animatedObstacleY }] }]}
                >
                  {obstacle.type === "coffee" ? <Coffee color="#f7b733" size={32} fill="#8b4e23" /> : <RoadCone />}
                </Animated.View>
              );
            })}
            <View style={[styles.playerPosition, { left: getLaneCenter(game.lane, playerY, trackWidth, trackHeight, roadWidth) - 25, top: playerY - 38 }]}>
              <Roadster color={car.color} glass={car.glass} flying={flying} nitro={nitroActive} />
            </View>
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
              {laneButton("Steer left", -1)}
              {abilityButton("NITRO", Zap, game.nitroFuel, 40, nitroActive, activateNitro)}
              {abilityButton("FLY", Play, game.thrusterFuel, 50, flying, activateThrusters)}
              {laneButton("Steer right", 1)}
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
  toggleRow: { width: "100%", minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderWidth: 1, borderRadius: 11 },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 12, fontWeight: "800" },
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
  scenery: { position: "absolute", zIndex: 1, fontSize: 25 },
  roadItem: { position: "absolute", zIndex: 3, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  playerPosition: { position: "absolute", zIndex: 4, width: 50, height: 76, alignItems: "center", justifyContent: "center" },
  roadster: { width: 35, height: 68, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.8)", borderRadius: 15, elevation: 8, shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.55, shadowRadius: 6 },
  flyingCar: { transform: [{ translateY: -18 }, { scale: 1.08 }], elevation: 15, shadowColor: "#fbbf24", shadowOpacity: 0.9 },
  nitroCar: { shadowColor: "#38bdf8", shadowOpacity: 1, shadowRadius: 14 },
  carWindshield: { position: "absolute", top: 10, width: 21, height: 13, borderRadius: 6, borderWidth: 1, borderColor: "rgba(6,25,35,0.5)" },
  carRoof: { position: "absolute", top: 24, width: 25, height: 20, borderRadius: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)" },
  carHood: { position: "absolute", top: 3, width: 19, height: 8, borderRadius: 5 },
  carFrontLightLeft: { position: "absolute", top: 3, left: 4, width: 6, height: 3, borderRadius: 2, backgroundColor: "#fff8bd" },
  carFrontLightRight: { position: "absolute", top: 3, right: 4, width: 6, height: 3, borderRadius: 2, backgroundColor: "#fff8bd" },
  carWheelLeftFront: { position: "absolute", left: -3, top: 13, width: 4, height: 13, borderRadius: 2, backgroundColor: "#101418" },
  carWheelRightFront: { position: "absolute", right: -3, top: 13, width: 4, height: 13, borderRadius: 2, backgroundColor: "#101418" },
  carWheelLeftRear: { position: "absolute", left: -3, bottom: 12, width: 4, height: 13, borderRadius: 2, backgroundColor: "#101418" },
  carWheelRightRear: { position: "absolute", right: -3, bottom: 12, width: 4, height: 13, borderRadius: 2, backgroundColor: "#101418" },
  thrusterFlame: { position: "absolute", bottom: -19, alignItems: "center" },
  flameEmoji: { fontSize: 17 },
  nitroStreak: { position: "absolute", top: -34, width: 5, height: 24, borderRadius: 3, backgroundColor: "#38bdf8", opacity: 0.85 },
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
