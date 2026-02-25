<script>
	/** @type {{ src: string }} */
	let { src } = $props();

	/** @type {HTMLAudioElement|null} */
	let audio = $state(null);
	let isPlaying = $state(false);
	let progress = $state(0);
	let timeDisplay = $state('0:00');

	function toggle() {
		if (!audio) {
			audio = new Audio(src);
			audio.ontimeupdate = () => {
				if (!audio?.duration) return;
				progress = (audio.currentTime / audio.duration) * 100;
				const m = Math.floor(audio.currentTime / 60);
				const s = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
				timeDisplay = `${m}:${s}`;
			};
			audio.onended = () => { isPlaying = false; progress = 0; timeDisplay = '0:00'; };
		}
		if (isPlaying) { audio.pause(); isPlaying = false; }
		else { audio.play(); isPlaying = true; }
	}

	/** @param {MouseEvent} e */
	function seek(e) {
		if (!audio?.duration) return;
		const rect = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
		audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
	}
</script>

<div class="flex flex-col gap-1.5 rounded-md px-0 py-1" style="background: transparent; border: 0;">
	<span class="text-[0.6rem] font-semibold uppercase tracking-[0.22em]" style="color: var(--text-secondary);">Summary</span>
	<div class="flex items-center gap-2.5 w-full">
		<button
			onclick={toggle}
			class="audio-toggle w-8 h-8 rounded-full shrink-0 flex items-center justify-center border cursor-pointer transition-all duration-150"
			style="background: transparent; color: var(--accent-teal); border-color: rgba(0,210,211,0.5);"
		>
			{#if isPlaying}
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path d="M8 5v14l11-7z"/>
				</svg>
			{/if}
		</button>
		<div onclick={seek} class="progress-track flex-1 h-0.5 rounded-full cursor-pointer relative" style="background: rgba(255,255,255,0.15);">
			<div class="h-full rounded-full transition-[width] duration-100" style="width: {progress}%; background: rgba(0,210,211,0.7);"></div>
		</div>
		<span class="text-[0.78rem] shrink-0 tabular-nums" style="color: var(--text-secondary);">{timeDisplay}</span>
	</div>
</div>

<style>
	.audio-toggle:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.55);
		outline-offset: 2px;
	}

	.progress-track:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.4);
		outline-offset: 3px;
	}
</style>
