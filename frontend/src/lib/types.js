/**
 * @typedef {Object} Summary
 * @property {number} chapter
 * @property {string} original_topic
 * @property {string} gospel_title
 * @property {string} subtitle
 * @property {string} summary
 * @property {string} ideology_summary
 */

/**
 * @typedef {Object} Chapter
 * @property {string} title
 * @property {Summary} summary
 * @property {string|null} full_audio_filename
 * @property {string|null} summary_audio_filename
 * @property {number|null} [active_iteration]
 * --- Legacy flat fields (chapters without active iteration) ---
 * @property {string[]} [chunks]
 * @property {(string|null)[]} [audio_urls]
 * --- Iteration-based fields (chapters with active iteration) ---
 * @property {string[]} [story_chunks]
 * @property {string[]} [lesson_chunks]
 * @property {(string|null)[]} [story_audio_urls]
 * @property {(string|null)[]} [lesson_audio_urls]
 */

/**
 * @typedef {Object} ChapterEntry
 * @property {string} id
 * @property {Chapter} data
 */

export {};
