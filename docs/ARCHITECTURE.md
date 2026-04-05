# Scripture Breaker - Architecture

## File Structure
```
CDBS_Game/
├── index.html           # Entry HTML with Google Fonts
├── package.json         # Vite dev dependency
├── vite.config.js       # Dev server config (port 3000)
├── src/
│   ├── main.js          # Entry: font loading, canvas init, resize handler
│   ├── game.js          # Main game engine (~800 lines)
│   ├── config.js        # All constants (colors, physics, scoring, fonts)
│   ├── audio.js         # Web Audio synthesis (sfx + music)
│   ├── styles.css       # Dark futuristic body/canvas styles
│   └── data/
│       └── verses.json  # 200 NIV verses with phrase breakdowns
└── docs/
    ├── GAME_DESIGN.md   # Game design document
    ├── PROGRESS.md      # Progress tracker
    └── ARCHITECTURE.md  # This file
```

## Game Engine (game.js)

### State Machine
```
opening → menu → transition → serve → playing → clearing → transition (next level)
                                         ↓                       ↓
                                      gameover              gameover (victory at level 5)
```

### Update/Render Loop
- `requestAnimationFrame` with delta-time capping (1/20s max)
- State-specific update/render methods
- Background glyphs always animate

### Entity System
- **Balls**: array of {x, y, vx, vy, speed, radius, attached, char}
- **Paddle**: {x, y, text, width, height}
- **Bricks**: {x, y, targetX/Y, w, h, text, font, category, color, score, alive, flyProgress}
- **Power-ups**: {x, y, kind, label, color, drift, spin}
- **Particles**: {x, y, vx, vy, life, char, color, size, rotation}
- **Guard**: {x, y, text, width, charges}

### Text Measurement
- Canvas `measureText()` with caching via Map
- Results cached by `font|text` key
- Includes width, height, ascent, descent

### Collision Detection
- AABB overlap for ball-brick
- Resolved by smallest overlap axis
- One brick collision per frame
- Ball-paddle: impact-based angle reflection

## Data (verses.json)
- 200 entries from 39+ Bible books
- Fields: ref, text, difficulty (1-10), phrases[]
- Each phrase: {t: text, c: category}
- Categories: god, good, bad, connector, other
- Difficulty distribution: bell curve peaking at 3-4

## Scoring Formula
```
base_points = SCORE[category] × word_count
combo_multiplier = 1 + (consecutive_same_category × 0.25)
final_points = round(base_points × combo_multiplier)
```
