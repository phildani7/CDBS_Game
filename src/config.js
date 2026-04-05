// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Game Constants
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
export const PADDLE_Y_OFFSET = 60; // from bottom of play rect
export const PADDLE_SPEED = 540;
export const PADDLE_LERP = 16;

// Ball
export const BALL_CHAR = '◉';
export const BALL_BASE_SPEED = 310;
export const BALL_SPEED_PER_LEVEL = 22;
export const BALL_MIN_VY_RATIO = 0.36;
export const BALL_RADIUS_MIN = 8;
export const BALL_RADIUS_MAX = 14;
export const MAX_BALLS = 5;

// Brick scoring by category
export const SCORE = {
  god: 150,      // Maximum positive – about God
  good: 100,     // Positive – good for us
  other: 50,     // Neutral
  connector: 25, // Connecting words
  bad: -120      // Maximum negative – not good for us
};

// Category colors – futuristic neon palette
export const COLORS = {
  god: '#FFD700',       // Gold
  good: '#4ADE80',      // Green
  bad: '#EF4444',       // Red
  connector: '#60A5FA', // Blue
  other: '#A78BFA',     // Purple

  // Glow variants
  godGlow: 'rgba(255, 215, 0, 0.4)',
  goodGlow: 'rgba(74, 222, 128, 0.35)',
  badGlow: 'rgba(239, 68, 68, 0.4)',
  connectorGlow: 'rgba(96, 165, 250, 0.3)',
  otherGlow: 'rgba(167, 139, 250, 0.3)',

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
  textWallAlpha: 0.45
};

// Power-ups
export const POWERUP_CHANCE = 0.32;
export const POWERUP_FALL_SPEED = 146;
export const POWERUP_TYPES = [
  { kind: 'expand', label: '[WIDEN]',  color: '#95edff', duration: 12 },
  { kind: 'slow',   label: '[SLOW]',   color: '#ffd577', duration: 10 },
  { kind: 'multi',  label: '[MULTI]',  color: '#c7b2ff', duration: 0 },
  { kind: 'guard',  label: '[GUARD]',  color: '#a4f094', duration: 0 },
  { kind: 'life',   label: '[+LIFE]',  color: '#ff9db8', duration: 0 },
  { kind: 'reveal', label: '[REVEAL]', color: '#FFD700', duration: 8 }
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
  badBrick: 3.5
};

// Lives
export const INITIAL_LIVES = 3;
export const MAX_LIVES = 6;

// Timing (seconds)
export const INTRO_DURATION = 2.34;
export const CLEAR_DURATION = 2.18;
export const OPENING_DURATION = 3.1;

// Levels
export const TOTAL_LEVELS = 5;
export const DIFFICULTY_PER_LEVEL = [
  [1, 3],  // Level 1: difficulty 1-3
  [2, 4],  // Level 2: difficulty 2-4
  [3, 6],  // Level 3: difficulty 3-6
  [5, 8],  // Level 4: difficulty 5-8
  [7, 10]  // Level 5: difficulty 7-10
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

// Text wall
export const WALL_FONT_SIZE = 13;
export const WALL_LINE_HEIGHT = 16;
export const WALL_FONT = "13px 'Share Tech Mono', monospace";

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
  gameOver: "900 56px 'Orbitron', sans-serif"
};
