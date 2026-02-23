/** Shared reactive audio player state — imported directly, no store needed */

export const player = $state({
	/** @type {HTMLAudioElement|null} */
	audio: null,
	chapterId: /** @type {string|null} */ (null),
	chunkIndex: 0,
	/** @type {(string|null)[]} */
	audioUrls: [],
	title: '',
	status: 'Ready',
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	visible: false,
	/** @type {string|null} */
	fullAudioFilename: null,
});

/** @param {number} index @param {(string|null)[]} audioUrls */
export function loadChunk(index, audioUrls) {
	if (!audioUrls?.[index]) return;
	player.chunkIndex = index;
	if (!player.audio) player.audio = new Audio();
	player.audio.src = audioUrls[index];
	player.audio.load();
	player.status = `Ready: Chunk ${index + 1}`;
}

/** @param {number} index @param {(string|null)[]} audioUrls */
export function playChunk(index, audioUrls) {
	if (!audioUrls?.[index]) return;
	player.chunkIndex = index;
	if (!player.audio) player.audio = new Audio();

	player.audio.src = audioUrls[index];
	player.status = `Reading Chunk ${index + 1}...`;
	player.isPlaying = true;
	player.audio.play();

	player.audio.onended = () => {
		if (player.chunkIndex + 1 < audioUrls.length) {
			playChunk(player.chunkIndex + 1, audioUrls);
		} else {
			player.status = 'Chapter Finished';
			player.isPlaying = false;
		}
	};
}

/** @param {string} id @param {import('./types.js').Chapter} data */
export function openChapter(id, data) {
	// Iteration chapters have story_audio_urls + lesson_audio_urls; legacy has audio_urls.
	const urls = data.story_audio_urls
		? [...(data.story_audio_urls ?? []), ...(data.lesson_audio_urls ?? [])]
		: (data.audio_urls ?? []);
	player.chapterId = id;
	player.audioUrls = urls;
	player.title = data.summary?.gospel_title ?? '';
	player.fullAudioFilename = data.full_audio_filename ?? null;
	player.visible = true;
	loadChunk(0, urls);
}

export function formatTime(secs) {
	const m = Math.floor(secs / 60);
	const s = Math.floor(secs % 60);
	return `${m}:${s < 10 ? '0' : ''}${s}`;
}
