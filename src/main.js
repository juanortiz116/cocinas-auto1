/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Main Entry Point
   Phase 4: 3D Visualization Integration
   ═══════════════════════════════════════════════ */

import './style.css';
import { subscribe, init as initState, getState } from './state.js';
import { initCanvas, render } from './canvas.js';
import { initPanel } from './panel.js';
import { init3D, render3D } from './view3d.js';

let is3DMode = false;

// Boot sequence
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize the canvas engine (2D)
  const canvasEl = document.getElementById('kitchen-canvas');
  initCanvas(canvasEl);

  // 2. Initialize the control panel
  initPanel();

  // 3. Initialize 3D engine (hidden initially)
  const view3dEl = document.getElementById('view-3d');
  init3D(view3dEl);

  // 4. Wire state → Re-render
  subscribe((state, ui) => {
    // Always render 2D (it's cheap and state might change)
    render(state, ui);

    // Render 3D if active (or always to keep it sync? Always is safer for now)
    render3D(state);
  });

  // 5. Wire View Toggles
  const btn2D = document.getElementById('btn-2d');
  const btn3D = document.getElementById('btn-3d');
  const canvasContainer = document.getElementById('kitchen-canvas'); // Actually it's canvas element, parent has no ID but section is #kitchen-viewer

  if (btn2D && btn3D) {
    btn2D.addEventListener('click', () => setViewMode(false));
    btn3D.addEventListener('click', () => setViewMode(true));
  }

  function setViewMode(is3D) {
    is3DMode = is3D;

    // Toggle Buttons
    btn2D.classList.toggle('active', !is3D);
    btn3D.classList.toggle('active', is3D);

    // Toggle Visibility
    // We toggle the canvas visibility and the 3D view visibility
    // canvasEl is the 2D canvas. view3dEl is the 3D container.
    if (is3D) {
      canvasEl.style.display = 'none';
      view3dEl.classList.remove('hidden');
      // Trigger a render to ensure size is correct
      render3D(getState());
    } else {
      canvasEl.style.display = 'block';
      view3dEl.classList.add('hidden');
    }
  }

  // 6. Trigger initial render
  initState();

  console.log('🟢 Opspilot Kitchens — Phase 4 (3D) loaded');
});
