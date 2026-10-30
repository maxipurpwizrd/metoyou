export const BUBBLE_COLUMNS = 8;
export const BUBBLE_ROWS = 12;
export const BUBBLE_LEVELS = 10;
export const BUBBLE_RADIUS_RATIO = 0.0625;

export const BUBBLE_COLORS = ["#fb7185", "#38bdf8", "#facc15", "#4ade80", "#fb923c", "#a78bfa"] as const;
export type BubbleColor = typeof BUBBLE_COLORS[number];
export type BubbleBoard = (BubbleColor | null)[][];

export type BubbleShooterState = {
  board: BubbleBoard;
  currentColor: BubbleColor;
  nextColor: BubbleColor;
  score: number;
  shots: number;
  level: number;
  isWon: boolean;
  isGameOver: boolean;
};

export type BubblePoint = { x: number; y: number };
export type BubbleShotTrace = {
  path: BubblePoint[];
  attachment: [number, number] | null;
};

function colorCountForLevel(level: number) {
  return Math.min(BUBBLE_COLORS.length, 2 + Math.floor((level - 1) / 2));
}

function drawColor(level: number, random: () => number): BubbleColor {
  const count = colorCountForLevel(level);
  const index = Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
  return BUBBLE_COLORS[index];
}

function emptyBoard(): BubbleBoard {
  return Array.from({ length: BUBBLE_ROWS }, () => Array<BubbleColor | null>(BUBBLE_COLUMNS).fill(null));
}

export function getBubblePosition(row: number, column: number, radius: number): BubblePoint {
  return {
    x: radius + column * radius * 2 + (row % 2) * radius,
    y: radius + row * radius * Math.sqrt(3),
  };
}

export function getBubbleNeighbors(row: number, column: number): Array<[number, number]> {
  const diagonalColumns = row % 2 === 0 ? [column - 1, column] : [column, column + 1];
  return [
    [row, column - 1],
    [row, column + 1],
    [row - 1, diagonalColumns[0]],
    [row - 1, diagonalColumns[1]],
    [row + 1, diagonalColumns[0]],
    [row + 1, diagonalColumns[1]],
  ].filter(([neighborRow, neighborColumn]) =>
    neighborRow >= 0 && neighborRow < BUBBLE_ROWS && neighborColumn >= 0 && neighborColumn < BUBBLE_COLUMNS,
  ) as Array<[number, number]>;
}

export function createBubbleShooterState(level = 1, random: () => number = Math.random): BubbleShooterState {
  const normalizedLevel = Math.max(1, Math.min(BUBBLE_LEVELS, Math.floor(level)));
  const board = emptyBoard();
  const startingRows = Math.min(3 + Math.floor((normalizedLevel - 1) * 0.65), 8);
  for (let row = 0; row < startingRows; row += 1) {
    for (let column = 0; column < BUBBLE_COLUMNS; column += 1) {
      board[row][column] = drawColor(normalizedLevel, random);
    }
  }
  return {
    board,
    currentColor: drawColor(normalizedLevel, random),
    nextColor: drawColor(normalizedLevel, random),
    score: 0,
    shots: 0,
    level: normalizedLevel,
    isWon: false,
    isGameOver: false,
  };
}

export function sinkBubbleBoard(state: BubbleShooterState): BubbleShooterState {
  if (state.isWon || state.isGameOver) return state;
  const board: BubbleBoard = [
    Array<BubbleColor | null>(BUBBLE_COLUMNS).fill(null),
    ...state.board.slice(0, -1).map((row) => [...row]),
  ];
  return {
    ...state,
    board,
    isGameOver: board[BUBBLE_ROWS - 1].some((bubble) => bubble !== null),
  };
}

function connectedBubbles(board: BubbleBoard, startRow: number, startColumn: number, color: BubbleColor): Array<[number, number]> {
  const pending: Array<[number, number]> = [[startRow, startColumn]];
  const visited = new Set<string>();
  const connected: Array<[number, number]> = [];

  while (pending.length > 0) {
    const [row, column] = pending.pop()!;
    const key = `${row}:${column}`;
    if (visited.has(key) || board[row]?.[column] !== color) continue;
    visited.add(key);
    connected.push([row, column]);
    pending.push(...getBubbleNeighbors(row, column));
  }

  return connected;
}

function removeUnsupportedBubbles(board: BubbleBoard) {
  const pending: Array<[number, number]> = [];
  const supported = new Set<string>();
  for (let column = 0; column < BUBBLE_COLUMNS; column += 1) {
    if (board[0][column]) pending.push([0, column]);
  }

  while (pending.length > 0) {
    const [row, column] = pending.pop()!;
    const key = `${row}:${column}`;
    if (supported.has(key) || !board[row]?.[column]) continue;
    supported.add(key);
    pending.push(...getBubbleNeighbors(row, column));
  }

  let removed = 0;
  board.forEach((row, rowIndex) => row.forEach((bubble, columnIndex) => {
    if (bubble && !supported.has(`${rowIndex}:${columnIndex}`)) {
      row[columnIndex] = null;
      removed += 1;
    }
  }));
  return removed;
}

function findAttachment(board: BubbleBoard, point: BubblePoint, radius: number): [number, number] | null {
  let closest: [number, number] | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let row = 0; row < BUBBLE_ROWS; row += 1) {
    for (let column = 0; column < BUBBLE_COLUMNS; column += 1) {
      if (board[row][column] !== null) continue;
      const hasNeighbor = row === 0 || getBubbleNeighbors(row, column).some(([neighborRow, neighborColumn]) => board[neighborRow][neighborColumn] !== null);
      if (!hasNeighbor) continue;
      const position = getBubblePosition(row, column, radius);
      const distance = Math.hypot(position.x - point.x, position.y - point.y);
      if (distance < closestDistance) {
        closest = [row, column];
        closestDistance = distance;
      }
    }
  }
  return closest;
}

export function traceBubbleShot(state: BubbleShooterState, angle: number, width: number, height: number, radius: number): BubbleShotTrace {
  const board = state.board;
  const start = { x: width / 2, y: height - radius * 1.5 };
  const clampedAngle = Math.max(-Math.PI * 0.43, Math.min(Math.PI * 0.43, angle));
  const step = Math.max(1, radius * 0.24);
  const maxSteps = Math.ceil((height / step) * 3);
  let point = start;
  let horizontalStep = Math.sin(clampedAngle) * step;
  const verticalStep = Math.cos(clampedAngle) * step;
  let attachment: [number, number] | null = null;
  let stepCount = 0;
  const path = [start];

  for (let index = 0; index < maxSteps; index += 1) {
    point = {
      x: point.x + horizontalStep,
      y: point.y - verticalStep,
    };
    let bounced = false;
    if (point.x < radius) {
      point.x = radius + (radius - point.x);
      horizontalStep = Math.abs(horizontalStep);
      bounced = true;
    } else if (point.x > width - radius) {
      point.x = width - radius - (point.x - (width - radius));
      horizontalStep = -Math.abs(horizontalStep);
      bounced = true;
    }
    if (bounced) path.push({ x: point.x < width / 2 ? radius : width - radius, y: point.y });

    if (point.y <= radius) {
      attachment = findAttachment(board, { x: point.x, y: radius }, radius);
      path.push(point);
      break;
    }

    let hit = false;
    for (let row = 0; row < BUBBLE_ROWS && !hit; row += 1) {
      for (let column = 0; column < BUBBLE_COLUMNS; column += 1) {
        if (!board[row][column]) continue;
        const bubble = getBubblePosition(row, column, radius);
        if (Math.hypot(point.x - bubble.x, point.y - bubble.y) <= radius * 1.92) {
          attachment = findAttachment(board, point, radius);
          hit = true;
          break;
        }
      }
    }
    stepCount += 1;
    if (stepCount % 4 === 0 || hit) path.push(point);
    if (hit) break;
  }

  if (path.length > 1 && path[path.length - 1] !== point) path.push(point);
  return { path, attachment };
}

export function shootBubble(state: BubbleShooterState, angle: number, width: number, height: number, radius: number, random: () => number = Math.random): BubbleShooterState {
  if (state.isWon || state.isGameOver) return state;
  const board = state.board.map((row) => [...row]);
  const { attachment } = traceBubbleShot(state, angle, width, height, radius);
  if (!attachment) return { ...state, shots: state.shots + 1, isGameOver: true };
  const [row, column] = attachment;
  board[row][column] = state.currentColor;
  const connected = connectedBubbles(board, row, column, state.currentColor);
  let matched = 0;
  if (connected.length >= 3) {
    connected.forEach(([matchedRow, matchedColumn]) => {
      board[matchedRow][matchedColumn] = null;
    });
    matched = connected.length;
  }
  const unsupported = removeUnsupportedBubbles(board);
  const isWon = board.every((boardRow) => boardRow.every((bubble) => bubble === null));
  const isGameOver = !isWon && board[BUBBLE_ROWS - 1].some((bubble) => bubble !== null);

  return {
    ...state,
    board,
    currentColor: state.nextColor,
    nextColor: drawColor(state.level, random),
    score: state.score + matched * 10 + unsupported * 20,
    shots: state.shots + 1,
    isWon,
    isGameOver,
  };
}