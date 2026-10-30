import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Dice5, Play, RotateCcw, Trophy, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNativeTheme, NATIVE_THEME_COLORS } from "../contexts/NativeThemeProvider";
import NativeGameHelp from "./NativeGameHelp";
import {
  createYahtzeeState,
  getAvailableYahtzeeCategories,
  getYahtzeeTotal,
  getYahtzeeUpperBonus,
  getYahtzeeUpperSubtotal,
  rollYahtzeeDice,
  scoreYahtzeeCategory,
  scoreYahtzeeTurn,
  toggleYahtzeeHold,
  YAHTZEE_CATEGORIES,
  YAHTZEE_ROLLS_PER_TURN,
  type YahtzeeCategory,
  type YahtzeeState,
} from "../lib/yahtzee";

const BEST_SCORE_KEY = "metoyou-yahtzee-best-score";
type YahtzeePhase = "menu" | "countdown" | "playing";

const CATEGORY_LABELS: Record<YahtzeeCategory, string> = {
  ones: "Aces",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeOfAKind: "Three of a kind",
  fourOfAKind: "Four of a kind",
  fullHouse: "Full house",
  smallStraight: "Small straight",
  largeStraight: "Large straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

const DIE_PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export default function NativeYahtzeeGame({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const dieSize = Math.min(58, (window.width - 48) / 5);
  const [game, setGame] = useState<YahtzeeState>(() => createYahtzeeState());
  const [phase, setPhase] = useState<YahtzeePhase>("menu");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const availableCategories = useMemo(() => getAvailableYahtzeeCategories(game), [game]);
  const total = getYahtzeeTotal(game);
  const upperSubtotal = getYahtzeeUpperSubtotal(game.scores);
  const upperBonus = getYahtzeeUpperBonus(game.scores);

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
    if (!game.isGameOver || total <= bestScore) return;
    setBestScore(total);
    void AsyncStorage.setItem(BEST_SCORE_KEY, String(total)).catch(() => undefined);
  }, [bestScore, game.isGameOver, total]);

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

  const startGame = () => {
    setGame(createYahtzeeState());
    setCountdown(3);
    setPhase("countdown");
  };

  const roll = () => setGame((current) => rollYahtzeeDice(current));
  const chooseCategory = (category: YahtzeeCategory) => {
    setGame((current) => scoreYahtzeeTurn(current, category));
  };

  const dice = game.dice.map((value, index) => {
    const held = game.held[index];
    const canHold = value > 0 && game.rollsRemaining > 0 && game.rollsRemaining < YAHTZEE_ROLLS_PER_TURN;
    return (
      <Pressable
        key={index}
        accessibilityRole="button"
        accessibilityLabel={value === 0 ? `Die ${index + 1}, not rolled` : `Die ${index + 1}, ${value}${held ? ", held" : ""}`}
        accessibilityState={{ selected: held, disabled: !canHold }}
        disabled={!canHold}
        onPress={() => setGame((current) => toggleYahtzeeHold(current, index))}
        style={[styles.die, { width: dieSize, height: dieSize, backgroundColor: held ? colors.accent : "#ffffff", borderColor: held ? colors.accent : "#d8dee8" }, held && styles.heldDie, !canHold && value === 0 && styles.unrolledDie]}
      >
        {value > 0 ? DIE_PIPS[value].map(([left, top], pipIndex) => (
          <View
            key={pipIndex}
            style={[
              styles.pip,
              { left: `${left}%`, top: `${top}%`, backgroundColor: held ? "#07121b" : "#172033" },
            ]}
          />
        )) : <Text style={styles.dieQuestion}>?</Text>}
      </Pressable>
    );
  });

  return (
    <LinearGradient colors={colors.background} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Exit Yahtzee" accessibilityRole="button" onPress={onExit} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <X color={colors.text} size={20} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.kicker, { color: colors.accent }]}>GAME KINGDOM</Text>
          <Text style={[styles.title, { color: colors.text }]}>Yahtzee</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {phase === "menu" ? (
        <View style={styles.menu}>
          <View style={[styles.menuIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Dice5 color={colors.accent} size={36} />
          </View>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Ready to roll?</Text>
          <Text style={[styles.menuDescription, { color: colors.muted }]}>Make the best score you can across 13 classic dice categories.</Text>
          <NativeGameHelp
            gameTitle="Yahtzee"
            introduction="Build scoring combinations with five dice and record one result in each of the 13 scorecard categories."
            steps={[
              "Roll all five dice. You get up to 3 rolls on each turn.",
              "After a roll, tap dice to hold them. Roll again to reroll only the unheld dice.",
              "Tap an open scorecard category after any roll to score your dice there. Each category can be used once.",
              "Aces through Sixes make up the upper section. Score 63 or more there to earn a 35-point bonus.",
              "Fill all 13 categories. The highest final total wins your best-score record.",
            ]}
            colors={colors}
          />
          <View style={[styles.bestScore, { borderColor: colors.border }]}>
            <Trophy color={colors.accent} size={18} />
            <Text style={[styles.bestScoreText, { color: colors.text }]}>Best game: {bestScore}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={startGame} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
            <Play color="#07121b" size={19} fill="#07121b" />
            <Text style={styles.primaryButtonText}>Start game</Text>
          </Pressable>
        </View>
      ) : phase === "countdown" ? (
        <View style={styles.countdown}>
          <Text style={[styles.countdownNumber, { color: colors.text }]}>{countdown}</Text>
          <Text style={[styles.countdownText, { color: colors.muted }]}>Get ready to roll</Text>
        </View>
      ) : game.isGameOver ? (
        <View style={styles.result}>
          <Trophy color={colors.accent} size={38} />
          <Text style={[styles.resultTitle, { color: colors.text }]}>Game complete</Text>
          <Text style={[styles.finalScore, { color: colors.accent }]}>{total}</Text>
          <Text style={[styles.resultDetail, { color: colors.muted }]}>Best game: {bestScore}</Text>
          <Pressable accessibilityRole="button" onPress={startGame} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
            <RotateCcw color="#07121b" size={18} />
            <Text style={styles.primaryButtonText}>Play again</Text>
          </Pressable>
          <ScoreSummary game={game} colors={colors} />
        </View>
      ) : (
        <>
          <View style={styles.gameSummary}>
            <View style={[styles.summaryCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>TURN</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{game.turnsPlayed + 1}/13</Text>
            </View>
            <View style={[styles.summaryCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>ROLLS LEFT</Text>
              <Text style={[styles.summaryValue, { color: colors.accent }]}>{game.rollsRemaining}</Text>
            </View>
            <View style={[styles.summaryCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>TOTAL</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{total}</Text>
            </View>
          </View>

          <View style={styles.diceArea}>
            <Text style={[styles.instruction, { color: colors.muted }]}>
              {game.rollsRemaining === YAHTZEE_ROLLS_PER_TURN ? "Roll all five dice to begin your turn" : "Tap dice to hold them, then roll again"}
            </Text>
            <View style={styles.diceRow}>{dice}</View>
            <Pressable
              accessibilityRole="button"
              disabled={game.rollsRemaining === 0}
              onPress={roll}
              style={({ pressed }) => [styles.rollButton, { backgroundColor: colors.accent }, game.rollsRemaining === 0 && styles.disabled, pressed && styles.pressed]}
            >
              <RotateCcw color="#07121b" size={19} />
              <Text style={styles.primaryButtonText}>{game.rollsRemaining === YAHTZEE_ROLLS_PER_TURN ? "Roll dice" : "Roll again"}</Text>
            </Pressable>
          </View>

          <View style={styles.scoreHeader}>
            <Text style={[styles.scoreTitle, { color: colors.text }]}>Scorecard</Text>
            <Text style={[styles.upperProgress, { color: colors.muted }]}>Upper {upperSubtotal}/63{upperBonus ? "  +35" : ""}</Text>
          </View>
          <ScrollView style={styles.scoreScroll} contentContainerStyle={[styles.scoreList, { paddingBottom: Math.max(insets.bottom, 14) }]} showsVerticalScrollIndicator={false}>
            {YAHTZEE_CATEGORIES.map((category, index) => {
              const selectedScore = game.scores[category];
              const selectable = availableCategories.includes(category);
              const preview = game.rollsRemaining < YAHTZEE_ROLLS_PER_TURN && selectable
                ? scoreYahtzeeCategory(game.dice, category, game.scores.yahtzee === 50 && game.dice.every((die) => die === game.dice[0]))
                : null;
              const isUpper = index < 6;
              return (
                <Pressable
                  key={category}
                  accessibilityRole={selectable ? "button" : undefined}
                  accessibilityLabel={`${CATEGORY_LABELS[category]}${preview === null ? "" : `, score ${preview}`}`}
                  disabled={!selectable}
                  onPress={() => chooseCategory(category)}
                  style={[styles.scoreRow, { backgroundColor: colors.surface, borderColor: colors.border }, selectable && { borderColor: colors.accent }, !selectable && styles.scoredRow]}
                >
                  <Text style={[styles.scoreCategory, { color: colors.text }, isUpper && styles.upperCategory]}>{CATEGORY_LABELS[category]}</Text>
                  <Text style={[styles.scoreValue, { color: selectedScore !== null ? colors.muted : selectable ? colors.accent : colors.muted }]}>
                    {selectedScore !== null ? selectedScore : preview === null ? "-" : preview}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </LinearGradient>
  );
}

function ScoreSummary({ game, colors }: { game: YahtzeeState; colors: typeof NATIVE_THEME_COLORS.dark | typeof NATIVE_THEME_COLORS.bluesky }) {
  return (
    <ScrollView style={styles.finalScoreList} contentContainerStyle={styles.scoreList} showsVerticalScrollIndicator={false}>
      {YAHTZEE_CATEGORIES.map((category) => (
        <View key={category} style={[styles.scoreRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.scoreCategory, { color: colors.text }]}>{CATEGORY_LABELS[category]}</Text>
          <Text style={[styles.scoreValue, { color: colors.muted }]}>{game.scores[category]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center" },
  header: { width: "100%", minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15 },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  heading: { alignItems: "center" },
  kicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: "#ffffff", fontSize: 21, fontWeight: "900" },
  menu: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 28 },
  menuIcon: { width: 76, height: 76, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 23 },
  menuTitle: { fontSize: 25, fontWeight: "900" },
  menuDescription: { maxWidth: 320, fontSize: 14, lineHeight: 21, textAlign: "center" },
  bestScore: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  bestScoreText: { fontSize: 13, fontWeight: "800" },
  primaryButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20, borderRadius: 13 },
  primaryButtonText: { color: "#07121b", fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  countdown: { flex: 1, alignItems: "center", justifyContent: "center" },
  countdownNumber: { fontSize: 88, fontWeight: "900" },
  countdownText: { marginTop: 6, fontSize: 14, fontWeight: "700" },
  result: { flex: 1, width: "100%", alignItems: "center", gap: 9, paddingTop: 16, paddingHorizontal: 18 },
  resultTitle: { fontSize: 22, fontWeight: "900" },
  finalScore: { fontSize: 44, fontWeight: "900" },
  resultDetail: { marginBottom: 5, fontSize: 12 },
  finalScoreList: { width: "100%", flex: 1, marginTop: 10 },
  gameSummary: { width: "100%", flexDirection: "row", gap: 7, paddingHorizontal: 12, marginTop: 8 },
  summaryCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 3, paddingVertical: 7, borderWidth: 1, borderRadius: 10 },
  summaryLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  summaryValue: { fontSize: 14, fontWeight: "900" },
  diceArea: { width: "100%", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 12 },
  instruction: { fontSize: 11, textAlign: "center" },
  diceRow: { width: "100%", flexDirection: "row", justifyContent: "center", gap: 6 },
  die: { position: "relative", alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 11, elevation: 3 },
  heldDie: { transform: [{ translateY: -4 }] },
  unrolledDie: { borderStyle: "dashed", opacity: 0.75 },
  pip: { position: "absolute", width: "17%", aspectRatio: 1, borderRadius: 99, transform: [{ translateX: -4 }, { translateY: -4 }] },
  dieQuestion: { color: "#334155", fontSize: 24, fontWeight: "800" },
  rollButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: 12 },
  disabled: { opacity: 0.45 },
  scoreHeader: { width: "100%", flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 5 },
  scoreTitle: { fontSize: 15, fontWeight: "900" },
  upperProgress: { fontSize: 10, fontWeight: "800" },
  scoreScroll: { width: "100%", flex: 1 },
  scoreList: { gap: 4, paddingHorizontal: 12, paddingBottom: 12 },
  scoreRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, borderWidth: 1, borderRadius: 8 },
  scoreCategory: { fontSize: 12, fontWeight: "700" },
  upperCategory: { fontWeight: "900" },
  scoreValue: { minWidth: 24, fontSize: 12, fontWeight: "900", textAlign: "right" },
  scoredRow: { opacity: 0.64 },
});
