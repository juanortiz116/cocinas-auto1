/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Control Panel Module
   Geometry selector & parametric inputs
   ═══════════════════════════════════════════════ */

import { SHAPES, getState, setShape, setWallLength, setCeilingHeight, subscribe, update } from './state.js';
import { saveDesign, loadDesign, listDesigns, deleteDesign } from './supabase.js';

/** Currently loaded design ID (null = unsaved) */
let currentDesignId = null;
let currentDesignName = 'Mi Cocina';

/* ── SVG Icons ──────────────────────────────── */

const ICONS = {
    [SHAPES.LINEAR]: `
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="4" y1="18" x2="32" y2="18"/>
    </svg>`,
    [SHAPES.L_SHAPED]: `
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4,6 4,18 32,18"/>
    </svg>`,
    [SHAPES.U_SHAPED]: `
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4,6 4,18 32,18 32,6"/>
    </svg>`,
};

const SHAPE_LABELS = {
    [SHAPES.LINEAR]: 'Lineal',
    [SHAPES.L_SHAPED]: 'En L',
    [SHAPES.U_SHAPED]: 'En U',
};

/* ── Geometry Selector ──────────────────────── */

export function initPanel() {
    renderGeometrySelector();
    renderInputs(getState());
    renderSaveLoadSection();

    // Re-render inputs when state changes
    subscribe((state) => {
        renderInputs(state);
        renderDebug(state);
    });
}

function renderGeometrySelector() {
    const container = document.getElementById('geometry-selector');
    container.innerHTML = '';

    Object.values(SHAPES).forEach(shape => {
        const btn = document.createElement('button');
        btn.className = 'geo-btn';
        btn.dataset.shape = shape;

        const isActive = getState().shape === shape;
        const isDisabled = shape === SHAPES.U_SHAPED;

        if (isActive) btn.classList.add('active');
        if (isDisabled) btn.classList.add('disabled');

        btn.innerHTML = `
      ${ICONS[shape]}
      <span class="geo-label">${SHAPE_LABELS[shape]}</span>
      ${isDisabled ? '<span class="coming-soon">Pronto</span>' : ''}
    `;

        if (!isDisabled) {
            btn.addEventListener('click', () => {
                setShape(shape);
                // Re-render selector to update active state
                renderGeometrySelector();
            });
        }

        container.appendChild(btn);
    });
}

/* ── Parametric Inputs ──────────────────────── */

function renderInputs(state) {
    const container = document.getElementById('inputs-container');

    // Only re-render if shape changed (to avoid losing focus during typing)
    const currentShape = container.dataset.currentShape;
    if (currentShape === state.shape) {
        // Just update values if inputs already exist (don't re-render)
        updateInputValues(state);
        return;
    }
    container.dataset.currentShape = state.shape;
    container.innerHTML = '';

    // Wall A — always visible
    container.appendChild(
        createInputGroup('wall-A', 'Largo Pared A', state.walls.find(w => w.id === 'wall-A')?.length || 3000)
    );

    // Wall B — visible for L and U
    if (state.shape === SHAPES.L_SHAPED || state.shape === SHAPES.U_SHAPED) {
        container.appendChild(createDivider());
        container.appendChild(
            createInputGroup('wall-B', 'Largo Pared B', state.walls.find(w => w.id === 'wall-B')?.length || 2000)
        );
    }

    // Wall C — visible for U only (future)
    if (state.shape === SHAPES.U_SHAPED) {
        container.appendChild(createDivider());
        container.appendChild(
            createInputGroup('wall-C', 'Largo Pared C', state.walls.find(w => w.id === 'wall-C')?.length || 3000)
        );
    }

    // Divider before ceiling
    container.appendChild(createDivider());

    // Ceiling height — always visible
    container.appendChild(
        createInputGroup('ceiling', 'Altura Techo', state.ceilingHeight, true)
    );
}

function updateInputValues(state) {
    // Update wall input values without re-rendering (preserves focus)
    state.walls.forEach(wall => {
        const input = document.getElementById(`input-${wall.id}`);
        if (input && document.activeElement !== input) {
            input.value = wall.length;
        }
    });

    const ceilingInput = document.getElementById('input-ceiling');
    if (ceilingInput && document.activeElement !== ceilingInput) {
        ceilingInput.value = state.ceilingHeight;
    }
}

function createInputGroup(id, label, defaultValue, isCeiling = false) {
    const group = document.createElement('div');
    group.className = 'input-group';

    const labelColor = isCeiling ? '#64748b' : '#39ce86';

    group.innerHTML = `
    <label class="input-label" for="input-${id}">
      <span class="wall-indicator" style="background:${labelColor}"></span>
      ${label}
    </label>
    <div class="input-wrapper">
      <input
        type="number"
        id="input-${id}"
        class="input-field"
        value="${defaultValue}"
        min="100"
        max="20000"
        step="50"
        placeholder="mm"
      />
      <span class="input-suffix">mm</span>
    </div>
  `;

    const input = group.querySelector('input');

    // Live update on input
    input.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!val || val <= 0) return;

        if (isCeiling) {
            setCeilingHeight(val);
        } else {
            setWallLength(id, val);
        }
    });

    // Validate on blur
    input.addEventListener('blur', (e) => {
        let val = parseInt(e.target.value, 10);
        if (!val || val <= 0) {
            val = defaultValue;
            e.target.value = val;
            if (isCeiling) setCeilingHeight(val);
            else setWallLength(id, val);
        }
    });

    return group;
}

function createDivider() {
    const div = document.createElement('div');
    div.className = 'input-divider';
    return div;
}

/* ── Save / Load Section ─────────────────────── */

function renderSaveLoadSection() {
    const container = document.getElementById('save-load-container');
    if (!container) return;
    container.innerHTML = '';

    // Design name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'input-group';
    nameGroup.innerHTML = `
    <label class="input-label" for="input-design-name">
      <span class="wall-indicator" style="background:#64748b"></span>
      Nombre del Diseño
    </label>
    <div class="input-wrapper">
      <input
        type="text"
        id="input-design-name"
        class="input-field"
        value="${currentDesignName}"
        placeholder="Mi Cocina"
        style="font-family:var(--font-sans); padding-right:14px;"
      />
    </div>
  `;
    nameGroup.querySelector('input').addEventListener('input', (e) => {
        currentDesignName = e.target.value || 'Mi Cocina';
    });
    container.appendChild(nameGroup);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.className = 'save-load-buttons';
    btnRow.innerHTML = `
    <button id="btn-save" class="sl-btn sl-btn-primary" title="Guardar diseño">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Guardar
    </button>
    <button id="btn-load-list" class="sl-btn sl-btn-secondary" title="Cargar diseño guardado">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      Cargar
    </button>
    <button id="btn-new" class="sl-btn sl-btn-ghost" title="Nuevo diseño">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Nuevo
    </button>
  `;
    container.appendChild(btnRow);

    // Status indicator
    const status = document.createElement('div');
    status.id = 'save-status';
    status.className = 'save-status';
    container.appendChild(status);

    // Designs list (hidden by default)
    const listWrap = document.createElement('div');
    listWrap.id = 'designs-list';
    listWrap.className = 'designs-list hidden';
    container.appendChild(listWrap);

    // Wire buttons
    document.getElementById('btn-save').addEventListener('click', handleSave);
    document.getElementById('btn-load-list').addEventListener('click', handleToggleList);
    document.getElementById('btn-new').addEventListener('click', handleNew);
}

async function handleSave() {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Guardando...';
    statusEl.className = 'save-status saving';

    const state = getState();
    const { data, error } = await saveDesign(state, currentDesignId, currentDesignName);

    if (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'save-status error';
    } else {
        currentDesignId = data.id;
        statusEl.textContent = '✓ Guardado';
        statusEl.className = 'save-status success';
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'save-status';
        }, 2500);
    }
}

async function handleToggleList() {
    const listEl = document.getElementById('designs-list');
    if (!listEl.classList.contains('hidden')) {
        listEl.classList.add('hidden');
        return;
    }

    listEl.innerHTML = '<div class="designs-loading">Cargando...</div>';
    listEl.classList.remove('hidden');

    const { data, error } = await listDesigns();
    if (error) {
        listEl.innerHTML = `<div class="designs-loading">Error: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="designs-loading">No hay diseños guardados</div>';
        return;
    }

    listEl.innerHTML = data.map(d => `
    <div class="design-item" data-id="${d.id}">
      <div class="design-info">
        <span class="design-name">${d.name}</span>
        <span class="design-date">${new Date(d.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="design-actions">
        <button class="design-load" data-id="${d.id}" title="Cargar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
        </button>
        <button class="design-delete" data-id="${d.id}" title="Eliminar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

    // Wire load buttons
    listEl.querySelectorAll('.design-load').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            await handleLoadDesign(id);
            listEl.classList.add('hidden');
        });
    });

    // Wire delete buttons
    listEl.querySelectorAll('.design-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            await deleteDesign(id);
            if (currentDesignId === id) {
                currentDesignId = null;
            }
            // Refresh list
            handleToggleList();
            handleToggleList();
        });
    });
}

async function handleLoadDesign(id) {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Cargando...';
    statusEl.className = 'save-status saving';

    const { data, error } = await loadDesign(id);
    if (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'save-status error';
        return;
    }

    // Apply loaded state
    currentDesignId = data.id;
    currentDesignName = data.name;
    const nameInput = document.getElementById('input-design-name');
    if (nameInput) nameInput.value = data.name;

    // Force full re-render by resetting currentShape tracker
    const container = document.getElementById('inputs-container');
    container.dataset.currentShape = '';

    update(data.room_state);
    renderGeometrySelector();

    statusEl.textContent = `✓ "${data.name}" cargado`;
    statusEl.className = 'save-status success';
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'save-status';
    }, 2500);
}

function handleNew() {
    currentDesignId = null;
    currentDesignName = 'Mi Cocina';
    const nameInput = document.getElementById('input-design-name');
    if (nameInput) nameInput.value = currentDesignName;

    const container = document.getElementById('inputs-container');
    container.dataset.currentShape = '';

    setShape(SHAPES.LINEAR);
    renderGeometrySelector();

    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Nuevo diseño';
    statusEl.className = 'save-status success';
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'save-status';
    }, 1500);
}

/* ── Debug Panel ─────────────────────────────── */

function renderDebug(state) {
    const el = document.getElementById('state-debug');
    if (el) {
        el.textContent = JSON.stringify(state, null, 2);
    }
}
