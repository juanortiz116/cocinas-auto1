/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — 2D Canvas Grid Engine
   Phase 3: Wall selection + Obstacles + Modules
   ═══════════════════════════════════════════════ */

import { selectWall, selectObstacle, clearSelection, getUIState } from './state.js';
import { MODULE_TYPES } from './catalog.js';

const COLORS = {
    grid: 'rgba(255, 255, 255, 0.04)',
    gridMajor: 'rgba(255, 255, 255, 0.08)',
    wall: '#ffffff',
    wallSelected: '#39ce86',
    accent: '#39ce86',
    dimLine: 'rgba(203, 213, 225, 0.35)',
    dimText: '#cbd5e1',
    origin: 'rgba(57, 206, 134, 0.25)',
    // Obstacle colors
    window: '#ffffff',
    door: '#94a3b8',
    column: '#475569',
    water_point: '#06b6d4',
    smoke_outlet: '#f59e0b',
    obstacleSelected: '#39ce86',
    // Module colors
    moduleBase: 'rgba(57, 206, 134, 0.22)',
    moduleBaseBorder: 'rgba(57, 206, 134, 0.6)',
    moduleWall: 'rgba(100, 149, 237, 0.15)',
    moduleWallBorder: 'rgba(100, 149, 237, 0.55)',
    moduleAnchor: 'rgba(6, 182, 212, 0.25)',
    moduleAnchorBorder: 'rgba(6, 182, 212, 0.7)',
    moduleCorner: 'rgba(249, 158, 11, 0.2)',
    moduleCornerBorder: 'rgba(249, 158, 11, 0.6)',
    moduleLabel: '#cbd5e1',
};

const WALL_THICKNESS = 4;
const DIM_OFFSET = 40;
const DIM_TICK = 8;
const GRID_STEP_MM = 500;
const PADDING = 100;
const OBSTACLE_HEIGHT = 16;    // px — visual height for rectangles
const POINT_RADIUS = 7;     // px — radius for point obstacles
const WALL_HIT_DISTANCE = 12;   // px — click tolerance for wall selection
const MODULE_DEPTH_PX = 36;   // px — how deep base modules render into the room
const WALL_MODULE_DEPTH_PX = 24; // px — depth for wall (alto) modules
const WALL_MODULE_OFFSET_PX = -30; // px — Y offset above the wall for altos

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
let lastState = null;
let lastUI = null;
let lastScale = 1;
let lastOffset = { x: 0, y: 0 };

/** Computed wall segments in screen coords for hit-testing */
let wallSegments = [];

/* ── Init ─────────────────────────────────────── */

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
        if (lastState) render(lastState, lastUI);
    };

    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handleCanvasClick);
    resize();
}

/* ── Main Render ─────────────────────────────── */

export function render(state, ui) {
    lastState = state;
    lastUI = ui || getUIState();
    if (!ctx) return;

    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, W, H);

    const bbox = getBoundingBox(state);
    const scale = computeScale(bbox, W, H);
    const offset = computeOffset(bbox, scale, W, H);
    lastScale = scale;
    lastOffset = offset;

    drawGrid(W, H, scale, offset);
    buildWallSegments(state, scale, offset);
    drawModules(state, scale, offset);      // Draw modules BEHIND walls
    drawWalls(state, scale, offset, lastUI);
    drawObstacles(state, scale, offset, lastUI);
    drawDimensions(state, scale, offset);
    drawOriginMark(scale, offset);
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

    // If we have modules, extend bbox to show them
    maxY = Math.max(maxY, maxX * 0.4);
    return { minX: -100, minY: -200, maxX: maxX + 100, maxY: maxY + 100 };
}

function computeScale(bbox, viewW, viewH) {
    const roomW = bbox.maxX - bbox.minX;
    const roomH = bbox.maxY - bbox.minY;
    return Math.min(
        (viewW - PADDING * 2) / roomW,
        (viewH - PADDING * 2) / roomH
    );
}

function computeOffset(bbox, scale, viewW, viewH) {
    const roomW = (bbox.maxX - bbox.minX) * scale;
    const roomH = (bbox.maxY - bbox.minY) * scale;
    return {
        x: (viewW - roomW) / 2 - bbox.minX * scale,
        y: (viewH - roomH) / 2 - bbox.minY * scale,
    };
}

/* ── Wall Segments for Hit-Testing ───────────── */

function buildWallSegments(state, scale, offset) {
    wallSegments = [];
    const ox = offset.x;
    const oy = offset.y;

    const wallA = state.walls.find(w => w.id === 'wall-A');
    if (wallA) {
        wallSegments.push({
            id: 'wall-A',
            x1: ox, y1: oy,
            x2: ox + wallA.length * scale, y2: oy,
            orientation: 'horizontal',
        });
    }

    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const wallB = state.walls.find(w => w.id === 'wall-B');
        if (wallB) {
            wallSegments.push({
                id: 'wall-B',
                x1: ox, y1: oy,
                x2: ox, y2: oy + wallB.length * scale,
                orientation: 'vertical',
            });
        }
    }
}

/** Get screen coordinates for a wall */
function getWallScreenCoords(wallId) {
    return wallSegments.find(s => s.id === wallId) || null;
}

/* ── Grid ─────────────────────────────────────── */

function drawGrid(W, H, scale, offset) {
    const stepPx = GRID_STEP_MM * scale;
    if (stepPx < 5) return;

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

/* ── Walls ────────────────────────────────────── */

function drawWalls(state, scale, offset, ui) {
    for (const seg of wallSegments) {
        const isSelected = ui.selectedWallId === seg.id;

        // Glow
        ctx.shadowColor = isSelected ? COLORS.accent : 'rgba(255,255,255,0.06)';
        ctx.shadowBlur = isSelected ? 18 : 8;

        ctx.strokeStyle = isSelected ? COLORS.wallSelected : COLORS.wall;
        ctx.lineWidth = isSelected ? 5 : WALL_THICKNESS;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Corner dot
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(offset.x, offset.y, 5, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Obstacles ────────────────────────────────── */

function drawObstacles(state, scale, offset, ui) {
    for (const wall of state.walls) {
        if (!wall.obstacles || wall.obstacles.length === 0) continue;

        const seg = getWallScreenCoords(wall.id);
        if (!seg) continue;

        for (const obs of wall.obstacles) {
            const isSelected = ui.selectedObstacleId === obs.id;
            drawObstacle(obs, seg, scale, isSelected);
        }
    }
}

function drawObstacle(obs, seg, scale, isSelected) {
    const posPx = obs.position * scale;
    const widPx = obs.width * scale;
    const isHoriz = seg.orientation === 'horizontal';

    // Position along the wall
    let cx, cy;
    if (isHoriz) {
        cx = seg.x1 + posPx;
        cy = seg.y1;
    } else {
        cx = seg.x1;
        cy = seg.y1 + posPx;
    }

    ctx.save();

    switch (obs.type) {
        case 'window':
            drawWindow(cx, cy, widPx, isHoriz, isSelected);
            break;
        case 'door':
            drawDoor(cx, cy, widPx, isHoriz, isSelected);
            break;
        case 'column':
            drawColumn(cx, cy, widPx, scale, isHoriz, isSelected);
            break;
        case 'water_point':
            drawPoint(cx, cy, COLORS.water_point, '💧', isSelected);
            break;
        case 'smoke_outlet':
            drawPoint(cx, cy, COLORS.smoke_outlet, '🔥', isSelected);
            break;
    }

    ctx.restore();
}

function drawWindow(x, y, width, isHoriz, selected) {
    const h = OBSTACLE_HEIGHT;

    ctx.strokeStyle = selected ? COLORS.obstacleSelected : COLORS.window;
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.setLineDash([]);

    if (isHoriz) {
        ctx.beginPath();
        ctx.rect(x - width / 2, y - h / 2, width, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x + width / 2, y);
        ctx.stroke();
        ctx.fillStyle = selected ? 'rgba(57,206,134,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(x - width / 2, y - h / 2, width, h);
    } else {
        ctx.beginPath();
        ctx.rect(x - h / 2, y - width / 2, h, width);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - width / 2);
        ctx.lineTo(x, y + width / 2);
        ctx.stroke();
        ctx.fillStyle = selected ? 'rgba(57,206,134,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(x - h / 2, y - width / 2, h, width);
    }

    if (selected) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = COLORS.obstacleSelected;
        ctx.lineWidth = 1;
        if (isHoriz) {
            ctx.strokeRect(x - width / 2 - 3, y - h / 2 - 3, width + 6, h + 6);
        } else {
            ctx.strokeRect(x - h / 2 - 3, y - width / 2 - 3, h + 6, width + 6);
        }
        ctx.setLineDash([]);
    }
}

function drawDoor(x, y, width, isHoriz, selected) {
    const color = selected ? COLORS.obstacleSelected : COLORS.door;

    ctx.fillStyle = '#111a23';
    if (isHoriz) {
        ctx.fillRect(x - width / 2, y - 4, width, 8);
    } else {
        ctx.fillRect(x - 4, y - width / 2, 8, width);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    if (isHoriz) {
        ctx.arc(x - width / 2, y, width, 0, -Math.PI / 2, true);
    } else {
        ctx.arc(x, y - width / 2, width, Math.PI / 2, 0, true);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (isHoriz) {
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x - width / 2, y - width);
    } else {
        ctx.moveTo(x, y - width / 2);
        ctx.lineTo(x + width, y - width / 2);
    }
    ctx.stroke();

    if (selected) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = COLORS.obstacleSelected;
        ctx.lineWidth = 1;
        if (isHoriz) {
            ctx.strokeRect(x - width / 2 - 3, y - width - 3, width + 6, width + 6);
        } else {
            ctx.strokeRect(x - 3, y - width / 2 - 3, width + 6, width + 6);
        }
        ctx.setLineDash([]);
    }
}

function drawColumn(x, y, width, scale, isHoriz, selected) {
    const size = Math.max(width * scale, 12);
    const depth = size;

    ctx.fillStyle = selected ? COLORS.obstacleSelected : COLORS.column;
    ctx.globalAlpha = selected ? 0.7 : 0.8;

    if (isHoriz) {
        ctx.fillRect(x - size / 2, y, size, depth);
    } else {
        ctx.fillRect(x, y - size / 2, depth, size);
    }

    ctx.globalAlpha = 1;

    ctx.strokeStyle = selected ? COLORS.obstacleSelected : '#64748b';
    ctx.lineWidth = 1;
    if (isHoriz) {
        ctx.strokeRect(x - size / 2, y, size, depth);
    } else {
        ctx.strokeRect(x, y - size / 2, depth, size);
    }
}

function drawPoint(x, y, color, emoji, selected) {
    const r = POINT_RADIUS;

    ctx.shadowColor = color;
    ctx.shadowBlur = selected ? 16 : 8;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#111a23';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    if (selected) {
        ctx.strokeStyle = COLORS.obstacleSelected;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

/* ── Placed Modules Rendering ────────────────── */

function drawModules(state, scale, offset) {
    const modules = state.placed_modules;
    if (!modules || modules.length === 0) return;

    for (const mod of modules) {
        // Handle corner module separately
        if (mod.corner) {
            drawCornerModule(mod, scale, offset);
            continue;
        }

        const seg = getWallScreenCoords(mod.wallId);
        if (!seg) continue;

        if (mod.type === MODULE_TYPES.BASE) {
            drawBaseModule(mod, seg, scale);
        } else if (mod.type === MODULE_TYPES.WALL) {
            drawWallModule(mod, seg, scale);
        }
    }
}

function drawBaseModule(mod, seg, scale) {
    const posPx = mod.position * scale;
    const widPx = mod.width * scale;
    const isHoriz = seg.orientation === 'horizontal';
    const depth = MODULE_DEPTH_PX;

    let x, y, w, h;
    if (isHoriz) {
        x = seg.x1 + posPx;
        y = seg.y1 + 3; // Just below the wall line
        w = widPx;
        h = depth;
    } else {
        x = seg.x1 + 3;
        y = seg.y1 + posPx;
        w = depth;
        h = widPx;
    }

    // Determine colors based on anchor type
    let fill = COLORS.moduleBase;
    let border = COLORS.moduleBaseBorder;
    if (mod.anchor) {
        fill = COLORS.moduleAnchor;
        border = COLORS.moduleAnchorBorder;
    }

    ctx.save();

    // Module body
    ctx.fillStyle = fill;
    roundRect(x, y, w, h, 3);
    ctx.fill();

    // Module border
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 3);
    ctx.stroke();

    // Module label
    ctx.font = '600 9px "Roboto Mono", monospace';
    ctx.fillStyle = COLORS.moduleLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelText = mod.ref;
    if (isHoriz) {
        ctx.fillText(labelText, x + w / 2, y + h / 2);
    } else {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(labelText, 0, 0);
        ctx.restore();
    }

    ctx.restore();
}

function drawWallModule(mod, seg, scale) {
    const posPx = mod.position * scale;
    const widPx = mod.width * scale;
    const isHoriz = seg.orientation === 'horizontal';
    const depth = WALL_MODULE_DEPTH_PX;
    const offsetY = WALL_MODULE_OFFSET_PX;

    let x, y, w, h;
    if (isHoriz) {
        x = seg.x1 + posPx;
        y = seg.y1 + offsetY; // Above the wall line
        w = widPx;
        h = depth;
    } else {
        x = seg.x1 + offsetY;
        y = seg.y1 + posPx;
        w = depth;
        h = widPx;
    }

    ctx.save();

    // Wall module body (more transparent)
    ctx.fillStyle = COLORS.moduleWall;
    roundRect(x, y, w, h, 3);
    ctx.fill();

    // Dashed border for wall modules
    ctx.strokeStyle = COLORS.moduleWallBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    roundRect(x, y, w, h, 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.font = '500 8px "Roboto Mono", monospace';
    ctx.fillStyle = 'rgba(100, 149, 237, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isHoriz) {
        ctx.fillText(mod.ref, x + w / 2, y + h / 2);
    } else {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(mod.ref, 0, 0);
        ctx.restore();
    }

    ctx.restore();
}

function drawCornerModule(mod, scale, offset) {
    const ox = offset.x;
    const oy = offset.y;
    const size = mod.width * scale;
    const depth = MODULE_DEPTH_PX;

    ctx.save();

    // Corner fills both directions from origin
    ctx.fillStyle = COLORS.moduleCorner;
    // Horizontal part
    roundRect(ox + 3, oy + 3, size, depth, 3);
    ctx.fill();
    // Vertical part
    roundRect(ox + 3, oy + 3, depth, size, 3);
    ctx.fill();

    // Borders
    ctx.strokeStyle = COLORS.moduleCornerBorder;
    ctx.lineWidth = 1;
    roundRect(ox + 3, oy + 3, size, depth, 3);
    ctx.stroke();
    roundRect(ox + 3, oy + 3, depth, size, 3);
    ctx.stroke();

    // Label
    ctx.font = '600 9px "Roboto Mono", monospace';
    ctx.fillStyle = COLORS.moduleLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CORNER', ox + 3 + size / 2, oy + 3 + depth / 2);

    ctx.restore();
}

/* ── Dimension Annotations ───────────────────── */

function drawDimensions(state, scale, offset) {
    const wallA = state.walls.find(w => w.id === 'wall-A');
    if (!wallA) return;

    const ax = offset.x;
    const ay = offset.y;
    const aEndX = ax + wallA.length * scale;

    drawHorizontalDimension(ax, aEndX, ay - DIM_OFFSET, wallA.length);

    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const wallB = state.walls.find(w => w.id === 'wall-B');
        if (wallB) {
            const bEndY = ay + wallB.length * scale;
            drawVerticalDimension(ax - DIM_OFFSET, ay, bEndY, wallB.length);
        }
    }
}

function drawHorizontalDimension(x1, x2, y, lengthMM) {
    ctx.strokeStyle = COLORS.dimLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y - DIM_TICK / 2); ctx.lineTo(x1, y + DIM_TICK / 2);
    ctx.moveTo(x2, y - DIM_TICK / 2); ctx.lineTo(x2, y + DIM_TICK / 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.15)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y + DIM_TICK); ctx.lineTo(x1, y + DIM_OFFSET);
    ctx.moveTo(x2, y + DIM_TICK); ctx.lineTo(x2, y + DIM_OFFSET);
    ctx.stroke();
    ctx.setLineDash([]);

    drawDimensionLabel((x1 + x2) / 2, y - 8, `${lengthMM} mm`);
}

function drawVerticalDimension(x, y1, y2, lengthMM) {
    ctx.strokeStyle = COLORS.dimLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - DIM_TICK / 2, y1); ctx.lineTo(x + DIM_TICK / 2, y1);
    ctx.moveTo(x - DIM_TICK / 2, y2); ctx.lineTo(x + DIM_TICK / 2, y2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.15)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x + DIM_TICK, y1); ctx.lineTo(x + DIM_OFFSET, y1);
    ctx.moveTo(x + DIM_TICK, y2); ctx.lineTo(x + DIM_OFFSET, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(x - 8, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    drawDimensionLabel(0, 0, `${lengthMM} mm`);
    ctx.restore();
}

function drawDimensionLabel(x, y, text) {
    ctx.font = '500 11px "Roboto Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const pw = metrics.width + 14;
    const ph = 18;
    ctx.fillStyle = 'rgba(17, 26, 35, 0.85)';
    roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.2)';
    ctx.lineWidth = 0.5;
    roundRect(x - pw / 2, y - ph / 2, pw, ph, 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.dimText;
    ctx.fillText(text, x, y);
}

/* ── Origin Mark ─────────────────────────────── */

function drawOriginMark(scale, offset) {
    const x = offset.x, y = offset.y, size = 14;
    ctx.strokeStyle = COLORS.origin;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
    ctx.stroke();

    ctx.font = '500 9px "Roboto Mono", monospace';
    ctx.fillStyle = COLORS.origin;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', x + size + 4, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Y', x, y + size + 4);
}

/* ── HUD ──────────────────────────────────────── */

function updateHUD(state, scale) {
    const shapeEl = document.getElementById('hud-shape');
    const scaleEl = document.getElementById('hud-scale');
    if (shapeEl) shapeEl.textContent = state.shape;
    if (scaleEl) scaleEl.textContent = `1px = ${Math.round(1 / scale)} mm`;
}

/* ── Click Handling ───────────────────────────── */

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check obstacles first (more precise targets)
    if (lastState) {
        for (const wall of lastState.walls) {
            if (!wall.obstacles) continue;
            const seg = getWallScreenCoords(wall.id);
            if (!seg) continue;

            for (const obs of wall.obstacles) {
                if (isClickOnObstacle(mx, my, obs, seg, lastScale)) {
                    selectObstacle(obs.id);
                    return;
                }
            }
        }
    }

    // Check walls
    for (const seg of wallSegments) {
        if (distToSegment(mx, my, seg.x1, seg.y1, seg.x2, seg.y2) < WALL_HIT_DISTANCE) {
            selectWall(seg.id);
            return;
        }
    }

    // Clicked on nothing
    clearSelection();
}

function isClickOnObstacle(mx, my, obs, seg, scale) {
    const posPx = obs.position * scale;
    const widPx = obs.width * scale;
    const isHoriz = seg.orientation === 'horizontal';

    let cx, cy;
    if (isHoriz) {
        cx = seg.x1 + posPx;
        cy = seg.y1;
    } else {
        cx = seg.x1;
        cy = seg.y1 + posPx;
    }

    // For points (water/smoke)
    if (obs.type === 'water_point' || obs.type === 'smoke_outlet') {
        return Math.hypot(mx - cx, my - cy) < POINT_RADIUS + 6;
    }

    // For rectangles (window/door/column)
    const margin = 6;
    if (isHoriz) {
        return mx >= cx - widPx / 2 - margin && mx <= cx + widPx / 2 + margin &&
            my >= cy - OBSTACLE_HEIGHT - margin && my <= cy + OBSTACLE_HEIGHT + margin;
    } else {
        return mx >= cx - OBSTACLE_HEIGHT - margin && mx <= cx + OBSTACLE_HEIGHT + margin &&
            my >= cy - widPx / 2 - margin && my <= cy + widPx / 2 + margin;
    }
}

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2) */
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/* ── Helpers ──────────────────────────────────── */

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
