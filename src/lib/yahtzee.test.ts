import { describe, expect, it } from "vitest";
import {
  createYahtzeeState,
  getAvailableYahtzeeCategories,
  getYahtzeeTotal,
  getYahtzeeUpperBonus,
  rollYahtzeeDice,
  scoreYahtzeeCategory,
  scoreYahtzeeTurn,
  toggleYahtzeeHold,
  type YahtzeeState,
} from "../native/lib/yahtzee";

describe("Yahtzee rules", () => {
  it("keeps held dice and allows no more than three rolls", () => {
    let state = rollYahtzeeDice(createYahtzeeState(), () => 0.5);
    state = toggleYahtzeeHold(state, 0);
    const firstDie = state.dice[0];
    state = rollYahtzeeDice(state, () => 0);

    expect(state.dice[0]).toBe(firstDie);
    expect(state.dice.slice(1)).toEqual([1, 1, 1, 1]);
    expect(rollYahtzeeDice({ ...state, rollsRemaining: 0 })).toEqual({ ...state, rollsRemaining: 0 });
  });

  it("scores the standard combinations", () => {
    expect(scoreYahtzeeCategory([2, 2, 2, 4, 4], "fullHouse")).toBe(25);
    expect(scoreYahtzeeCategory([1, 2, 3, 4, 6], "smallStraight")).toBe(30);
    expect(scoreYahtzeeCategory([2, 3, 4, 5, 6], "largeStraight")).toBe(40);
    expect(scoreYahtzeeCategory([6, 6, 6, 6, 6], "yahtzee")).toBe(50);
    expect(scoreYahtzeeCategory([3, 3, 3, 5, 6], "threeOfAKind")).toBe(20);
  });

  it("awards the upper-section bonus at 63 points", () => {
    const scores = {
      ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
      threeOfAKind: null, fourOfAKind: null, fullHouse: null, smallStraight: null,
      largeStraight: null, yahtzee: null, chance: null,
    };
    expect(getYahtzeeUpperBonus(scores)).toBe(35);
  });

  it("uses forced upper joker scoring and adds a 100-point Yahtzee bonus", () => {
    const base = createYahtzeeState();
    const state: YahtzeeState = {
      ...base,
      dice: [4, 4, 4, 4, 4],
      rollsRemaining: 1,
      scores: { ...base.scores, yahtzee: 50, fours: null },
    };
    expect(getAvailableYahtzeeCategories(state)).toEqual(["fours"]);
    const result = scoreYahtzeeTurn(state, "fours");

    expect(result.scores.fours).toBe(20);
    expect(result.yahtzeeBonuses).toBe(1);
    expect(getYahtzeeTotal(result)).toBe(170);
  });

  it("finishes after all thirteen categories are scored", () => {
    const base = createYahtzeeState();
    const finalTurn: YahtzeeState = {
      ...base,
      dice: [1, 2, 3, 4, 5],
      rollsRemaining: 2,
      turnsPlayed: 12,
    };
    const result = scoreYahtzeeTurn(finalTurn, "ones");
    expect(result.turnsPlayed).toBe(13);
    expect(result.isGameOver).toBe(true);
  });
});