<script>
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import StickyPlayer from '$lib/components/StickyPlayer.svelte';
	import { fetchChapters, fetchChapter } from '$lib/api.js';
	import { player } from '$lib/audioState.svelte.js';

	let { children } = $props();

	/** @type {import('$lib/types.js').ChapterEntry[]} */
	let allChapters = $state([]);
	let carouselIndex = $state(0);
	let activeIndex = $state(/** @type {number|null} */ (null));

	/** @type {import('$lib/types.js').ChapterEntry|null} */
	let commandmentsEntry = $state(null);

	$effect(() => {
		(async () => {
			const ids = await fetchChapters();
			const chapterIds = ids.filter(id => id !== 'commandments');
			const cmdId = ids.includes('commandments') ? 'commandments' : null;
			const [results, cmdData] = await Promise.all([
				Promise.all(chapterIds.map(id => fetchChapter(id))),
				cmdId ? fetchChapter(cmdId) : Promise.resolve(null),
			]);
			allChapters = chapterIds.map((id, i) => ({ id, data: results[i] }));
			commandmentsEntry = cmdId && cmdData ? { id: cmdId, data: cmdData } : null;
		})();
	});

	function handleCardClick(index) {
		carouselIndex = index;
		if (activeIndex !== null) {
			// A chapter is open — go back to carousel at this index and stop audio
			activeIndex = null;
			player.visible = false;
			if (player.audio) { player.audio.pause(); player.isPlaying = false; }
		}
		onCarouselJump?.(index);
	}

	function handleTitleClick() {
		activeIndex = null;
		onBackToCarousel?.();
	}

	import { setContext } from 'svelte';
	let onCarouselJump = $state(/** @type {((i: number) => void)|null} */ (null));
	let onBackToCarousel = $state(/** @type {(() => void)|null} */ (null));

	let onCommandments = $state(/** @type {(() => void)|null} */ (null));

	setContext('layout', {
		get allChapters() { return allChapters; },
		get commandmentsEntry() { return commandmentsEntry; },
		get carouselIndex() { return carouselIndex; },
		set carouselIndex(v) { carouselIndex = v; },
		get activeIndex() { return activeIndex; },
		set activeIndex(v) { activeIndex = v; },
		registerCallbacks(onJump, onBack, onCmd) {
			onCarouselJump = onJump;
			onBackToCarousel = onBack;
			onCommandments = onCmd ?? null;
		},
	});
</script>

<svelte:head>
	<title>The Gospel of the Real</title>
</svelte:head>

<div class="flex h-screen overflow-hidden" style="background: var(--bg-main); color: var(--text-primary);">
	<Sidebar
		{allChapters}
		{commandmentsEntry}
		activeIndex={activeIndex}
		focusedIndex={carouselIndex}
		onCardClick={handleCardClick}
		onTitleClick={handleTitleClick}
		onCommandmentsClick={() => onCommandments?.()}
	/>
	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>

<StickyPlayer />
