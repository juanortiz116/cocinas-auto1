/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Main Entry Point
   Phase 1: Spatial Engine & 2D Viewer
   ═══════════════════════════════════════════════ */

import './style.css';
import { subscribe, init as initState } from './state.js';
import { initCanvas, render } from './canvas.js';
import { initPanel } from './panel.js';

// Boot sequence
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize the canvas engine
  const canvasEl = document.getElementById('kitchen-canvas');
  initCanvas(canvasEl);

  // 2. Initialize the control panel
  initPanel();

  // 3. Wire state → canvas re-render
  subscribe((state) => {
    render(state);
  });

  // 4. Trigger initial render
  initState();

  console.log('🟢 Opspilot Kitchens — Phase 1 loaded');
});
