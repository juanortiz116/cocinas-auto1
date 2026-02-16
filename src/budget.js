/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Budget Engine
   Phase 3: Real-time cost calculation
   ═══════════════════════════════════════════════ */

import { MODULE_TYPES, HARDWARE, LINEALS, getCatalogItem } from './catalog.js';

/**
 * Calculate a complete budget from placed modules.
 * 
 * @param {Array} placedModules - Array of placed module objects
 * @returns {object} Budget breakdown
 */
export function calculateBudget(placedModules) {
    if (!placedModules || placedModules.length === 0) {
        return emptyBudget();
    }

    // ── Module costs ────────────────────────────
    const moduleLines = [];
    const counts = {};

    for (const mod of placedModules) {
        if (!counts[mod.ref]) {
            counts[mod.ref] = { qty: 0, label: mod.label, price: mod.price, type: mod.type };
        }
        counts[mod.ref].qty++;
    }

    let modulesTotal = 0;
    for (const [ref, info] of Object.entries(counts)) {
        const lineTotal = info.qty * info.price;
        modulesTotal += lineTotal;
        moduleLines.push({
            qty: info.qty,
            ref,
            label: info.label,
            unitPrice: info.price,
            total: lineTotal,
            type: info.type,
        });
    }

    // ── Hardware costs ──────────────────────────
    const totalModuleCount = placedModules.length;
    const hardwareLines = [];
    let hardwareTotal = 0;

    for (const [key, hw] of Object.entries(HARDWARE)) {
        const qty = totalModuleCount * hw.perModule;
        const lineTotal = qty * hw.price;
        hardwareTotal += lineTotal;
        hardwareLines.push({
            qty,
            ref: key,
            label: hw.label,
            unitPrice: hw.price,
            total: lineTotal,
        });
    }

    // ── Linear costs (countertop + plinth) ─────
    const baseMods = placedModules.filter(m => m.type === MODULE_TYPES.BASE);
    const baseLinealMM = baseMods.reduce((sum, m) => sum + m.width, 0);
    const baseLinealM = baseLinealMM / 1000;

    const linealLines = [];
    let linealTotal = 0;

    // Countertop
    const ctCost = Math.round(baseLinealM * LINEALS.COUNTERTOP.pricePerMeter * 100) / 100;
    linealTotal += ctCost;
    linealLines.push({
        qty: 1,
        ref: 'COUNTERTOP',
        label: `${LINEALS.COUNTERTOP.label} (${baseLinealM.toFixed(2)}m)`,
        unitPrice: ctCost,
        total: ctCost,
    });

    // Plinth
    const plCost = Math.round(baseLinealM * LINEALS.PLINTH.pricePerMeter * 100) / 100;
    linealTotal += plCost;
    linealLines.push({
        qty: 1,
        ref: 'PLINTH',
        label: `${LINEALS.PLINTH.label} (${baseLinealM.toFixed(2)}m)`,
        unitPrice: plCost,
        total: plCost,
    });

    // ── Grand total ────────────────────────────
    const totalPrice = modulesTotal + hardwareTotal + linealTotal;

    return {
        moduleLines,
        hardwareLines,
        linealLines,
        modulesTotal,
        hardwareTotal,
        linealTotal,
        totalPrice: Math.round(totalPrice * 100) / 100,
        moduleCount: totalModuleCount,
        baseLinealM,
    };
}

function emptyBudget() {
    return {
        moduleLines: [],
        hardwareLines: [],
        linealLines: [],
        modulesTotal: 0,
        hardwareTotal: 0,
        linealTotal: 0,
        totalPrice: 0,
        moduleCount: 0,
        baseLinealM: 0,
    };
}
