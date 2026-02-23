<script>
	import CarouselAudioPlayer from './CarouselAudioPlayer.svelte';

	/** @type {{ chapter: import('../types.js').ChapterEntry, onRead: () => void, slideDir?: 'left'|'right' }} */
	let { chapter, onRead, slideDir = 'right' } = $props();

	const summary = $derived(chapter.data.summary ?? {});
	const chapterNum = $derived(summary.chapter ? String(summary.chapter).padStart(2, '0') : null);
	const slugTitle = $derived(
		(summary.gospel_title ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
	);
	const imagePath = $derived(
		chapterNum ? `/static/chapters/chapter-${chapterNum}-${slugTitle}/img.png` : null
	);
	// summary_audio_filename is already a full /files/... URL for iteration chapters
	const summaryAudio = $derived(chapter.data.summary_audio_filename);
	// Iteration summary.json has summary_chunks[]; legacy has summary string
	const summaryText = $derived(
		summary.summary || (summary.summary_chunks ? summary.summary_chunks.join(' ') : '')
	);
</script>

<div class="flex w-full h-full slide-{slideDir}">
	<div class="relative flex w-full rounded-2xl overflow-hidden" style="height: 100%; background: var(--bg-card); border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 24px 60px rgba(0,0,0,0.5);">

		<!-- Left: full-bleed image ~55% -->
		<div class="relative flex-[1.2] min-w-0 overflow-hidden">
			{#if imagePath}
			<img
				src={imagePath}
				alt={summary.gospel_title}
				class="absolute inset-0 w-full h-full object-cover object-[center_15%]"
				onerror={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
			/>
			{/if}
			<!-- Subtle gradient fade into right panel -->
			<div class="absolute inset-0" style="background: linear-gradient(to right, transparent 97%, var(--bg-card) 100%);"></div>
		</div>

		<!-- Right: info panel -->
		<div class="flex flex-col justify-between w-96 shrink-0 px-8 py-8 relative z-10">
			<!-- Top meta -->
			<div>
				<div class="text-[0.6rem] font-bold uppercase tracking-[0.2em] mb-3" style="color: var(--accent-teal);">
					{chapterNum ? `Chapter ${chapterNum}` : (chapter.data.title ?? chapter.id)}
				</div>

				<h2 class="text-[2rem] font-black leading-[1.1] text-white m-0 mb-3">{summary.gospel_title ?? chapter.data.title ?? chapter.id}</h2>

				<!-- Accent line -->
				<div class="w-10 h-0.5 mb-5 rounded-full" style="background: var(--accent-teal);"></div>

				<p class="text-[0.88rem] leading-relaxed overflow-y-auto m-0 scrollbar-thin flex-1" style="color: var(--text-secondary);">
					{summaryText}
				</p>
			</div>

			<!-- Bottom actions -->
			<div class="flex flex-col gap-3">
				{#if summaryAudio}
					<CarouselAudioPlayer src={summaryAudio} />
				{/if}
				<button
					onclick={onRead}
					class="w-full py-3 rounded-xl font-bold text-[0.9rem] cursor-pointer border-none transition-all duration-200 tracking-wide hover:brightness-110 hover:-translate-y-px"
					style="background: var(--accent-teal); color: var(--bg-main); box-shadow: 0 4px 20px rgba(0,210,211,0.25);"
				>Read Chapter →</button>
			</div>
		</div>
	</div>
</div>
