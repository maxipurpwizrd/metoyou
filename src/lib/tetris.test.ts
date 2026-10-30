import { describe, expect, it } from "vitest";
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
  type TetrisState,
} from "../native/lib/tetris";

const fixedRandom = () => 0;

describe("Tetris game rules", () => {
  it("starts with an empty board and a valid first level", () => {
    const state = createTetrisState(fixedRandom);

    expect(state.board).toHaveLength(TETRIS_ROWS);
    expect(state.board.every((row) => row.length === TETRIS_COLUMNS && row.every((cell) => cell === null))).toBe(true);
    expect(state.level).toBe(1);
    expect(state.isGameOver).toBe(false);
  });

  it("starts at a selected level and clamps invalid levels", () => {
    expect(createTetrisState(fixedRandom, 6)).toMatchObject({ level: 6, lines: 0, startingLevel: 6 });
    expect(createTetrisState(fixedRandom, 99).level).toBe(TETRIS_LEVELS);
    expect(createTetrisState(fixedRandom, 0).level).toBe(1);
  });

  it("moves, rotates, and soft-drops the active piece", () => {
    const state = createTetrisState(fixedRandom);
    const moved = moveTetrisPiece(state, 1);
    const rotated = rotateTetrisPiece(moved);
    const dropped = softDropTetrisPiece(rotated, fixedRandom);

    expect(moved.piece.x).toBe(state.piece.x + 1);
    expect(rotated.piece.shape).not.toEqual(moved.piece.shape);
    expect(dropped.piece.y).toBe(rotated.piece.y + 1);
    expect(dropped.score).toBe(1);
  });

  it("clears a completed row, scores it, and advances after five lines", () => {
    const board = Array.from({ length: TETRIS_ROWS }, () => Array<string | null>(TETRIS_COLUMNS).fill(null));
    board[TETRIS_ROWS - 1] = Array.from({ length: TETRIS_COLUMNS }, (_, column) => column === 4 || column === 5 ? null : "#ffffff");
    const state: TetrisState = {
      ...createTetrisState(fixedRandom),
      board,
      piece: { shape: [[1, 1], [1, 1]], x: 4, y: TETRIS_ROWS - 2, color: "#facc15" },
      nextPiece: { shape: [[1]], x: 4, y: 0, color: "#ffffff" },
      lines: 4,
    };
    const result = stepTetris(state, fixedRandom);

    expect(result.lines).toBe(5);
    expect(result.level).toBe(2);
    expect(result.score).toBe(100);
    expect(result.board[TETRIS_ROWS - 1].every((cell) => cell === null)).toBe(true);
  });

  it("hard-drops to the floor, locks the piece, and awards drop points", () => {
    const state = createTetrisState(fixedRandom);
    const result = dropTetrisPiece(state, fixedRandom);

    expect(result.score).toBeGreaterThan(0);
    expect(result.piece.y).toBeLessThan(state.piece.y + TETRIS_ROWS);
    expect(result.board.flat().some((cell) => cell !== null)).toBe(true);
  });

  it("speeds up across ten levels and caps at level ten", () => {
    expect(getTetrisDropInterval(1)).toBe(800);
    expect(getTetrisDropInterval(TETRIS_LEVELS)).toBe(100);
    expect(getTetrisDropInterval(20)).toBe(100);
  });
});