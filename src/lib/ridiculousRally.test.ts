import { describe, expect, it } from "vitest";
import {
  advanceRally,
  createRallyState,
  getRallyScore,
  getRallyTickInterval,
  moveRallyCar,
  RALLY_LANES,
  RALLY_PLAYER_ROW,
  type RallyState,
} from "../native/lib/ridiculousRally";

describe("Ridiculous Rally rules", () => {
  it("keeps the car within the three lanes", () => {
    const state = createRallyState();
    expect(moveRallyCar(state, -1).lane).toBe(0);
    expect(moveRallyCar(state, 1).lane).toBe(2);
    expect(moveRallyCar({ ...state, lane: RALLY_LANES - 1 }, 1).lane).toBe(RALLY_LANES - 1);
  });

  it("takes one life for a cone in the player's lane", () => {
    const state: RallyState = {
      ...createRallyState(),
      obstacles: [{ id: 1, lane: 1, row: RALLY_PLAYER_ROW - 1, type: "cone" }],
    };
    const result = advanceRally(state, () => 0.5);

    expect(result.lives).toBe(2);
    expect(result.obstacles).toHaveLength(0);
  });

  it("collects coffee without losing a life and adds a score bonus", () => {
    const state: RallyState = {
      ...createRallyState(),
      distance: 30,
      obstacles: [{ id: 1, lane: 1, row: RALLY_PLAYER_ROW - 1, type: "coffee" }],
    };
    const result = advanceRally(state, () => 0.5);

    expect(result.lives).toBe(3);
    expect(result.snacks).toBe(1);
    expect(getRallyScore(result)).toBe(115);
  });

  it("ends the run after the third collision and increases speed over distance", () => {
    let state: RallyState = { ...createRallyState(), lives: 1, obstacles: [{ id: 1, lane: 1, row: RALLY_PLAYER_ROW - 1, type: "cone" }] };
    state = advanceRally(state, () => 0.5);

    expect(state.lives).toBe(0);
    expect(state.isGameOver).toBe(true);
    expect(getRallyTickInterval(5000)).toBeLessThan(getRallyTickInterval(0));
  });
});