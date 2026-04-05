// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Entry Point
// ─────────────────────────────────────────────────────────────

import './styles.css';
import { Game } from './game.js';
import * as C from './config.js';
import youtubeVideos from './data/youtube.json';

// Show a RELATED YouTube video in sidebar based on current verse
function showRelatedVideo(game) {
  const link = document.getElementById('yt-link');
  const title = document.getElementById('yt-title');
  if (!link || !youtubeVideos || youtubeVideos.length === 0) return;

  let video = null;

  // Try to find a video related to the current verse
  if (game && game.currentVerse) {
    const ref = game.currentVerse.ref.toLowerCase();
    // Extract book name from reference
    const bookMatch = ref.match(/^(\d?\s*[a-z]+)/);
    const book = bookMatch ? bookMatch[1].replace(/\s/g, '') : '';

    // Search for videos matching the same book
    const related = youtubeVideos.filter(v => {
      const vTitle = v.title.toLowerCase();
      const vPassage = (v.passage || '').toLowerCase().replace(/\s/g, '');
      // Exact passage match first
      if (vPassage && ref.replace(/\s/g, '').includes(vPassage.split(':')[0])) return true;
      // Book match
      if (book && vTitle.includes(book)) return true;
      return false;
    });

    if (related.length > 0) {
      video = related[Math.floor(Math.random() * related.length)];
    }
  }

  // Fallback: pick a random video
  if (!video) {
    video = youtubeVideos[Math.floor(Math.random() * youtubeVideos.length)];
  }

  link.href = `https://www.youtube.com/watch?v=${video.id}&list=${C.YOUTUBE_PLAYLIST}`;
  title.textContent = video.title;
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

  // Setup sidebar with related video
  showRelatedVideo(game);
  setInterval(() => showRelatedVideo(game), 20000); // rotate every 20s
  setInterval(() => updateMemorizationDisplay(game), 5000);

  // Expose for debugging
  if (import.meta.env.DEV) {
    window.__game = game;
  }
});
