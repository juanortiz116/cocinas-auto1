/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — Main Entry Point
   Phase 2: Obstacles & Persistence
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

  // 3. Wire state → canvas re-render (now includes UI state)
  subscribe((state, ui) => {
    render(state, ui);
  });

  // 4. Trigger initial render
  initState();

  console.log('🟢 Opspilot Kitchens — Phase 2 loaded');
});
