import { describe, expect, it } from "vitest";
import {
  BUBBLE_COLUMNS,
  BUBBLE_ROWS,
  createBubbleShooterState,
  getBubbleNeighbors,
  sinkBubbleBoard,
  shootBubble,
  traceBubbleShot,
  type BubbleColor,
  type BubbleShooterState,
} from "../native/lib/bubbleShooter";

const fixedRandom = () => 0;

describe("Bubble Shooter rules", () => {
  it("creates a level-specific offline board", () => {
    const state = createBubbleShooterState(10, fixedRandom);

    expect(state.board).toHaveLength(BUBBLE_ROWS);
    expect(state.board.every((row) => row.length === BUBBLE_COLUMNS)).toBe(true);
    expect(state.level).toBe(10);
    expect(state.board.flat().filter(Boolean)).toHaveLength(64);
  });

  it("scales starting density and color variety with the selected level", () => {
    let draw = 0;
    const variedRandom = () => {
      const value = (draw % 6) / 6;
      draw += 1;
      return value;
    };
    const firstLevel = createBubbleShooterState(1, variedRandom);
    draw = 0;
    const finalLevel = createBubbleShooterState(10, variedRandom);
    const firstColors = new Set(firstLevel.board.flat().filter(Boolean));
    const finalColors = new Set(finalLevel.board.flat().filter(Boolean));

    expect(finalLevel.board.flat().filter(Boolean).length).toBeGreaterThan(firstLevel.board.flat().filter(Boolean).length);
    expect(finalColors.size).toBeGreaterThan(firstColors.size);
    expect(finalColors.size).toBe(6);
  });

  it("uses staggered hex neighbors", () => {
    expect(getBubbleNeighbors(0, 3)).toEqual([[0, 2], [0, 4], [1, 2], [1, 3]]);
    expect(getBubbleNeighbors(1, 3)).toEqual([[1, 2], [1, 4], [0, 3], [0, 4], [2, 3], [2, 4]]);
  });

  it("removes a group of three and awards points", () => {
    const board = Array.from({ length: BUBBLE_ROWS }, () => Array(BUBBLE_COLUMNS).fill(null));
    board[0][3] = "#fb7185";
    board[0][4] = "#fb7185";
    const state: BubbleShooterState = {
      ...createBubbleShooterState(1, fixedRandom),
      board,
      currentColor: "#fb7185",
      nextColor: "#38bdf8",
    };
    const result = shootBubble(state, 0, 200, 300, 12, fixedRandom);

    expect(result.board[0][3]).toBeNull();
    expect(result.board[0][4]).toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.board.flat().every((bubble) => bubble === null)).toBe(true);
    expect(result.isWon).toBe(true);
  });

  it("keeps shots offline and rotates the current bubble", () => {
    const state = createBubbleShooterState(2, fixedRandom);
    const result = shootBubble(state, 0, 200, 300, 12, fixedRandom);

    expect(result.shots).toBe(1);
    expect(result.currentColor).toBe(state.nextColor);
  });

  it("previews a wall bounce and predicts its final attachment", () => {
    const state = createBubbleShooterState(1, fixedRandom);
    state.board = Array.from({ length: BUBBLE_ROWS }, () => Array<BubbleColor | null>(BUBBLE_COLUMNS).fill(null));
    const trace = traceBubbleShot(state, 1.15, 200, 300, 12);
    const horizontalChanges = trace.path.slice(1).map((point, index) => point.x - trace.path[index].x);

    expect(horizontalChanges.some((change) => change > 0)).toBe(true);
    expect(horizontalChanges.some((change) => change < 0)).toBe(true);
    expect(trace.path.some((point) => point.x === 188)).toBe(true);
    expect(trace.attachment).not.toBeNull();
  });

  it("sinks the field one row and ends the round when bubbles reach the bottom", () => {
    const board = Array.from({ length: BUBBLE_ROWS }, () => Array<BubbleColor | null>(BUBBLE_COLUMNS).fill(null));
    board[BUBBLE_ROWS - 2][3] = "#fb7185";
    const state: BubbleShooterState = { ...createBubbleShooterState(1, fixedRandom), board };
    const result = sinkBubbleBoard(state);

    expect(result.board[0].every((bubble) => bubble === null)).toBe(true);
    expect(result.board[BUBBLE_ROWS - 1][3]).toBe("#fb7185");
    expect(result.isGameOver).toBe(true);
  });
});