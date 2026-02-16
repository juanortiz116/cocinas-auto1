/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Reactive State Manager
   Phase 3: Modules + Budget + Solver integration
   ═══════════════════════════════════════════════ */

/**
 * Shape types for the kitchen layout.
 * @readonly
 * @enum {string}
 */
export const SHAPES = Object.freeze({
  LINEAR: 'LINEAR',
  L_SHAPED: 'L-SHAPED',
  U_SHAPED: 'U-SHAPED',
});

/**
 * Obstacle type constants.
 * @readonly
 * @enum {string}
 */
export const OBSTACLE_TYPES = Object.freeze({
  WINDOW: 'window',
  DOOR: 'door',
  COLUMN: 'column',
  WATER_POINT: 'water_point',
  SMOKE_OUTLET: 'smoke_outlet',
});

/** Default widths (mm) for each obstacle type */
const DEFAULT_WIDTHS = {
  [OBSTACLE_TYPES.WINDOW]: 1200,
  [OBSTACLE_TYPES.DOOR]: 800,
  [OBSTACLE_TYPES.COLUMN]: 300,
  [OBSTACLE_TYPES.WATER_POINT]: 0,
  [OBSTACLE_TYPES.SMOKE_OUTLET]: 0,
};

/* ── Helpers ──────────────────────────────────── */

let obstacleCounter = 0;

function createWall(id, length, type) {
  return { id, length, type, obstacles: [] };
}

function createObstacle(type, position, width) {
  obstacleCounter++;
  return {
    id: `obs-${obstacleCounter}-${Date.now()}`,
    type,
    position,
    width: width ?? DEFAULT_WIDTHS[type] ?? 0,
  };
}

/* ── Build Initial State ─────────────────────── */

function buildInitialState(shape = SHAPES.LINEAR) {
  const base = {
    shape,
    walls: [createWall('wall-A', 3000, 'main')],
    ceilingHeight: 2400,
    placed_modules: [],
    budget: null,
    solverErrors: [],
  };

  if (shape === SHAPES.L_SHAPED) {
    base.walls.push(createWall('wall-B', 2000, 'side'));
  }

  if (shape === SHAPES.U_SHAPED) {
    base.walls.push(createWall('wall-B', 2000, 'side'));
    base.walls.push(createWall('wall-C', 3000, 'side'));
  }

  return base;
}

/* ── Subscribers ─────────────────────────────── */
const subscribers = new Set();

/* ── Current State ───────────────────────────── */
let roomState = buildInitialState();

/* ── UI State (not persisted) ────────────────── */
let uiState = {
  selectedWallId: null,
  selectedObstacleId: null,
  activeTool: null,   // one of OBSTACLE_TYPES or null
  solverRunning: false,
};

/* ── Getters ─────────────────────────────────── */

export function getState() {
  return JSON.parse(JSON.stringify(roomState));
}

export function getUIState() {
  return { ...uiState };
}

/* ── Subscribe / Notify ──────────────────────── */

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  const snapshot = getState();
  const ui = getUIState();
  subscribers.forEach(fn => fn(snapshot, ui));
}

/* ── Room State Mutations ────────────────────── */

export function update(patch) {
  roomState = { ...roomState, ...patch };
  // Ensure every wall has an obstacles array
  roomState.walls = roomState.walls.map(w => ({
    ...w,
    obstacles: w.obstacles || [],
  }));
  // Ensure placed_modules array exists
  if (!roomState.placed_modules) roomState.placed_modules = [];
  if (!roomState.solverErrors) roomState.solverErrors = [];
  notify();
}

export function setShape(shape) {
  roomState = buildInitialState(shape);
  uiState = { selectedWallId: null, selectedObstacleId: null, activeTool: null, solverRunning: false };
  notify();
}

export function setWallLength(wallId, length) {
  const wall = roomState.walls.find(w => w.id === wallId);
  if (wall) {
    wall.length = length;
    notify();
  }
}

export function setCeilingHeight(height) {
  roomState.ceilingHeight = height;
  notify();
}

/* ── UI State Mutations ──────────────────────── */

export function selectWall(wallId) {
  uiState.selectedWallId = wallId;
  uiState.selectedObstacleId = null;

  // If a tool is active, add obstacle to the selected wall
  if (uiState.activeTool && wallId) {
    const wall = roomState.walls.find(w => w.id === wallId);
    if (wall) {
      const defaultPos = Math.round(wall.length / 2);
      const obs = createObstacle(uiState.activeTool, defaultPos, DEFAULT_WIDTHS[uiState.activeTool]);
      wall.obstacles.push(obs);
      uiState.selectedObstacleId = obs.id;
      uiState.activeTool = null; // Deactivate tool after placing
    }
  }

  notify();
}

export function selectObstacle(obstacleId) {
  uiState.selectedObstacleId = obstacleId;

  // Also select the wall that contains this obstacle
  if (obstacleId) {
    for (const wall of roomState.walls) {
      if (wall.obstacles.some(o => o.id === obstacleId)) {
        uiState.selectedWallId = wall.id;
        break;
      }
    }
  }

  notify();
}

export function setActiveTool(tool) {
  uiState.activeTool = uiState.activeTool === tool ? null : tool; // Toggle
  uiState.selectedObstacleId = null;
  notify();
}

export function clearSelection() {
  uiState.selectedWallId = null;
  uiState.selectedObstacleId = null;
  uiState.activeTool = null;
  notify();
}

export function setSolverRunning(val) {
  uiState.solverRunning = val;
  notify();
}

/* ── Obstacle Mutations ──────────────────────── */

export function addObstacleToWall(wallId, type) {
  const wall = roomState.walls.find(w => w.id === wallId);
  if (!wall) return;
  const defaultPos = Math.round(wall.length / 2);
  const obs = createObstacle(type, defaultPos, DEFAULT_WIDTHS[type]);
  wall.obstacles.push(obs);
  uiState.selectedObstacleId = obs.id;
  uiState.selectedWallId = wallId;
  notify();
}

export function updateObstacle(obstacleId, patch) {
  for (const wall of roomState.walls) {
    const obs = wall.obstacles.find(o => o.id === obstacleId);
    if (obs) {
      Object.assign(obs, patch);
      notify();
      return;
    }
  }
}

export function removeObstacle(obstacleId) {
  for (const wall of roomState.walls) {
    const idx = wall.obstacles.findIndex(o => o.id === obstacleId);
    if (idx !== -1) {
      wall.obstacles.splice(idx, 1);
      if (uiState.selectedObstacleId === obstacleId) {
        uiState.selectedObstacleId = null;
      }
      notify();
      return;
    }
  }
}

/* ── Module / Solver Mutations ───────────────── */

export function setPlacedModules(modules) {
  roomState.placed_modules = modules;
  notify();
}

export function setBudget(budget) {
  roomState.budget = budget;
  notify();
}

export function setSolverErrors(errors) {
  roomState.solverErrors = errors;
  notify();
}

export function clearModules() {
  roomState.placed_modules = [];
  roomState.budget = null;
  roomState.solverErrors = [];
  notify();
}

/* ── Init ─────────────────────────────────────── */

export function init() {
  notify();
}
