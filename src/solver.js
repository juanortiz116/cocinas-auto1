/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Solver Algorithm
   Phase 3: Automatic kitchen module placement
   ═══════════════════════════════════════════════ */

import { CATALOG, MODULE_TYPES, getBaseModulesByWidth, getWallModulesByWidth } from './catalog.js';

/**
 * Generate a kitchen layout based on the room state.
 * 
 * Algorithm:
 * 1. Clear previous modules
 * 2. Place anchor modules (sink at water_point, oven at smoke_outlet)
 * 3. Place corner module (L-shape only)
 * 4. Greedy-fill remaining space with base modules (largest first)
 * 5. Mirror base layout to wall modules, skipping windows
 * 
 * @param {object} state - The current room state (walls + obstacles)
 * @returns {{ placed_modules: Array, errors: string[] }}
 */
export function generateLayout(state) {
    const placed = [];
    const errors = [];

    // ── Step 1: Process each wall ──────────────────
    for (const wall of state.walls) {
        const obstacles = wall.obstacles || [];
        const wallLen = wall.length;

        // Build a list of "blocked zones" on this wall
        const blocked = buildBlockedZones(obstacles);

        // ── Step 2: Place anchor modules ────────────
        const waterPoints = obstacles.filter(o => o.type === 'water_point');
        for (const wp of waterPoints) {
            const sinkItem = CATALOG.find(c => c.ref === 'SINK60');
            const sinkStart = wp.position - sinkItem.width / 2;
            const sinkEnd = sinkStart + sinkItem.width;

            // Check if the sink position conflicts with a column or door
            if (isConflict(sinkStart, sinkEnd, blocked)) {
                errors.push(`Conflicto: La toma de agua en ${wall.id} (pos ${wp.position}mm) está obstruida.`);
                continue;
            }

            if (sinkStart < 0 || sinkEnd > wallLen) {
                errors.push(`Conflicto: Fregadero no cabe en ${wall.id} (pos ${wp.position}mm).`);
                continue;
            }

            placed.push({
                ref: 'SINK60',
                type: MODULE_TYPES.BASE,
                wallId: wall.id,
                position: sinkStart,
                width: sinkItem.width,
                label: sinkItem.label,
                price: sinkItem.price,
                anchor: 'water_point',
            });
        }

        const smokePoints = obstacles.filter(o => o.type === 'smoke_outlet');
        for (const sp of smokePoints) {
            const ovenItem = CATALOG.find(c => c.ref === 'OVEN60');
            const ovenStart = sp.position - ovenItem.width / 2;
            const ovenEnd = ovenStart + ovenItem.width;

            if (isConflict(ovenStart, ovenEnd, blocked)) {
                errors.push(`Conflicto: La salida de humos en ${wall.id} (pos ${sp.position}mm) está obstruida.`);
                continue;
            }

            if (ovenStart < 0 || ovenEnd > wallLen) {
                errors.push(`Conflicto: Horno no cabe en ${wall.id} (pos ${sp.position}mm).`);
                continue;
            }

            placed.push({
                ref: 'OVEN60',
                type: MODULE_TYPES.BASE,
                wallId: wall.id,
                position: ovenStart,
                width: ovenItem.width,
                label: ovenItem.label,
                price: ovenItem.price,
                anchor: 'smoke_outlet',
            });
        }
    }

    // ── Step 3: Corner module (L-shape) ──────────
    if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
        const cornerItem = CATALOG.find(c => c.ref === 'CORNER90');
        if (cornerItem) {
            // Corner is at origin (0,0) where wall-A meets wall-B
            // It occupies the first 930mm of wall-A and the first 930mm of wall-B
            placed.push({
                ref: 'CORNER90',
                type: MODULE_TYPES.BASE,
                wallId: 'corner-AB',
                position: 0,
                width: cornerItem.width,
                label: cornerItem.label,
                price: cornerItem.price,
                corner: true,
            });
        }
    }

    // ── Step 4: Greedy fill base modules ─────────
    for (const wall of state.walls) {
        const obstacles = wall.obstacles || [];
        const wallLen = wall.length;

        // Calculate already-placed module zones on this wall
        const occupiedByModules = placed
            .filter(m => m.wallId === wall.id && m.type === MODULE_TYPES.BASE)
            .map(m => ({ start: m.position, end: m.position + m.width }));

        // Add corner occupation
        if (state.shape === 'L-SHAPED' || state.shape === 'U-SHAPED') {
            const cornerItem = CATALOG.find(c => c.ref === 'CORNER90');
            if (cornerItem) {
                if (wall.id === 'wall-A') {
                    occupiedByModules.push({ start: 0, end: cornerItem.width });
                }
                if (wall.id === 'wall-B') {
                    occupiedByModules.push({ start: 0, end: cornerItem.width });
                }
            }
        }

        // Build combined blocked zones (doors, columns + already placed modules)
        const blocked = buildBlockedZones(obstacles);
        const allOccupied = [...blocked, ...occupiedByModules].sort((a, b) => a.start - b.start);

        // Find free segments
        const freeSegments = findFreeSegments(wallLen, allOccupied);

        // Greedy fill each free segment
        const baseMods = getBaseModulesByWidth();
        for (const seg of freeSegments) {
            let cursor = seg.start;
            while (cursor < seg.end) {
                const remaining = seg.end - cursor;
                const fitMod = baseMods.find(m => m.width <= remaining);
                if (!fitMod) break;

                placed.push({
                    ref: fitMod.ref,
                    type: MODULE_TYPES.BASE,
                    wallId: wall.id,
                    position: cursor,
                    width: fitMod.width,
                    label: fitMod.label,
                    price: fitMod.price,
                });

                cursor += fitMod.width;
            }
        }
    }

    // ── Step 5: Wall (alto) modules — mirror base, skip windows ──
    for (const wall of state.walls) {
        const obstacles = wall.obstacles || [];
        const wallLen = wall.length;
        const windows = obstacles
            .filter(o => o.type === 'window')
            .map(o => ({ start: o.position - o.width / 2, end: o.position + o.width / 2 }));

        // Get base modules placed on this wall
        const baseOnWall = placed.filter(m => m.wallId === wall.id && m.type === MODULE_TYPES.BASE);

        const wallMods = getWallModulesByWidth();

        for (const baseMod of baseOnWall) {
            // Check if this base module's zone overlaps any window
            const baseStart = baseMod.position;
            const baseEnd = baseMod.position + baseMod.width;

            const overlapsWindow = windows.some(w =>
                baseStart < w.end && baseEnd > w.start
            );

            if (overlapsWindow) continue; // Skip — no tall modules under windows

            // Find the matching wall module width
            const matchingWall = wallMods.find(wm => wm.width === baseMod.width);
            if (!matchingWall) {
                // Try to fit from largest to smallest
                const fitWall = wallMods.find(wm => wm.width <= baseMod.width);
                if (fitWall) {
                    placed.push({
                        ref: fitWall.ref,
                        type: MODULE_TYPES.WALL,
                        wallId: wall.id,
                        position: baseMod.position,
                        width: fitWall.width,
                        label: fitWall.label,
                        price: fitWall.price,
                    });
                }
            } else {
                placed.push({
                    ref: matchingWall.ref,
                    type: MODULE_TYPES.WALL,
                    wallId: wall.id,
                    position: baseMod.position,
                    width: matchingWall.width,
                    label: matchingWall.label,
                    price: matchingWall.price,
                });
            }
        }
    }

    return { placed_modules: placed, errors };
}

/* ── Helpers ──────────────────────────────────── */

/**
 * Build blocked zones from obstacles (doors and columns block furniture).
 * Doors: the full width is blocked.
 * Columns: the full width is blocked.
 * Windows: only block wall (alto) modules, NOT base modules.
 */
function buildBlockedZones(obstacles) {
    const zones = [];
    for (const obs of obstacles) {
        if (obs.type === 'door' || obs.type === 'column') {
            zones.push({
                start: obs.position - obs.width / 2,
                end: obs.position + obs.width / 2,
            });
        }
    }
    return zones.sort((a, b) => a.start - b.start);
}

/**
 * Check if placing a module from `start` to `end` conflicts with any blocked zone.
 */
function isConflict(start, end, blockedZones) {
    return blockedZones.some(z => start < z.end && end > z.start);
}

/**
 * Find free segments on a wall given occupied zones.
 * Returns array of { start, end } representing gaps.
 */
function findFreeSegments(wallLength, occupiedZones) {
    // Merge overlapping zones
    const merged = mergeZones(occupiedZones);
    const free = [];
    let cursor = 0;

    for (const zone of merged) {
        if (cursor < zone.start) {
            free.push({ start: cursor, end: zone.start });
        }
        cursor = Math.max(cursor, zone.end);
    }

    if (cursor < wallLength) {
        free.push({ start: cursor, end: wallLength });
    }

    return free;
}

/**
 * Merge overlapping/adjacent zones.
 */
function mergeZones(zones) {
    if (zones.length === 0) return [];
    const sorted = [...zones].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].start <= last.end) {
            last.end = Math.max(last.end, sorted[i].end);
        } else {
            merged.push({ ...sorted[i] });
        }
    }

    return merged;
}
