<script>
	import CarouselAudioPlayer from './CarouselAudioPlayer.svelte';

	/** @type {{ chapter: import('../types.js').ChapterEntry, onRead: () => void, slideDir?: 'left'|'right' }} */
	let { chapter, onRead, slideDir = 'right' } = $props();

	const summary = $derived(chapter.data.summary ?? {});
	const imagePath = $derived(`/static/chapters/${chapter.id}/img.png`);
	// summary_audio_filename is already a full /files/... URL for iteration chapters
	const summaryAudio = $derived(chapter.data.summary_audio_filename);
	// Iteration summary.json has summary_chunks[]; legacy has summary string
	const summaryText = $derived(
		summary.summary || (summary.summary_chunks ? summary.summary_chunks.join(' ') : '')
	);
</script>

<div class="flex w-full h-full slide-{slideDir}">
	<div class="relative flex w-full rounded-2xl overflow-hidden slide-card" style="background: var(--bg-card); border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 24px 60px rgba(0,0,0,0.5);">

		<!-- Image: full-bleed on desktop, top banner on mobile -->
		<div class="slide-image relative overflow-hidden">
			{#if imagePath}
			<img
				src={imagePath}
				alt={summary.gospel_title}
				class="absolute inset-0 w-full h-full object-cover object-[center_15%] mobile-img"
				onerror={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
			/>
			{/if}
			<div class="absolute inset-0" style="background: linear-gradient(to right, transparent 97%, var(--bg-card) 100%);"></div>
		</div>

		<!-- Info panel -->
		<div class="slide-info flex flex-col px-8 py-8 relative z-10">
			<!-- Top meta -->
			<div>
				<div class="text-[0.6rem] font-bold uppercase tracking-[0.2em] mb-3" style="color: var(--accent-teal);">
					{summary.chapter ? `Chapter ${String(summary.chapter).padStart(2, '0')}` : (chapter.data.title ?? chapter.id)}
				</div>

				<h2 class="slide-title font-black leading-[1.1] text-white m-0 mb-3">{summary.gospel_title ?? chapter.data.title ?? chapter.id}</h2>

				<!-- Accent line -->
				<div class="w-10 h-0.5 mb-5 rounded-full" style="background: var(--accent-teal);"></div>

				<p class="slide-summary text-[0.88rem] leading-relaxed overflow-y-auto m-0 scrollbar-thin" style="color: var(--text-secondary);">
					{summaryText}
				</p>
			</div>

			<!-- Bottom actions -->
			<div class="flex flex-col gap-3 mt-6">
				{#if summaryAudio}
					<CarouselAudioPlayer src={summaryAudio} />
				{/if}
				<button
					onclick={onRead}
					class="slide-read-btn w-full py-3 rounded-xl font-bold text-[0.9rem] cursor-pointer border-none transition-all duration-200 tracking-wide hover:brightness-110 hover:-translate-y-px"
					style="background: var(--accent-teal); color: var(--bg-main); box-shadow: 0 4px 20px rgba(0,210,211,0.25);"
				>Read Chapter →</button>
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

	.slide-image {
		flex: 1.2;
		min-width: 0;
	}

	.slide-title {
		font-size: 2rem;
	}

	.slide-summary {
		line-height: 1.7;
	}

	.slide-info {
		width: 24rem;
		flex-shrink: 0;
		justify-content: space-between;
	}

	.slide-read-btn:focus-visible {
		outline: 2px solid rgba(0, 210, 211, 0.6);
		outline-offset: 2px;
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
