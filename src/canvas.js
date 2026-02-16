/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — 2D Canvas Grid Engine
   Renders walls, grid, and dimension annotations
   ═══════════════════════════════════════════════ */

const COLORS = {
    grid: 'rgba(255, 255, 255, 0.04)',
    gridMajor: 'rgba(255, 255, 255, 0.08)',
    wall: '#ffffff',
    wallGlow: 'rgba(57, 206, 134, 0.10)',
    accent: '#39ce86',
    dimLine: 'rgba(203, 213, 225, 0.35)',
    dimText: '#cbd5e1',
    origin: 'rgba(57, 206, 134, 0.25)',
};

const WALL_THICKNESS = 4;        // px on screen
const DIM_OFFSET = 40;       // px — distance of dimension line from wall
const DIM_TICK = 8;        // px — tick marks length
const GRID_STEP_MM = 500;      // 50 cm grid
const PADDING = 100;      // px — viewport padding

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
/** last known state snapshot */
let lastState = null;

/**
 * Initialize the canvas engine.
 * @param {HTMLCanvasElement} canvasEl
 */
export function initCanvas(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (lastState) render(lastState);
    };

    window.addEventListener('resize', resize);
    resize();
}

/**
 * Main render entry point — called on every state change.
 * @param {object} state - roomState snapshot
 */
export function render(state) {
    lastState = state;
    if (!ctx) return;

    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, W, H);

    // Determine bounding box of the room in mm
    const bbox = getBoundingBox(state);
    const scale = computeScale(bbox, W, H);
    const offset = computeOffset(bbox, scale, W, H);

    drawGrid(W, H, scale, offset);
    drawWalls(state, scale, offset);
    drawDimensions(state, scale, offset);
    drawOriginMark(scale, offset);

    // Update HUD
    updateHUD(state, scale);
}

/* ── Bounding Box ────────────────────────────── */

function getBoundingBox(state) {
    const wallA = state.walls.find(w => w.id === 'wall-A');
    let maxX = wallA ? wallA.length : 3000;
    let maxY = 0;

    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const wallB = state.walls.find(w => w.id === 'wall-B');
        if (wallB) maxY = wallB.length;
    }

    if (state.shape === 'U-SHAPED') {
        const wallC = state.walls.find(w => w.id === 'wall-C');
        // U-shape not active yet, but ready
    }

    // Minimum display area
    maxY = Math.max(maxY, maxX * 0.3);

    return { minX: 0, minY: 0, maxX, maxY };
}

function computeScale(bbox, viewW, viewH) {
    const roomW = bbox.maxX - bbox.minX;
    const roomH = bbox.maxY - bbox.minY;
    const scaleX = (viewW - PADDING * 2) / roomW;
    const scaleY = (viewH - PADDING * 2) / roomH;
    return Math.min(scaleX, scaleY);
}

function computeOffset(bbox, scale, viewW, viewH) {
    const roomW = (bbox.maxX - bbox.minX) * scale;
    const roomH = (bbox.maxY - bbox.minY) * scale;
    return {
        x: (viewW - roomW) / 2 - bbox.minX * scale,
        y: (viewH - roomH) / 2 - bbox.minY * scale,
    };
}

/* ── Grid ─────────────────────────────────── */

function drawGrid(W, H, scale, offset) {
    const stepPx = GRID_STEP_MM * scale;
    if (stepPx < 5) return; // too dense — skip

    // Vertical lines
    const startX = offset.x % stepPx;
    for (let x = startX; x < W; x += stepPx) {
        const mmVal = Math.round((x - offset.x) / scale);
        const isMajor = mmVal % (GRID_STEP_MM * 2) === 0;
        ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }

    // Horizontal lines
    const startY = offset.y % stepPx;
    for (let y = startY; y < H; y += stepPx) {
        const mmVal = Math.round((y - offset.y) / scale);
        const isMajor = mmVal % (GRID_STEP_MM * 2) === 0;
        ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
}

/* ── Walls ────────────────────────────────── */

function drawWalls(state, scale, offset) {
    const wallA = state.walls.find(w => w.id === 'wall-A');
    if (!wallA) return;

    const ax = offset.x;
    const ay = offset.y;
    const aEndX = ax + wallA.length * scale;

    // Glow effect behind walls
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 12;

    // Wall A — horizontal
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = WALL_THICKNESS;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(aEndX, ay);
    ctx.stroke();

    // L-SHAPED — Wall B going down from left end
    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const wallB = state.walls.find(w => w.id === 'wall-B');
        if (wallB) {
            const bEndY = ay + wallB.length * scale;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax, bEndY);
            ctx.stroke();
        }
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw corner dot
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(ax, ay, 5, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Dimension Annotations (Cotas) ─────────── */

function drawDimensions(state, scale, offset) {
    const wallA = state.walls.find(w => w.id === 'wall-A');
    if (!wallA) return;

    const ax = offset.x;
    const ay = offset.y;
    const aEndX = ax + wallA.length * scale;

    // Wall A dimension — above the wall
    drawHorizontalDimension(
        ax, aEndX, ay - DIM_OFFSET,
        wallA.length
    );

    // Wall B dimension — left of the wall
    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const wallB = state.walls.find(w => w.id === 'wall-B');
        if (wallB) {
            const bEndY = ay + wallB.length * scale;
            drawVerticalDimension(
                ax - DIM_OFFSET, ay, bEndY,
                wallB.length
            );
        }
    }
}

function drawHorizontalDimension(x1, x2, y, lengthMM) {
    ctx.strokeStyle = COLORS.dimLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // Ticks
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y - DIM_TICK / 2);
    ctx.lineTo(x1, y + DIM_TICK / 2);
    ctx.moveTo(x2, y - DIM_TICK / 2);
    ctx.lineTo(x2, y + DIM_TICK / 2);
    ctx.stroke();

    // Extension lines (from wall to dimension line)
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.15)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y + DIM_TICK);
    ctx.lineTo(x1, y + DIM_OFFSET);
    ctx.moveTo(x2, y + DIM_TICK);
    ctx.lineTo(x2, y + DIM_OFFSET);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    const midX = (x1 + x2) / 2;
    drawDimensionLabel(midX, y - 8, `${lengthMM} mm`);
}

function drawVerticalDimension(x, y1, y2, lengthMM) {
    ctx.strokeStyle = COLORS.dimLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    // Main line
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();

    // Ticks
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - DIM_TICK / 2, y1);
    ctx.lineTo(x + DIM_TICK / 2, y1);
    ctx.moveTo(x - DIM_TICK / 2, y2);
    ctx.lineTo(x + DIM_TICK / 2, y2);
    ctx.stroke();

    // Extension lines
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.15)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x + DIM_TICK, y1);
    ctx.lineTo(x + DIM_OFFSET, y1);
    ctx.moveTo(x + DIM_TICK, y2);
    ctx.lineTo(x + DIM_OFFSET, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label (rotated)
    const midY = (y1 + y2) / 2;
    ctx.save();
    ctx.translate(x - 8, midY);
    ctx.rotate(-Math.PI / 2);
    drawDimensionLabel(0, 0, `${lengthMM} mm`);
    ctx.restore();
}

function drawDimensionLabel(x, y, text) {
    ctx.font = '500 11px "Roboto Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background pill
    const metrics = ctx.measureText(text);
    const pw = metrics.width + 14;
    const ph = 18;
    ctx.fillStyle = 'rgba(17, 26, 35, 0.85)';
    roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.2)';
    ctx.lineWidth = 0.5;
    roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
    ctx.stroke();

    // Text
    ctx.fillStyle = COLORS.dimText;
    ctx.fillText(text, x, y);
}

/* ── Origin Mark ─────────────────────────────── */

function drawOriginMark(scale, offset) {
    const x = offset.x;
    const y = offset.y;
    const size = 14;

    ctx.strokeStyle = COLORS.origin;
    ctx.lineWidth = 1;

    // Crosshair
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    // Labels
    ctx.font = '500 9px "Roboto Mono", monospace';
    ctx.fillStyle = COLORS.origin;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', x + size + 4, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Y', x, y + size + 4);
}

/* ── HUD ──────────────────────────────────── */

function updateHUD(state, scale) {
    const shapeEl = document.getElementById('hud-shape');
    const scaleEl = document.getElementById('hud-scale');
    if (shapeEl) shapeEl.textContent = state.shape;
    if (scaleEl) scaleEl.textContent = `1px = ${Math.round(1 / scale)} mm`;
}

/* ── Helpers ──────────────────────────────── */

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
