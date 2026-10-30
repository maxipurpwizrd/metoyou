export const YAHTZEE_DICE_COUNT = 5;
export const YAHTZEE_ROLLS_PER_TURN = 3;
export const YAHTZEE_TURNS = 13;
export const YAHTZEE_UPPER_BONUS_THRESHOLD = 63;
export const YAHTZEE_UPPER_BONUS = 35;
export const YAHTZEE_BONUS = 100;

export const YAHTZEE_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "threeOfAKind",
  "fourOfAKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
] as const;

export type YahtzeeCategory = typeof YAHTZEE_CATEGORIES[number];
export type YahtzeeScores = Record<YahtzeeCategory, number | null>;

export type YahtzeeState = {
  dice: number[];
  held: boolean[];
  rollsRemaining: number;
  turnsPlayed: number;
  scores: YahtzeeScores;
  yahtzeeBonuses: number;
  isGameOver: boolean;
};

const UPPER_CATEGORIES: YahtzeeCategory[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];

function emptyScores(): YahtzeeScores {
  return Object.fromEntries(YAHTZEE_CATEGORIES.map((category) => [category, null])) as YahtzeeScores;
}

export function createYahtzeeState(): YahtzeeState {
  return {
    dice: Array<number>(YAHTZEE_DICE_COUNT).fill(0),
    held: Array<boolean>(YAHTZEE_DICE_COUNT).fill(false),
    rollsRemaining: YAHTZEE_ROLLS_PER_TURN,
    turnsPlayed: 0,
    scores: emptyScores(),
    yahtzeeBonuses: 0,
    isGameOver: false,
  };
}

export function rollYahtzeeDice(state: YahtzeeState, random: () => number = Math.random): YahtzeeState {
  if (state.isGameOver || state.rollsRemaining <= 0) return state;
  return {
    ...state,
    dice: state.dice.map((die, index) => state.held[index] ? die : Math.min(6, Math.floor(random() * 6) + 1)),
    rollsRemaining: state.rollsRemaining - 1,
  };
}

export function toggleYahtzeeHold(state: YahtzeeState, index: number): YahtzeeState {
  if (state.isGameOver || state.rollsRemaining === YAHTZEE_ROLLS_PER_TURN || state.rollsRemaining === 0 || index < 0 || index >= YAHTZEE_DICE_COUNT) {
    return state;
  }
  const held = [...state.held];
  held[index] = !held[index];
  return { ...state, held };
}

function isYahtzee(dice: number[]) {
  return dice.length === YAHTZEE_DICE_COUNT && dice.every((die) => die !== 0 && die === dice[0]);
}

function getForcedJokerCategory(state: YahtzeeState): YahtzeeCategory | null {
  if (state.scores.yahtzee !== 50 || !isYahtzee(state.dice)) return null;
  const upperCategory = UPPER_CATEGORIES[state.dice[0] - 1];
  return state.scores[upperCategory] === null ? upperCategory : null;
}

export function getAvailableYahtzeeCategories(state: YahtzeeState): YahtzeeCategory[] {
  if (state.isGameOver || state.rollsRemaining === YAHTZEE_ROLLS_PER_TURN) return [];
  const forcedCategory = getForcedJokerCategory(state);
  if (forcedCategory) return [forcedCategory];
  return YAHTZEE_CATEGORIES.filter((category) => state.scores[category] === null);
}

export function scoreYahtzeeCategory(dice: number[], category: YahtzeeCategory, joker = false): number {
  const counts = Array<number>(7).fill(0);
  dice.forEach((die) => {
    if (die >= 1 && die <= 6) counts[die] += 1;
  });
  const total = dice.reduce((sum, die) => sum + die, 0);
  const upperIndex = UPPER_CATEGORIES.indexOf(category);
  if (upperIndex >= 0) return counts[upperIndex + 1] * (upperIndex + 1);

  switch (category) {
    case "threeOfAKind": return counts.some((count) => count >= 3) ? total : 0;
    case "fourOfAKind": return counts.some((count) => count >= 4) ? total : 0;
    case "fullHouse": return joker || (counts.includes(2) && counts.includes(3)) ? 25 : 0;
    case "smallStraight": {
      const unique = new Set(dice);
      return joker || [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]].some((run) => run.every((die) => unique.has(die))) ? 30 : 0;
    }
    case "largeStraight": {
      const sorted = [...dice].sort((left, right) => left - right);
      return joker || sorted.join(",") === "1,2,3,4,5" || sorted.join(",") === "2,3,4,5,6" ? 40 : 0;
    }
    case "yahtzee": return isYahtzee(dice) ? 50 : 0;
    case "chance": return total;
  }
  return 0;
}

export function scoreYahtzeeTurn(state: YahtzeeState, category: YahtzeeCategory): YahtzeeState {
  if (!getAvailableYahtzeeCategories(state).includes(category)) return state;
  const joker = state.scores.yahtzee === 50 && isYahtzee(state.dice);
  const scores = { ...state.scores, [category]: scoreYahtzeeCategory(state.dice, category, joker) };
  const yahtzeeBonuses = state.yahtzeeBonuses + (joker ? 1 : 0);
  const turnsPlayed = state.turnsPlayed + 1;
  return {
    ...state,
    dice: Array<number>(YAHTZEE_DICE_COUNT).fill(0),
    held: Array<boolean>(YAHTZEE_DICE_COUNT).fill(false),
    rollsRemaining: YAHTZEE_ROLLS_PER_TURN,
    turnsPlayed,
    scores,
    yahtzeeBonuses,
    isGameOver: turnsPlayed >= YAHTZEE_TURNS,
  };
}

export function getYahtzeeUpperSubtotal(scores: YahtzeeScores) {
  return UPPER_CATEGORIES.reduce((sum, category) => sum + (scores[category] ?? 0), 0);
}

export function getYahtzeeUpperBonus(scores: YahtzeeScores) {
  return getYahtzeeUpperSubtotal(scores) >= YAHTZEE_UPPER_BONUS_THRESHOLD ? YAHTZEE_UPPER_BONUS : 0;
}

export function getYahtzeeTotal(state: YahtzeeState) {
  const scored = YAHTZEE_CATEGORIES.reduce((sum, category) => sum + (state.scores[category] ?? 0), 0);
  return scored + getYahtzeeUpperBonus(state.scores) + state.yahtzeeBonuses * YAHTZEE_BONUS;
}