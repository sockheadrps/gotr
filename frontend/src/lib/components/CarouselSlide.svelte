<script>
	import CarouselAudioPlayer from './CarouselAudioPlayer.svelte';

	/** @type {{ chapter: import('../types.js').ChapterEntry, onRead: () => void, slideDir?: 'left'|'right', phase?: 'enter'|'leave' }} */
	let { chapter, onRead, slideDir = 'right', phase = 'enter' } = $props();

	const summary = $derived(chapter.data.summary ?? {});
	const imagePath = $derived(`/static/chapters/${chapter.id}/img.png`);
	// summary_audio_filename is already a full /files/... URL for iteration chapters
	const summaryAudio = $derived(chapter.data.summary_audio_filename);
	// Iteration summary.json has summary_chunks[]; legacy has summary string
	const summaryText = $derived(
		summary.summary || (summary.summary_chunks ? summary.summary_chunks.join(' ') : '')
	);

	let imgLoaded = $state(false);

	$effect(() => {
		imgLoaded = false;
		imagePath;
	});
</script>

<div class="flex w-full h-full slide-{slideDir} phase-{phase}">
	<div class="relative flex w-full rounded-2xl overflow-hidden slide-card" style="background: var(--bg-card); border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 24px 60px rgba(0,0,0,0.5);">

		<!-- Image: full-bleed on desktop, top banner on mobile -->
		<div class="slide-image relative overflow-hidden">
			{#if imagePath}
			<img
				src={imagePath}
				alt={summary.gospel_title}
				class="absolute inset-0 w-full h-full object-cover object-[center_15%] mobile-img {imgLoaded ? 'img-loaded' : 'img-loading'}"
				onload={() => { imgLoaded = true; }}
				onerror={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
			/>
			{/if}
			<div class="absolute inset-0" style="background: linear-gradient(to right, transparent 97%, var(--bg-card) 100%);"></div>
		</div>

		<!-- Info panel -->
		<div class="slide-info flex flex-col px-8 py-8 relative z-10">
			<!-- Top meta -->
			<div class="slide-meta">
				<div class="slide-kicker text-[0.6rem] font-semibold uppercase tracking-[0.22em] mb-3" style="color: var(--accent-teal); opacity: 0.8;">
					{summary.chapter ? `Chapter ${String(summary.chapter).padStart(2, '0')}` : (chapter.data.title ?? chapter.id)}
				</div>

				<h2 class="slide-title font-semibold leading-[1.12] text-white m-0 mb-3">{summary.gospel_title ?? chapter.data.title ?? chapter.id}</h2>

				<!-- Accent line -->
				<div class="slide-rule w-10 h-0.5 mb-5 rounded-full" style="background: var(--accent-teal);"></div>

				<p class="slide-summary text-[0.88rem] leading-relaxed overflow-y-auto m-0 scrollbar-thin" style="color: var(--text-secondary);">
					{summaryText}
				</p>
			</div>

			<!-- Bottom actions -->
			<div class="slide-actions flex flex-col gap-3 mt-6">
				{#if summaryAudio}
					<CarouselAudioPlayer src={summaryAudio} />
				{/if}
				<button
					onclick={onRead}
					class="slide-read-btn w-full py-2.5 rounded-md font-semibold text-[0.85rem] cursor-pointer border transition-all duration-200 tracking-[0.18em]"
					style="background: transparent; color: var(--accent-teal); border-color: rgba(0,210,211,0.5);"
				>Read Chapter</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Desktop: side-by-side */
	.slide-card {
		flex-direction: row;
		height: 100%;
	}

	.phase-enter .slide-card {
		animation: cardFadeIn 0.65s ease both;
		animation-delay: 0.12s;
	}

	.phase-leave .slide-card {
		animation: cardFadeOut 0.5s ease both;
	}

	.phase-enter .slide-image img {
		animation: imageBreathIn 0.7s ease both;
		animation-delay: 0.12s;
	}

	.phase-leave .slide-image img {
		animation: imageBreathOut 0.55s ease both;
	}

	@keyframes cardFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes cardFadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes imageBreathIn {
		from { transform: scale(1.02); }
		to { transform: scale(1); }
	}

	@keyframes imageBreathOut {
		from { transform: scale(1); }
		to { transform: scale(1.01); }
	}

	.slide-image {
		flex: 1.2;
		min-width: 0;
		background: rgba(255, 255, 255, 0.02);
	}

	.img-loading {
		filter: blur(12px) saturate(0.9);
		transform: scale(1.04);
		opacity: 0.4;
		transition: filter 0.6s ease, transform 0.6s ease, opacity 0.6s ease;
	}

	.img-loaded {
		filter: blur(0);
		transform: scale(1);
		opacity: 1;
	}

	.slide-title {
		font-size: 2.2rem;
		letter-spacing: -0.02em;
	}

	.slide-summary {
		font-size: 0.95rem;
		line-height: 1.75;
	}

	.slide-info {
		width: 24rem;
		flex-shrink: 0;
		justify-content: space-between;
		animation: slideFadeUp 0.55s ease both;
		animation-delay: 0.08s;
	}

	@keyframes slideFadeUp {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes cmdFadeOnly {
		from { opacity: 0; }
		to { opacity: 0.9; }
	}

	@keyframes cmdRise {
		from { opacity: 0; transform: translateY(12px); filter: blur(1px); }
		to { opacity: 1; transform: translateY(0); filter: blur(0); }
	}

	@keyframes cmdDrawRule {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}

	@keyframes cmdSurface {
		from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
		to { opacity: 1; transform: translateY(0); filter: blur(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.slide-card,
		.slide-info,
		.slide-image img,
		.slide-meta,
		.slide-title,
		.slide-rule,
		.slide-summary,
		.slide-actions {
			animation: none !important;
		}
	}

	.slide-read-btn:hover {
		background: rgba(0, 210, 211, 0.08);
		border-color: rgba(0,210,211,0.9);
	}

	.slide-read-btn:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.6);
		outline-offset: 2px;
	}

	.slide-meta {
		animation: cmdFadeOnly 0.5s ease both;
		animation-delay: 0.05s;
	}

	.slide-title {
		animation: cmdRise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.12s;
	}

	.slide-rule {
		transform-origin: left;
		animation: cmdDrawRule 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.28s;
	}

	.slide-summary {
		animation: cmdSurface 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.36s;
	}

	.slide-actions {
		animation: cmdFadeOnly 0.7s ease both;
		animation-delay: 0.48s;
	}

	/* Mobile: image fills card, info panel overlays from bottom */
	@media (max-width: 767px) {
		.slide-card {
			flex-direction: column;
			height: 100%;
			overflow: hidden;
			position: relative;
		}

		/* Image fills the entire card */
		.slide-image {
			position: absolute;
			inset: 0;
			height: 100%;
			width: 100%;
			flex: none;
		}

		.slide-image .mobile-img {
			object-fit: contain;
			object-position: center top;
		}

		.slide-image div {
			/* Gradient from bottom so text panel blends in */
			background: linear-gradient(to bottom, transparent 50%, var(--bg-card) 100%) !important;
		}

		.slide-title {
			font-size: 1.2rem;
		}

		/* Info panel: anchored to bottom, scrolls upward */
		.slide-info {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			max-height: 50%;
			overflow-y: auto;
			padding: 1.5rem 1.25rem 5rem;
			background: linear-gradient(to bottom, transparent, var(--bg-card) 18%);
		}
	}
</style>
