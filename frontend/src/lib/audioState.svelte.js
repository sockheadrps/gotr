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

function ensureAudio() {
	if (!player.audio) {
		const a = new Audio();
		a.addEventListener('timeupdate', () => {
			player.currentTime = Number.isFinite(a.currentTime) ? a.currentTime : 0;
		});
		a.addEventListener('durationchange', () => {
			player.duration = Number.isFinite(a.duration) ? a.duration : 0;
		});
		a.addEventListener('loadedmetadata', () => {
			player.duration = Number.isFinite(a.duration) ? a.duration : 0;
			player.currentTime = Number.isFinite(a.currentTime) ? a.currentTime : 0;
		});
		a.addEventListener('play', () => {
			player.isPlaying = true;
		});
		a.addEventListener('pause', () => {
			player.isPlaying = false;
		});
		player.audio = a;
	}
	return player.audio;
}

/** @param {number} index @param {(string|null)[]} audioUrls */
export function loadChunk(index, audioUrls) {
	if (!audioUrls?.[index]) return;
	player.chunkIndex = index;
	const a = ensureAudio();
	a.src = audioUrls[index];
	a.load();
	player.currentTime = 0;
	player.duration = 0;
	player.status = `Ready: Chunk ${index + 1}`;
}

/** @param {number} index @param {(string|null)[]} audioUrls */
export function playChunk(index, audioUrls) {
	if (!audioUrls?.[index]) return;
	player.chunkIndex = index;
	const a = ensureAudio();

	a.src = audioUrls[index];
	player.status = `Reading Chunk ${index + 1}...`;
	player.currentTime = 0;
	player.duration = 0;
	void a.play();

	a.onended = () => {
		if (player.chunkIndex + 1 < audioUrls.length) {
			playChunk(player.chunkIndex + 1, audioUrls);
		} else {
			player.status = 'Chapter Finished';
			player.isPlaying = false;
		}
	};
}

export function pause() {
	if (!player.audio) return;
	player.audio.pause();
	player.status = `Paused: Chunk ${player.chunkIndex + 1}`;
}

export function stop() {
	if (!player.audio) return;
	player.audio.pause();
	player.audio.currentTime = 0;
	player.currentTime = 0;
	player.status = 'Ready';
}

/** @param {number} seconds */
export function seekTo(seconds) {
	if (!player.audio) return;
	const d = Number.isFinite(player.audio.duration) ? player.audio.duration : 0;
	if (!d || d <= 0) return;
	const t = Math.max(0, Math.min(d, seconds));
	player.audio.currentTime = t;
	player.currentTime = t;
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
