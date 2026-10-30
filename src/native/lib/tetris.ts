export const TETRIS_COLUMNS = 10;
export const TETRIS_ROWS = 20;
export const TETRIS_LEVELS = 10;
export const TETRIS_LINES_PER_LEVEL = 5;

export type TetrisCell = string | null;
export type TetrisShape = number[][];

export type TetrisPiece = {
  shape: TetrisShape;
  x: number;
  y: number;
  color: string;
};

export type TetrisState = {
  board: TetrisCell[][];
  piece: TetrisPiece;
  nextPiece: TetrisPiece;
  score: number;
  lines: number;
  startingLevel: number;
  level: number;
  isGameOver: boolean;
};

const PIECES: Array<{ shape: TetrisShape; color: string }> = [
  { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "#22d3ee" },
  { shape: [[1, 1], [1, 1]], color: "#facc15" },
  { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "#c084fc" },
  { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "#4ade80" },
  { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "#fb7185" },
  { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "#60a5fa" },
  { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "#fb923c" },
];

function emptyBoard(): TetrisCell[][] {
  return Array.from({ length: TETRIS_ROWS }, () => Array<TetrisCell>(TETRIS_COLUMNS).fill(null));
}

function drawPiece(random: () => number): TetrisPiece {
  const index = Math.min(PIECES.length - 1, Math.max(0, Math.floor(random() * PIECES.length)));
  const { shape, color } = PIECES[index];
  return {
    shape: shape.map((row) => [...row]),
    x: Math.floor((TETRIS_COLUMNS - shape[0].length) / 2),
    y: shape.length === 4 ? -1 : 0,
    color,
  };
}

function pieceFits(board: TetrisCell[][], piece: TetrisPiece): boolean {
  return piece.shape.every((row, rowIndex) => row.every((filled, columnIndex) => {
    if (!filled) return true;
    const x = piece.x + columnIndex;
    const y = piece.y + rowIndex;
    return x >= 0 && x < TETRIS_COLUMNS && y < TETRIS_ROWS && (y < 0 || board[y][x] === null);
  }));
}

function rotateClockwise(shape: TetrisShape): TetrisShape {
  return shape[0].map((_, columnIndex) => shape.map((row) => row[columnIndex]).reverse());
}

function lockPiece(state: TetrisState, random: () => number, bonusScore = 0): TetrisState {
  const board = state.board.map((row) => [...row]);
  let lockedAboveTop = false;

  state.piece.shape.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
    if (!filled) return;
    const x = state.piece.x + columnIndex;
    const y = state.piece.y + rowIndex;
    if (y < 0) lockedAboveTop = true;
    else board[y][x] = state.piece.color;
  }));

  const remainingRows = board.filter((row) => row.some((cell) => cell === null));
  const cleared = TETRIS_ROWS - remainingRows.length;
  const nextBoard = [...Array.from({ length: cleared }, () => Array<TetrisCell>(TETRIS_COLUMNS).fill(null)), ...remainingRows];
  const lines = state.lines + cleared;
  const level = Math.min(TETRIS_LEVELS, state.startingLevel + Math.floor(lines / TETRIS_LINES_PER_LEVEL));
  const pointsByLines = [0, 100, 300, 500, 800];
  const score = state.score + bonusScore + (pointsByLines[cleared] ?? 0) * state.level;
  const piece = state.nextPiece;
  const nextPiece = drawPiece(random);
  const spawnedPiece = { ...piece, x: Math.floor((TETRIS_COLUMNS - piece.shape[0].length) / 2), y: piece.shape.length === 4 ? -1 : 0 };

  return {
    board: nextBoard,
    piece: spawnedPiece,
    nextPiece,
    score,
    lines,
    startingLevel: state.startingLevel,
    level,
    isGameOver: lockedAboveTop || !pieceFits(nextBoard, spawnedPiece),
  };
}

export function createTetrisState(random: () => number = Math.random, startingLevel = 1): TetrisState {
  const piece = drawPiece(random);
  const nextPiece = drawPiece(random);
  const level = Math.max(1, Math.min(TETRIS_LEVELS, Math.floor(startingLevel)));
  return {
    board: emptyBoard(),
    piece,
    nextPiece,
    score: 0,
    lines: 0,
    startingLevel: level,
    level,
    isGameOver: false,
  };
}

export function moveTetrisPiece(state: TetrisState, direction: -1 | 1): TetrisState {
  if (state.isGameOver) return state;
  const piece = { ...state.piece, x: state.piece.x + direction };
  return pieceFits(state.board, piece) ? { ...state, piece } : state;
}

export function rotateTetrisPiece(state: TetrisState): TetrisState {
  if (state.isGameOver) return state;
  const shape = rotateClockwise(state.piece.shape);
  for (const offset of [0, -1, 1, -2, 2]) {
    const piece = { ...state.piece, shape, x: state.piece.x + offset };
    if (pieceFits(state.board, piece)) return { ...state, piece };
  }
  return state;
}

export function dropTetrisPiece(state: TetrisState, random: () => number = Math.random): TetrisState {
  if (state.isGameOver) return state;
  let piece = state.piece;
  let distance = 0;
  while (pieceFits(state.board, { ...piece, y: piece.y + 1 })) {
    piece = { ...piece, y: piece.y + 1 };
    distance += 1;
  }
  return lockPiece({ ...state, piece }, random, distance * 2);
}

export function stepTetris(state: TetrisState, random: () => number = Math.random): TetrisState {
  if (state.isGameOver) return state;
  const fallingPiece = { ...state.piece, y: state.piece.y + 1 };
  if (pieceFits(state.board, fallingPiece)) return { ...state, piece: fallingPiece };
  return lockPiece(state, random);
}

export function softDropTetrisPiece(state: TetrisState, random: () => number = Math.random): TetrisState {
  if (state.isGameOver) return state;
  const fallingPiece = { ...state.piece, y: state.piece.y + 1 };
  if (pieceFits(state.board, fallingPiece)) return { ...state, piece: fallingPiece, score: state.score + 1 };
  return lockPiece(state, random);
}

export function getTetrisDropInterval(level: number): number {
  return [800, 700, 600, 500, 400, 320, 250, 190, 140, 100][Math.max(0, Math.min(TETRIS_LEVELS - 1, level - 1))];
}