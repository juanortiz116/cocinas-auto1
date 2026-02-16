/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Virtual Catalog
   Phase 3: Kitchen module definitions & pricing
   ═══════════════════════════════════════════════ */

/**
 * Module placement types.
 * @readonly
 * @enum {string}
 */
export const MODULE_TYPES = Object.freeze({
    BASE: 'base',
    WALL: 'wall',
    TALL: 'tall',
});

/**
 * Kitchen module catalog.
 * Each entry has: ref, label, type, width (mm), depth (mm), price (€).
 * Specials have an `anchor` property indicating what obstacle they bind to.
 */
export const CATALOG = [
    // ── Base modules (Bajos) ──────────────────
    { ref: 'B15', label: 'Bajo 15', type: MODULE_TYPES.BASE, width: 150, depth: 600, price: 25 },
    { ref: 'B30', label: 'Bajo 30', type: MODULE_TYPES.BASE, width: 300, depth: 600, price: 35 },
    { ref: 'B45', label: 'Bajo 45', type: MODULE_TYPES.BASE, width: 450, depth: 600, price: 42 },
    { ref: 'B60', label: 'Bajo 60', type: MODULE_TYPES.BASE, width: 600, depth: 600, price: 50 },
    { ref: 'B90', label: 'Bajo 90', type: MODULE_TYPES.BASE, width: 900, depth: 600, price: 72 },
    { ref: 'B120', label: 'Bajo 120', type: MODULE_TYPES.BASE, width: 1200, depth: 600, price: 95 },

    // ── Special Base modules ──────────────────
    { ref: 'SINK60', label: 'Fregadero', type: MODULE_TYPES.BASE, width: 600, depth: 600, price: 65, anchor: 'water_point' },
    { ref: 'OVEN60', label: 'Horno', type: MODULE_TYPES.BASE, width: 600, depth: 600, price: 60, anchor: 'smoke_outlet' },
    { ref: 'CORNER90', label: 'Rincón L', type: MODULE_TYPES.BASE, width: 930, depth: 930, price: 110, corner: true },

    // ── Wall modules (Altos) ──────────────────
    { ref: 'A15', label: 'Alto 15', type: MODULE_TYPES.WALL, width: 150, depth: 350, price: 22 },
    { ref: 'A30', label: 'Alto 30', type: MODULE_TYPES.WALL, width: 300, depth: 350, price: 30 },
    { ref: 'A45', label: 'Alto 45', type: MODULE_TYPES.WALL, width: 450, depth: 350, price: 38 },
    { ref: 'A60', label: 'Alto 60', type: MODULE_TYPES.WALL, width: 600, depth: 350, price: 45 },
    { ref: 'A90', label: 'Alto 90', type: MODULE_TYPES.WALL, width: 900, depth: 350, price: 65 },
    { ref: 'A120', label: 'Alto 120', type: MODULE_TYPES.WALL, width: 1200, depth: 350, price: 85 },

    // ── Tall modules (Columnas) ───────────────
    { ref: 'T60', label: 'Columna 60', type: MODULE_TYPES.TALL, width: 600, depth: 600, price: 120 },
];

/**
 * Hardware pricing constants.
 */
export const HARDWARE = Object.freeze({
    HANDLE: { label: 'Tirador', price: 5, perModule: 1 },
    LEGS: { label: 'Patas (x4)', price: 4, perModule: 1 },
    HINGES: { label: 'Bisagras (x2)', price: 3, perModule: 1 },
});

/**
 * Linear pricing (per meter).
 */
export const LINEALS = Object.freeze({
    COUNTERTOP: { label: 'Encimera', pricePerMeter: 85 },
    PLINTH: { label: 'Zócalo', pricePerMeter: 15 },
});

/**
 * Get a catalog item by ref.
 */
export function getCatalogItem(ref) {
    return CATALOG.find(c => c.ref === ref) || null;
}

/**
 * Get base modules sorted by width descending (for greedy fill).
 */
export function getBaseModulesByWidth() {
    return CATALOG
        .filter(c => c.type === MODULE_TYPES.BASE && !c.anchor && !c.corner)
        .sort((a, b) => b.width - a.width);
}

/**
 * Get wall modules sorted by width descending (for greedy fill).
 */
export function getWallModulesByWidth() {
    return CATALOG
        .filter(c => c.type === MODULE_TYPES.WALL)
        .sort((a, b) => b.width - a.width);
}
