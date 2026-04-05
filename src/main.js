// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Entry Point
// ─────────────────────────────────────────────────────────────

import './styles.css';
import { Game } from './game.js';

// Wait for fonts to load before starting
document.fonts.ready.then(() => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Handle responsive sizing
  function resize() {
    const container = document.getElementById('game-container');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetRatio = 960 / 720;
    const windowRatio = vw / vh;

    if (windowRatio > targetRatio) {
      container.style.height = vh + 'px';
      container.style.width = (vh * targetRatio) + 'px';
    } else {
      container.style.width = vw + 'px';
      container.style.height = (vw / targetRatio) + 'px';
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // Start game
  const game = new Game(canvas);

  // Expose for debugging
  if (import.meta.env.DEV) {
    window.__game = game;
  }
});
