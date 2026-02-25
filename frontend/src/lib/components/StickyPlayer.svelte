<script>
	import { player, playChunk, formatTime } from '$lib/audioState.svelte.js';

	const sliderMax = $derived(Math.floor(player.duration) || 100);
	const sliderValue = $derived(Math.floor(player.currentTime));

	function togglePlay() {
		if (!player.audio) return;
		if (player.audio.paused) {
			playChunk(player.chunkIndex, player.audioUrls);
		} else {
			player.audio.pause();
			player.isPlaying = false;
		}
	}

	/** @param {Event} e */
	function handleSeek(e) {
		if (player.audio) {
			player.audio.currentTime = Number(/** @type {HTMLInputElement} */ (e.target).value);
		}
	}

	$effect(() => {
		const a = player.audio;
		if (!a) return;

		const onPlay = () => { player.isPlaying = true; };
		const onPause = () => { player.isPlaying = false; };
		const onTimeUpdate = () => {
			player.currentTime = a.currentTime;
			if (!isNaN(a.duration)) player.duration = a.duration;
		};

		a.addEventListener('play', onPlay);
		a.addEventListener('pause', onPause);
		a.addEventListener('timeupdate', onTimeUpdate);

		return () => {
			a.removeEventListener('play', onPlay);
			a.removeEventListener('pause', onPause);
			a.removeEventListener('timeupdate', onTimeUpdate);
		};
	});
</script>

{#if player.visible}
	<footer
		class="fixed bottom-4 right-4 left-4 z-3000 rounded-2xl px-4 py-3 border md:bottom-6 md:right-6 md:left-93.5 md:px-6"
		style="
			background: rgba(22,27,34,0.8);
			backdrop-filter: blur(12px) saturate(180%);
			-webkit-backdrop-filter: blur(12px) saturate(180%);
			border-color: rgba(255,255,255,0.1);
			box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		"
	>
		<div class="flex items-center justify-between gap-4 md:gap-8">
			<!-- Info -->
			<div class="flex-1 min-w-50">
				<span class="block font-bold text-[0.95rem] truncate text-white">{player.title}</span>
				<span class="block text-[0.7rem] uppercase tracking-[1.5px] font-semibold mt-0.5" style="color: var(--accent-teal);">{player.status}</span>
			</div>

			<!-- Controls -->
			<div class="flex-3 flex flex-col items-center">
				<button
					onclick={togglePlay}
					class="player-toggle w-10 h-10 rounded-full flex items-center justify-center border-none cursor-pointer mb-2 transition-transform duration-200 hover:scale-110"
					style="background: var(--accent-teal);"
				>
					{#if player.isPlaying}
						<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--bg-main)">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--bg-main)">
							<path d="M8 5v14l11-7z"/>
						</svg>
					{/if}
				</button>
				<div class="flex items-center gap-3 w-full">
					<span class="text-[0.7rem] font-mono min-w-8.75" style="color: var(--text-secondary);">{formatTime(player.currentTime)}</span>
					<input
						type="range"
						class="custom-slider"
						max={sliderMax}
						value={sliderValue}
						step="1"
						oninput={handleSeek}
					/>
					<span class="text-[0.7rem] font-mono min-w-8.75" style="color: var(--text-secondary);">{formatTime(player.duration)}</span>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex-1 flex justify-end gap-4">
				{#if player.fullAudioFilename}
					<a
						href="/files/{player.fullAudioFilename}"
						download
						class="player-action flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 hover:-translate-y-0.5 no-underline"
						style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-secondary);"
						onmouseenter={(e) => { e.currentTarget.style.color = 'var(--accent-teal)'; e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
						onmouseleave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
						title="Download full chapter"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
						</svg>
					</a>
				{/if}
			</div>
		</div>
	</footer>
{/if}

<style>
	.player-toggle:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.6);
		outline-offset: 3px;
	}

	.player-action:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.4);
		outline-offset: 3px;
	}
</style>
