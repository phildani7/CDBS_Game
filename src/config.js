// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Game Constants
//  Color system aligned with CDBS (Color and Draw Bible Study)
// ─────────────────────────────────────────────────────────────

// Canvas
export const CANVAS_W = 960;
export const CANVAS_H = 720;

// Layout regions
export const HUD_HEIGHT = 58;
export const BRICK_REGION_TOP = 66;
export const BRICK_REGION_HEIGHT = 260;
export const PLAY_RECT = { x: 10, y: HUD_HEIGHT, w: CANVAS_W - 20, h: CANVAS_H - HUD_HEIGHT - 10 };
export const WALL_PAD = 10;

// Paddle
export const PADDLE_TEXT = '⟦==========⟧';
export const PADDLE_TEXT_WIDE = '⟦================⟧';
export const PADDLE_Y_OFFSET = 60;
export const PADDLE_SPEED = 540;
export const PADDLE_LERP = 16;

// Ball
export const BALL_CHAR = '◉';
export const BALL_BASE_SPEED = 310;
export const BALL_SPEED_PER_LEVEL = 12;
export const BALL_MIN_VY_RATIO = 0.36;
export const BALL_RADIUS_MIN = 8;
export const BALL_RADIUS_MAX = 14;
export const MAX_BALLS = 5;

// Trinity ball characters and colors
export const TRINITY_BALLS = {
  jesus:  { char: '✝', color: '#FF8C00', glow: 'rgba(255,140,0,0.5)', label: 'Jesus – Grace through sin' },
  spirit: { char: '🕊', color: '#42A5F5', glow: 'rgba(66,165,245,0.5)', label: 'Spirit – Reveals truth' },
  father: { char: '✦', color: '#FFD700', glow: 'rgba(255,215,0,0.5)', label: 'Father – Double blessing' }
};

// Brick scoring by category (CDBS aligned)
export const SCORE = {
  god: 150,       // Gold – about God / His character
  good: 100,      // Green – good for us / obey
  bad: -120,      // Red – not good for us / warning
  connector: 25,  // Blue – sequence / connection
  earth: 40,      // Brown – earth / foundation
  royal: 80,      // Purple – royalty / kingdom
  other: 50       // Neutral
};

// CDBS-aligned category colors
export const COLORS = {
  god: '#F5A623',       // Gold – About God
  good: '#4CAF50',      // Green – Good / Obey
  bad: '#E53E3E',       // Red – Warning
  connector: '#2196F3', // Blue – Sequence / Connection
  earth: '#8D6E63',     // Brown – Earth / Foundation
  royal: '#7B1FA2',     // Purple – Royalty / Kingdom
  other: '#90A4AE',     // Gray-blue – Other

  // Glow variants
  godGlow: 'rgba(245, 166, 35, 0.4)',
  goodGlow: 'rgba(76, 175, 80, 0.35)',
  badGlow: 'rgba(229, 62, 62, 0.4)',
  connectorGlow: 'rgba(33, 150, 243, 0.3)',
  earthGlow: 'rgba(141, 110, 99, 0.3)',
  royalGlow: 'rgba(123, 31, 162, 0.35)',
  otherGlow: 'rgba(144, 164, 174, 0.3)',

  // UI colors
  bg: '#070d18',
  bgGrad1: '#070d18',
  bgGrad2: '#0f1d35',
  bgGrad3: '#1a0f28',
  hudFrame: '#9bbce9',
  playFrame: '#75d7e6',
  footerFrame: '#f0c35f',
  paddle: '#f5f0df',
  paddleGlow: 'rgba(117, 215, 230, 0.35)',
  ball: '#ffd577',
  ballGlow: 'rgba(255, 183, 76, 0.45)',
  textWall: ['#2a4458', '#354f6a', '#3d5c78', '#455e6d'],
  textWallAlpha: 0.45,

  // Heaven surface
  heavenGold: '#FFD700',
  heavenGlow: 'rgba(255, 215, 0, 0.25)',

  // Earth surface
  earthGreen: '#4CAF50',
  earthDarkGreen: '#2E7D32',
  earthBrown: '#5D4037'
};

// Power-ups with CDBS symbols
export const POWERUP_CHANCE = 0.32;
export const POWERUP_FALL_SPEED = 146;
export const POWERUP_TYPES = [
  { kind: 'expand', label: '⛨ Widen',    symbol: '⛨', color: '#95edff', duration: 12 },
  { kind: 'slow',   label: '🕊 Peace',    symbol: '🕊', color: '#ffd577', duration: 10 },
  { kind: 'multi',  label: '🌾 Harvest',  symbol: '🌾', color: '#c7b2ff', duration: 0 },
  { kind: 'guard',  label: '🛡 Shield',   symbol: '🛡', color: '#a4f094', duration: 0 },
  { kind: 'life',   label: '✝ Life',      symbol: '✝',  color: '#ff9db8', duration: 0 },
  { kind: 'reveal', label: '👑 Reveal',   symbol: '👑', color: '#FFD700', duration: 8 },
  { kind: 'trinity',label: '☩ Trinity',   symbol: '☩',  color: '#FF8C00', duration: 0 }
];

// Hazards (negative drops from red/bad bricks)
export const HAZARD_CHANCE = 0.55;         // Chance to drop hazard when red brick is hit
export const HAZARD_FALL_SPEED = 170;      // Slightly faster than powerups
export const HAZARD_TYPES = [
  { kind: 'shrink',  label: '⚠ Shrink',   symbol: '⚠', color: '#E53E3E', duration: 8 },
  { kind: 'speed',   label: '⚡ Speed Up', symbol: '⚡', color: '#FF6B35', duration: 8 },
  { kind: 'blind',   label: '🌑 Darkness', symbol: '🌑', color: '#4A0E0E', duration: 5 },
  { kind: 'drain',   label: '💀 -100pts',  symbol: '💀', color: '#8B0000', duration: 0 }
];

// Guard
export const GUARD_TEXT = '⟦:::: SAFEGUARD ::::⟧';
export const GUARD_COLOR = '#a4f094';
export const GUARD_CHARGES = 2;

// Physics
export const SCREEN_SHAKE_DECAY = 16;
export const SHAKE = {
  paddleHit: 1.2,
  brickBreak: 2.2,
  guardSave: 1.8,
  lifeLoss: 3.2,
  waveClear: 2.8,
  badBrick: 3.5,
  wrongAnswer: 5.0
};

// Lives
export const INITIAL_LIVES = 3;
export const MAX_LIVES = 6;

// Timing (seconds)
export const INTRO_DURATION = 2.34;
export const CLEAR_DURATION = 2.18;
export const OPENING_DURATION = 3.1;
export const QUIZ_DURATION = 45;
export const MINIGAME_DURATION = 60;
export const CATEGORY_SORT_DURATION = 35;

// Order bonus – points awarded based on which category brick is hit first
export const ORDER_BONUS = {
  god: 200,       // Max bonus – about God first
  royal: 150,     // Royalty/kingdom early
  good: 120,      // Good for us
  earth: 80,      // Earth/foundation
  other: 50,      // Neutral
  connector: 30,  // Connectors
  bad: 0          // No bonus for bad first
};
// Bonus decays: each subsequent brick gets ORDER_BONUS[cat] * (1 - position/total)
export const RED_ONLY_CLEAR_BONUS = 500; // Bonus for auto-clearing when only red bricks remain

// Levels – 20 levels with graduated difficulty
export const TOTAL_LEVELS = 20;
export const DIFFICULTY_PER_LEVEL = [
  [1, 2],  // Level 1
  [1, 3],  // Level 2
  [2, 3],  // Level 3
  [2, 4],  // Level 4
  [3, 4],  // Level 5
  [3, 5],  // Level 6
  [4, 5],  // Level 7
  [4, 6],  // Level 8
  [5, 6],  // Level 9
  [5, 7],  // Level 10
  [5, 7],  // Level 11
  [6, 7],  // Level 12
  [6, 8],  // Level 13
  [6, 8],  // Level 14
  [7, 8],  // Level 15
  [7, 9],  // Level 16
  [7, 9],  // Level 17
  [8, 9],  // Level 18
  [8, 10], // Level 19
  [9, 10]  // Level 20
];

// Particles
export const PARTICLE_GRAVITY = 90;
export const BRICK_PARTICLE_SPEED = [80, 120];
export const BRICK_PARTICLE_LIFE = [0.7, 1.05];
export const BALL_TRAIL_CHANCE = 0.5;
export const BALL_TRAIL_LIFE = 0.26;
export const WAKE_RADIUS = 30;
export const WAKE_LIFE = 0.42;

// Brick layout
export const BRICK_PADDING_X_RATIO = 0.22;
export const BRICK_PADDING_Y_RATIO = 0.15;
export const BRICK_FONT_SIZES = [30, 28, 26, 24, 22, 20, 18, 16];
export const BRICK_FONT_FAMILY = "'Rajdhani', sans-serif";
export const BRICK_STROKE_COLOR = 'rgba(5, 10, 16, 0.65)';

// Text wall (PreText-style interactive displacement)
export const WALL_FONT_SIZE = 13;
export const WALL_LINE_HEIGHT = 16;
export const WALL_FONT = "13px 'Share Tech Mono', monospace";
export const WALL_CHAR_W = 7.8;            // monospace char width at 13px
export const WALL_REPEL_RADIUS = 60;       // ball pushes chars within this radius
export const WALL_REPEL_STRENGTH = 2800;   // force magnitude
export const WALL_SPRING = 6.0;            // spring-back speed (higher = snappier)
export const WALL_DAMPING = 0.88;          // velocity damping per frame
export const WALL_PARTICLE_REPEL = 36;     // smaller repel radius for particles
export const WALL_PARTICLE_STRENGTH = 800; // weaker force for particles

// Background particles
export const BG_GLYPH_COUNT = 54;
export const BG_GLYPHS = ['.', ':', '·', '✦', '+', '†'];
export const BG_SPEED = [8, 18];
export const BG_COLOR = '#c8e9ff';
export const BG_ALPHA = 0.12;

// Fonts
export const FONT = {
  hud: "bold 16px 'Orbitron', sans-serif",
  hudSmall: "14px 'Rajdhani', sans-serif",
  title: "900 48px 'Orbitron', sans-serif",
  titleSm: "700 28px 'Orbitron', sans-serif",
  subtitle: "500 20px 'Rajdhani', sans-serif",
  verse: "600 18px 'Rajdhani', sans-serif",
  verseRef: "bold 16px 'Orbitron', sans-serif",
  ball: "800 24px 'Share Tech Mono', monospace",
  paddle: "bold 20px 'Share Tech Mono', monospace",
  guard: "bold 16px 'Share Tech Mono', monospace",
  banner: "900 42px 'Orbitron', sans-serif",
  bannerSub: "500 22px 'Rajdhani', sans-serif",
  score: "bold 20px 'Orbitron', sans-serif",
  gameOver: "900 56px 'Orbitron', sans-serif",
  quiz: "600 20px 'Rajdhani', sans-serif",
  quizOption: "500 18px 'Rajdhani', sans-serif",
  miniGame: "600 22px 'Rajdhani', sans-serif"
};

// CDBS YouTube – CartoonForChrist channel (190 videos loaded from JSON)
export const YOUTUBE_CHANNEL = '@CartoonForChrist';
export const YOUTUBE_PLAYLIST = 'PL_zwO2E6LyLJUq9r68bF-zXd8lw_phslx';
// Videos loaded dynamically from src/data/youtube.json in main.js

// Category labels (shown when bricks break so kids understand WHY)
export const CATEGORY_LABELS = {
  god:       '✦ About God',
  good:      '✓ Good for us',
  bad:       '✗ Warning!',
  connector: '→ Connector',
  earth:     '🌍 Earth',
  royal:     '👑 Royalty',
  other:     '· Neutral'
};

// Lesson categories for quiz
export const LESSON_CATEGORIES = [
  { key: 'god',  label: 'About God',        color: COLORS.god,  icon: '✦' },
  { key: 'good', label: 'Good for us',      color: COLORS.good, icon: '✓' },
  { key: 'bad',  label: 'Not good for us',  color: COLORS.bad,  icon: '✗' }
];

// Mini-game types
export const MINIGAME_TYPES = ['reassemble', 'missing_word'];

// Activity scoring
export const QUIZ_CORRECT_POINTS = 75;       // Per correct quiz answer
export const QUIZ_PERFECT_BONUS = 300;        // All 3 correct
export const MINI_CORRECT_POINTS = 50;        // Per correct mini-game step
export const MINI_PERFECT_BONUS = 400;        // Perfect mini-game
export const POWERUP_COLLECT_POINTS = 50;     // Points per power-up collected (was 35)

// Score popup visibility
export const SCORE_POPUP_LIFE = 2.2;          // Seconds popup is visible (was 1.2)
export const SCORE_POPUP_SPEED = 35;          // Upward speed (was 60 - slower = more visible)
export const BONUS_POPUP_LIFE = 3.0;          // Bonus popups last even longer
export const BONUS_FLASH_DURATION = 0.8;      // Flash duration for big bonuses
