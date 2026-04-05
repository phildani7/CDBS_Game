/**
 * share.js — Scripture Breaker share module
 *
 * Provides functions to share game scores via email, WhatsApp,
 * and the system clipboard.  No external dependencies.
 */

const PLAY_URL = 'https://scripturebreaker.com'; // update when deployed

/**
 * Build a nicely-formatted plain-text summary of a game session.
 *
 * @param {Object} data
 * @param {number} data.score        - final score for the session
 * @param {number} data.level        - level reached
 * @param {number} data.versesPlayed - total verses played in the session
 * @param {number} data.bestScore    - player's all-time best score
 * @param {Object} data.lastVerse    - { ref, text }
 * @returns {string}
 */
function formatShareText(data) {
  const { score, level, versesPlayed, bestScore, lastVerse } = data;

  const formattedScore = Number(score).toLocaleString();
  const formattedBest  = Number(bestScore).toLocaleString();

  const lines = [
    '\u271D Scripture Breaker \u271D',
    `Score: ${formattedScore} | Level: ${level}`,
    `Verses played: ${versesPlayed}`,
  ];

  if (lastVerse && lastVerse.ref) {
    const preview = lastVerse.text && lastVerse.text.length > 80
      ? lastVerse.text.slice(0, 77) + '...'
      : lastVerse.text || '';
    lines.push(`\uD83D\uDCD6 Last Verse: \u201C${preview}\u201D \u2014 ${lastVerse.ref}`);
  }

  lines.push(`\uD83C\uDFC6 Best Score: ${formattedBest}`);
  lines.push(`Play at: ${PLAY_URL}`);

  return lines.join('\n');
}

/**
 * Open the user's email client with a pre-filled message containing the
 * game score and last verse.
 *
 * @param {Object} data - see formatShareText for shape
 */
export function shareViaEmail(data) {
  const subject = encodeURIComponent('Scripture Breaker Score');
  const body    = encodeURIComponent(formatShareText(data));
  window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
}

/**
 * Open WhatsApp (web or native) with a pre-filled message.
 *
 * @param {Object} data - see formatShareText for shape
 */
export function shareViaWhatsApp(data) {
  const text = encodeURIComponent(formatShareText(data));
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

/**
 * Copy the formatted score text to the system clipboard.
 *
 * @param {Object} data - see formatShareText for shape
 * @returns {Promise<void>} resolves when the text has been copied
 */
export function shareToClipboard(data) {
  return navigator.clipboard.writeText(formatShareText(data));
}
