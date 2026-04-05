// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Entry Point
// ─────────────────────────────────────────────────────────────

import './styles.css';
import { Game } from './game.js';
import * as C from './config.js';

// Rotate YouTube sidebar video with real CDBS video links
function rotateYouTubeLink() {
  const videos = C.YOUTUBE_VIDEOS;
  if (!videos || videos.length === 0) return;
  const video = videos[Math.floor(Math.random() * videos.length)];
  const link = document.getElementById('yt-link');
  const title = document.getElementById('yt-title');
  if (link) link.href = `https://www.youtube.com/watch?v=${video.id}&list=${C.YOUTUBE_PLAYLIST}`;
  if (title) title.textContent = video.title;
}

// Update memorization count in sidebar
function updateMemorizationDisplay(game) {
  const el = document.getElementById('memorized-count');
  if (!el || !game.memorization) return;
  try {
    const stats = game.memorization.getMasteryStats();
    el.textContent = stats.memorized || '0';
  } catch { el.textContent = '0'; }
}

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
    const sidebar = document.getElementById('sidebar');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sidebarW = 56;
    const availW = vw - sidebarW;
    const targetRatio = 960 / 720;
    const windowRatio = availW / vh;

    if (windowRatio > targetRatio) {
      const h = Math.min(vh, 720);
      container.style.height = h + 'px';
      container.style.width = (h * targetRatio) + 'px';
      sidebar.style.height = h + 'px';
    } else {
      const w = Math.min(availW, 960);
      container.style.width = w + 'px';
      container.style.height = (w / targetRatio) + 'px';
      sidebar.style.height = (w / targetRatio) + 'px';
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // Start game
  const game = new Game(canvas);

  // Setup sidebar
  rotateYouTubeLink();
  setInterval(rotateYouTubeLink, 30000); // rotate every 30s
  setInterval(() => updateMemorizationDisplay(game), 5000);

  // Expose for debugging
  if (import.meta.env.DEV) {
    window.__game = game;
  }
});
