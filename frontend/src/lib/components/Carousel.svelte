<script>
	import CarouselSlide from './CarouselSlide.svelte';

	/**
	 * @type {{
	 *   allChapters: import('../types.js').ChapterEntry[],
	 *   currentIndex?: number,
	 *   onReadChapter: (index: number) => void,
	 *   onSlideChange?: (index: number) => void,
	 * }}
	 */
	let { allChapters, currentIndex = 0, onReadChapter, onSlideChange } = $props();

	const total = $derived(allChapters.length);

	/** @type {'left'|'right'} */
	let slideDir = $state('right');
	let animKey = $state(0);

	function go(n) {
		const next = ((n % total) + total) % total;
		slideDir = next > currentIndex || (currentIndex === total - 1 && next === 0) ? 'right' : 'left';
		animKey++;
		onSlideChange?.(next);
	}
</script>

<div class="w-full h-full flex flex-col px-8 py-4">
	<!-- Slide + arrows -->
	<div class="relative flex-1 w-full max-w-325 mx-auto group/carousel">
		<!-- Prev arrow -->
		<button
			onclick={() => go(currentIndex - 1)}
			class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-20
				w-11 h-11 rounded-full flex items-center justify-center
				border cursor-pointer transition-all duration-200
				opacity-0 group-hover/carousel:opacity-100 hover:scale-110"
			style="background: rgba(15,17,26,0.85); border-color: rgba(255,255,255,0.15); color: var(--text-primary); backdrop-filter: blur(8px);"
			onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.color = 'var(--accent-teal)'; }}
			onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<path d="M15 18l-6-6 6-6"/>
			</svg>
		</button>

		<!-- Slides -->
		<div class="flex w-full h-full">
			{#each allChapters as chapter, i}
				{#if i === currentIndex}
					{#key animKey}
						<CarouselSlide {chapter} slideDir={slideDir} onRead={() => onReadChapter(i)} />
					{/key}
				{/if}
			{/each}
		</div>

		<!-- Next arrow -->
		<button
			onclick={() => go(currentIndex + 1)}
			class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-20
				w-11 h-11 rounded-full flex items-center justify-center
				border cursor-pointer transition-all duration-200
				opacity-0 group-hover/carousel:opacity-100 hover:scale-110"
			style="background: rgba(15,17,26,0.85); border-color: rgba(255,255,255,0.15); color: var(--text-primary); backdrop-filter: blur(8px);"
			onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.color = 'var(--accent-teal)'; }}
			onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<path d="M9 18l6-6-6-6"/>
			</svg>
		</button>
	</div>

	<!-- Pill dots -->
	<div class="flex items-center justify-center gap-1.5 mt-6">
		{#each allChapters as _, i}
			<button
				onclick={() => go(i)}
				class="h-1.5 rounded-full border-none cursor-pointer transition-all duration-300"
				style="
					width: {i === currentIndex ? '28px' : '8px'};
					background: {i === currentIndex ? 'var(--accent-teal)' : 'rgba(255,255,255,0.2)'};
					box-shadow: {i === currentIndex ? '0 0 8px rgba(0,210,211,0.6)' : 'none'};
				"
			></button>
		{/each}
	</div>
</div>
