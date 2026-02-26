<script>
	import * as audio from '$lib/audioState.svelte.js';

	const { player, playChunk } = audio;

	/** @type {{ chunks?: any, audioUrls?: any, lessonOffset?: number|null }} */
	const props = $props();

	const chunks = $derived(Array.isArray(props.chunks) ? props.chunks : []);
	const audioUrls = $derived(Array.isArray(props.audioUrls) ? props.audioUrls : []);

	const lessonOffset = $derived.by(() => {
		const v = props.lessonOffset;
		if (v === null || v === undefined) return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	});

	/** @type {HTMLElement|null} */
	let scrollViewport = $state(null);
	/** @type {HTMLElement[]} */
	let paraEls = $state([]);
	let userClicking = $state(false);

	const chunkProgress = $derived.by(() => {
		const d = player.duration ?? 0;
		const t = player.currentTime ?? 0;
		if (!d || d <= 0) return 0;
		return Math.max(0, Math.min(1, t / d));
	});

	const progress = $derived.by(() => {
		const total = chunks.length;
		if (!total || total <= 0) return 0;
		const i = Math.max(0, Math.min(total - 1, player.chunkIndex ?? 0));
		return Math.max(0, Math.min(1, (i + chunkProgress) / total));
	});

	const progressPct = $derived(Math.round(progress * 100));
	const isPlaying = $derived(!!player.isPlaying);

	function togglePlay() {
		if (isPlaying) {
			audio.pause();
			return;
		}
		playChunk(player.chunkIndex ?? 0, audioUrls);
	}

	/** @param {MouseEvent} e */
	function scrub(e) {
		const total = chunks.length;
		if (!total || total <= 0) return;

		const el = /** @type {HTMLElement} */ (e.currentTarget);
		const rect = el.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const ratio = Math.max(0, Math.min(1, x));
		const scaled = ratio * total;
		const index = Math.max(0, Math.min(total - 1, Math.floor(scaled)));
		const frac = Math.max(0, Math.min(0.999, scaled - index));
		const wasPlaying = !!player.isPlaying;

		playChunk(index, audioUrls);

		const a = player.audio;
		if (!a) return;

		const applySeek = () => {
			const d = Number.isFinite(a.duration) ? a.duration : 0;
			if (!d || d <= 0) return;
			audio.seekTo(frac * d);
			if (!wasPlaying) audio.pause();
		};

		if (a.readyState >= 1) applySeek();
		else a.addEventListener('loadedmetadata', applySeek, { once: true });
	}

	/** @param {number} index */
	function handleClick(index) {
		userClicking = true;
		playChunk(index, audioUrls);
		setTimeout(() => {
			userClicking = false;
		}, 50);
	}

	$effect(() => {
		const n = chunks.length;
		if (paraEls.length !== n) paraEls = Array(n);
	});

	$effect(() => {
		const i = player.chunkIndex;
		if (player.isPlaying && !userClicking && paraEls[i]) {
			const anchor = window.matchMedia('(max-width: 767px)').matches ? 56 : 96;
			const y = Math.max(0, paraEls[i].offsetTop - anchor);
			scrollViewport?.scrollTo({ top: y, behavior: 'smooth' });
		}
	});
</script>

<section class="manuscript-shell relative transition-all duration-500">
	<header class="manuscript-header max-w-3xl mx-auto px-5 pt-1 pb-2">
		<div class="reader-toolbar">
			<button
				class="rule-play"
				onclick={togglePlay}
				aria-label={isPlaying ? 'Pause' : 'Play'}
				title={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}<svg viewBox="0 0 24 24" fill="currentColor" class="ms-play-icon"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>{:else}<svg viewBox="0 0 24 24" fill="currentColor" class="ms-play-icon"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86z"/></svg>{/if}
			</button>

			<div
				class="rule-scrubber"
				role="slider"
				tabindex="0"
				aria-label="Audio progress"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progressPct}
				onclick={scrub}
			>
				<div class="rule-track"></div>
				<div class="rule-fill" style="transform: translateY(-50%) scaleX({progress});"></div>
				<div class="rule-head" style="left: calc({progress * 100}% - 6px);"></div>
			</div>

			<div class="rule-meta" aria-live="polite">{progressPct}%</div>
		</div>
	</header>

	<div class="manuscript-window max-w-3xl mx-auto">
		<div
			class="manuscript-view leading-loose font-serif text-[1.3rem]"
			style="color: var(--text-primary);"
			bind:this={scrollViewport}
		>
		{#if chunks.length === 0}
			<div class="px-5 py-6" style="color: var(--text-secondary);">Loading manuscript...</div>
		{:else if lessonOffset !== null}
			{#each chunks.slice(0, lessonOffset) as text, i}
				<p
					bind:this={paraEls[i]}
					class="chunk-text px-5 py-3 mb-3 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
					class:reading-now={player.chunkIndex === i && player.isPlaying}
					onclick={() => handleClick(i)}
					style="
						border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'transparent'};
						background: {player.chunkIndex === i && player.isPlaying ? 'rgba(0,210,211,0.06)' : 'transparent'};
						color: inherit;
					"
				>
					{String(text).replace(/\[.*?\]/g, '').trim()}
				</p>
			{/each}

			<div class="lesson-shell mt-8 mb-4 rounded-xl px-6 sm:px-8 pt-5 pb-2">
				<div class="text-[0.6rem] font-black uppercase tracking-[0.2em] mb-2" style="color: var(--accent-purple);">
					The Wanderer's Wisdom
				</div>
				<div class="wisdom-rule"></div>

				{#each chunks.slice(lessonOffset) as text, j}
					{@const i = lessonOffset + j}
					<p
						bind:this={paraEls[i]}
						class="chunk-text chunk-text--lesson px-5 py-2 mb-2 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
						class:reading-now={player.chunkIndex === i && player.isPlaying}
						onclick={() => handleClick(i)}
						style="
							border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-purple)' : 'transparent'};
							background: {player.chunkIndex === i && player.isPlaying ? 'rgba(162,155,254,0.06)' : 'transparent'};
							color: inherit;
							font-style: italic;
						"
					>
						{String(text).replace(/\[.*?\]/g, '').trim()}
					</p>
				{/each}
			</div>
		{:else}
			{#each chunks as text, i}
				<p
					bind:this={paraEls[i]}
					class="chunk-text px-5 py-3 mb-3 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
					class:reading-now={player.chunkIndex === i && player.isPlaying}
					onclick={() => handleClick(i)}
					style="
						border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'transparent'};
						background: {player.chunkIndex === i && player.isPlaying ? 'rgba(0,210,211,0.06)' : 'transparent'};
						color: inherit;
					"
				>
					{String(text).replace(/\[.*?\]/g, '').trim()}
				</p>
			{/each}
		{/if}
		</div>
	</div>
</section>

<style>
	.manuscript-shell {
		animation: manuscriptIn 0.5s ease;
		border-radius: 0;
		background: transparent;
		border: none;
	}

	@keyframes manuscriptIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.manuscript-shell { animation: none; }
	}

	.manuscript-header {
		padding-bottom: 0.35rem;
	}

	.reader-toolbar {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.2rem 0;
		border-radius: 0;
		background: transparent;
		border: none;
		backdrop-filter: none;
	}

	.manuscript-window {
		position: relative;
		overflow: visible;
		border-radius: 0;
		background: transparent;
	}

	.manuscript-view {
		max-height: min(56vh, 38rem);
		overflow-y: auto;
		scroll-behavior: smooth;
		padding: 0.25rem 0 0.75rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(145, 173, 209, 0.28) transparent;
	}

	.manuscript-view::-webkit-scrollbar {
		width: 8px;
	}

	.manuscript-view::-webkit-scrollbar-track {
		background: transparent;
	}

	.manuscript-view::-webkit-scrollbar-thumb {
		background: rgba(126, 157, 199, 0.35);
		border-radius: 999px;
	}

	.rule-play {
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 999px;
		border: 1.5px solid rgba(0, 210, 211, 0.3);
		background:
			radial-gradient(circle at 35% 35%, rgba(0, 210, 211, 0.12), transparent 70%),
			rgba(0, 210, 211, 0.04);
		color: var(--accent-teal);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.15s;
		box-shadow:
			0 0 12px rgba(0, 210, 211, 0.08),
			0 0 0 0.5px rgba(0, 210, 211, 0.1) inset;
	}

	.rule-play:hover {
		background:
			radial-gradient(circle at 35% 35%, rgba(0, 210, 211, 0.2), transparent 70%),
			rgba(0, 210, 211, 0.08);
		border-color: rgba(0, 210, 211, 0.6);
		box-shadow:
			0 0 20px rgba(0, 210, 211, 0.2),
			0 0 0 1px rgba(0, 210, 211, 0.15) inset;
		transform: scale(1.06);
	}

	.rule-play:active {
		transform: scale(0.96);
	}

	.rule-play:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.55);
		outline-offset: 2px;
	}

	.ms-play-icon {
		width: 48%;
		height: 48%;
	}

	.rule-scrubber {
		position: relative;
		flex: 1;
		height: 18px;
		cursor: pointer;
	}

	.rule-track {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		transform: translateY(-50%);
		border-radius: 999px;
		background: rgba(255,255,255,0.16);
	}

	.rule-fill {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		border-radius: 999px;
		transform-origin: left;
		background: var(--accent-teal);
		box-shadow: none;
		transition: transform 0.08s linear;
	}

	.rule-head {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		transform: translateY(-50%);
		border-radius: 999px;
		background: #c5f9ff;
		box-shadow: 0 0 0 2px rgba(0, 210, 211, 0.22);
	}

	.rule-meta {
		min-width: 3ch;
		text-align: right;
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		font-weight: 700;
		color: rgba(215, 238, 255, 0.7);
	}

	.chunk-text {
		animation: cmdSurface 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.chunk-text--lesson {
		animation-delay: 0.08s;
	}

	.lesson-shell {
		background: rgba(162,155,254,0.03);
		border: 1px solid rgba(162,155,254,0.12);
	}

	.wisdom-rule {
		height: 1px;
		width: 6rem;
		margin-bottom: 1.25rem;
		background: linear-gradient(to right, var(--accent-purple), var(--accent-teal), transparent);
		transform-origin: left;
		animation: cmdDrawRule 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes cmdDrawRule {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}

	@keyframes cmdSurface {
		from { opacity: 0; transform: translateY(8px); filter: blur(1px); }
		to { opacity: 1; transform: translateY(0); filter: blur(0); }
	}

	@media (max-width: 767px) {
		.manuscript-view {
			font-size: 1.05rem;
			line-height: 1.75;
			max-height: min(52vh, 34rem);
		}

		.manuscript-view p {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}
</style>
