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

	let sidebarOpen = $state(false);

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
		sidebarOpen = false;
		if (activeIndex !== null) {
			activeIndex = null;
			player.visible = false;
			if (player.audio) { player.audio.pause(); player.isPlaying = false; }
		}
		onCarouselJump?.(index);
	}

	function handleTitleClick() {
		activeIndex = null;
		sidebarOpen = false;
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

<!-- Mobile overlay -->
{#if sidebarOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 md:hidden"
		style="background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"
		onclick={() => sidebarOpen = false}
	></div>
{/if}

<div class="flex h-screen overflow-hidden" style="background: var(--bg-main); color: var(--text-primary);">

	<!-- Sidebar: hidden off-screen on mobile, shown as drawer when open -->
	<div class="
		fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
		md:relative md:translate-x-0 md:z-auto md:shrink-0
		{sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
	">
		<Sidebar
			{allChapters}
			{commandmentsEntry}
			activeIndex={activeIndex}
			focusedIndex={carouselIndex}
			onCardClick={handleCardClick}
			onTitleClick={handleTitleClick}
			onCommandmentsClick={() => { onCommandments?.(); sidebarOpen = false; }}
		/>
	</div>

	<main class="flex-1 min-w-0 flex flex-col overflow-hidden">
		<!-- Mobile header bar -->
		<div class="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 md:hidden border-b" style="background: var(--bg-sidebar); border-color: var(--border-color);">
			<button
				onclick={() => sidebarOpen = !sidebarOpen}
				class="flex flex-col gap-1.5 p-1.5 rounded border-none cursor-pointer"
				style="background: transparent;"
				aria-label="Toggle menu"
			>
				<span class="block w-5 h-0.5 rounded-full transition-all duration-200" style="background: {sidebarOpen ? 'var(--accent-teal)' : 'rgba(255,255,255,0.6)'}"></span>
				<span class="block w-5 h-0.5 rounded-full" style="background: {sidebarOpen ? 'var(--accent-teal)' : 'rgba(255,255,255,0.6)'}"></span>
				<span class="block w-5 h-0.5 rounded-full transition-all duration-200" style="background: {sidebarOpen ? 'var(--accent-teal)' : 'rgba(255,255,255,0.6)'}"></span>
			</button>
			<span class="font-bold tracking-tight" style="font-family: Georgia, serif; color: white; font-size: 1.1rem;">
				Got<em style="font-style: normal; color: var(--accent-teal);">R</em>
			</span>
		</div>

		<div class="flex-1 min-h-0 overflow-hidden">
			{@render children()}
		</div>
	</main>
</div>

<StickyPlayer />
