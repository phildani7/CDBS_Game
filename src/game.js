// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Main Game Engine
//  A futuristic Bible verse breakout game
// ─────────────────────────────────────────────────────────────

import * as C from './config.js';
import { AudioManager } from './audio.js';
import versesData from './data/verses.json';

// ── Optional module imports (loaded asynchronously) ──────────

let shareModule = null;
let MemorizationTracker = null;

import('./share.js').then(m => { shareModule = m; }).catch(() => {});
import('./memorization.js').then(m => { MemorizationTracker = m.MemorizationTracker; }).catch(() => {});

// ── Utility helpers ───────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const easeOutBack = t => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── roundRect polyfill ────────────────────────────────────────

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = typeof r === 'number' ? r : (r?.[0] ?? 0);
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.arcTo(x + w, y, x + w, y + radius, radius);
    this.lineTo(x + w, y + h - radius);
    this.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    this.lineTo(x + radius, y + h);
    this.arcTo(x, y + h, x, y + h - radius, radius);
    this.lineTo(x, y + radius);
    this.arcTo(x, y, x + radius, y, radius);
    this.closePath();
  };
}

// ── Text measurement cache ────────────────────────────────────

const measureCache = new Map();
function measureText(ctx, text, font) {
  const key = `${font}|${text}`;
  if (measureCache.has(key)) return measureCache.get(key);
  ctx.font = font;
  const m = ctx.measureText(text);
  const result = {
    width: m.width,
    height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent
  };
  measureCache.set(key, result);
  return result;
}

// ── Main Game Class ───────────────────────────────────────────

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Size canvas
    canvas.width = C.CANVAS_W * this.dpr;
    canvas.height = C.CANVAS_H * this.dpr;
    canvas.style.width = C.CANVAS_W + 'px';
    canvas.style.height = C.CANVAS_H + 'px';
    this.ctx.scale(this.dpr, this.dpr);

    // Audio
    this.audio = new AudioManager();

    // Persistent stats (localStorage)
    this.stats = this._loadStats();

    // Memorization tracker
    this.memorization = null;
    try {
      if (MemorizationTracker) {
        this.memorization = new MemorizationTracker();
      }
    } catch (_) { /* tracker not available */ }

    // Game state
    // States: opening | menu | serve | playing | transition | clearing
    //         | lesson_quiz | mini_game | gameover | share_screen
    this.state = 'opening';
    this.stateTime = 0;
    this.level = 1;
    this.score = 0;
    this.bestScore = this.stats.playerHighScore;
    this.lives = C.INITIAL_LIVES;
    this.currentVerse = null;
    this.usedVerseIndices = new Set();

    // Entities
    this.balls = [];
    this.paddle = null;
    this.bricks = [];
    this.powerups = [];
    this.particles = [];
    this.guard = null;

    // Effects
    this.shake = 0;
    this.bgGlyphs = [];
    this.wakeHoles = [];
    this.revealTimer = 0;
    this.comboCount = 0;
    this.comboCategory = null;
    this.lastCategory = null;
    this.flashAlpha = 0;
    this.flashColor = '#fff';

    // Heaven surface shimmer
    this.heavenShimmerT = 0;

    // Timed power-ups
    this.expandTimer = 0;
    this.slowTimer = 0;

    // Trinity ball reveal timer (spirit ball effect)
    this.trinityRevealTimer = 0;

    // Input
    this.pointerX = C.CANVAS_W / 2;
    this.pointerActive = false;
    this.keys = {};

    // Verse display
    this.revealedPhrases = [];
    this.verseDisplayY = 0;

    // Launch direction
    this.launchAngle = -Math.PI / 2;
    this.launchAngleSpeed = 1.8;

    // Intro animation
    this.introT = 0;
    this.brickFlyIn = [];

    // Lesson Quiz state (Feature #5)
    this.quizLessons = [];
    this.quizCurrent = 0;
    this.quizScore = 0;
    this.quizTimer = 0;
    this.quizFeedback = null;    // { text, color, timer }
    this.quizAnswered = false;

    // Mini-game state (Feature #8)
    this.miniGameType = '';
    this.miniPhrases = [];
    this.miniSelected = [];
    this.miniComplete = false;
    this.miniTimer = 0;
    this.miniScore = 0;
    this.miniCorrectOrder = [];
    this.miniFeedback = null;
    // missing_word sub-state
    this.miniBlankIndices = [];
    this.miniWordBank = [];
    this.miniFilledBlanks = [];

    // Share screen state (Feature #14)
    this.shareClipboardFeedback = 0;

    // YouTube sidebar (Feature #13)
    this.youtubeVideoIndex = Math.floor(Math.random() * C.YOUTUBE_VIDEOS.length);
    this.youtubeSidebarRect = { x: C.CANVAS_W - 45, y: C.HUD_HEIGHT + 5, w: 40, h: C.PLAY_RECT.h - 10 };

    // Bind
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._loop = this._loop.bind(this);

    this._setupInput();
    this._initBgGlyphs();
    this._lastTime = performance.now();

    requestAnimationFrame(this._loop);
  }

  // ── Canvas position helpers ─────────────────────────────────

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * C.CANVAS_W,
      y: (e.clientY - rect.top) / rect.height * C.CANVAS_H
    };
  }

  _isInRect(pos, x, y, w, h) {
    return pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h;
  }

  // ── Persistent Stats ───────────────────────────────────────

  _loadStats() {
    try {
      const global = JSON.parse(localStorage.getItem('sb_global') || '{}');
      const player = JSON.parse(localStorage.getItem('sb_player') || '{}');
      return {
        globalVersesPlayed: global.versesPlayed || 0,
        globalHighScore: global.highScore || 0,
        playerVersesPlayed: player.versesPlayed || 0,
        playerHighScore: player.highScore || 0
      };
    } catch {
      return { globalVersesPlayed: 0, globalHighScore: 0, playerVersesPlayed: 0, playerHighScore: 0 };
    }
  }

  _saveStats() {
    try {
      localStorage.setItem('sb_global', JSON.stringify({
        versesPlayed: this.stats.globalVersesPlayed,
        highScore: this.stats.globalHighScore
      }));
      localStorage.setItem('sb_player', JSON.stringify({
        versesPlayed: this.stats.playerVersesPlayed,
        highScore: this.stats.playerHighScore
      }));
    } catch { /* storage full or unavailable */ }
  }

  _recordVersePlayed() {
    this.stats.globalVersesPlayed++;
    this.stats.playerVersesPlayed++;
    this._saveStats();
  }

  _recordScore(score) {
    if (score > this.stats.playerHighScore) {
      this.stats.playerHighScore = score;
    }
    if (score > this.stats.globalHighScore) {
      this.stats.globalHighScore = score;
    }
    this._saveStats();
  }

  // ── Input ─────────────────────────────────────────────────

  _setupInput() {
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  _onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = (e.clientX - rect.left) / rect.width * C.CANVAS_W;
    this.pointerActive = true;
  }

  _onPointerDown(e) {
    this.audio.init();
    this.audio.resume();
    this._onPointerMove(e);

    const pos = this._getCanvasPos(e);

    // ── YouTube sidebar click ───────────────────
    if (this.state === 'serve' || this.state === 'playing') {
      const yt = this.youtubeSidebarRect;
      if (this._isInRect(pos, yt.x, yt.y, yt.w, yt.h)) {
        const video = C.YOUTUBE_VIDEOS[this.youtubeVideoIndex];
        if (video) {
          window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
        }
        return;
      }
    }

    // ── State-specific click handling ───────────
    if (this.state === 'opening' || this.state === 'menu') {
      this._startGame();
    } else if (this.state === 'serve') {
      this._launchBall();
    } else if (this.state === 'gameover') {
      this._onGameOverClick(pos);
    } else if (this.state === 'share_screen') {
      this._onShareScreenClick(pos);
    } else if (this.state === 'lesson_quiz') {
      this._onQuizClick(pos);
    } else if (this.state === 'mini_game') {
      this._onMiniGameClick(pos);
    }
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    this.audio.init();
    this.audio.resume();

    if (e.code === 'KeyM') this.audio.toggleMute();

    if (e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'Space') {
      if (this.state === 'opening' || this.state === 'menu') this._startGame();
      else if (this.state === 'serve') this._launchBall();
      else if (this.state === 'gameover') this._restart();
      else if (this.state === 'share_screen') this._restart();
    }

    if (e.code === 'KeyR' && (this.state === 'gameover' || this.state === 'share_screen')) {
      this._restart();
    }

    // Keyboard controls for quiz (1, 2, 3 keys)
    if (this.state === 'lesson_quiz' && !this.quizAnswered) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') this._answerQuiz(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') this._answerQuiz(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') this._answerQuiz(2);
    }

    // Keyboard controls for mini-game (number keys select phrases)
    if (this.state === 'mini_game' && !this.miniComplete) {
      if (this.miniGameType === 'reassemble') {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= this.miniPhrases.length) {
          this._selectMiniPhrase(num - 1);
        }
      }
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  // ── Background glyphs ────────────────────────────────────

  _initBgGlyphs() {
    this.bgGlyphs = [];
    for (let i = 0; i < C.BG_GLYPH_COUNT; i++) {
      this.bgGlyphs.push({
        char: pick(C.BG_GLYPHS),
        x: rand(0, C.CANVAS_W),
        y: rand(0, C.CANVAS_H),
        speed: rand(C.BG_SPEED[0], C.BG_SPEED[1]),
        alpha: rand(0.04, C.BG_ALPHA),
        size: rand(10, 18)
      });
    }
  }

  // ── Game lifecycle ────────────────────────────────────────

  _startGame() {
    this.state = 'serve';
    this.stateTime = 0;
    this.level = 1;
    this.score = 0;
    this.lives = C.INITIAL_LIVES;
    this.usedVerseIndices.clear();
    this._buildLevel();
    this.audio.playMenuSelect();
    this.audio.startMusic('serve');
  }

  _restart() {
    if (this.score > this.bestScore) this.bestScore = this.score;
    this._startGame();
  }

  _buildLevel() {
    // Select verse based on level difficulty
    const [minDiff, maxDiff] = C.DIFFICULTY_PER_LEVEL[Math.min(this.level - 1, C.DIFFICULTY_PER_LEVEL.length - 1)];
    const candidates = versesData.verses
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => v.difficulty >= minDiff && v.difficulty <= maxDiff && !this.usedVerseIndices.has(i));

    let chosen;
    if (candidates.length > 0) {
      const c = pick(candidates);
      chosen = c.v;
      this.usedVerseIndices.add(c.i);
    } else {
      // Fallback: pick any unused verse
      const unused = versesData.verses
        .map((v, i) => ({ v, i }))
        .filter(({ i }) => !this.usedVerseIndices.has(i));
      if (unused.length > 0) {
        const c = pick(unused);
        chosen = c.v;
        this.usedVerseIndices.add(c.i);
      } else {
        this.usedVerseIndices.clear();
        chosen = pick(versesData.verses);
      }
    }

    this.currentVerse = chosen;
    this.revealedPhrases = [];
    this.comboCount = 0;
    this.comboCategory = null;

    // Memorization tracking
    if (this.memorization && this.currentVerse) {
      try {
        this.memorization.recordVersePlayed(
          this.currentVerse.ref,
          this.currentVerse.text,
          this.currentVerse.phrases
        );
      } catch (_) { /* memorization not available */ }
    }

    // Check if we should run a memory test (blanked bricks)
    this._memoryTestData = null;
    if (this.memorization && this.currentVerse) {
      try {
        if (this.memorization.shouldTestMemory(this.currentVerse.ref)) {
          this._memoryTestData = this.memorization.generateMemoryTest(this.currentVerse.ref);
        }
      } catch (_) { /* memorization not available */ }
    }

    // Create paddle
    this.paddle = {
      x: C.CANVAS_W / 2,
      y: C.PLAY_RECT.y + C.PLAY_RECT.h - C.PADDLE_Y_OFFSET,
      text: C.PADDLE_TEXT,
      width: 0,
      height: 0
    };
    this._measurePaddle();

    // Create bricks from verse phrases
    this._layoutBricks();

    // Reset balls
    this.balls = [];
    this._createBall(true);

    // Clear entities
    this.powerups = [];
    this.particles = [];
    this.guard = null;
    this.wakeHoles = [];
    this.expandTimer = 0;
    this.slowTimer = 0;
    this.trinityRevealTimer = 0;

    // Track verse played
    this._recordVersePlayed();

    // Pick a new YouTube video for this level
    this.youtubeVideoIndex = Math.floor(Math.random() * C.YOUTUBE_VIDEOS.length);

    // Trigger intro animation
    this.state = 'transition';
    this.stateTime = 0;
    this.introT = 0;
    this._setupBrickFlyIn();
  }

  _measurePaddle() {
    const m = measureText(this.ctx, this.paddle.text, C.FONT.paddle);
    this.paddle.width = m.width;
    this.paddle.height = m.height;
  }

  _createBall(attached = false, trinityType = null) {
    const trinityInfo = trinityType ? C.TRINITY_BALLS[trinityType] : null;
    const ball = {
      x: this.paddle ? this.paddle.x : C.CANVAS_W / 2,
      y: this.paddle ? this.paddle.y - 20 : C.CANVAS_H - 120,
      vx: 0,
      vy: 0,
      speed: C.BALL_BASE_SPEED + (this.level - 1) * C.BALL_SPEED_PER_LEVEL,
      radius: 10,
      attached,
      char: trinityInfo ? trinityInfo.char : C.BALL_CHAR,
      trinityType: trinityType || null
    };
    const charToMeasure = trinityInfo ? trinityInfo.char : C.BALL_CHAR;
    const m = measureText(this.ctx, charToMeasure, C.FONT.ball);
    ball.radius = clamp(m.width * 0.45, C.BALL_RADIUS_MIN, C.BALL_RADIUS_MAX);
    this.balls.push(ball);
    return ball;
  }

  _layoutBricks() {
    const phrases = this.currentVerse.phrases;
    this.bricks = [];

    const regionLeft = C.PLAY_RECT.x + 20;
    const regionRight = C.PLAY_RECT.x + C.PLAY_RECT.w - 20;
    const regionWidth = regionRight - regionLeft;
    const regionTop = C.BRICK_REGION_TOP;

    // Check for memory test blanking
    const blankedSet = new Set();
    if (this._memoryTestData && this._memoryTestData.phrases) {
      this._memoryTestData.phrases.forEach((p, i) => {
        if (p.blanked) blankedSet.add(i);
      });
    }

    // Find best font size that fits all bricks
    let fontSize = 0;
    let brickData = [];

    for (const size of C.BRICK_FONT_SIZES) {
      const font = `600 ${size}px ${C.BRICK_FONT_FAMILY}`;
      const padX = size * C.BRICK_PADDING_X_RATIO;
      const padY = size * C.BRICK_PADDING_Y_RATIO;

      const measured = phrases.map((p, idx) => {
        const displayText = blankedSet.has(idx) ? '????' : p.t;
        const m = measureText(this.ctx, displayText, font);
        return {
          text: p.t,
          displayText,
          category: p.c,
          blanked: blankedSet.has(idx),
          phraseIndex: idx,
          mWidth: m.width + padX * 2,
          mHeight: m.height + padY * 2,
          textWidth: m.width,
          textHeight: m.height,
          ascent: m.ascent
        };
      });

      // Try to lay out in rows
      const rows = [];
      let currentRow = [];
      let rowWidth = 0;
      const gap = 8;

      for (const brick of measured) {
        if (rowWidth + brick.mWidth + (currentRow.length > 0 ? gap : 0) > regionWidth && currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [brick];
          rowWidth = brick.mWidth;
        } else {
          rowWidth += brick.mWidth + (currentRow.length > 0 ? gap : 0);
          currentRow.push(brick);
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      const rowHeight = measured[0].mHeight;
      const totalHeight = rows.length * (rowHeight + gap);

      if (totalHeight <= C.BRICK_REGION_HEIGHT) {
        fontSize = size;
        brickData = rows;
        break;
      }
    }

    if (!fontSize) {
      fontSize = C.BRICK_FONT_SIZES[C.BRICK_FONT_SIZES.length - 1];
    }

    const font = `600 ${fontSize}px ${C.BRICK_FONT_FAMILY}`;
    const padX = fontSize * C.BRICK_PADDING_X_RATIO;
    const padY = fontSize * C.BRICK_PADDING_Y_RATIO;
    const gap = 8;

    // Position bricks
    let y = regionTop;
    for (const row of brickData) {
      const totalRowWidth = row.reduce((sum, b) => sum + b.mWidth, 0) + (row.length - 1) * gap;
      let x = regionLeft + (regionWidth - totalRowWidth) / 2;

      for (const brick of row) {
        const color = C.COLORS[brick.category] || C.COLORS.other;
        const glow = C.COLORS[brick.category + 'Glow'] || C.COLORS.otherGlow;
        const score = C.SCORE[brick.category] || C.SCORE.other;
        const wordCount = brick.text.split(/\s+/).length;

        this.bricks.push({
          x: x + brick.mWidth / 2,
          y: y + brick.mHeight / 2,
          targetX: x + brick.mWidth / 2,
          targetY: y + brick.mHeight / 2,
          w: brick.mWidth,
          h: brick.mHeight,
          text: brick.text,
          displayText: brick.displayText,
          blanked: brick.blanked,
          font,
          category: brick.category,
          color,
          glow,
          score: score * wordCount,
          alive: true,
          alpha: 1,
          textWidth: brick.textWidth,
          ascent: brick.ascent,
          padX,
          padY,
          // Fly-in animation
          flyX: 0,
          flyY: 0,
          flyProgress: 0
        });

        x += brick.mWidth + gap;
      }
      y += (row.length > 0 ? row[0].mHeight : 30) + gap;
    }
  }

  _setupBrickFlyIn() {
    const cx = C.CANVAS_W / 2;
    const cy = C.CANVAS_H / 2;
    this.bricks.forEach((brick, i) => {
      const angle = (i / this.bricks.length) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 500 + Math.random() * 300;
      brick.flyX = cx + Math.cos(angle) * dist;
      brick.flyY = cy + Math.sin(angle) * dist;
      brick.flyProgress = 0;
      brick.flyDelay = i * 0.06;
    });
  }

  _launchBall() {
    const ball = this.balls.find(b => b.attached);
    if (!ball) return;

    ball.attached = false;
    // Use the selected launch angle
    ball.vx = Math.cos(this.launchAngle) * ball.speed;
    ball.vy = Math.sin(this.launchAngle) * ball.speed;

    this.state = 'playing';
    this.stateTime = 0;
    this.audio.playLaunch();
    this.audio.startMusic('playing');

    // Reset angle for next serve
    this.launchAngle = -Math.PI / 2;
  }

  // ── Main loop ─────────────────────────────────────────────

  _loop(now) {
    const dt = Math.min((now - this._lastTime) / 1000, 1 / 20);
    this._lastTime = now;

    this.stateTime += dt;
    this._update(dt);
    this._render(dt);

    requestAnimationFrame(this._loop);
  }

  // ── Update ────────────────────────────────────────────────

  _update(dt) {
    // Background glyphs always animate
    this._updateBgGlyphs(dt);

    // Flash decay
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4);

    // Heaven shimmer always ticks
    this.heavenShimmerT += dt;

    switch (this.state) {
      case 'opening':
        if (this.stateTime > C.OPENING_DURATION) {
          this.state = 'menu';
          this.stateTime = 0;
        }
        break;

      case 'menu':
        break;

      case 'transition':
        this.introT += dt;
        // Animate bricks flying in
        this.bricks.forEach(brick => {
          const t = clamp((this.introT - brick.flyDelay) / 0.5, 0, 1);
          brick.flyProgress = easeOutBack(t);
        });
        if (this.introT >= C.INTRO_DURATION) {
          this.state = 'serve';
          this.stateTime = 0;
          this.bricks.forEach(b => b.flyProgress = 1);
          this.audio.startMusic('serve');
        }
        break;

      case 'serve':
        this._updatePaddle(dt);
        // Aim direction with left/right keys
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
          this.launchAngle = clamp(this.launchAngle - this.launchAngleSpeed * dt, -Math.PI * 0.85, -Math.PI * 0.15);
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
          this.launchAngle = clamp(this.launchAngle + this.launchAngleSpeed * dt, -Math.PI * 0.85, -Math.PI * 0.15);
        }
        // Aim with mouse position relative to ball
        if (this.pointerActive && this.paddle) {
          const dx = this.pointerX - this.paddle.x;
          const targetAngle = clamp(Math.atan2(-1, dx * 0.01), -Math.PI * 0.85, -Math.PI * 0.15);
          this.launchAngle = lerp(this.launchAngle, targetAngle, dt * 6);
        }
        // Attached ball follows paddle
        this.balls.forEach(ball => {
          if (ball.attached) {
            ball.x = this.paddle.x;
            ball.y = this.paddle.y - 20;
          }
        });
        break;

      case 'playing':
        this._updatePaddle(dt);
        this._updateBalls(dt);
        this._updatePowerups(dt);
        this._updateParticles(dt);
        this._updateTimers(dt);
        this._updateWakeHoles(dt);

        // Check win
        if (this.bricks.every(b => !b.alive)) {
          this._onLevelClear();
        }
        break;

      case 'clearing':
        this._updateParticles(dt);
        if (this.stateTime >= C.CLEAR_DURATION) {
          // Transition to lesson quiz instead of directly to next level
          this._startLessonQuiz();
        }
        break;

      case 'lesson_quiz':
        this._updateLessonQuiz(dt);
        break;

      case 'mini_game':
        this._updateMiniGame(dt);
        break;

      case 'gameover':
        this._updateParticles(dt);
        // After a brief delay, auto-transition to share screen
        if (this.stateTime >= 3.0) {
          this.state = 'share_screen';
          this.stateTime = 0;
        }
        break;

      case 'share_screen':
        this._updateParticles(dt);
        if (this.shareClipboardFeedback > 0) {
          this.shareClipboardFeedback -= dt;
        }
        break;
    }

    // Screen shake decay
    this.shake *= Math.max(0, 1 - C.SCREEN_SHAKE_DECAY * dt);
    if (this.shake < 0.1) this.shake = 0;
  }

  _updateBgGlyphs(dt) {
    this.bgGlyphs.forEach(g => {
      g.y += g.speed * dt;
      if (g.y > C.CANVAS_H + 20) {
        g.y = -20;
        g.x = rand(0, C.CANVAS_W);
      }
    });
  }

  _updatePaddle(dt) {
    if (this.pointerActive) {
      this.paddle.x = lerp(this.paddle.x, this.pointerX, dt * C.PADDLE_LERP);
    }
    // During serve, arrow keys aim the ball instead of moving paddle
    if (this.state !== 'serve') {
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
        this.paddle.x -= C.PADDLE_SPEED * dt;
        this.pointerActive = false;
      }
      if (this.keys['ArrowRight'] || this.keys['KeyD']) {
        this.paddle.x += C.PADDLE_SPEED * dt;
        this.pointerActive = false;
      }
    }

    // Clamp paddle to play area
    const halfW = this.paddle.width / 2;
    this.paddle.x = clamp(this.paddle.x, C.PLAY_RECT.x + halfW + 5, C.PLAY_RECT.x + C.PLAY_RECT.w - halfW - 5);
  }

  _updateBalls(dt) {
    const speed = this.slowTimer > 0 ? 0.74 : 1;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.attached) continue;

      ball.x += ball.vx * dt * speed;
      ball.y += ball.vy * dt * speed;

      // Wall collisions
      const left = C.PLAY_RECT.x + C.WALL_PAD;
      const right = C.PLAY_RECT.x + C.PLAY_RECT.w - C.WALL_PAD;
      const top = C.PLAY_RECT.y + C.WALL_PAD;

      if (ball.x - ball.radius < left) {
        ball.x = left + ball.radius;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.radius > right) {
        ball.x = right - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < top) {
        ball.y = top + ball.radius;
        ball.vy = Math.abs(ball.vy);
        // Heaven surface sparkle on top wall hit
        this._spawnHeavenSparkles(ball.x, top);
      }

      // Guard collision
      if (this.guard && ball.vy > 0) {
        const gy = this.guard.y;
        if (ball.y + ball.radius >= gy && ball.y - ball.radius < gy + 8) {
          if (ball.x >= this.guard.x - this.guard.width / 2 && ball.x <= this.guard.x + this.guard.width / 2) {
            ball.vy = -Math.abs(ball.vy);
            ball.y = gy - ball.radius;
            this.guard.charges--;
            this.shake = C.SHAKE.guardSave;
            this.audio.playGuardSave();
            this._spawnParticles(ball.x, gy, C.GUARD_COLOR, 6, '†');
            if (this.guard.charges <= 0) this.guard = null;
          }
        }
      }

      // Paddle collision
      if (ball.vy > 0) {
        const px = this.paddle.x;
        const py = this.paddle.y;
        const pw = this.paddle.width / 2;
        const ph = this.paddle.height / 2;

        if (ball.y + ball.radius >= py - ph &&
            ball.y - ball.radius < py + ph &&
            ball.x >= px - pw - ball.radius &&
            ball.x <= px + pw + ball.radius) {
          const impact = clamp((ball.x - px) / pw, -1, 1);
          const deadZone = 0.18;
          const adjusted = Math.abs(impact) < deadZone
            ? (impact >= 0 ? deadZone : -deadZone)
            : impact;

          const s = ball.speed;
          ball.vx = adjusted * s * 0.92;
          ball.vy = -Math.sqrt(s * s - ball.vx * ball.vx);
          ball.y = py - ph - ball.radius;

          this.shake = C.SHAKE.paddleHit;
          this.audio.playPaddleHit();
          this._spawnPaddleSparks();
        }
      }

      // Brick collisions
      this._checkBrickCollisions(ball);

      // Enforce minimum vertical velocity
      const minVy = ball.speed * C.BALL_MIN_VY_RATIO;
      if (Math.abs(ball.vy) < minVy) {
        ball.vy = ball.vy < 0 ? -minVy : minVy;
        const s = ball.speed;
        ball.vx = Math.sign(ball.vx) * Math.sqrt(Math.max(0, s * s - ball.vy * ball.vy));
      }

      // Ball trail particle
      if (Math.random() < C.BALL_TRAIL_CHANCE) {
        const trailColor = ball.trinityType
          ? C.TRINITY_BALLS[ball.trinityType].color
          : C.COLORS.ball;
        const trailChar = ball.trinityType ? pick(['✦', '·', '†']) : pick(['.', '·']);
        this.particles.push({
          x: ball.x, y: ball.y,
          vx: rand(-10, 10), vy: rand(5, 15),
          life: C.BALL_TRAIL_LIFE, maxLife: C.BALL_TRAIL_LIFE,
          char: trailChar,
          color: trailColor,
          size: 12, rotation: 0, rotSpeed: 0,
          affectsWall: false
        });
      }

      // Golden aura trail for trinity balls
      if (ball.trinityType && Math.random() < 0.6) {
        this.particles.push({
          x: ball.x + rand(-6, 6), y: ball.y + rand(-6, 6),
          vx: rand(-15, 15), vy: rand(-15, 15),
          life: 0.35, maxLife: 0.35,
          char: '·',
          color: C.COLORS.heavenGold,
          size: 8, rotation: 0, rotSpeed: 0,
          affectsWall: false
        });
      }

      // Wake holes
      if (this.wakeHoles.length === 0 || Math.hypot(ball.x - (this.wakeHoles[this.wakeHoles.length - 1]?.x || 0), ball.y - (this.wakeHoles[this.wakeHoles.length - 1]?.y || 0)) > 16) {
        this.wakeHoles.push({ x: ball.x, y: ball.y, life: C.WAKE_LIFE, radius: C.WAKE_RADIUS });
      }

      // Ball lost below play area
      if (ball.y > C.PLAY_RECT.y + C.PLAY_RECT.h + 20) {
        this.balls.splice(i, 1);
        if (this.balls.length === 0) {
          this._onBallLost();
        }
      }
    }
  }

  _checkBrickCollisions(ball) {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;

      const bx = brick.flyProgress < 1
        ? lerp(brick.flyX, brick.targetX, brick.flyProgress)
        : brick.x;
      const by = brick.flyProgress < 1
        ? lerp(brick.flyY, brick.targetY, brick.flyProgress)
        : brick.y;

      const halfW = brick.w / 2;
      const halfH = brick.h / 2;

      // AABB overlap
      if (ball.x + ball.radius > bx - halfW &&
          ball.x - ball.radius < bx + halfW &&
          ball.y + ball.radius > by - halfH &&
          ball.y - ball.radius < by + halfH) {

        // Resolve collision by smallest overlap
        const overlapLeft = (ball.x + ball.radius) - (bx - halfW);
        const overlapRight = (bx + halfW) - (ball.x - ball.radius);
        const overlapTop = (ball.y + ball.radius) - (by - halfH);
        const overlapBottom = (by + halfH) - (ball.y - ball.radius);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft) ball.vx = -Math.abs(ball.vx);
        else if (minOverlap === overlapRight) ball.vx = Math.abs(ball.vx);
        else if (minOverlap === overlapTop) ball.vy = -Math.abs(ball.vy);
        else ball.vy = Math.abs(ball.vy);

        this._destroyBrick(brick, ball);
        return; // One brick per frame
      }
    }
  }

  _destroyBrick(brick, ball) {
    brick.alive = false;

    // If brick was blanked (memory test), reveal the text
    if (brick.blanked) {
      brick.displayText = brick.text;
      brick.blanked = false;
    }

    // Score with combo multiplier
    let comboMult = 1;
    if (brick.category === this.lastCategory) {
      this.comboCount++;
      comboMult = 1 + this.comboCount * 0.25;
    } else {
      this.comboCount = 0;
    }
    this.lastCategory = brick.category;

    let points = Math.round(brick.score * comboMult);

    // ── Trinity ball effects ────────────────────
    if (ball && ball.trinityType) {
      switch (ball.trinityType) {
        case 'jesus':
          // GRACE: negate penalty on bad bricks
          if (brick.category === 'bad') {
            // Instead of losing points, gain +50
            points = 50;
            // Grace feedback particles
            this._spawnParticles(brick.x, brick.y, C.TRINITY_BALLS.jesus.color, 8, '✝');
            this.flashAlpha = 0.2;
            this.flashColor = C.TRINITY_BALLS.jesus.color;
          }
          break;

        case 'spirit':
          // REVEALS TRUTH: show full verse for 3 seconds
          this.trinityRevealTimer = 3;
          this._spawnParticles(brick.x, brick.y, C.TRINITY_BALLS.spirit.color, 8, '🕊');
          break;

        case 'father':
          // DOUBLE BLESSING: double points on gold/god bricks
          if (brick.category === 'god') {
            points *= 2;
            this._spawnParticles(brick.x, brick.y, C.TRINITY_BALLS.father.color, 10, '✦');
            this.flashAlpha = 0.2;
            this.flashColor = C.TRINITY_BALLS.father.color;
          }
          break;
      }
    }

    this.score += points;

    // Visual feedback based on category
    if (brick.category === 'bad' && !(ball && ball.trinityType === 'jesus')) {
      this.shake = C.SHAKE.badBrick;
      this.flashAlpha = 0.3;
      this.flashColor = C.COLORS.bad;
    } else if (brick.category === 'god') {
      this.shake = C.SHAKE.brickBreak;
      this.flashAlpha = 0.15;
      this.flashColor = C.COLORS.god;
    } else {
      this.shake = C.SHAKE.brickBreak;
    }

    // Track revealed phrases
    this.revealedPhrases.push({
      text: brick.text,
      category: brick.category,
      color: brick.color
    });

    // Particle burst - each letter flies out
    const letters = brick.text.split('');
    letters.forEach((char, i) => {
      if (char === ' ') return;
      const angle = (i / letters.length) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(C.BRICK_PARTICLE_SPEED[0], C.BRICK_PARTICLE_SPEED[1]);
      this.particles.push({
        x: brick.x + rand(-brick.w / 3, brick.w / 3),
        y: brick.y + rand(-brick.h / 3, brick.h / 3),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: rand(C.BRICK_PARTICLE_LIFE[0], C.BRICK_PARTICLE_LIFE[1]),
        maxLife: C.BRICK_PARTICLE_LIFE[1],
        char,
        color: brick.color,
        size: rand(12, 20),
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-5, 5),
        affectsWall: true
      });
    });

    // Score popup particle
    const prefix = points >= 0 ? '+' : '';
    this.particles.push({
      x: brick.x,
      y: brick.y - 15,
      vx: 0, vy: -60,
      life: 1.2, maxLife: 1.2,
      char: `${prefix}${points}`,
      color: points >= 0 ? brick.color : C.COLORS.bad,
      size: 16,
      rotation: 0, rotSpeed: 0,
      affectsWall: false,
      isScore: true
    });

    this.audio.playBrickBreak(brick.category);

    // Maybe spawn power-up
    if (Math.random() < C.POWERUP_CHANCE) {
      this._spawnPowerup(brick.x, brick.y);
    }

    // Relayout surviving bricks (smooth animation)
    this._relayoutBricks();
  }

  _relayoutBricks() {
    const alive = this.bricks.filter(b => b.alive);
    if (alive.length === 0) return;

    const regionLeft = C.PLAY_RECT.x + 20;
    const regionRight = C.PLAY_RECT.x + C.PLAY_RECT.w - 20;
    const regionWidth = regionRight - regionLeft;
    const gap = 8;

    // Re-flow into rows
    const rows = [];
    let currentRow = [];
    let rowWidth = 0;

    for (const brick of alive) {
      if (rowWidth + brick.w + (currentRow.length > 0 ? gap : 0) > regionWidth && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [brick];
        rowWidth = brick.w;
      } else {
        rowWidth += brick.w + (currentRow.length > 0 ? gap : 0);
        currentRow.push(brick);
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    let y = C.BRICK_REGION_TOP;
    for (const row of rows) {
      const totalRowWidth = row.reduce((sum, b) => sum + b.w, 0) + (row.length - 1) * gap;
      let x = regionLeft + (regionWidth - totalRowWidth) / 2;

      for (const brick of row) {
        brick.targetX = x + brick.w / 2;
        brick.targetY = y + brick.h / 2;
        x += brick.w + gap;
      }
      y += (row[0]?.h || 30) + gap;
    }
  }

  _updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.y += C.POWERUP_FALL_SPEED * dt;
      pu.x += pu.drift * dt;
      pu.spin += dt * 2;

      // Bounce off walls
      if (pu.x < C.PLAY_RECT.x + 20) pu.drift = Math.abs(pu.drift);
      if (pu.x > C.PLAY_RECT.x + C.PLAY_RECT.w - 20) pu.drift = -Math.abs(pu.drift);

      // Paddle collision
      const px = this.paddle.x;
      const py = this.paddle.y;
      const pw = this.paddle.width / 2;

      if (pu.y >= py - 15 && pu.y <= py + 15 &&
          pu.x >= px - pw - 10 && pu.x <= px + pw + 10) {
        this._activatePowerup(pu);
        this.powerups.splice(i, 1);
        continue;
      }

      // Off screen
      if (pu.y > C.CANVAS_H + 30) {
        this.powerups.splice(i, 1);
      }
    }
  }

  _spawnPowerup(x, y) {
    // Smart selection based on game state
    const types = [...C.POWERUP_TYPES];
    const weights = types.map(t => {
      if (t.kind === 'life' && this.lives >= C.MAX_LIVES) return 0.1;
      if (t.kind === 'life' && this.lives <= 1) return 3;
      if (t.kind === 'guard' && this.guard) return 0.2;
      if (t.kind === 'guard' && this.lives <= 2) return 2.5;
      if (t.kind === 'multi' && this.balls.length >= C.MAX_BALLS) return 0.1;
      if (t.kind === 'expand' && this.expandTimer > 5) return 0.3;
      if (t.kind === 'slow' && this.slowTimer > 5) return 0.3;
      if (t.kind === 'trinity' && this.balls.some(b => b.trinityType)) return 0.2;
      return 1;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    let chosen = types[0];
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = types[i]; break; }
    }

    const m = measureText(this.ctx, chosen.label, C.FONT.hudSmall);
    this.powerups.push({
      x, y,
      kind: chosen.kind,
      label: chosen.label,
      symbol: chosen.symbol || '',
      color: chosen.color,
      width: m.width + 16,
      height: m.height + 8,
      drift: rand(-30, 30),
      spin: 0
    });
  }

  _activatePowerup(pu) {
    this.score += 35;
    this.audio.playPowerUp(pu.kind);

    // Burst effect
    const chars = pu.label.split('').filter(c => c !== ' ');
    chars.forEach((char, i) => {
      const angle = (i / chars.length) * Math.PI - Math.PI;
      this.particles.push({
        x: pu.x + rand(-10, 10), y: pu.y,
        vx: Math.cos(angle) * rand(40, 80),
        vy: Math.sin(angle) * rand(40, 80) - 30,
        life: 0.6, maxLife: 0.6,
        char, color: pu.color,
        size: 14, rotation: rand(0, Math.PI * 2), rotSpeed: rand(-3, 3),
        affectsWall: false
      });
    });

    switch (pu.kind) {
      case 'expand':
        this.expandTimer = C.POWERUP_TYPES.find(t => t.kind === 'expand').duration;
        this.paddle.text = C.PADDLE_TEXT_WIDE;
        this._measurePaddle();
        break;
      case 'slow':
        this.slowTimer = C.POWERUP_TYPES.find(t => t.kind === 'slow').duration;
        break;
      case 'multi':
        while (this.balls.length < 3 && this.balls.length < C.MAX_BALLS) {
          const newBall = this._createBall(false);
          const existing = this.balls[0];
          if (existing && !existing.attached) {
            newBall.x = existing.x;
            newBall.y = existing.y;
            const angle = rand(0.3, Math.PI - 0.3);
            newBall.vx = Math.cos(angle) * newBall.speed * (Math.random() > 0.5 ? 1 : -1);
            newBall.vy = -Math.abs(Math.sin(angle) * newBall.speed);
          }
        }
        break;
      case 'guard':
        this.guard = {
          x: C.CANVAS_W / 2,
          y: this.paddle.y - 30,
          text: C.GUARD_TEXT,
          width: measureText(this.ctx, C.GUARD_TEXT, C.FONT.guard).width,
          charges: C.GUARD_CHARGES
        };
        break;
      case 'life':
        this.lives = Math.min(this.lives + 1, C.MAX_LIVES);
        break;
      case 'reveal':
        this.revealTimer = C.POWERUP_TYPES.find(t => t.kind === 'reveal').duration;
        break;
      case 'trinity':
        this._spawnTrinityBall();
        break;
    }
  }

  // ── Trinity Ball Spawning ─────────────────────────────────

  _spawnTrinityBall() {
    const trinityTypes = ['jesus', 'spirit', 'father'];
    const type = pick(trinityTypes);

    // Create a trinity ball at the paddle position
    const ball = this._createBall(false, type);
    const existing = this.balls.find(b => !b.attached && !b.trinityType);
    if (existing) {
      ball.x = existing.x;
      ball.y = existing.y;
    } else if (this.paddle) {
      ball.x = this.paddle.x;
      ball.y = this.paddle.y - 30;
    }

    // Launch in a random upward direction
    const angle = rand(-Math.PI * 0.8, -Math.PI * 0.2);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;

    // Spawn celebration particles
    const info = C.TRINITY_BALLS[type];
    this._spawnParticles(ball.x, ball.y, info.color, 12, info.char);
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.isScore) p.vy += C.PARTICLE_GRAVITY * dt;
      p.rotation += p.rotSpeed * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  _updateTimers(dt) {
    if (this.expandTimer > 0) {
      this.expandTimer -= dt;
      if (this.expandTimer <= 0) {
        this.paddle.text = C.PADDLE_TEXT;
        this._measurePaddle();
      }
    }
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.revealTimer > 0) this.revealTimer -= dt;
    if (this.trinityRevealTimer > 0) this.trinityRevealTimer -= dt;
  }

  _updateWakeHoles(dt) {
    for (let i = this.wakeHoles.length - 1; i >= 0; i--) {
      this.wakeHoles[i].life -= dt;
      if (this.wakeHoles[i].life <= 0) {
        this.wakeHoles.splice(i, 1);
      }
    }
  }

  _spawnParticles(x, y, color, count, char = '·') {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(40, 100);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: rand(0.4, 0.8), maxLife: 0.8,
        char, color, size: rand(10, 16),
        rotation: rand(0, Math.PI * 2), rotSpeed: rand(-4, 4),
        affectsWall: false
      });
    }
  }

  _spawnPaddleSparks() {
    const chars = ['=', '=', ':', ':'];
    chars.forEach(() => {
      this.particles.push({
        x: this.paddle.x + rand(-this.paddle.width / 3, this.paddle.width / 3),
        y: this.paddle.y - this.paddle.height / 2,
        vx: rand(-40, 40),
        vy: rand(-80, -30),
        life: rand(0.35, 0.5), maxLife: 0.5,
        char: pick(chars),
        color: '#a9f1ff',
        size: 12, rotation: 0, rotSpeed: rand(-2, 2),
        affectsWall: false
      });
    });
  }

  // ── Heaven Surface Sparkles ───────────────────────────────

  _spawnHeavenSparkles(x, y) {
    const chars = ['✦', '†', '·'];
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + rand(-30, 30),
        y: y + rand(0, 10),
        vx: rand(-40, 40),
        vy: rand(10, 50),
        life: rand(0.5, 1.0), maxLife: 1.0,
        char: pick(chars),
        color: C.COLORS.heavenGold,
        size: rand(10, 18),
        rotation: rand(0, Math.PI * 2), rotSpeed: rand(-3, 3),
        affectsWall: false
      });
    }
  }

  _onBallLost() {
    this.lives--;
    this.comboCount = 0;
    this.lastCategory = null;

    // Failure particles
    const failChars = ['/', '\\', '!', '?', '_'];
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.paddle.x + rand(-20, 20),
        y: C.PLAY_RECT.y + C.PLAY_RECT.h,
        vx: rand(-60, 60),
        vy: rand(-120, -40),
        life: rand(0.5, 1), maxLife: 1,
        char: pick(failChars),
        color: '#ff8d6b',
        size: rand(14, 22), rotation: rand(0, Math.PI * 2), rotSpeed: rand(-5, 5),
        affectsWall: true
      });
    }

    if (this.lives <= 0) {
      this._onGameOver();
    } else {
      this.shake = C.SHAKE.lifeLoss;
      this.audio.playLoseLife();
      this._createBall(true);
      this.state = 'serve';
      this.stateTime = 0;
      this.audio.startMusic('serve');
    }
  }

  _onLevelClear() {
    this.state = 'clearing';
    this.stateTime = 0;
    this.shake = C.SHAKE.waveClear;
    this.audio.playWaveClear();
    this.flashAlpha = 0.25;
    this.flashColor = C.COLORS.god;

    // Golden burst
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: C.CANVAS_W / 2 + rand(-200, 200),
        y: C.CANVAS_H / 2 + rand(-100, 100),
        vx: rand(-100, 100),
        vy: rand(-100, -20),
        life: rand(1, 2), maxLife: 2,
        char: pick(['✦', '†', '·', '+', '✝']),
        color: C.COLORS.god,
        size: rand(14, 24), rotation: rand(0, Math.PI * 2), rotSpeed: rand(-3, 3),
        affectsWall: true
      });
    }
  }

  _onGameComplete() {
    // All levels done - show special ending
    this.state = 'gameover';
    this.stateTime = 0;
    this._gameComplete = true;
    if (this.score > this.bestScore) this.bestScore = this.score;
    this._recordScore(this.score);
    this.audio.stopMusic();

    // Massive celebration burst
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      this.particles.push({
        x: C.CANVAS_W / 2, y: C.CANVAS_H / 2,
        vx: Math.cos(angle) * rand(80, 200),
        vy: Math.sin(angle) * rand(80, 200),
        life: rand(1.5, 3), maxLife: 3,
        char: pick(['✦', '†', '✝', '♱', '☩']),
        color: pick([C.COLORS.god, C.COLORS.good, '#fff', C.COLORS.connector]),
        size: rand(16, 30), rotation: rand(0, Math.PI * 2), rotSpeed: rand(-3, 3),
        affectsWall: true
      });
    }
  }

  _onGameOver() {
    this.state = 'gameover';
    this.stateTime = 0;
    this._gameComplete = false;
    if (this.score > this.bestScore) this.bestScore = this.score;
    this._recordScore(this.score);
    this.shake = C.SHAKE.lifeLoss;
    this.audio.playGameOver();
    this.audio.startMusic('gameover');
  }

  // ── Game Over Click Handling ──────────────────────────────

  _onGameOverClick(pos) {
    // In game over state, any click can restart or go to share
    // The auto-transition to share_screen handles it after 3 seconds
    // But clicking early will restart
    this._restart();
  }

  // ── Share Screen ──────────────────────────────────────────

  _getShareData() {
    return {
      score: this.score,
      level: this.level,
      versesPlayed: this.stats.playerVersesPlayed,
      bestScore: this.bestScore,
      lastVerse: this.currentVerse ? {
        ref: this.currentVerse.ref,
        text: this.currentVerse.text
      } : null
    };
  }

  _onShareScreenClick(pos) {
    const cx = C.CANVAS_W / 2;
    const btnW = 140;
    const btnH = 44;
    const btnY = C.CANVAS_H * 0.62;
    const gap = 20;
    const totalW = btnW * 3 + gap * 2;
    const startX = cx - totalW / 2;

    // Email button
    if (this._isInRect(pos, startX, btnY, btnW, btnH)) {
      if (shareModule) {
        try { shareModule.shareViaEmail(this._getShareData()); } catch (_) {}
      }
      return;
    }

    // WhatsApp button
    if (this._isInRect(pos, startX + btnW + gap, btnY, btnW, btnH)) {
      if (shareModule) {
        try { shareModule.shareViaWhatsApp(this._getShareData()); } catch (_) {}
      }
      return;
    }

    // Copy button
    if (this._isInRect(pos, startX + (btnW + gap) * 2, btnY, btnW, btnH)) {
      if (shareModule) {
        try {
          shareModule.shareToClipboard(this._getShareData());
          this.shareClipboardFeedback = 2.0;
        } catch (_) {}
      }
      return;
    }

    // Play Again button
    const playAgainY = C.CANVAS_H * 0.78;
    const playAgainW = 200;
    const playAgainH = 48;
    if (this._isInRect(pos, cx - playAgainW / 2, playAgainY, playAgainW, playAgainH)) {
      this._restart();
      return;
    }
  }

  // ── Lesson Quiz (Feature #5) ──────────────────────────────

  _startLessonQuiz() {
    // Extract lessons from current verse
    const lessons = this._extractLessons();

    this.quizLessons = shuffle(lessons).map(l => ({
      text: l.text,
      correctKey: l.key,
      answered: false,
      correct: false
    }));
    this.quizCurrent = 0;
    this.quizScore = 0;
    this.quizTimer = C.QUIZ_DURATION;
    this.quizFeedback = null;
    this.quizAnswered = false;
    this.state = 'lesson_quiz';
    this.stateTime = 0;
  }

  _extractLessons() {
    const verse = this.currentVerse;
    const lessons = [];

    // If the verse has a lessons field, use it
    if (verse && verse.lessons) {
      if (verse.lessons.god) {
        lessons.push({ key: 'god', text: verse.lessons.god });
      }
      if (verse.lessons.good) {
        lessons.push({ key: 'good', text: verse.lessons.good });
      }
      if (verse.lessons.bad) {
        lessons.push({ key: 'bad', text: verse.lessons.bad });
      }
    }

    // If we don't have 3 lessons, generate placeholders from phrases
    if (lessons.length < 3 && verse && verse.phrases) {
      const phrases = verse.phrases;
      const categories = ['god', 'good', 'bad'];
      const existingKeys = new Set(lessons.map(l => l.key));

      for (const cat of categories) {
        if (existingKeys.has(cat)) continue;
        if (lessons.length >= 3) break;

        // Find a phrase that matches this category, or use a generic one
        const catPhrases = phrases.filter(p => p.c === cat);
        if (catPhrases.length > 0) {
          lessons.push({
            key: cat,
            text: catPhrases.map(p => p.t).join(' ')
          });
        } else {
          // Generate a placeholder based on category
          const placeholders = {
            god: `This verse teaches us about God's character`,
            good: `This verse shows us what is good to follow`,
            bad: `This verse warns us about what to avoid`
          };
          lessons.push({
            key: cat,
            text: placeholders[cat]
          });
        }
        existingKeys.add(cat);
      }
    }

    // Ensure we have exactly 3
    while (lessons.length < 3) {
      lessons.push({
        key: pick(['god', 'good', 'bad']),
        text: 'Consider what this verse means for your life'
      });
    }

    return lessons.slice(0, 3);
  }

  _updateLessonQuiz(dt) {
    this.quizTimer -= dt;

    // Feedback timer
    if (this.quizFeedback) {
      this.quizFeedback.timer -= dt;
      if (this.quizFeedback.timer <= 0) {
        this.quizFeedback = null;
        this.quizAnswered = false;
        this.quizCurrent++;

        // Check if quiz is done
        if (this.quizCurrent >= this.quizLessons.length) {
          this._endLessonQuiz();
          return;
        }
      }
    }

    // Time's up
    if (this.quizTimer <= 0) {
      this._endLessonQuiz();
    }
  }

  _answerQuiz(categoryIndex) {
    if (this.quizAnswered) return;
    if (this.quizCurrent >= this.quizLessons.length) return;

    this.quizAnswered = true;
    const lesson = this.quizLessons[this.quizCurrent];
    const categories = C.LESSON_CATEGORIES;
    const selected = categories[categoryIndex];

    if (!selected) return;

    const correct = selected.key === lesson.correctKey;
    lesson.answered = true;
    lesson.correct = correct;

    if (correct) {
      this.quizScore += 100;
      this.score += 100;
      this.quizFeedback = { text: 'Correct! +100', color: C.COLORS.good, timer: 1.0 };
    } else {
      this.quizFeedback = {
        text: `Not quite. It's "${categories.find(c => c.key === lesson.correctKey)?.label || 'unknown'}"`,
        color: C.COLORS.bad,
        timer: 1.5
      };
    }
  }

  _onQuizClick(pos) {
    if (this.quizAnswered) return;

    const cx = C.CANVAS_W / 2;
    const btnW = 180;
    const btnH = 42;
    const btnY = C.CANVAS_H * 0.58;
    const gap = 15;
    const totalW = btnW * 3 + gap * 2;
    const startX = cx - totalW / 2;

    for (let i = 0; i < 3; i++) {
      const bx = startX + i * (btnW + gap);
      if (this._isInRect(pos, bx, btnY, btnW, btnH)) {
        this._answerQuiz(i);
        return;
      }
    }
  }

  _endLessonQuiz() {
    // Transition to mini-game
    this._startMiniGame();
  }

  // ── Mini-Game (Feature #8) ────────────────────────────────

  _startMiniGame() {
    const types = C.MINIGAME_TYPES;
    this.miniGameType = pick(types);
    this.miniTimer = C.MINIGAME_DURATION;
    this.miniComplete = false;
    this.miniScore = 0;
    this.miniFeedback = null;

    if (this.miniGameType === 'reassemble') {
      this._setupReassemble();
    } else if (this.miniGameType === 'missing_word') {
      this._setupMissingWord();
    } else {
      // category_sort: simplified version
      this._setupCategorySort();
    }

    this.state = 'mini_game';
    this.stateTime = 0;
  }

  _setupReassemble() {
    // Get phrase texts in correct order
    const phrases = this.currentVerse.phrases.map(p => p.t);
    this.miniCorrectOrder = [...phrases];
    this.miniPhrases = shuffle(phrases.map((text, i) => ({
      text,
      originalIndex: i,
      selected: false,
      selectOrder: -1
    })));
    this.miniSelected = [];
  }

  _setupMissingWord() {
    // Show verse with some words blanked
    const text = this.currentVerse.text;
    const words = text.split(' ');
    const blankCount = Math.min(3, Math.max(2, Math.floor(words.length * 0.15)));

    // Pick random word indices to blank (avoid very short words)
    const candidates = words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.length >= 3);

    const blanked = shuffle(candidates).slice(0, blankCount);
    this.miniBlankIndices = blanked.map(b => b.i).sort((a, b) => a - b);

    // Word bank (correct words + a few distractors)
    const correctWords = this.miniBlankIndices.map(i => words[i]);
    // Generate distractors from the verse's other words
    const otherWords = words.filter((w, i) => !this.miniBlankIndices.includes(i) && w.length >= 3);
    const distractors = shuffle(otherWords).slice(0, 2);
    this.miniWordBank = shuffle([...correctWords, ...distractors]).map((w, i) => ({
      text: w,
      used: false,
      index: i
    }));

    this.miniFilledBlanks = new Array(this.miniBlankIndices.length).fill(null);
    this.miniSelected = [];
    this.miniPhrases = words; // Store original words for display
  }

  _setupCategorySort() {
    // Simplified: show phrases with their categories, auto-reveal after a few seconds
    const phrases = this.currentVerse.phrases.slice(0, 5).map(p => ({
      text: p.t,
      category: p.c,
      revealed: false
    }));
    this.miniPhrases = shuffle(phrases);
    this.miniSelected = [];
    // Auto-complete after a shorter timer for this simplified version
    this.miniTimer = Math.min(C.MINIGAME_DURATION, 10);
  }

  _updateMiniGame(dt) {
    this.miniTimer -= dt;

    // Feedback timer
    if (this.miniFeedback) {
      this.miniFeedback.timer -= dt;
      if (this.miniFeedback.timer <= 0) {
        this.miniFeedback = null;
      }
    }

    // Category sort: auto-reveal phrases over time
    if (this.miniGameType === 'category_sort' && !this.miniComplete) {
      const elapsed = C.MINIGAME_DURATION - this.miniTimer;
      const revealInterval = 2; // reveal one every 2 seconds
      const toReveal = Math.floor(elapsed / revealInterval);
      for (let i = 0; i < Math.min(toReveal, this.miniPhrases.length); i++) {
        this.miniPhrases[i].revealed = true;
      }
      if (this.miniPhrases.every(p => p.revealed)) {
        this.miniComplete = true;
        this.miniScore += 50;
        this.score += 50;
      }
    }

    // Timer expired
    if (this.miniTimer <= 0 || this.miniComplete) {
      if (this.miniTimer <= 0 && !this.miniComplete) {
        this.miniComplete = true;
      }
      // Brief pause then advance
      if (this.miniTimer <= -1.5 || (this.miniComplete && this.stateTime > 1.5)) {
        this._endMiniGame();
      }
    }
  }

  _selectMiniPhrase(index) {
    if (this.miniComplete) return;

    if (this.miniGameType === 'reassemble') {
      const phrase = this.miniPhrases[index];
      if (!phrase || phrase.selected) return;

      phrase.selected = true;
      phrase.selectOrder = this.miniSelected.length;
      this.miniSelected.push(index);

      // Check if the selected phrase is in the correct position
      const correctIndex = this.miniSelected.length - 1;
      if (phrase.text === this.miniCorrectOrder[correctIndex]) {
        this.miniScore += 30;
        this.score += 30;
        this.miniFeedback = { text: '+30', color: C.COLORS.good, timer: 0.5 };
      } else {
        this.miniFeedback = { text: 'Wrong order', color: C.COLORS.bad, timer: 0.5 };
      }

      // Check completion
      if (this.miniSelected.length === this.miniPhrases.length) {
        this.miniComplete = true;
      }
    } else if (this.miniGameType === 'missing_word') {
      // For missing_word, index is the word bank index
      const word = this.miniWordBank[index];
      if (!word || word.used) return;

      // Find first unfilled blank
      const blankIdx = this.miniFilledBlanks.findIndex(b => b === null);
      if (blankIdx === -1) return;

      word.used = true;
      this.miniFilledBlanks[blankIdx] = word.text;
      this.miniSelected.push(index);

      // Check if correct
      const originalWords = this.currentVerse.text.split(' ');
      const correctWord = originalWords[this.miniBlankIndices[blankIdx]];
      if (word.text === correctWord) {
        this.miniScore += 40;
        this.score += 40;
        this.miniFeedback = { text: 'Correct! +40', color: C.COLORS.good, timer: 0.5 };
      } else {
        this.miniFeedback = { text: 'Not quite', color: C.COLORS.bad, timer: 0.5 };
      }

      // Check completion
      if (this.miniFilledBlanks.every(b => b !== null)) {
        this.miniComplete = true;
      }
    }
  }

  _onMiniGameClick(pos) {
    if (this.miniComplete) return;

    if (this.miniGameType === 'reassemble') {
      // Calculate phrase button positions
      const startY = C.CANVAS_H * 0.4;
      const btnH = 36;
      const gap = 8;

      for (let i = 0; i < this.miniPhrases.length; i++) {
        const phrase = this.miniPhrases[i];
        if (phrase.selected) continue;

        const by = startY + i * (btnH + gap);
        const bw = Math.min(C.CANVAS_W - 100, 600);
        const bx = C.CANVAS_W / 2 - bw / 2;

        if (this._isInRect(pos, bx, by, bw, btnH)) {
          this._selectMiniPhrase(i);
          return;
        }
      }
    } else if (this.miniGameType === 'missing_word') {
      // Word bank buttons
      const bankY = C.CANVAS_H * 0.68;
      const btnW = 100;
      const btnH = 36;
      const gap = 10;
      const totalW = this.miniWordBank.length * (btnW + gap) - gap;
      const startX = C.CANVAS_W / 2 - totalW / 2;

      for (let i = 0; i < this.miniWordBank.length; i++) {
        const word = this.miniWordBank[i];
        if (word.used) continue;

        const bx = startX + i * (btnW + gap);
        if (this._isInRect(pos, bx, bankY, btnW, btnH)) {
          this._selectMiniPhrase(i);
          return;
        }
      }
    }
  }

  _endMiniGame() {
    // Advance to next level
    if (this.level >= C.TOTAL_LEVELS) {
      this._onGameComplete();
    } else {
      this.level++;
      this._buildLevel();
    }
  }

  // ── Rendering ─────────────────────────────────────────────

  _render(dt) {
    const ctx = this.ctx;

    ctx.save();

    // Screen shake
    if (this.shake > 0.1) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    // Background
    this._renderBackground(ctx);

    // Background glyphs
    this._renderBgGlyphs(ctx);

    switch (this.state) {
      case 'opening':
        this._renderOpening(ctx);
        break;
      case 'menu':
        this._renderMenu(ctx);
        break;
      case 'transition':
        this._renderTransition(ctx);
        break;
      case 'serve':
      case 'playing':
        this._renderGame(ctx, dt);
        break;
      case 'clearing':
        this._renderClearing(ctx);
        break;
      case 'lesson_quiz':
        this._renderLessonQuiz(ctx);
        break;
      case 'mini_game':
        this._renderMiniGame(ctx);
        break;
      case 'gameover':
        this._renderGameOver(ctx);
        break;
      case 'share_screen':
        this._renderShareScreen(ctx);
        break;
    }

    // Flash overlay
    if (this.flashAlpha > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha * 0.15;
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _renderBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    grad.addColorStop(0, C.COLORS.bgGrad1);
    grad.addColorStop(0.5, C.COLORS.bgGrad2);
    grad.addColorStop(1, C.COLORS.bgGrad3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Subtle radial glows
    const glow1 = ctx.createRadialGradient(C.CANVAS_W * 0.3, 0, 0, C.CANVAS_W * 0.3, 0, 400);
    glow1.addColorStop(0, 'rgba(255, 215, 0, 0.04)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const glow2 = ctx.createRadialGradient(C.CANVAS_W * 0.7, C.CANVAS_H, 0, C.CANVAS_W * 0.7, C.CANVAS_H, 400);
    glow2.addColorStop(0, 'rgba(96, 165, 250, 0.04)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  }

  _renderBgGlyphs(ctx) {
    ctx.save();
    this.bgGlyphs.forEach(g => {
      ctx.font = `${g.size}px 'Share Tech Mono', monospace`;
      ctx.fillStyle = C.BG_COLOR;
      ctx.globalAlpha = g.alpha;
      ctx.fillText(g.char, g.x, g.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _renderFrame(ctx) {
    // Box-drawing frame around play area
    ctx.save();
    const r = C.PLAY_RECT;

    // Top frame (HUD area)
    ctx.strokeStyle = C.COLORS.hudFrame;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(r.x, 2, r.w, C.HUD_HEIGHT - 4);

    // Play area frame
    ctx.strokeStyle = C.COLORS.playFrame;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    // Corner accents
    const corners = [
      [r.x, r.y], [r.x + r.w, r.y],
      [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]
    ];
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = C.COLORS.playFrame;
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx - 8 * Math.sign(cx - C.CANVAS_W / 2 || 1), cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + 8 * Math.sign(cy - C.CANVAS_H / 2 || 1));
      ctx.stroke();
    });

    ctx.restore();

    // ── Heaven Surface Glow (Feature #10) ──────────────────
    this._renderHeavenSurface(ctx);
  }

  // ── Heaven Surface (Feature #10) ─────────────────────────

  _renderHeavenSurface(ctx) {
    ctx.save();
    const r = C.PLAY_RECT;
    const topY = r.y;
    const glowHeight = 40;

    // Shimmer effect using sine wave
    const shimmerAlpha = 0.25 + Math.sin(this.heavenShimmerT * 2.5) * 0.08;

    // Golden gradient from top edge downward
    const heavenGrad = ctx.createLinearGradient(r.x, topY, r.x, topY + glowHeight);
    heavenGrad.addColorStop(0, `rgba(255, 215, 0, ${shimmerAlpha})`);
    heavenGrad.addColorStop(0.4, `rgba(255, 215, 0, ${shimmerAlpha * 0.5})`);
    heavenGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = heavenGrad;
    ctx.fillRect(r.x, topY, r.w, glowHeight);

    // Subtle accent line at very top
    ctx.strokeStyle = C.COLORS.heavenGold;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = shimmerAlpha * 1.2;
    ctx.beginPath();
    ctx.moveTo(r.x + 5, topY + 1);
    ctx.lineTo(r.x + r.w - 5, topY + 1);
    ctx.stroke();

    ctx.restore();
  }

  _renderHUD(ctx) {
    ctx.save();

    // Score
    ctx.font = C.FONT.score;
    ctx.fillStyle = this.score >= 0 ? C.COLORS.god : C.COLORS.bad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const scoreStr = String(Math.abs(this.score)).padStart(5, '0');
    const prefix = this.score < 0 ? '-' : '';
    ctx.fillText(`${prefix}${scoreStr}`, C.PLAY_RECT.x + 15, C.HUD_HEIGHT / 2 - 8);

    // Lives
    ctx.font = C.FONT.hud;
    ctx.fillStyle = C.COLORS.good;
    ctx.textAlign = 'center';
    let livesStr = '';
    for (let i = 0; i < this.lives; i++) livesStr += '♥ ';
    for (let i = this.lives; i < C.MAX_LIVES; i++) livesStr += '♡ ';
    ctx.fillText(livesStr.trim(), C.CANVAS_W / 2, C.HUD_HEIGHT / 2 - 8);

    // Level
    ctx.font = C.FONT.hud;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.textAlign = 'right';
    ctx.fillText(`LVL ${this.level}`, C.PLAY_RECT.x + C.PLAY_RECT.w - 15, C.HUD_HEIGHT / 2 - 8);

    // Stats bar (second row)
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.6;
    const sy = C.HUD_HEIGHT / 2 + 12;

    ctx.textAlign = 'left';
    ctx.fillStyle = C.COLORS.connector;
    ctx.fillText(`VERSES: ${this.stats.playerVersesPlayed}`, C.PLAY_RECT.x + 15, sy);

    ctx.textAlign = 'center';
    ctx.fillStyle = C.COLORS.other;
    ctx.fillText(`ALL VERSES: ${this.stats.globalVersesPlayed}  |  ALL BEST: ${this.stats.globalHighScore}`, C.CANVAS_W / 2, sy);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.COLORS.god;
    ctx.fillText(`BEST: ${this.stats.playerHighScore}`, C.PLAY_RECT.x + C.PLAY_RECT.w - 15, sy);

    ctx.restore();
  }

  _renderVerseReference(ctx) {
    if (!this.currentVerse) return;
    ctx.save();
    ctx.font = C.FONT.verseRef;
    ctx.fillStyle = C.COLORS.footerFrame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = 0.8;
    ctx.fillText(this.currentVerse.ref, C.CANVAS_W / 2, C.CANVAS_H - 8);
    ctx.restore();
  }

  _renderRevealedVerse(ctx) {
    if (this.revealedPhrases.length === 0) return;

    ctx.save();
    const y = C.PLAY_RECT.y + C.PLAY_RECT.h - 25;
    ctx.font = C.FONT.verse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Build the revealed text with colors
    const fullText = this.revealedPhrases.map(p => p.text).join(' ');
    const maxWidth = C.PLAY_RECT.w - 60;
    const m = measureText(ctx, fullText, C.FONT.verse);

    if (m.width <= maxWidth) {
      // Single line - draw each phrase colored
      let x = C.CANVAS_W / 2 - m.width / 2;
      ctx.textAlign = 'left';
      this.revealedPhrases.forEach((p, i) => {
        const text = i > 0 ? ' ' + p.text : p.text;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.fillText(text, x, y);
        x += measureText(ctx, text, C.FONT.verse).width;
      });
    } else {
      // Truncate with ellipsis
      ctx.fillStyle = C.COLORS.god;
      ctx.globalAlpha = 0.7;
      const last3 = this.revealedPhrases.slice(-3);
      const truncated = '... ' + last3.map(p => p.text).join(' ');
      ctx.fillText(truncated, C.CANVAS_W / 2, y);
    }

    ctx.restore();
  }

  _renderTextWall(ctx) {
    // Fill entire play area with the current verse text, repeating
    if (!this.currentVerse) return;
    ctx.save();
    ctx.font = C.WALL_FONT;

    const verseText = this.currentVerse.text + '  ✝  ' + this.currentVerse.ref + '  ·  ';
    const lineH = C.WALL_LINE_HEIGHT;
    const startY = C.PLAY_RECT.y + 5;
    const endY = C.PLAY_RECT.y + C.PLAY_RECT.h;
    const startX = C.PLAY_RECT.x + 5;
    const lineWidth = C.PLAY_RECT.w - 10;

    let charIdx = 0;
    let colorIdx = 0;
    for (let y = startY; y < endY; y += lineH) {
      // Cycle through muted category colors for visual interest
      const categoryColors = [
        C.COLORS.god, C.COLORS.good, C.COLORS.connector, C.COLORS.other
      ];
      ctx.fillStyle = categoryColors[colorIdx % categoryColors.length];
      ctx.globalAlpha = 0.12;
      colorIdx++;

      // Build a line from the repeating verse text
      let line = '';
      const charsPerLine = 85;
      for (let c = 0; c < charsPerLine; c++) {
        line += verseText[(charIdx + c) % verseText.length];
      }
      ctx.fillText(line, startX, y);
      charIdx += charsPerLine;
    }

    ctx.restore();
  }

  _renderBricks(ctx, dt) {
    ctx.save();

    for (const brick of this.bricks) {
      if (!brick.alive) continue;

      // Smooth position animation
      brick.x = lerp(brick.x, brick.targetX, dt * 10);
      brick.y = lerp(brick.y, brick.targetY, dt * 10);

      let bx, by;
      if (brick.flyProgress < 1) {
        bx = lerp(brick.flyX, brick.targetX, brick.flyProgress);
        by = lerp(brick.flyY, brick.targetY, brick.flyProgress);
      } else {
        bx = brick.x;
        by = brick.y;
      }

      const halfW = brick.w / 2;
      const halfH = brick.h / 2;

      // Glow
      ctx.save();
      ctx.shadowColor = brick.glow;
      ctx.shadowBlur = 12;

      // Background
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = brick.blanked ? 0.25 : 0.15;
      ctx.beginPath();
      ctx.roundRect(bx - halfW, by - halfH, brick.w, brick.h, 4);
      ctx.fill();

      // Border
      ctx.strokeStyle = brick.color;
      ctx.lineWidth = brick.blanked ? 2 : 1.5;
      ctx.globalAlpha = brick.blanked ? 0.9 : 0.7;
      ctx.beginPath();
      ctx.roundRect(bx - halfW, by - halfH, brick.w, brick.h, 4);
      ctx.stroke();

      // Add dashed border for blanked bricks
      if (brick.blanked) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = C.COLORS.god;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.roundRect(bx - halfW + 2, by - halfH + 2, brick.w - 4, brick.h - 4, 3);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Text
      ctx.globalAlpha = 1;
      ctx.font = brick.font;
      ctx.fillStyle = brick.blanked ? C.COLORS.god : brick.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(brick.displayText || brick.text, bx, by);

      // Dark outline on text for readability
      ctx.strokeStyle = C.BRICK_STROKE_COLOR;
      ctx.lineWidth = 0.5;
      ctx.strokeText(brick.displayText || brick.text, bx, by);

      ctx.restore();

      // Category indicator dot
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(bx - halfW + 6, by - halfH + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _renderBall(ctx) {
    for (const ball of this.balls) {
      ctx.save();

      if (ball.trinityType) {
        // Trinity ball rendering
        const info = C.TRINITY_BALLS[ball.trinityType];

        // Golden aura
        ctx.shadowColor = info.glow;
        ctx.shadowBlur = 22;

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = info.glow;
        ctx.globalAlpha = 0.3 + Math.sin(this.stateTime * 6) * 0.15;
        ctx.fill();

        // Ball character
        ctx.font = C.FONT.ball;
        ctx.fillStyle = info.color;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.char, ball.x, ball.y);

      } else {
        // Normal ball rendering
        ctx.shadowColor = C.COLORS.ballGlow;
        ctx.shadowBlur = 16;

        ctx.font = C.FONT.ball;
        ctx.fillStyle = C.COLORS.ball;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.char, ball.x, ball.y);
      }

      ctx.restore();
    }
  }

  _renderLaunchIndicator(ctx) {
    const ball = this.balls.find(b => b.attached);
    if (!ball) return;

    ctx.save();
    const bx = ball.x;
    const by = ball.y;
    const angle = this.launchAngle;
    const lineLen = 80;
    const pulse = 0.5 + Math.sin(this.stateTime * 5) * 0.3;

    // Dotted trajectory line
    ctx.strokeStyle = C.COLORS.god;
    ctx.globalAlpha = pulse * 0.6;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle) * lineLen, by + Math.sin(angle) * lineLen);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const tipX = bx + Math.cos(angle) * lineLen;
    const tipY = by + Math.sin(angle) * lineLen;
    const arrowSize = 10;
    ctx.globalAlpha = pulse * 0.8;
    ctx.fillStyle = C.COLORS.god;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + Math.cos(angle + 2.6) * arrowSize, tipY + Math.sin(angle + 2.6) * arrowSize);
    ctx.lineTo(tipX + Math.cos(angle - 2.6) * arrowSize, tipY + Math.sin(angle - 2.6) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Arc showing selectable range
    ctx.strokeStyle = C.COLORS.playFrame;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, 50, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();

    // Angle indicator dot on arc
    ctx.fillStyle = C.COLORS.god;
    ctx.globalAlpha = pulse * 0.9;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(angle) * 50, by + Math.sin(angle) * 50, 4, 0, Math.PI * 2);
    ctx.fill();

    // Instruction text
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.fillStyle = C.COLORS.god;
    ctx.globalAlpha = pulse * 0.7;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('<- -> AIM  |  CLICK / ENTER to LAUNCH', bx, by + 30);

    ctx.restore();
  }

  _renderPaddle(ctx) {
    if (!this.paddle) return;
    ctx.save();

    // Glow
    ctx.shadowColor = C.COLORS.paddleGlow;
    ctx.shadowBlur = 14;

    ctx.font = C.FONT.paddle;
    ctx.fillStyle = C.COLORS.paddle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.paddle.text, this.paddle.x, this.paddle.y);

    ctx.restore();
  }

  _renderGuard(ctx) {
    if (!this.guard) return;
    ctx.save();

    ctx.shadowColor = 'rgba(164, 240, 148, 0.4)';
    ctx.shadowBlur = 10;
    ctx.font = C.FONT.guard;
    ctx.fillStyle = C.GUARD_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.8;
    ctx.fillText(this.guard.text, this.guard.x, this.guard.y);

    // Charges indicator
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = C.GUARD_COLOR;
    ctx.globalAlpha = 0.6;
    ctx.fillText(`x${this.guard.charges}`, this.guard.x + this.guard.width / 2 + 15, this.guard.y);

    ctx.restore();
  }

  _renderPowerups(ctx) {
    for (const pu of this.powerups) {
      ctx.save();

      const bob = Math.sin(pu.spin) * 3;

      ctx.shadowColor = pu.color;
      ctx.shadowBlur = 10;

      // Background pill
      ctx.fillStyle = pu.color;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.roundRect(pu.x - pu.width / 2, pu.y - pu.height / 2 + bob, pu.width, pu.height, 8);
      ctx.fill();

      // Border
      ctx.strokeStyle = pu.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.roundRect(pu.x - pu.width / 2, pu.y - pu.height / 2 + bob, pu.width, pu.height, 8);
      ctx.stroke();

      // Symbol prominently in center
      if (pu.symbol) {
        ctx.font = "bold 18px 'Rajdhani', sans-serif";
        ctx.fillStyle = pu.color;
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.symbol, pu.x, pu.y + bob - 1);

        // Smaller label below symbol if there's room
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.globalAlpha = 0.6;
        // (label is already visible via the pill, so symbol just adds flair)
      }

      // Label
      ctx.font = C.FONT.hudSmall;
      ctx.fillStyle = pu.color;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.label, pu.x, pu.y + bob);

      ctx.restore();
    }
  }

  _renderParticles(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.isScore) {
        ctx.font = `bold ${p.size}px 'Orbitron', sans-serif`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.char, 0, 0);
      } else {
        ctx.font = `${p.size}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, 0, 0);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  // ── YouTube Sidebar (Feature #13) ─────────────────────────

  _renderYouTubeSidebar(ctx) {
    ctx.save();
    const yt = this.youtubeSidebarRect;
    const video = C.YOUTUBE_VIDEOS[this.youtubeVideoIndex];

    // Semi-transparent background
    ctx.fillStyle = 'rgba(7, 13, 24, 0.75)';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.roundRect(yt.x, yt.y, yt.w, yt.h, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = C.COLORS.god;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.roundRect(yt.x, yt.y, yt.w, yt.h, 4);
    ctx.stroke();

    // CDBS text rotated vertically
    ctx.save();
    ctx.translate(yt.x + yt.w / 2, yt.y + 50);
    ctx.rotate(Math.PI / 2);
    ctx.font = "bold 14px 'Orbitron', sans-serif";
    ctx.fillStyle = C.COLORS.god;
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CDBS', 0, 0);
    ctx.restore();

    // Play icon
    ctx.font = "22px sans-serif";
    ctx.fillStyle = C.COLORS.bad;
    ctx.globalAlpha = 0.8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const playY = yt.y + yt.h / 2;
    ctx.fillText('\u25B6', yt.x + yt.w / 2, playY);

    // "Watch" label
    ctx.save();
    ctx.translate(yt.x + yt.w / 2, playY + 50);
    ctx.rotate(Math.PI / 2);
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Watch', 0, 0);
    ctx.restore();

    // Video title (truncated, rotated)
    if (video) {
      ctx.save();
      ctx.translate(yt.x + yt.w / 2, yt.y + yt.h - 80);
      ctx.rotate(Math.PI / 2);
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.fillStyle = C.COLORS.other;
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const title = video.title.length > 25 ? video.title.substring(0, 22) + '...' : video.title;
      ctx.fillText(title, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Scene renderers ───────────────────────────────────────

  _renderOpening(ctx) {
    const t = this.stateTime / C.OPENING_DURATION;

    // Title
    ctx.save();
    ctx.font = C.FONT.title;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 30;

    const titleY = C.CANVAS_H * 0.35;
    const titleAlpha = easeOutCubic(clamp(t * 3, 0, 1));
    ctx.globalAlpha = titleAlpha;

    // "SCRIPTURE" slides from left
    const slideX1 = lerp(-200, 0, easeOutBack(clamp(t * 2.5, 0, 1)));
    ctx.fillText('SCRIPTURE', C.CANVAS_W / 2 + slideX1, titleY);

    // "BREAKER" slides from right
    ctx.font = C.FONT.title;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.shadowColor = 'rgba(117, 215, 230, 0.5)';
    const slideX2 = lerp(200, 0, easeOutBack(clamp(t * 2.5 - 0.3, 0, 1)));
    ctx.fillText('BREAKER', C.CANVAS_W / 2 + slideX2, titleY + 55);

    // Tagline
    ctx.font = C.FONT.subtitle;
    ctx.fillStyle = '#c8d6e5';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = easeOutCubic(clamp(t * 2 - 0.8, 0, 1));
    ctx.fillText('Break the Word. Learn the Word.', C.CANVAS_W / 2, titleY + 110);

    // Cross symbol
    ctx.font = '60px serif';
    ctx.fillStyle = C.COLORS.god;
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 20;
    ctx.globalAlpha = easeOutCubic(clamp(t * 2 - 0.5, 0, 1)) * 0.6;
    ctx.fillText('\u271D', C.CANVAS_W / 2, titleY - 60);

    ctx.restore();
  }

  _renderMenu(ctx) {
    ctx.save();

    const pulse = 0.7 + Math.sin(this.stateTime * 3) * 0.3;

    // Title
    ctx.font = C.FONT.title;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 25;
    ctx.fillText('SCRIPTURE', C.CANVAS_W / 2, C.CANVAS_H * 0.28);

    ctx.fillStyle = C.COLORS.playFrame;
    ctx.shadowColor = 'rgba(117, 215, 230, 0.5)';
    ctx.fillText('BREAKER', C.CANVAS_W / 2, C.CANVAS_H * 0.28 + 55);

    // Subtitle
    ctx.font = C.FONT.subtitle;
    ctx.fillStyle = '#c8d6e5';
    ctx.shadowBlur = 0;
    ctx.fillText('Break the Word. Learn the Word.', C.CANVAS_W / 2, C.CANVAS_H * 0.28 + 110);

    // Instructions
    ctx.font = C.FONT.hudSmall;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = C.COLORS.god;
    ctx.fillText('CLICK or PRESS ENTER to Start', C.CANVAS_W / 2, C.CANVAS_H * 0.58);

    // Color legend
    ctx.globalAlpha = 0.8;
    const legendY = C.CANVAS_H * 0.66;
    const legendItems = [
      { label: 'About God (+150)', color: C.COLORS.god },
      { label: 'Good for us (+100)', color: C.COLORS.good },
      { label: 'Other (+50)', color: C.COLORS.other },
      { label: 'Connectors (+25)', color: C.COLORS.connector },
      { label: 'Not good (-120)', color: C.COLORS.bad },
      { label: 'Earth (+40)', color: C.COLORS.earth },
      { label: 'Royal (+80)', color: C.COLORS.royal }
    ];

    ctx.font = "600 15px 'Rajdhani', sans-serif";
    const cols = 3;
    const colW = 180;
    const rowH = 22;
    const startX = C.CANVAS_W / 2 - (cols * colW) / 2;

    legendItems.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * colW + 20;
      const y = legendY + row * rowH;

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 10, y + 4);
    });

    // Memorization stats (Feature #11)
    if (this.memorization) {
      try {
        const mStats = this.memorization.getMasteryStats();
        if (mStats.total > 0) {
          ctx.font = "12px 'Share Tech Mono', monospace";
          ctx.textAlign = 'center';
          ctx.fillStyle = C.COLORS.god;
          ctx.globalAlpha = 0.65;
          const memY = C.CANVAS_H * 0.82;
          ctx.fillText(
            `MEMORIZATION: ${mStats.memorized} mastered | ${mStats.learning} learning | ${mStats.familiar} familiar | ${mStats.seen} seen`,
            C.CANVAS_W / 2, memY
          );
        }
      } catch (_) {}
    }

    // Controls
    ctx.textAlign = 'center';
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.fillStyle = '#6b7b8d';
    ctx.globalAlpha = 0.6;
    ctx.fillText('MOUSE / ARROWS to move  |  CLICK / ENTER to launch  |  M to mute', C.CANVAS_W / 2, C.CANVAS_H * 0.88);

    // Stats
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.globalAlpha = 0.55;
    const statY = C.CANVAS_H * 0.93;
    ctx.fillStyle = C.COLORS.connector;
    ctx.fillText(
      `YOUR VERSES: ${this.stats.playerVersesPlayed}  |  YOUR BEST: ${this.stats.playerHighScore}  |  ALL VERSES: ${this.stats.globalVersesPlayed}  |  ALL BEST: ${this.stats.globalHighScore}`,
      C.CANVAS_W / 2, statY
    );

    ctx.restore();
  }

  _renderTransition(ctx) {
    // Render bricks flying in
    this._renderFrame(ctx);
    this._renderHUD(ctx);
    this._renderBricks(ctx, 0);

    // Banner
    const t = this.introT / C.INTRO_DURATION;
    const bannerAlpha = t < 0.8 ? easeOutCubic(clamp(t * 3, 0, 1)) : easeOutCubic(clamp((1 - t) * 5, 0, 1));

    ctx.save();
    ctx.globalAlpha = bannerAlpha;

    // Banner background
    ctx.fillStyle = 'rgba(7, 13, 24, 0.85)';
    ctx.fillRect(C.CANVAS_W / 2 - 250, C.CANVAS_H / 2 - 50, 500, 100);

    ctx.strokeStyle = C.COLORS.god;
    ctx.lineWidth = 1;
    ctx.strokeRect(C.CANVAS_W / 2 - 250, C.CANVAS_H / 2 - 50, 500, 100);

    ctx.font = C.FONT.banner;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 20;
    ctx.fillText(`LEVEL ${this.level}`, C.CANVAS_W / 2, C.CANVAS_H / 2 - 12);

    ctx.font = C.FONT.bannerSub;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.shadowBlur = 0;
    ctx.fillText(this.currentVerse.ref, C.CANVAS_W / 2, C.CANVAS_H / 2 + 25);

    ctx.restore();

    // Verse reference at bottom
    this._renderVerseReference(ctx);
  }

  _renderGame(ctx, dt) {
    // Text wall background
    this._renderTextWall(ctx);

    // Frame (includes heaven surface)
    this._renderFrame(ctx);

    // HUD
    this._renderHUD(ctx);

    // Bricks
    this._renderBricks(ctx, dt);

    // Guard
    this._renderGuard(ctx);

    // Ball
    this._renderBall(ctx);

    // Launch direction indicator (serve state only)
    if (this.state === 'serve') {
      this._renderLaunchIndicator(ctx);
    }

    // Paddle
    this._renderPaddle(ctx);

    // Power-ups
    this._renderPowerups(ctx);

    // Particles
    this._renderParticles(ctx);

    // Revealed verse
    this._renderRevealedVerse(ctx);

    // Verse reference
    this._renderVerseReference(ctx);

    // YouTube sidebar (Feature #13)
    this._renderYouTubeSidebar(ctx);

    // Combo display
    if (this.comboCount >= 2) {
      ctx.save();
      ctx.font = C.FONT.hud;
      ctx.fillStyle = C.COLORS.god;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.8;
      ctx.shadowColor = C.COLORS.godGlow;
      ctx.shadowBlur = 8;
      ctx.fillText(`COMBO x${this.comboCount + 1}`, C.PLAY_RECT.x + C.PLAY_RECT.w - 50, C.HUD_HEIGHT + 10);
      ctx.restore();
    }

    // Power-up timers
    this._renderPowerTimers(ctx);

    // Reveal overlay (shows full verse)
    if (this.revealTimer > 0 || this.trinityRevealTimer > 0) {
      this._renderRevealOverlay(ctx);
    }
  }

  _renderPowerTimers(ctx) {
    ctx.save();
    let ty = C.HUD_HEIGHT + 10;
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.textAlign = 'left';

    if (this.expandTimer > 0) {
      ctx.fillStyle = '#95edff';
      ctx.globalAlpha = 0.7;
      ctx.fillText(`WIDEN ${this.expandTimer.toFixed(1)}s`, C.PLAY_RECT.x + 15, ty);
      ty += 16;
    }
    if (this.slowTimer > 0) {
      ctx.fillStyle = '#ffd577';
      ctx.globalAlpha = 0.7;
      ctx.fillText(`SLOW ${this.slowTimer.toFixed(1)}s`, C.PLAY_RECT.x + 15, ty);
      ty += 16;
    }
    if (this.revealTimer > 0) {
      ctx.fillStyle = C.COLORS.god;
      ctx.globalAlpha = 0.7;
      ctx.fillText(`REVEAL ${this.revealTimer.toFixed(1)}s`, C.PLAY_RECT.x + 15, ty);
      ty += 16;
    }
    if (this.trinityRevealTimer > 0) {
      ctx.fillStyle = C.TRINITY_BALLS.spirit.color;
      ctx.globalAlpha = 0.7;
      ctx.fillText(`SPIRIT REVEAL ${this.trinityRevealTimer.toFixed(1)}s`, C.PLAY_RECT.x + 15, ty);
    }

    // Trinity ball active indicators
    const trinityBalls = this.balls.filter(b => b.trinityType);
    if (trinityBalls.length > 0) {
      ctx.textAlign = 'right';
      let tby = C.HUD_HEIGHT + 10;
      for (const tb of trinityBalls) {
        const info = C.TRINITY_BALLS[tb.trinityType];
        ctx.fillStyle = info.color;
        ctx.globalAlpha = 0.8;
        ctx.fillText(`${info.char} ${info.label}`, C.PLAY_RECT.x + C.PLAY_RECT.w - 50, tby);
        tby += 16;
      }
    }

    ctx.restore();
  }

  _renderRevealOverlay(ctx) {
    if (!this.currentVerse) return;
    ctx.save();

    const maxReveal = Math.max(this.revealTimer, this.trinityRevealTimer);
    const alpha = clamp(maxReveal / 2, 0, 0.9);
    ctx.globalAlpha = alpha * 0.85;

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(7, 13, 24, 0.7)';
    ctx.fillRect(C.PLAY_RECT.x + 30, C.BRICK_REGION_TOP - 10,
                 C.PLAY_RECT.w - 60, C.BRICK_REGION_HEIGHT + 20);

    // Full verse text
    ctx.font = "600 22px 'Rajdhani', sans-serif";
    ctx.fillStyle = this.trinityRevealTimer > 0 ? C.TRINITY_BALLS.spirit.color : C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = alpha;

    // Word wrap
    const words = this.currentVerse.text.split(' ');
    const maxW = C.PLAY_RECT.w - 100;
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
      const test = currentLine ? currentLine + ' ' + word : word;
      if (measureText(ctx, test, "600 22px 'Rajdhani', sans-serif").width > maxW) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    });
    if (currentLine) lines.push(currentLine);

    const startY = C.BRICK_REGION_TOP + 20;
    lines.forEach((line, i) => {
      ctx.fillText(line, C.CANVAS_W / 2, startY + i * 28);
    });

    // Reference
    ctx.font = C.FONT.verseRef;
    ctx.fillStyle = C.COLORS.footerFrame;
    ctx.fillText(`-- ${this.currentVerse.ref}`, C.CANVAS_W / 2, startY + lines.length * 28 + 15);

    // Spirit reveal label
    if (this.trinityRevealTimer > 0) {
      ctx.font = "bold 14px 'Orbitron', sans-serif";
      ctx.fillStyle = C.TRINITY_BALLS.spirit.color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillText('SPIRIT REVEALS TRUTH', C.CANVAS_W / 2, startY - 20);
    }

    ctx.restore();
  }

  _renderClearing(ctx) {
    this._renderTextWall(ctx);
    this._renderFrame(ctx);
    this._renderHUD(ctx);
    this._renderParticles(ctx);

    const t = this.stateTime / C.CLEAR_DURATION;

    // Golden sweep line
    const sweepX = lerp(-50, C.CANVAS_W + 50, easeInOutQuad(clamp(t * 1.5, 0, 1)));
    ctx.save();
    const sweepGrad = ctx.createLinearGradient(sweepX - 60, 0, sweepX + 60, 0);
    sweepGrad.addColorStop(0, 'transparent');
    sweepGrad.addColorStop(0.5, C.COLORS.god);
    sweepGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = sweepGrad;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(sweepX, C.PLAY_RECT.y);
    ctx.lineTo(sweepX, C.PLAY_RECT.y + C.PLAY_RECT.h);
    ctx.stroke();
    ctx.restore();

    // Banner
    const bannerAlpha = t < 0.7 ? easeOutCubic(clamp(t * 3, 0, 1)) : easeOutCubic(clamp((1 - t) * 3, 0, 1));
    ctx.save();
    ctx.globalAlpha = bannerAlpha;

    ctx.fillStyle = 'rgba(7, 13, 24, 0.85)';
    ctx.fillRect(C.CANVAS_W / 2 - 280, C.CANVAS_H / 2 - 60, 560, 120);
    ctx.strokeStyle = C.COLORS.god;
    ctx.lineWidth = 1;
    ctx.strokeRect(C.CANVAS_W / 2 - 280, C.CANVAS_H / 2 - 60, 560, 120);

    ctx.font = C.FONT.banner;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 20;
    ctx.fillText(`LEVEL ${this.level} CLEAR`, C.CANVAS_W / 2, C.CANVAS_H / 2 - 15);

    ctx.font = C.FONT.bannerSub;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.shadowBlur = 0;
    ctx.fillText('THE WORD STANDS FOREVER', C.CANVAS_W / 2, C.CANVAS_H / 2 + 20);

    ctx.restore();

    // Show full verse
    this._renderFullVerse(ctx, easeOutCubic(clamp(t * 2 - 0.5, 0, 1)));
    this._renderVerseReference(ctx);
  }

  _renderFullVerse(ctx, alpha) {
    if (!this.currentVerse) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = "500 16px 'Rajdhani', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render phrases in their colors
    const phrases = this.currentVerse.phrases;
    const fullText = phrases.map(p => p.t).join(' ');
    const m = measureText(ctx, fullText, "500 16px 'Rajdhani', sans-serif");

    if (m.width < C.PLAY_RECT.w - 60) {
      let x = C.CANVAS_W / 2 - m.width / 2;
      ctx.textAlign = 'left';
      phrases.forEach((p, i) => {
        const text = i > 0 ? ' ' + p.t : p.t;
        ctx.fillStyle = C.COLORS[p.c] || C.COLORS.other;
        ctx.fillText(text, x, C.CANVAS_H / 2 + 55);
        x += measureText(ctx, text, "500 16px 'Rajdhani', sans-serif").width;
      });
    } else {
      ctx.fillStyle = C.COLORS.god;
      ctx.fillText(this.currentVerse.text.substring(0, 80) + '...', C.CANVAS_W / 2, C.CANVAS_H / 2 + 55);
    }

    ctx.restore();
  }

  // ── Lesson Quiz Rendering (Feature #5) ────────────────────

  _renderLessonQuiz(ctx) {
    this._renderBackground(ctx);
    this._renderBgGlyphs(ctx);

    const cx = C.CANVAS_W / 2;
    const fadeIn = easeOutCubic(clamp(this.stateTime * 3, 0, 1));

    ctx.save();
    ctx.globalAlpha = fadeIn;

    // Dark overlay
    ctx.fillStyle = 'rgba(2, 6, 9, 0.88)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Title
    ctx.font = C.FONT.titleSm;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 15;
    ctx.fillText('LESSON QUIZ', cx, C.CANVAS_H * 0.1);
    ctx.shadowBlur = 0;

    // Verse reference
    if (this.currentVerse) {
      ctx.font = C.FONT.verseRef;
      ctx.fillStyle = C.COLORS.footerFrame;
      ctx.globalAlpha = fadeIn * 0.7;
      ctx.fillText(this.currentVerse.ref, cx, C.CANVAS_H * 0.16);
      ctx.globalAlpha = fadeIn;
    }

    // Timer bar
    const timerBarW = 400;
    const timerBarH = 6;
    const timerBarX = cx - timerBarW / 2;
    const timerBarY = C.CANVAS_H * 0.20;
    const timerProgress = clamp(this.quizTimer / C.QUIZ_DURATION, 0, 1);

    // Timer background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(timerBarX, timerBarY, timerBarW, timerBarH, 3);
    ctx.fill();

    // Timer fill
    const timerColor = timerProgress > 0.3 ? C.COLORS.good : C.COLORS.bad;
    ctx.fillStyle = timerColor;
    ctx.globalAlpha = fadeIn * 0.8;
    ctx.beginPath();
    ctx.roundRect(timerBarX, timerBarY, timerBarW * timerProgress, timerBarH, 3);
    ctx.fill();
    ctx.globalAlpha = fadeIn;

    // Progress dots
    const dotY = C.CANVAS_H * 0.25;
    for (let i = 0; i < this.quizLessons.length; i++) {
      const dotX = cx - 30 + i * 30;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      if (i < this.quizCurrent) {
        const lesson = this.quizLessons[i];
        ctx.fillStyle = lesson.correct ? C.COLORS.good : C.COLORS.bad;
      } else if (i === this.quizCurrent) {
        ctx.fillStyle = C.COLORS.god;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
      }
      ctx.fill();
    }

    // Current question
    if (this.quizCurrent < this.quizLessons.length) {
      const lesson = this.quizLessons[this.quizCurrent];

      // Question text
      ctx.font = C.FONT.quiz;
      ctx.fillStyle = '#e0e0e0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Word wrap the lesson text
      const words = lesson.text.split(' ');
      const maxW = C.CANVAS_W - 120;
      let lines = [];
      let currentLine = '';
      words.forEach(word => {
        const test = currentLine ? currentLine + ' ' + word : word;
        if (measureText(ctx, test, C.FONT.quiz).width > maxW) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = test;
        }
      });
      if (currentLine) lines.push(currentLine);

      const questionY = C.CANVAS_H * 0.38;
      lines.forEach((line, i) => {
        ctx.fillText(line, cx, questionY + i * 28);
      });

      // Question label
      ctx.font = "500 16px 'Rajdhani', sans-serif";
      ctx.fillStyle = C.COLORS.playFrame;
      ctx.globalAlpha = fadeIn * 0.7;
      ctx.fillText('What category does this lesson fit?', cx, questionY - 35);
      ctx.globalAlpha = fadeIn;

      // Category buttons
      const btnW = 180;
      const btnH = 42;
      const btnY = C.CANVAS_H * 0.58;
      const gap = 15;
      const totalW = btnW * 3 + gap * 2;
      const startX = cx - totalW / 2;

      C.LESSON_CATEGORIES.forEach((cat, i) => {
        const bx = startX + i * (btnW + gap);
        const isHovered = false; // could add hover detection

        // Button background
        ctx.fillStyle = cat.color;
        ctx.globalAlpha = fadeIn * (this.quizAnswered ? 0.3 : 0.2);
        ctx.beginPath();
        ctx.roundRect(bx, btnY, btnW, btnH, 6);
        ctx.fill();

        // Button border
        ctx.strokeStyle = cat.color;
        ctx.lineWidth = this.quizAnswered && cat.key === this.quizLessons[this.quizCurrent].correctKey ? 3 : 1.5;
        ctx.globalAlpha = fadeIn * (this.quizAnswered ? 0.9 : 0.7);
        ctx.beginPath();
        ctx.roundRect(bx, btnY, btnW, btnH, 6);
        ctx.stroke();

        // Highlight correct answer when answered
        if (this.quizAnswered && cat.key === this.quizLessons[this.quizCurrent].correctKey) {
          ctx.fillStyle = cat.color;
          ctx.globalAlpha = fadeIn * 0.4;
          ctx.beginPath();
          ctx.roundRect(bx, btnY, btnW, btnH, 6);
          ctx.fill();
        }

        // Button label
        ctx.font = C.FONT.quizOption;
        ctx.fillStyle = cat.color;
        ctx.globalAlpha = fadeIn;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${cat.icon} ${cat.label}`, bx + btnW / 2, btnY + btnH / 2);

        // Keyboard hint
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.fillStyle = '#6b7b8d';
        ctx.globalAlpha = fadeIn * 0.5;
        ctx.fillText(`[${i + 1}]`, bx + btnW / 2, btnY + btnH + 14);
      });
    }

    // Feedback
    if (this.quizFeedback) {
      ctx.font = "bold 20px 'Rajdhani', sans-serif";
      ctx.fillStyle = this.quizFeedback.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeIn * clamp(this.quizFeedback.timer * 2, 0, 1);
      ctx.fillText(this.quizFeedback.text, cx, C.CANVAS_H * 0.75);
    }

    // Quiz score
    ctx.font = C.FONT.hud;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fadeIn * 0.8;
    ctx.fillText(`Quiz Bonus: +${this.quizScore}`, cx, C.CANVAS_H * 0.9);

    ctx.restore();
  }

  // ── Mini-Game Rendering (Feature #8) ──────────────────────

  _renderMiniGame(ctx) {
    this._renderBackground(ctx);
    this._renderBgGlyphs(ctx);

    const cx = C.CANVAS_W / 2;
    const fadeIn = easeOutCubic(clamp(this.stateTime * 3, 0, 1));

    ctx.save();
    ctx.globalAlpha = fadeIn;

    // Dark overlay
    ctx.fillStyle = 'rgba(2, 6, 9, 0.88)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Title
    ctx.font = C.FONT.titleSm;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(117, 215, 230, 0.5)';
    ctx.shadowBlur = 15;

    const titleMap = {
      'reassemble': 'VERSE REASSEMBLY',
      'missing_word': 'FILL THE BLANKS',
      'category_sort': 'CATEGORY SORT'
    };
    ctx.fillText(titleMap[this.miniGameType] || 'MINI GAME', cx, C.CANVAS_H * 0.08);
    ctx.shadowBlur = 0;

    // Timer bar
    const timerBarW = 400;
    const timerBarH = 6;
    const timerBarX = cx - timerBarW / 2;
    const timerBarY = C.CANVAS_H * 0.13;
    const maxTimer = this.miniGameType === 'category_sort' ? 10 : C.MINIGAME_DURATION;
    const timerProgress = clamp(this.miniTimer / maxTimer, 0, 1);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(timerBarX, timerBarY, timerBarW, timerBarH, 3);
    ctx.fill();

    const timerColor = timerProgress > 0.3 ? C.COLORS.good : C.COLORS.bad;
    ctx.fillStyle = timerColor;
    ctx.globalAlpha = fadeIn * 0.8;
    ctx.beginPath();
    ctx.roundRect(timerBarX, timerBarY, timerBarW * timerProgress, timerBarH, 3);
    ctx.fill();
    ctx.globalAlpha = fadeIn;

    // Verse reference
    if (this.currentVerse) {
      ctx.font = C.FONT.verseRef;
      ctx.fillStyle = C.COLORS.footerFrame;
      ctx.globalAlpha = fadeIn * 0.6;
      ctx.fillText(this.currentVerse.ref, cx, C.CANVAS_H * 0.17);
      ctx.globalAlpha = fadeIn;
    }

    // Render specific mini-game type
    switch (this.miniGameType) {
      case 'reassemble':
        this._renderReassemble(ctx, fadeIn);
        break;
      case 'missing_word':
        this._renderMissingWord(ctx, fadeIn);
        break;
      case 'category_sort':
        this._renderCategorySort(ctx, fadeIn);
        break;
    }

    // Feedback
    if (this.miniFeedback) {
      ctx.font = "bold 18px 'Rajdhani', sans-serif";
      ctx.fillStyle = this.miniFeedback.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeIn * clamp(this.miniFeedback.timer * 3, 0, 1);
      ctx.fillText(this.miniFeedback.text, cx, C.CANVAS_H * 0.92);
    }

    // Completion message
    if (this.miniComplete) {
      ctx.font = "bold 24px 'Rajdhani', sans-serif";
      ctx.fillStyle = C.COLORS.good;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeIn;
      ctx.shadowColor = C.COLORS.goodGlow;
      ctx.shadowBlur = 10;
      ctx.fillText(`Mini-Game Complete! +${this.miniScore}`, cx, C.CANVAS_H * 0.86);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _renderReassemble(ctx, fadeIn) {
    const cx = C.CANVAS_W / 2;

    // Instructions
    ctx.font = "500 16px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fadeIn * 0.7;
    ctx.fillText('Click the phrases in the correct order to reassemble the verse', cx, C.CANVAS_H * 0.22);
    ctx.globalAlpha = fadeIn;

    // Already selected (correct order so far)
    if (this.miniSelected.length > 0) {
      ctx.font = C.FONT.verse;
      ctx.fillStyle = C.COLORS.good;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeIn * 0.8;

      const selectedTexts = this.miniSelected.map(i => this.miniPhrases[i].text);
      const assembled = selectedTexts.join(' ');
      const maxW = C.CANVAS_W - 100;
      if (measureText(ctx, assembled, C.FONT.verse).width > maxW) {
        const lastFew = selectedTexts.slice(-3).join(' ');
        ctx.fillText('... ' + lastFew, cx, C.CANVAS_H * 0.30);
      } else {
        ctx.fillText(assembled, cx, C.CANVAS_H * 0.30);
      }
    }

    // Phrase buttons
    const startY = C.CANVAS_H * 0.4;
    const btnH = 36;
    const gap = 8;
    const bw = Math.min(C.CANVAS_W - 100, 600);
    const bx = cx - bw / 2;

    for (let i = 0; i < this.miniPhrases.length; i++) {
      const phrase = this.miniPhrases[i];
      const by = startY + i * (btnH + gap);

      if (by + btnH > C.CANVAS_H * 0.82) break; // Don't overflow

      // Button background
      ctx.fillStyle = phrase.selected ? C.COLORS.good : 'rgba(255,255,255,0.05)';
      ctx.globalAlpha = fadeIn * (phrase.selected ? 0.3 : 0.8);
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, btnH, 5);
      ctx.fill();

      // Button border
      ctx.strokeStyle = phrase.selected ? C.COLORS.good : C.COLORS.playFrame;
      ctx.lineWidth = 1;
      ctx.globalAlpha = fadeIn * (phrase.selected ? 0.6 : 0.4);
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, btnH, 5);
      ctx.stroke();

      // Number label
      ctx.font = "bold 14px 'Share Tech Mono', monospace";
      ctx.fillStyle = phrase.selected ? C.COLORS.good : C.COLORS.playFrame;
      ctx.globalAlpha = fadeIn * 0.6;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${i + 1}]`, bx + 8, by + btnH / 2);

      // Phrase text
      ctx.font = C.FONT.miniGame;
      ctx.fillStyle = phrase.selected ? C.COLORS.good : '#d0d0d0';
      ctx.globalAlpha = fadeIn * (phrase.selected ? 0.5 : 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Strikethrough for selected
      if (phrase.selected) {
        ctx.fillText(phrase.text, cx, by + btnH / 2);
        // Draw strikethrough line
        const textW = measureText(ctx, phrase.text, C.FONT.miniGame).width;
        ctx.strokeStyle = C.COLORS.good;
        ctx.lineWidth = 1;
        ctx.globalAlpha = fadeIn * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - textW / 2, by + btnH / 2);
        ctx.lineTo(cx + textW / 2, by + btnH / 2);
        ctx.stroke();
      } else {
        ctx.fillText(phrase.text, cx, by + btnH / 2);
      }
    }
  }

  _renderMissingWord(ctx, fadeIn) {
    const cx = C.CANVAS_W / 2;

    // Instructions
    ctx.font = "500 16px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fadeIn * 0.7;
    ctx.fillText('Fill in the missing words from the verse', cx, C.CANVAS_H * 0.22);
    ctx.globalAlpha = fadeIn;

    // Show verse with blanks
    const words = this.currentVerse.text.split(' ');
    let displayWords = [...words];
    let blankCounter = 0;
    for (const blankIdx of this.miniBlankIndices) {
      if (this.miniFilledBlanks[blankCounter] !== null) {
        displayWords[blankIdx] = this.miniFilledBlanks[blankCounter];
      } else {
        displayWords[blankIdx] = '____';
      }
      blankCounter++;
    }

    const verseDisplay = displayWords.join(' ');
    ctx.font = C.FONT.verse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Word wrap
    const maxW = C.CANVAS_W - 100;
    let lines = [];
    let currentLine = '';
    displayWords.forEach((word, idx) => {
      const test = currentLine ? currentLine + ' ' + word : word;
      if (measureText(ctx, test, C.FONT.verse).width > maxW) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    });
    if (currentLine) lines.push(currentLine);

    const verseY = C.CANVAS_H * 0.32;
    lines.forEach((line, i) => {
      // Highlight blanks in the line
      const lineWords = line.split(' ');
      let lineX = cx - measureText(ctx, line, C.FONT.verse).width / 2;
      ctx.textAlign = 'left';

      lineWords.forEach((word, wi) => {
        const isBlank = word === '____';
        const isFilled = this.miniBlankIndices.some((bi, fi) =>
          displayWords[bi] === word && this.miniFilledBlanks[fi] !== null
        );

        ctx.fillStyle = isBlank ? C.COLORS.bad : (isFilled ? C.COLORS.good : '#d0d0d0');
        ctx.globalAlpha = fadeIn;
        ctx.fillText(word, lineX, verseY + i * 26);
        lineX += measureText(ctx, word + ' ', C.FONT.verse).width;
      });
    });

    // Word bank
    ctx.textAlign = 'center';
    const bankY = C.CANVAS_H * 0.68;
    const btnW = 100;
    const btnH = 36;
    const gap = 10;
    const totalW = this.miniWordBank.length * (btnW + gap) - gap;
    const startX = cx - totalW / 2;

    ctx.font = "500 14px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.globalAlpha = fadeIn * 0.6;
    ctx.fillText('Word Bank:', cx, bankY - 20);

    for (let i = 0; i < this.miniWordBank.length; i++) {
      const word = this.miniWordBank[i];
      const bx = startX + i * (btnW + gap);

      // Button
      ctx.fillStyle = word.used ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255,255,255,0.08)';
      ctx.globalAlpha = fadeIn * (word.used ? 0.5 : 1);
      ctx.beginPath();
      ctx.roundRect(bx, bankY, btnW, btnH, 5);
      ctx.fill();

      ctx.strokeStyle = word.used ? C.COLORS.good : C.COLORS.connector;
      ctx.lineWidth = 1;
      ctx.globalAlpha = fadeIn * (word.used ? 0.4 : 0.6);
      ctx.beginPath();
      ctx.roundRect(bx, bankY, btnW, btnH, 5);
      ctx.stroke();

      ctx.font = C.FONT.miniGame;
      ctx.fillStyle = word.used ? C.COLORS.good : '#d0d0d0';
      ctx.globalAlpha = fadeIn * (word.used ? 0.4 : 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word.text, bx + btnW / 2, bankY + btnH / 2);
    }
  }

  _renderCategorySort(ctx, fadeIn) {
    const cx = C.CANVAS_W / 2;

    // Instructions
    ctx.font = "500 16px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fadeIn * 0.7;
    ctx.fillText('Watch as the verse phrases are sorted by category', cx, C.CANVAS_H * 0.22);
    ctx.globalAlpha = fadeIn;

    // Category columns
    const colW = 200;
    const colGap = 20;
    const colStartX = cx - (colW * 3 + colGap * 2) / 2;
    const colY = C.CANVAS_H * 0.30;
    const colH = C.CANVAS_H * 0.50;

    const categories = C.LESSON_CATEGORIES;
    categories.forEach((cat, ci) => {
      const cx2 = colStartX + ci * (colW + colGap);

      // Column header
      ctx.fillStyle = cat.color;
      ctx.globalAlpha = fadeIn * 0.3;
      ctx.beginPath();
      ctx.roundRect(cx2, colY, colW, 32, [5, 5, 0, 0]);
      ctx.fill();

      ctx.font = "bold 14px 'Rajdhani', sans-serif";
      ctx.fillStyle = cat.color;
      ctx.globalAlpha = fadeIn;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cat.icon} ${cat.label}`, cx2 + colW / 2, colY + 16);

      // Column body
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.globalAlpha = fadeIn * 0.5;
      ctx.beginPath();
      ctx.roundRect(cx2, colY + 32, colW, colH - 32, [0, 0, 5, 5]);
      ctx.fill();

      ctx.strokeStyle = cat.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = fadeIn * 0.2;
      ctx.beginPath();
      ctx.roundRect(cx2, colY, colW, colH, 5);
      ctx.stroke();
    });

    // Place revealed phrases in their columns
    const categorized = { god: [], good: [], bad: [] };
    this.miniPhrases.forEach(phrase => {
      if (phrase.revealed) {
        const cat = phrase.category;
        if (categorized[cat]) {
          categorized[cat].push(phrase.text);
        } else {
          // Put in 'other' items under 'good' for simplicity
          categorized.good.push(phrase.text);
        }
      }
    });

    categories.forEach((cat, ci) => {
      const cx2 = colStartX + ci * (colW + colGap);
      const items = categorized[cat.key] || [];
      let iy = colY + 42;

      ctx.font = "500 14px 'Rajdhani', sans-serif";
      items.forEach(text => {
        ctx.fillStyle = cat.color;
        ctx.globalAlpha = fadeIn * 0.85;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Truncate if too long
        const displayText = text.length > 22 ? text.substring(0, 19) + '...' : text;
        ctx.fillText(displayText, cx2 + colW / 2, iy);
        iy += 22;
      });
    });
  }

  _renderGameOver(ctx) {
    this._renderParticles(ctx);

    ctx.save();

    const fadeIn = easeOutCubic(clamp(this.stateTime * 2, 0, 1));
    ctx.globalAlpha = fadeIn;

    // Dark overlay
    ctx.fillStyle = 'rgba(2, 6, 9, 0.8)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    if (this._gameComplete) {
      // Victory screen
      ctx.font = C.FONT.gameOver;
      ctx.fillStyle = C.COLORS.god;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = C.COLORS.godGlow;
      ctx.shadowBlur = 30;
      ctx.fillText('VICTORY!', C.CANVAS_W / 2, C.CANVAS_H * 0.3);

      ctx.font = C.FONT.titleSm;
      ctx.fillStyle = C.COLORS.good;
      ctx.shadowBlur = 0;
      ctx.fillText('All Levels Complete', C.CANVAS_W / 2, C.CANVAS_H * 0.3 + 55);

      // Cross
      ctx.font = '80px serif';
      ctx.fillStyle = C.COLORS.god;
      ctx.shadowColor = C.COLORS.godGlow;
      ctx.shadowBlur = 40;
      ctx.globalAlpha = fadeIn * 0.5;
      ctx.fillText('\u271D', C.CANVAS_W / 2, C.CANVAS_H * 0.55);
    } else {
      // Game over screen
      ctx.font = C.FONT.gameOver;
      ctx.fillStyle = C.COLORS.bad;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = C.COLORS.badGlow;
      ctx.shadowBlur = 25;
      ctx.fillText('GAME OVER', C.CANVAS_W / 2, C.CANVAS_H * 0.32);
    }

    // Score
    ctx.globalAlpha = fadeIn;
    ctx.shadowBlur = 0;
    ctx.font = C.FONT.score;
    ctx.fillStyle = this.score >= 0 ? C.COLORS.god : C.COLORS.bad;
    ctx.fillText(`SCORE: ${this.score}`, C.CANVAS_W / 2, C.CANVAS_H * 0.52);

    if (this.bestScore > 0) {
      ctx.font = C.FONT.hud;
      ctx.fillStyle = C.COLORS.playFrame;
      ctx.fillText(`BEST: ${this.bestScore}`, C.CANVAS_W / 2, C.CANVAS_H * 0.58);
    }

    // Last verse
    if (this.currentVerse) {
      ctx.font = C.FONT.verse;
      ctx.fillStyle = C.COLORS.god;
      ctx.globalAlpha = fadeIn * 0.6;
      const text = this.currentVerse.text.length > 80
        ? this.currentVerse.text.substring(0, 77) + '...'
        : this.currentVerse.text;
      ctx.fillText(`"${text}"`, C.CANVAS_W / 2, C.CANVAS_H * 0.68);
      ctx.font = C.FONT.verseRef;
      ctx.fillStyle = C.COLORS.footerFrame;
      ctx.fillText(`-- ${this.currentVerse.ref}`, C.CANVAS_W / 2, C.CANVAS_H * 0.73);
    }

    // Restart prompt (or hint about share screen coming)
    const pulse = 0.5 + Math.sin(this.stateTime * 3) * 0.5;
    ctx.globalAlpha = fadeIn * pulse;
    ctx.font = C.FONT.hudSmall;
    ctx.fillStyle = C.COLORS.god;
    ctx.fillText('CLICK to Play Again  |  Share screen coming...', C.CANVAS_W / 2, C.CANVAS_H * 0.85);

    ctx.restore();
  }

  // ── Share Screen Rendering (Feature #14) ──────────────────

  _renderShareScreen(ctx) {
    this._renderParticles(ctx);

    ctx.save();
    const cx = C.CANVAS_W / 2;
    const fadeIn = easeOutCubic(clamp(this.stateTime * 2, 0, 1));
    ctx.globalAlpha = fadeIn;

    // Dark overlay
    ctx.fillStyle = 'rgba(2, 6, 9, 0.88)';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Title
    ctx.font = C.FONT.titleSm;
    ctx.fillStyle = C.COLORS.god;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = C.COLORS.godGlow;
    ctx.shadowBlur = 20;
    ctx.fillText(this._gameComplete ? 'VICTORY!' : 'GAME OVER', cx, C.CANVAS_H * 0.15);
    ctx.shadowBlur = 0;

    // Score display
    ctx.font = C.FONT.score;
    ctx.fillStyle = this.score >= 0 ? C.COLORS.god : C.COLORS.bad;
    ctx.fillText(`SCORE: ${this.score}`, cx, C.CANVAS_H * 0.25);

    ctx.font = C.FONT.hud;
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.fillText(`LEVEL: ${this.level}  |  BEST: ${this.bestScore}`, cx, C.CANVAS_H * 0.32);

    // Last verse
    if (this.currentVerse) {
      ctx.font = C.FONT.verse;
      ctx.fillStyle = C.COLORS.god;
      ctx.globalAlpha = fadeIn * 0.7;
      const text = this.currentVerse.text.length > 70
        ? this.currentVerse.text.substring(0, 67) + '...'
        : this.currentVerse.text;
      ctx.fillText(`"${text}"`, cx, C.CANVAS_H * 0.42);
      ctx.font = C.FONT.verseRef;
      ctx.fillStyle = C.COLORS.footerFrame;
      ctx.fillText(`-- ${this.currentVerse.ref}`, cx, C.CANVAS_H * 0.47);
      ctx.globalAlpha = fadeIn;
    }

    // Share label
    ctx.font = "600 18px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.playFrame;
    ctx.fillText('Share your score:', cx, C.CANVAS_H * 0.55);

    // Share buttons
    const btnW = 140;
    const btnH = 44;
    const btnY = C.CANVAS_H * 0.62;
    const gap = 20;
    const totalW = btnW * 3 + gap * 2;
    const startX = cx - totalW / 2;

    const shareButtons = [
      { label: 'Email', icon: '\uD83D\uDCE7', color: '#64B5F6' },
      { label: 'WhatsApp', icon: '\uD83D\uDCF1', color: '#66BB6A' },
      { label: 'Copy', icon: '\uD83D\uDCCB', color: '#FFD54F' }
    ];

    shareButtons.forEach((btn, i) => {
      const bx = startX + i * (btnW + gap);

      // Button background
      ctx.fillStyle = btn.color;
      ctx.globalAlpha = fadeIn * 0.15;
      ctx.beginPath();
      ctx.roundRect(bx, btnY, btnW, btnH, 8);
      ctx.fill();

      // Button border
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fadeIn * 0.7;
      ctx.beginPath();
      ctx.roundRect(bx, btnY, btnW, btnH, 8);
      ctx.stroke();

      // Button label
      ctx.font = "600 16px 'Rajdhani', sans-serif";
      ctx.fillStyle = btn.color;
      ctx.globalAlpha = fadeIn;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${btn.icon} ${btn.label}`, bx + btnW / 2, btnY + btnH / 2);
    });

    // "Copied!" feedback
    if (this.shareClipboardFeedback > 0) {
      ctx.font = "bold 16px 'Rajdhani', sans-serif";
      ctx.fillStyle = C.COLORS.good;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fadeIn * clamp(this.shareClipboardFeedback, 0, 1);
      ctx.fillText('Copied to clipboard!', cx, btnY + btnH + 25);
    }

    // Share not available notice
    if (!shareModule) {
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillStyle = '#6b7b8d';
      ctx.globalAlpha = fadeIn * 0.4;
      ctx.fillText('(Share module loading...)', cx, btnY + btnH + 25);
    }

    // Play Again button
    const playAgainY = C.CANVAS_H * 0.78;
    const playAgainW = 200;
    const playAgainH = 48;
    const playAgainX = cx - playAgainW / 2;

    const playPulse = 0.7 + Math.sin(this.stateTime * 3) * 0.3;

    ctx.fillStyle = C.COLORS.god;
    ctx.globalAlpha = fadeIn * 0.2;
    ctx.beginPath();
    ctx.roundRect(playAgainX, playAgainY, playAgainW, playAgainH, 8);
    ctx.fill();

    ctx.strokeStyle = C.COLORS.god;
    ctx.lineWidth = 2;
    ctx.globalAlpha = fadeIn * playPulse;
    ctx.beginPath();
    ctx.roundRect(playAgainX, playAgainY, playAgainW, playAgainH, 8);
    ctx.stroke();

    ctx.font = "bold 18px 'Rajdhani', sans-serif";
    ctx.fillStyle = C.COLORS.god;
    ctx.globalAlpha = fadeIn * playPulse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PLAY AGAIN', cx, playAgainY + playAgainH / 2);

    // Keyboard hint
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillStyle = '#6b7b8d';
    ctx.globalAlpha = fadeIn * 0.5;
    ctx.fillText('Press ENTER or R to play again', cx, C.CANVAS_H * 0.92);

    ctx.restore();
  }
}
