/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Supabase Client
   Database connection for persisting designs
   ═══════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn('⚠️ Supabase credentials missing! Check .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Save a kitchen design (insert or update).
 * @param {object} roomState - the current room state
 * @param {string|null} id - if provided, updates existing record
 * @param {string} name - design name
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function saveDesign(roomState, id = null, name = 'Mi Cocina') {
    if (id) {
        // Update existing
        const { data, error } = await supabase
            .from('kitchen_designs')
            .update({ room_state: roomState, name })
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    } else {
        // Insert new
        const { data, error } = await supabase
            .from('kitchen_designs')
            .insert({ room_state: roomState, name })
            .select()
            .single();
        return { data, error };
    }
}

/**
 * Load a kitchen design by ID.
 * @param {string} id
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function loadDesign(id) {
    const { data, error } = await supabase
        .from('kitchen_designs')
        .select('*')
        .eq('id', id)
        .single();
    return { data, error };
}

/**
 * List all saved kitchen designs (most recent first).
 * @returns {Promise<{data: Array|null, error: object|null}>}
 */
export async function listDesigns() {
    const { data, error } = await supabase
        .from('kitchen_designs')
        .select('id, name, created_at, updated_at')
        .order('updated_at', { ascending: false });
    return { data, error };
}

/**
 * Delete a design by ID.
 * @param {string} id
 * @returns {Promise<{error: object|null}>}
 */
export async function deleteDesign(id) {
    const { error } = await supabase
        .from('kitchen_designs')
        .delete()
        .eq('id', id);
    return { error };
}
