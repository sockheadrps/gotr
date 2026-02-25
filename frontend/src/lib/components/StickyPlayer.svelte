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
		class="player-shell fixed bottom-4 right-4 left-4 z-3000 rounded-xl px-4 py-3 border md:bottom-6 md:right-6 md:left-93.5 md:px-6"
		style="
			background: rgba(16,20,26,0.78);
			backdrop-filter: blur(10px) saturate(170%);
			-webkit-backdrop-filter: blur(10px) saturate(170%);
			border-color: rgba(255,255,255,0.08);
			box-shadow: 0 12px 30px rgba(0,0,0,0.45);
		"
	>
		<div class="player-inner flex items-center justify-between gap-4 md:gap-8">
			<!-- Info -->
			<div class="flex-1 min-w-50">
				<span class="block font-semibold text-[0.95rem] tracking-[0.02em] truncate text-white">{player.title}</span>
				<span class="block text-[0.6rem] uppercase tracking-[0.28em] font-semibold mt-1" style="color: var(--text-secondary);">{player.status}</span>
			</div>

			<!-- Controls -->
			<div class="flex-3 flex flex-col items-center">
				<button
					onclick={togglePlay}
					class="player-toggle w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer mb-2 transition-all duration-200"
					style="background: transparent; border-color: rgba(0,210,211,0.5);"
				>
					{#if player.isPlaying}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="var(--accent-teal)">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="var(--accent-teal)">
							<path d="M8 5v14l11-7z"/>
						</svg>
					{/if}
				</button>
				<div class="flex items-center gap-3 w-full">
					<span class="text-[0.6rem] font-mono tracking-[0.15em] min-w-8.75" style="color: var(--text-secondary);">{formatTime(player.currentTime)}</span>
					<input
						type="range"
						class="custom-slider minimalist"
						max={sliderMax}
						value={sliderValue}
						step="1"
						oninput={handleSeek}
					/>
					<span class="text-[0.6rem] font-mono tracking-[0.15em] min-w-8.75" style="color: var(--text-secondary);">{formatTime(player.duration)}</span>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex-1 flex justify-end gap-4">
				{#if player.fullAudioFilename}
					<a
						href="/files/{player.fullAudioFilename}"
						download
						class="player-action flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 hover:-translate-y-0.5 no-underline"
						style="background: transparent; border-color: rgba(255,255,255,0.12); color: var(--text-secondary);"
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
	.player-shell {
		animation: playerRise 0.45s ease;
	}

	.player-inner {
		animation: cmdSurface 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.08s;
	}

	@keyframes cmdSurface {
		from { opacity: 0; transform: translateY(8px); filter: blur(1px); }
		to { opacity: 1; transform: translateY(0); filter: blur(0); }
	}

	@keyframes playerRise {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.player-shell,
		.player-inner { animation: none; }
	}

	.player-toggle:hover {
		background: rgba(0, 210, 211, 0.08);
		border-color: rgba(0,210,211,0.9);
	}

	.player-toggle:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.6);
		outline-offset: 3px;
	}

	.player-action:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.4);
		outline-offset: 3px;
	}

	.custom-slider.minimalist {
		height: 2px;
		accent-color: rgba(0, 210, 211, 0.6);
	}
</style>
