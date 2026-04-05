/**
 * memorization.js — Scripture Breaker verse memorization tracker
 *
 * Tracks every verse the player encounters, maintains a mastery level
 * (0-5) for each one, and generates spaced-repetition memory tests
 * with progressively more blanked-out phrases.
 *
 * All data is persisted to localStorage under the key 'sb_memorization'.
 * No external dependencies.
 */

const STORAGE_KEY = 'sb_memorization';

/**
 * Mastery levels
 *   0 — never seen
 *   1 — seen (played once)
 *   2 — familiar
 *   3 — learning
 *   4 — almost memorized
 *   5 — memorized
 */
const MASTERY_MAX = 5;
const MASTERY_MIN_AFTER_PLAY = 1;

/**
 * Spaced-repetition intervals (in hours) keyed by mastery level.
 * Lower mastery  => shorter gap between tests.
 */
const REVIEW_INTERVALS = {
  1: 1,    // 1 hour
  2: 4,    // 4 hours
  3: 24,   // 1 day
  4: 72,   // 3 days
};

export class MemorizationTracker {
  /**
   * Create a new tracker and hydrate from localStorage if data exists.
   */
  constructor() {
    /** @type {Map<string, Object>} keyed by verse ref */
    this._verses = new Map();
    this._load();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Load previously saved tracking data from localStorage.
   * @private
   */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const entry of arr) {
        if (entry && entry.ref) {
          this._verses.set(entry.ref, entry);
        }
      }
    } catch (_) {
      // Corrupt or missing data — start fresh.
    }
  }

  /**
   * Persist current tracking data to localStorage.
   */
  save() {
    try {
      const arr = Array.from(this._verses.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (_) {
      // Storage full or unavailable — fail silently.
    }
  }

  // ---------------------------------------------------------------------------
  // Recording & querying
  // ---------------------------------------------------------------------------

  /**
   * Record that a verse was played.  If the verse is already tracked its
   * play count is incremented; otherwise a new entry is created.
   *
   * @param {string}   ref     - verse reference, e.g. "John 3:16"
   * @param {string}   text    - full verse text
   * @param {Array}    phrases - array of phrase objects (as used in the game)
   */
  recordVersePlayed(ref, text, phrases) {
    const now = Date.now();

    if (this._verses.has(ref)) {
      const entry = this._verses.get(ref);
      entry.playCount += 1;
      entry.lastPlayed = now;
      // Keep phrase data up-to-date
      entry.text = text;
      entry.phrases = phrases;
      // First play sets mastery to 1; subsequent plays don't auto-change it
      if (entry.mastery < MASTERY_MIN_AFTER_PLAY) {
        entry.mastery = MASTERY_MIN_AFTER_PLAY;
      }
    } else {
      this._verses.set(ref, {
        ref,
        text,
        phrases,
        playCount: 1,
        lastPlayed: now,
        mastery: MASTERY_MIN_AFTER_PLAY,
      });
    }

    this.save();
  }

  /**
   * Return tracking data for a single verse.
   *
   * @param {string} ref
   * @returns {Object|null} tracking entry or null if not tracked
   */
  getVerseStatus(ref) {
    return this._verses.get(ref) || null;
  }

  /**
   * Return every tracked verse, sorted by lastPlayed descending (most
   * recent first).
   *
   * @returns {Array<Object>}
   */
  getAllTracked() {
    return Array.from(this._verses.values()).sort(
      (a, b) => b.lastPlayed - a.lastPlayed
    );
  }

  /**
   * Aggregate mastery statistics across all tracked verses.
   *
   * @returns {{ total: number, memorized: number, learning: number, familiar: number, seen: number }}
   */
  getMasteryStats() {
    const stats = { total: 0, memorized: 0, learning: 0, familiar: 0, seen: 0 };

    for (const entry of this._verses.values()) {
      stats.total += 1;
      if (entry.mastery >= 5) stats.memorized += 1;
      else if (entry.mastery >= 3) stats.learning += 1;
      else if (entry.mastery === 2) stats.familiar += 1;
      else stats.seen += 1;                       // mastery 0 or 1
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Spaced-repetition helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine whether a verse is due for a memory test.
   *
   * A verse qualifies when:
   *   1. It has been played at least 3 times.
   *   2. Its mastery is below 5 (not yet fully memorized).
   *   3. Enough time has elapsed since the last play (based on mastery).
   *
   * @param {string} ref
   * @returns {boolean}
   */
  shouldTestMemory(ref) {
    const entry = this._verses.get(ref);
    if (!entry) return false;
    if (entry.playCount < 3) return false;
    if (entry.mastery >= MASTERY_MAX) return false;

    const intervalHours = REVIEW_INTERVALS[entry.mastery] || 1;
    const elapsed = Date.now() - entry.lastPlayed;
    return elapsed >= intervalHours * 60 * 60 * 1000;
  }

  /**
   * Build a memory-test payload for a verse.
   *
   * Depending on the current mastery level, a varying number of phrases are
   * "blanked out" (the player must recall them).
   *
   *   mastery 1-2 : blank 1 phrase  (the shortest one)
   *   mastery 3   : blank 2 phrases
   *   mastery 4   : blank 3+ phrases (keep only the 2 longest as hints)
   *
   * @param {string} ref
   * @returns {{ ref: string, text: string, phrases: Array<{ t: string, c: string, blanked: boolean }> } | null}
   */
  generateMemoryTest(ref) {
    const entry = this._verses.get(ref);
    if (!entry || !entry.phrases || entry.phrases.length === 0) return null;

    // Work on a deep copy so the original data is not mutated
    const phrases = entry.phrases.map((p) => ({
      t: p.t || p.text || '',
      c: p.c || p.code || '',
      blanked: false,
    }));

    // Sort indices by phrase length (shortest first) for blanking decisions
    const byLength = phrases
      .map((p, i) => ({ idx: i, len: p.t.length }))
      .sort((a, b) => a.len - b.len);

    let blankCount;
    if (entry.mastery <= 2) {
      blankCount = 1;
    } else if (entry.mastery === 3) {
      blankCount = 2;
    } else {
      // mastery 4: blank everything except the 2 longest phrases
      blankCount = Math.max(1, phrases.length - 2);
    }

    // Never blank more phrases than exist
    blankCount = Math.min(blankCount, phrases.length);

    for (let i = 0; i < blankCount; i++) {
      phrases[byLength[i].idx].blanked = true;
    }

    return {
      ref: entry.ref,
      text: entry.text,
      phrases,
    };
  }

  // ---------------------------------------------------------------------------
  // Mastery updates
  // ---------------------------------------------------------------------------

  /**
   * Adjust the mastery level of a verse after a memory test.
   *
   * @param {string}  ref     - verse reference
   * @param {boolean} correct - true if the player recalled correctly
   */
  updateMastery(ref, correct) {
    const entry = this._verses.get(ref);
    if (!entry) return;

    if (correct) {
      entry.mastery = Math.min(MASTERY_MAX, entry.mastery + 1);
    } else {
      entry.mastery = Math.max(MASTERY_MIN_AFTER_PLAY, entry.mastery - 1);
    }

    entry.lastPlayed = Date.now();
    this.save();
  }
}
