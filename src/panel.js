/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Control Panel Module
   Phase 3: Solver + Budget + Obstacles + Geometry
   ═══════════════════════════════════════════════ */

import {
  SHAPES, OBSTACLE_TYPES,
  getState, getUIState,
  setShape, setWallLength, setCeilingHeight,
  subscribe, update,
  setActiveTool, selectWall, selectObstacle,
  updateObstacle, removeObstacle, clearSelection,
  setPlacedModules, setBudget, setSolverErrors, clearModules, setSolverRunning,
} from './state.js';
import { saveDesign, loadDesign, listDesigns, deleteDesign } from './supabase.js';
import { generateLayout } from './solver.js';
import { calculateBudget } from './budget.js';

/** Currently loaded design ID (null = unsaved) */
let currentDesignId = null;
let currentDesignName = 'Mi Cocina';

/* ── SVG Icons ──────────────────────────────── */

const SHAPE_ICONS = {
  [SHAPES.LINEAR]: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="18" x2="32" y2="18"/></svg>`,
  [SHAPES.L_SHAPED]: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 4,18 32,18"/></svg>`,
  [SHAPES.U_SHAPED]: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 4,18 32,18 32,6"/></svg>`,
};

const SHAPE_LABELS = {
  [SHAPES.LINEAR]: 'Lineal',
  [SHAPES.L_SHAPED]: 'En L',
  [SHAPES.U_SHAPED]: 'En U',
};

const OBSTACLE_TOOL_DEFS = [
  { type: OBSTACLE_TYPES.WINDOW, label: 'Ventana', emoji: '🪟', color: '#ffffff' },
  { type: OBSTACLE_TYPES.DOOR, label: 'Puerta', emoji: '🚪', color: '#94a3b8' },
  { type: OBSTACLE_TYPES.COLUMN, label: 'Columna', emoji: '🏗️', color: '#475569' },
  { type: OBSTACLE_TYPES.WATER_POINT, label: 'Agua', emoji: '💧', color: '#06b6d4' },
  { type: OBSTACLE_TYPES.SMOKE_OUTLET, label: 'Humos', emoji: '🔥', color: '#f59e0b' },
];

const OBSTACLE_TYPE_LABELS = {
  window: 'Ventana',
  door: 'Puerta',
  column: 'Columna',
  water_point: 'Toma de Agua',
  smoke_outlet: 'Salida Humos',
};

/* ── Init ─────────────────────────────────────── */

export function initPanel() {
  renderGeometrySelector();
  renderInputs(getState());
  renderObstacleToolbar();
  renderSaveLoadSection();

  // Wire floating save button (top-right corner)
  const floatingBtn = document.getElementById('btn-save-floating');
  if (floatingBtn) {
    floatingBtn.addEventListener('click', handleSave);
  }

  // Wire generate button
  const generateBtn = document.getElementById('btn-generate');
  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerate);
  }

  subscribe((state, ui) => {
    renderInputs(state);
    renderObstacleToolbar(ui);
    renderObstacleProperties(state, ui);
    renderBudgetPanel(state);
    renderSolverErrors(state);
    renderDebug(state);
  });
}

/* ── Generate Proposal (Solver) ──────────────── */

async function handleGenerate() {
  const btn = document.getElementById('btn-generate');
  const icon = btn.querySelector('.generate-icon');
  const text = btn.querySelector('.generate-text');
  const spinner = btn.querySelector('.generate-spinner');

  // Show loading state
  btn.classList.add('loading');
  icon.classList.add('hidden');
  spinner.classList.remove('hidden');
  text.textContent = 'Generando...';
  btn.disabled = true;

  setSolverRunning(true);

  // Simulate 1s AI "thinking"
  await new Promise(r => setTimeout(r, 1000));

  const state = getState();

  // Run solver
  const { placed_modules, errors } = generateLayout(state);

  // Calculate budget
  const budget = calculateBudget(placed_modules);

  // Update state
  setPlacedModules(placed_modules);
  setBudget(budget);
  setSolverErrors(errors);

  // Restore button
  btn.classList.remove('loading');
  icon.classList.remove('hidden');
  spinner.classList.add('hidden');
  text.textContent = 'GENERAR PROPUESTA';
  btn.disabled = false;

  setSolverRunning(false);

  // Show/hide budget panel
  const budgetPanel = document.getElementById('budget-panel');
  if (budgetPanel) {
    if (placed_modules.length > 0) {
      budgetPanel.classList.remove('hidden');
    } else {
      budgetPanel.classList.add('hidden');
    }
  }

  // Show toast feedback
  const toast = document.getElementById('save-toast');
  if (errors.length > 0) {
    showToast(toast, `⚠️ ${errors.length} conflicto(s) detectado(s)`, 'error');
  } else if (placed_modules.length > 0) {
    showToast(toast, `✓ ${placed_modules.length} módulos colocados — ${budget.totalPrice.toFixed(0)}€`, 'success');
  }
}

/* ── Budget Panel Rendering ──────────────────── */

function renderBudgetPanel(state) {
  const budget = state.budget;
  const totalEl = document.getElementById('budget-total');
  const bodyEl = document.getElementById('budget-body');
  const panelEl = document.getElementById('budget-panel');
  if (!totalEl || !bodyEl || !panelEl) return;

  if (!budget || budget.totalPrice === 0) {
    panelEl.classList.add('hidden');
    return;
  }

  panelEl.classList.remove('hidden');
  totalEl.textContent = `${budget.totalPrice.toFixed(2)} €`;

  let html = '';

  // ── Modules table ──────────────
  html += `
    <div class="budget-section">
      <div class="budget-section-title">Módulos</div>
      <table class="budget-table">
        <thead>
          <tr><th>Cant.</th><th>Ref</th><th>Descripción</th><th>Precio</th></tr>
        </thead>
        <tbody>
          ${budget.moduleLines.map(l => `
            <tr>
              <td class="budget-qty">${l.qty}</td>
              <td class="budget-ref">${l.ref}</td>
              <td>${l.label}</td>
              <td class="budget-price">${l.total.toFixed(2)}€</td>
            </tr>
          `).join('')}
          <tr class="budget-subtotal">
            <td colspan="3">Subtotal Módulos</td>
            <td class="budget-price">${budget.modulesTotal.toFixed(2)}€</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // ── Hardware table ──────────────
  html += `
    <div class="budget-section">
      <div class="budget-section-title">Herrajes</div>
      <table class="budget-table">
        <tbody>
          ${budget.hardwareLines.map(l => `
            <tr>
              <td class="budget-qty">${l.qty}</td>
              <td class="budget-ref">${l.ref}</td>
              <td>${l.label}</td>
              <td class="budget-price">${l.total.toFixed(2)}€</td>
            </tr>
          `).join('')}
          <tr class="budget-subtotal">
            <td colspan="3">Subtotal Herrajes</td>
            <td class="budget-price">${budget.hardwareTotal.toFixed(2)}€</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // ── Lineals table ──────────────
  html += `
    <div class="budget-section">
      <div class="budget-section-title">Lineales</div>
      <table class="budget-table">
        <tbody>
          ${budget.linealLines.map(l => `
            <tr>
              <td class="budget-qty">${l.qty}</td>
              <td class="budget-ref">${l.ref}</td>
              <td>${l.label}</td>
              <td class="budget-price">${l.total.toFixed(2)}€</td>
            </tr>
          `).join('')}
          <tr class="budget-subtotal">
            <td colspan="3">Subtotal Lineales</td>
            <td class="budget-price">${budget.linealTotal.toFixed(2)}€</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  bodyEl.innerHTML = html;
}

/* ── Solver Errors ───────────────────────────── */

function renderSolverErrors(state) {
  const container = document.getElementById('solver-errors');
  if (!container) return;

  if (!state.solverErrors || state.solverErrors.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.solverErrors.map(err => `
    <div class="solver-error">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      ${err}
    </div>
  `).join('');
}

/* ── Geometry Selector ──────────────────────── */

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
      ${SHAPE_ICONS[shape]}
      <span class="geo-label">${SHAPE_LABELS[shape]}</span>
      ${isDisabled ? '<span class="coming-soon">Pronto</span>' : ''}
    `;

    if (!isDisabled) {
      btn.addEventListener('click', () => {
        setShape(shape);
        renderGeometrySelector();
      });
    }

    container.appendChild(btn);
  });
}

/* ── Parametric Inputs ──────────────────────── */

function renderInputs(state) {
  const container = document.getElementById('inputs-container');
  const currentShape = container.dataset.currentShape;
  if (currentShape === state.shape) {
    updateInputValues(state);
    return;
  }
  container.dataset.currentShape = state.shape;
  container.innerHTML = '';

  container.appendChild(
    createInputGroup('wall-A', 'Largo Pared A', state.walls.find(w => w.id === 'wall-A')?.length || 3000)
  );

  if (state.shape === SHAPES.L_SHAPED || state.shape === SHAPES.U_SHAPED) {
    container.appendChild(createDivider());
    container.appendChild(
      createInputGroup('wall-B', 'Largo Pared B', state.walls.find(w => w.id === 'wall-B')?.length || 2000)
    );
  }

  if (state.shape === SHAPES.U_SHAPED) {
    container.appendChild(createDivider());
    container.appendChild(
      createInputGroup('wall-C', 'Largo Pared C', state.walls.find(w => w.id === 'wall-C')?.length || 3000)
    );
  }

  container.appendChild(createDivider());
  container.appendChild(
    createInputGroup('ceiling', 'Altura Techo', state.ceilingHeight, true)
  );
}

function updateInputValues(state) {
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
      <input type="number" id="input-${id}" class="input-field"
        value="${defaultValue}" min="100" max="20000" step="50" placeholder="mm" />
      <span class="input-suffix">mm</span>
    </div>
  `;

  const input = group.querySelector('input');
  input.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!val || val <= 0) return;
    if (isCeiling) setCeilingHeight(val);
    else setWallLength(id, val);
  });

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

/* ── Obstacle Toolbar ────────────────────────── */

function renderObstacleToolbar(ui) {
  const container = document.getElementById('obstacles-toolbar');
  if (!container) return;

  const currentUI = ui || getUIState();

  container.innerHTML = `
    <div class="toolbar-grid">
      ${OBSTACLE_TOOL_DEFS.map(tool => {
    const isActive = currentUI.activeTool === tool.type;
    return `
          <button class="tool-btn ${isActive ? 'active' : ''}" data-tool="${tool.type}"
                  title="${tool.label}" style="--tool-color: ${tool.color}">
            <span class="tool-emoji">${tool.emoji}</span>
            <span class="tool-label">${tool.label}</span>
          </button>
        `;
  }).join('')}
    </div>
    ${currentUI.activeTool
      ? `<div class="toolbar-hint">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
           Haz clic en una pared para colocar
         </div>`
      : `<div class="toolbar-hint muted">Selecciona herramienta y haz clic en la pared</div>`
    }
  `;

  // Wire click handlers
  container.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTool(btn.dataset.tool);
    });
  });
}

/* ── Obstacle Properties Editor ──────────────── */

function renderObstacleProperties(state, ui) {
  const container = document.getElementById('obstacle-properties');
  const section = document.getElementById('obstacle-properties-section');
  if (!container || !section) return;

  if (!ui.selectedObstacleId) {
    container.innerHTML = '';
    section.classList.add('hidden');
    return;
  }

  // Find the obstacle
  let selectedObs = null;
  let parentWall = null;
  for (const wall of state.walls) {
    const obs = (wall.obstacles || []).find(o => o.id === ui.selectedObstacleId);
    if (obs) {
      selectedObs = obs;
      parentWall = wall;
      break;
    }
  }

  if (!selectedObs) {
    container.innerHTML = '';
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  const typeLabel = OBSTACLE_TYPE_LABELS[selectedObs.type] || selectedObs.type;
  const showWidth = selectedObs.type !== 'water_point' && selectedObs.type !== 'smoke_outlet';

  container.innerHTML = `
    <div class="props-header">
      <span class="props-type">${typeLabel}</span>
      <span class="props-wall">en ${parentWall.id === 'wall-A' ? 'Pared A' : parentWall.id === 'wall-B' ? 'Pared B' : 'Pared C'}</span>
    </div>

    <div class="input-group">
      <label class="input-label" for="obs-position">
        <span class="wall-indicator" style="background:#06b6d4"></span>
        Posición X
      </label>
      <div class="input-wrapper">
        <input type="number" id="obs-position" class="input-field"
          value="${selectedObs.position}" min="0" max="${parentWall.length}" step="10" />
        <span class="input-suffix">mm</span>
      </div>
    </div>

    ${showWidth ? `
    <div class="input-group">
      <label class="input-label" for="obs-width">
        <span class="wall-indicator" style="background:#f59e0b"></span>
        Ancho
      </label>
      <div class="input-wrapper">
        <input type="number" id="obs-width" class="input-field"
          value="${selectedObs.width}" min="50" max="${parentWall.length}" step="10" />
        <span class="input-suffix">mm</span>
      </div>
    </div>
    ` : ''}

    <button id="btn-delete-obstacle" class="sl-btn sl-btn-danger">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      Eliminar
    </button>
  `;

  // Wire inputs
  const posInput = document.getElementById('obs-position');
  if (posInput) {
    posInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val >= 0) updateObstacle(selectedObs.id, { position: val });
    });
  }

  const widInput = document.getElementById('obs-width');
  if (widInput) {
    widInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) updateObstacle(selectedObs.id, { width: val });
    });
  }

  document.getElementById('btn-delete-obstacle').addEventListener('click', () => {
    removeObstacle(selectedObs.id);
  });
}

/* ── Save / Load Section ─────────────────────── */

function renderSaveLoadSection() {
  const container = document.getElementById('save-load-container');
  if (!container) return;
  container.innerHTML = '';

  const nameGroup = document.createElement('div');
  nameGroup.className = 'input-group';
  nameGroup.innerHTML = `
    <label class="input-label" for="input-design-name">
      <span class="wall-indicator" style="background:#64748b"></span>
      Nombre del Diseño
    </label>
    <div class="input-wrapper">
      <input type="text" id="input-design-name" class="input-field"
        value="${currentDesignName}" placeholder="Mi Cocina"
        style="font-family:var(--font-sans); padding-right:14px;" />
    </div>
  `;
  nameGroup.querySelector('input').addEventListener('input', (e) => {
    currentDesignName = e.target.value || 'Mi Cocina';
  });
  container.appendChild(nameGroup);

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

  const status = document.createElement('div');
  status.id = 'save-status';
  status.className = 'save-status';
  container.appendChild(status);

  const listWrap = document.createElement('div');
  listWrap.id = 'designs-list';
  listWrap.className = 'designs-list hidden';
  container.appendChild(listWrap);

  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-load-list').addEventListener('click', handleToggleList);
  document.getElementById('btn-new').addEventListener('click', handleNew);
}

async function handleSave() {
  const statusEl = document.getElementById('save-status');
  const floatingBtn = document.getElementById('btn-save-floating');
  const toast = document.getElementById('save-toast');

  // Visual feedback
  if (statusEl) {
    statusEl.textContent = 'Guardando...';
    statusEl.className = 'save-status saving';
  }
  if (floatingBtn) floatingBtn.classList.add('saving');

  const state = getState();
  const { data, error } = await saveDesign(state, currentDesignId, currentDesignName);

  if (floatingBtn) floatingBtn.classList.remove('saving');

  if (error) {
    if (statusEl) {
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'save-status error';
    }
    showToast(toast, `Error: ${error.message}`, 'error');
  } else {
    currentDesignId = data.id;
    if (statusEl) {
      statusEl.textContent = '✓ Guardado';
      statusEl.className = 'save-status success';
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 2500);
    }
    showToast(toast, '✓ Proyecto guardado en Supabase', 'success');
  }
}

function showToast(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `save-toast ${type} show`;
  setTimeout(() => { el.className = 'save-toast'; }, 3000);
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
        <span class="design-name">${d.name || 'Sin nombre'}</span>
        <span class="design-date">${new Date(d.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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

  listEl.querySelectorAll('.design-load').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await handleLoadDesign(e.currentTarget.dataset.id);
      listEl.classList.add('hidden');
    });
  });

  listEl.querySelectorAll('.design-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      await deleteDesign(id);
      if (currentDesignId === id) currentDesignId = null;
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

  currentDesignId = data.id;
  currentDesignName = data.name;
  const nameInput = document.getElementById('input-design-name');
  if (nameInput) nameInput.value = data.name;

  const container = document.getElementById('inputs-container');
  container.dataset.currentShape = '';

  update(data.room_data);
  renderGeometrySelector();

  statusEl.textContent = `✓ "${data.name}" cargado`;
  statusEl.className = 'save-status success';
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 2500);
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
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 1500);
}

/* ── Debug Panel ─────────────────────────────── */

function renderDebug(state) {
  const el = document.getElementById('state-debug');
  if (el) el.textContent = JSON.stringify(state, null, 2);
}
