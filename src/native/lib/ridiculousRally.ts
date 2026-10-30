export const RALLY_LANES = 3;
export const RALLY_PLAYER_ROW = 7;
export const RALLY_STARTING_LIVES = 3;

export type RallyObstacleType = "cone" | "coffee";

export type RallyObstacle = {
  id: number;
  lane: number;
  row: number;
  type: RallyObstacleType;
};

export type RallyState = {
  lane: number;
  obstacles: RallyObstacle[];
  distance: number;
  snacks: number;
  lives: number;
  nitroFuel: number;
  nitroTicks: number;
  thrusterFuel: number;
  flightTicks: number;
  tick: number;
  nextObstacleId: number;
  isGameOver: boolean;
};

export function createRallyState(): RallyState {
  return {
    lane: 1,
    obstacles: [],
    distance: 0,
    snacks: 0,
    lives: RALLY_STARTING_LIVES,
    nitroFuel: 100,
    nitroTicks: 0,
    thrusterFuel: 100,
    flightTicks: 0,
    tick: 0,
    nextObstacleId: 1,
    isGameOver: false,
  };
}

export function moveRallyCar(state: RallyState, direction: -1 | 1): RallyState {
  if (state.isGameOver) return state;
  return { ...state, lane: Math.max(0, Math.min(RALLY_LANES - 1, state.lane + direction)) };
}

export function activateRallyNitro(state: RallyState): RallyState {
  if (state.isGameOver || state.nitroTicks > 0 || state.nitroFuel < 40) return state;
  return { ...state, nitroFuel: state.nitroFuel - 40, nitroTicks: 8 };
}

export function activateRallyThrusters(state: RallyState): RallyState {
  if (state.isGameOver || state.flightTicks > 0 || state.thrusterFuel < 50) return state;
  return { ...state, thrusterFuel: state.thrusterFuel - 50, flightTicks: 6 };
}

export function advanceRally(state: RallyState, random: () => number = Math.random): RallyState {
  if (state.isGameOver) return state;

  const tick = state.tick + 1;
  const distance = state.distance + 10;
  const obstacles: RallyObstacle[] = [];
  let lives = state.lives;
  let snacks = state.snacks;

  for (const obstacle of state.obstacles) {
    const row = obstacle.row + 1;
    if (row >= RALLY_PLAYER_ROW) {
      if (row === RALLY_PLAYER_ROW && obstacle.lane === state.lane) {
        if (obstacle.type === "coffee") snacks += 1;
        else if (state.flightTicks === 0) lives -= 1;
      }
      continue;
    }
    obstacles.push({ ...obstacle, row });
  }

  const spawnInterval = Math.max(2, 4 - Math.floor(distance / 350));
  let nextObstacleId = state.nextObstacleId;
  if (tick % spawnInterval === 0) {
    obstacles.push({
      id: nextObstacleId,
      lane: Math.min(RALLY_LANES - 1, Math.floor(random() * RALLY_LANES)),
      row: 0,
      type: random() < 0.26 ? "coffee" : "cone",
    });
    nextObstacleId += 1;
  }

  return {
    ...state,
    obstacles,
    distance,
    snacks,
    lives: Math.max(0, lives),
    nitroFuel: Math.min(100, state.nitroFuel + (state.nitroTicks > 0 ? 0 : 1.5)),
    nitroTicks: Math.max(0, state.nitroTicks - 1),
    thrusterFuel: Math.min(100, state.thrusterFuel + (state.flightTicks > 0 ? 0 : 1)),
    flightTicks: Math.max(0, state.flightTicks - 1),
    tick,
    nextObstacleId,
    isGameOver: lives <= 0,
  };
}

export function getRallyScore(state: RallyState) {
  return state.distance + state.snacks * 75;
}

export function getRallyTickInterval(distance: number, nitroActive = false) {
  const normalSpeed = Math.max(280, 620 - Math.floor(distance / 500) * 38);
  return nitroActive ? Math.max(150, normalSpeed * 0.58) : normalSpeed;
}