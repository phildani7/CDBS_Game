# Scripture Breaker - Game Design Document

## Concept
A futuristic Bible verse breakout game inspired by PreText Breaker. Players break phrase-bricks from Bible verses using a ball and paddle, with each phrase color-coded by its theological category.

## Core Mechanics

### Breakout Gameplay
- Ball bounces off walls, paddle, and phrase-bricks
- Phrases from Bible verses serve as bricks
- Breaking all bricks clears the level
- Ball physics: AABB collision, angle-based paddle bounce
- Text characters for all visual elements (ball: ◉, paddle: ⟦==========⟧)

### Color-Coded Categories
| Category   | Color  | Points/Word | Description                          |
|-----------|--------|-------------|--------------------------------------|
| God       | Gold   | +150        | Phrases about God, Jesus, Holy Spirit |
| Good      | Green  | +100        | Blessings, virtues, positive outcomes |
| Other     | Purple | +50         | General phrases                       |
| Connector | Blue   | +25         | Transition/connecting words           |
| Bad       | Red    | -120        | Sin, death, destruction, evil         |

### Scoring Strategy
- Breaking gold (God) bricks earns maximum points
- Breaking red (Bad) bricks deducts maximum points
- Combo multiplier: consecutive same-category breaks increase score
- Power-up pickups: +35 bonus points
- Score can go negative

### Power-Up System
| Power-Up | Color  | Effect                    | Duration |
|----------|--------|---------------------------|----------|
| WIDEN    | Cyan   | Wider paddle              | 12s      |
| SLOW     | Gold   | Ball speed x0.74          | 10s      |
| MULTI    | Purple | Adds balls (up to 5)      | Instant  |
| GUARD    | Green  | Safety net (2 charges)    | Until used |
| +LIFE    | Pink   | Extra life                | Instant  |
| REVEAL   | Gold   | Shows full verse          | 8s       |

## Level Design
- 5 levels with escalating difficulty
- Each level features one Bible verse
- Verse difficulty 1-10 mapped to level ranges
- Ball speed increases per level (+22 px/s)
- 200 pre-curated NIV verses in database

## Visual Design
- Dark futuristic/neon aesthetic
- Glowing text effects with category-colored halos
- Particle bursts: letter-by-letter explosion on brick break
- Background: flowing scripture text wall
- Floating cross/dot glyphs in background
- Screen shake on impacts
- Score popups on brick destruction

## Audio
- All synthesized via Web Audio API (no files)
- Category-specific brick break sounds
- Ambient music patterns per game state
- Ascending tones for positive events, descending for negative

## Tech Stack
- Vite + vanilla JavaScript
- HTML5 Canvas rendering
- Web Audio API for sound
- Google Fonts: Orbitron, Rajdhani, Share Tech Mono

## Future Plans
- Host at verses subdomain
- More levels beyond 5
- Verse memorization mode
- Multiplayer score sharing
- Mobile touch optimization
- Progressive difficulty based on player performance
