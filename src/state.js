/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Reactive State Manager
   Pub/Sub pattern for roomState
   ═══════════════════════════════════════════════ */

/**
 * Shape types for the kitchen layout.
 * @readonly
 * @enum {string}
 */
export const SHAPES = Object.freeze({
  LINEAR:   'LINEAR',
  L_SHAPED: 'L-SHAPED',
  U_SHAPED: 'U-SHAPED',
});

/**
 * Default wall factory.
 */
function createWall(id, length, type) {
  return { id, length, type };
}

/**
 * Creates the initial roomState based on shape.
 */
function buildInitialState(shape = SHAPES.LINEAR) {
  const base = {
    shape,
    walls: [createWall('wall-A', 3000, 'main')],
    ceilingHeight: 2400,
    obstacles: [],   // Prepared for Phase 2
    modules: [],     // Prepared for Phase 3
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

/**
 * Get a read-only deep copy of the current state.
 * @returns {object}
 */
export function getState() {
  return JSON.parse(JSON.stringify(roomState));
}

/**
 * Subscribe to state changes.
 * @param {Function} fn - callback receiving the new state
 * @returns {Function} unsubscribe function
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Notify all subscribers of the current state.
 */
function notify() {
  const snapshot = getState();
  subscribers.forEach(fn => fn(snapshot));
}

/**
 * Update the state by merging a partial patch.
 * @param {object} patch - partial state to merge
 */
export function update(patch) {
  roomState = { ...roomState, ...patch };
  notify();
}

/**
 * Change the room shape, rebuilding walls as needed.
 * @param {string} shape - one of SHAPES values
 */
export function setShape(shape) {
  roomState = buildInitialState(shape);
  notify();
}

/**
 * Update a specific wall's length.
 * @param {string} wallId - e.g. 'wall-A'
 * @param {number} length - new length in mm
 */
export function setWallLength(wallId, length) {
  const wall = roomState.walls.find(w => w.id === wallId);
  if (wall) {
    wall.length = length;
    notify();
  }
}

/**
 * Update ceiling height.
 * @param {number} height - height in mm
 */
export function setCeilingHeight(height) {
  roomState.ceilingHeight = height;
  notify();
}

// Initial notification so all subscribers render on boot
export function init() {
  notify();
}
