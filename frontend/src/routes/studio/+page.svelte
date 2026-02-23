<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		fetchChapters, fetchIterations, fetchIteration,
		setActiveIteration, generateIterationChunk,
		concatenateIteration, generateIterationSummary,
		fixIterationAlignment,
	} from '$lib/api.js';
	import ChunkRow from '$lib/components/studio/ChunkRow.svelte';
	import SummaryPanel from '$lib/components/studio/SummaryPanel.svelte';
	import BatchProgress from '$lib/components/studio/BatchProgress.svelte';

	const isDev = import.meta.env.VITE_IS_DEV === 'true';
	if (browser && !isDev) goto('/');

	/** @type {string[]} */
	let chapterIds = $state([]);
	let selectedId = $state('');
	/** @type {number[]} */
	let iterations = $state([]);
	/** @type {number|null} */
	let selectedIteration = $state(null);
	/** @type {number|null} */
	let activeIteration = $state(null);

	/** @type {string[]} */
	let storyChunks = $state([]);
	/** @type {string[]} */
	let lessonChunks = $state([]);
	/** @type {(string|null)[]} */
	let storyAudioUrls = $state([]);
	/** @type {(string|null)[]} */
	let lessonAudioUrls = $state([]);
	/** @type {string|null} */
	let summaryText = $state(null);
	/** @type {string|null} */
	let summaryAudioUrl = $state(null);
	/** @type {string|null} */
	let fullAudioUrl = $state(null);
	let chapterTitle = $state('');
	let statusMsg = $state('');

	let isGenerating = $state(false);
	let batchCompleted = $state(0);
	let batchTotal = $state(0);
	let stopFlag = $state(false);
	let summaryOpen = $state(false);

	/** @type {HTMLAudioElement|null} */
	let playAllAudio = $state(null);
	let isPlayingAll = $state(false);
	/** @type {string|null} */
	let playAllCurrentUrl = $state(null);

	// Selection: { type: 'story'|'lesson', index: number } | null
	/** @type {{ type: 'story'|'lesson', index: number }|null} */
	let selectedChunk = $state(null);

	function toggleChunkSelect(type, index) {
		if (selectedChunk?.type === type && selectedChunk?.index === index) {
			selectedChunk = null;
		} else {
			selectedChunk = { type, index };
		}
	}

	$effect(() => {
		fetchChapters().then((ids) => { chapterIds = ids; });
	});

	async function loadChapterIterations(id) {
		if (!id) { iterations = []; selectedIteration = null; activeIteration = null; clearIteration(); return; }
		const res = await fetchIterations(id);
		iterations = res.iterations ?? [];
		activeIteration = res.active_iteration ?? null;
		selectedIteration = null;
		clearIteration();
	}

	function clearIteration() {
		storyChunks = []; lessonChunks = [];
		storyAudioUrls = []; lessonAudioUrls = [];
		summaryText = null; summaryAudioUrl = null;
		fullAudioUrl = null; chapterTitle = '';
		selectedChunk = null;
	}

	async function loadIteration(iteration) {
		if (iteration === null || iteration === undefined) { clearIteration(); return; }
		const data = await fetchIteration(selectedId, iteration);
		storyChunks = data.story_chunks ?? [];
		lessonChunks = data.lesson_chunks ?? [];
		storyAudioUrls = data.story_audio_urls ?? [];
		lessonAudioUrls = data.lesson_audio_urls ?? [];
		// summary.json may have "summary" string or "summary_chunks" array
		const s = data.summary ?? {};
		summaryText = s.summary ?? (s.summary_chunks?.join(' ') ?? null);
		summaryAudioUrl = data.summary_audio_url ?? null;
		fullAudioUrl = data.full_audio_url ?? null;
		chapterTitle = data.title ?? '';
	}

	async function refreshIteration() {
		if (selectedId && selectedIteration !== null) await loadIteration(selectedIteration);
	}

	async function handleSetActive() {
		if (!selectedId || selectedIteration === null) return;
		const res = await setActiveIteration(selectedId, selectedIteration);
		if (res.success) { activeIteration = selectedIteration; statusMsg = '✅ Set as active.'; setTimeout(() => statusMsg = '', 3000); }
	}

	async function handleGenSummary() {
		if (!selectedId || selectedIteration === null) return;
		statusMsg = '⏳ Generating summary audio...';
		const res = await generateIterationSummary(selectedId, selectedIteration);
		if (res.success) {
			summaryAudioUrl = res.url;
			summaryOpen = true; // auto-open so the player is visible
			statusMsg = '✅ Summary audio ready.';
		} else statusMsg = '❌ Failed.';
		setTimeout(() => statusMsg = '', 4000);
	}

	async function handleConcat() {
		if (!selectedId || selectedIteration === null) return;
		statusMsg = '⏳ Stitching...';
		const res = await concatenateIteration(selectedId, selectedIteration);
		if (res.success) { fullAudioUrl = res.url; statusMsg = '✅ Full audio ready.'; }
		else statusMsg = '❌ ' + (res.error ?? 'Failed');
		setTimeout(() => statusMsg = '', 4000);
	}

	async function handleFixSync() {
		if (!selectedId || selectedIteration === null) return;
		if (!confirm('Remove orphan audio files?')) return;
		statusMsg = '🔧 Synchronizing...';
		const res = await fixIterationAlignment(selectedId, selectedIteration);
		statusMsg = res.success ? '✅ Synced!' : '❌ Sync failed.';
		if (res.success) await refreshIteration();
		setTimeout(() => statusMsg = '', 4000);
	}

	async function runBatchGeneration(chunkType, chunks, force = false) {
		if (isGenerating || !selectedId || selectedIteration === null) return;
		isGenerating = true;
		stopFlag = false;
		const existingUrls = chunkType === 'story' ? storyAudioUrls : lessonAudioUrls;
		const tasks = chunks.map((_, i) => i).filter((i) => force || !existingUrls[i]);
		batchTotal = (storyChunks.length + lessonChunks.length);
		batchCompleted = force ? 0 : (storyAudioUrls.filter(Boolean).length + lessonAudioUrls.filter(Boolean).length);
		statusMsg = `🚀 Processing ${tasks.length} ${chunkType} chunks...`;
		const BATCH = 3;
		for (let i = 0; i < tasks.length; i += BATCH) {
			if (stopFlag) break;
			await Promise.all(tasks.slice(i, i + BATCH).map(async (idx) => {
				const res = await generateIterationChunk({
					text: chunks[idx],
					chapter_id: selectedId,
					iteration: selectedIteration,
					chunk_type: chunkType,
					chunk_index: idx,
					force,
				});
				if (res.success) {
					if (chunkType === 'story') storyAudioUrls[idx] = res.url;
					else lessonAudioUrls[idx] = res.url;
				}
				batchCompleted++;
			}));
		}
		statusMsg = stopFlag ? '🛑 Stopped.' : '✅ Batch complete.';
		isGenerating = false;
		setTimeout(() => statusMsg = '', 4000);
	}

	async function runBatchAll(force = false) {
		if (isGenerating || !selectedId || selectedIteration === null) return;
		isGenerating = true;
		stopFlag = false;
		batchTotal = storyChunks.length + lessonChunks.length;
		batchCompleted = force ? 0 : (storyAudioUrls.filter(Boolean).length + lessonAudioUrls.filter(Boolean).length);
		statusMsg = `🚀 Processing all chunks...`;
		const BATCH = 3;
		const storyTasks = storyChunks.map((_, i) => i).filter((i) => force || !storyAudioUrls[i]);
		const lessonTasks = lessonChunks.map((_, i) => i).filter((i) => force || !lessonAudioUrls[i]);
		const allTasks = [
			...storyTasks.map((i) => ({ type: 'story', i })),
			...lessonTasks.map((i) => ({ type: 'lesson', i })),
		];
		for (let t = 0; t < allTasks.length; t += BATCH) {
			if (stopFlag) break;
			await Promise.all(allTasks.slice(t, t + BATCH).map(async ({ type, i }) => {
				const chunks = type === 'story' ? storyChunks : lessonChunks;
				const res = await generateIterationChunk({
					text: chunks[i], chapter_id: selectedId,
					iteration: selectedIteration, chunk_type: type,
					chunk_index: i, force,
				});
				if (res.success) {
					if (type === 'story') storyAudioUrls[i] = res.url;
					else lessonAudioUrls[i] = res.url;
				}
				batchCompleted++;
			}));
		}
		statusMsg = stopFlag ? '🛑 Stopped.' : '✅ Batch complete.';
		isGenerating = false;
		setTimeout(() => statusMsg = '', 4000);
	}

	function stopAll() { stopFlag = true; isGenerating = false; }

	async function playAll() {
		if (isPlayingAll) { stopPlayAll(); return; }
		// Build ordered list of { url, type, index } for all generated chunks
		const all = [
			...storyAudioUrls.map((url, i) => ({ url, type: 'story', index: i })),
			...lessonAudioUrls.map((url, i) => ({ url, type: 'lesson', index: i })),
		].filter(e => e.url);
		if (all.length === 0) { statusMsg = 'No audio to play.'; setTimeout(() => statusMsg = '', 3000); return; }
		// Find start position from selection
		let startIdx = 0;
		if (selectedChunk) {
			const found = all.findIndex(e => e.type === selectedChunk.type && e.index === selectedChunk.index);
			if (found !== -1) startIdx = found;
		}
		const toPlay = all.slice(startIdx);
		isPlayingAll = true;
		for (const { url } of toPlay) {
			if (!isPlayingAll) break;
			playAllCurrentUrl = url.split('?')[0];
			await new Promise((resolve) => {
				playAllAudio = new Audio(url);
				playAllAudio.onended = resolve;
				playAllAudio.onerror = resolve;
				playAllAudio.play();
			});
		}
		isPlayingAll = false;
		playAllAudio = null;
		playAllCurrentUrl = null;
	}

	function stopPlayAll() {
		isPlayingAll = false;
		if (playAllAudio) { playAllAudio.pause(); playAllAudio = null; }
		playAllCurrentUrl = null;
	}
</script>

<svelte:head>
	<title>Voice Gen Studio</title>
</svelte:head>

<div class="min-h-screen flex flex-col" style="background: var(--bg-main); color: var(--text-primary);">

	<!-- Sticky toolbar -->
	<header class="sticky top-0 z-20 px-6 py-3 flex flex-wrap items-center gap-3 border-b" style="background: var(--bg-sidebar); border-color: var(--border-color);">
		<!-- Back link -->
		<a href="/" class="text-[0.7rem] font-bold uppercase tracking-widest no-underline px-3 py-1.5 rounded-md border transition-colors duration-150"
			style="color: var(--text-secondary); border-color: var(--border-color);"
			onmouseenter={(e) => { e.currentTarget.style.color = 'var(--accent-teal)'; e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
			onmouseleave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
		>← GotR</a>

		<span class="text-[0.6rem] font-black uppercase tracking-widest" style="color: var(--accent-purple);">Studio</span>

		<!-- Chapter select -->
		<select
			bind:value={selectedId}
			onchange={() => loadChapterIterations(selectedId)}
			class="text-[0.8rem] px-3 py-1.5 rounded-md border outline-none cursor-pointer"
			style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
		>
			<option value="">Select chapter...</option>
			{#each chapterIds as id}
				<option value={id}>{id}</option>
			{/each}
		</select>

		<!-- Iteration select -->
		{#if iterations.length > 0}
			<select
				onchange={(e) => { selectedIteration = Number(e.currentTarget.value); loadIteration(selectedIteration); }}
				class="text-[0.8rem] px-3 py-1.5 rounded-md border outline-none cursor-pointer"
				style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"
			>
				<option value="">Select iteration...</option>
				{#each iterations as n}
					<option value={n}>iteration-{n}{activeIteration === n ? ' ★' : ''}</option>
				{/each}
			</select>
		{:else if selectedId}
			<span class="text-[0.75rem]" style="color: var(--text-secondary);">No iterations found</span>
		{/if}

		<!-- Active badge -->
		{#if selectedIteration !== null}
			{#if activeIteration === selectedIteration}
				<span class="text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background: rgba(0,210,211,0.15); color: var(--accent-teal); border: 1px solid rgba(0,210,211,0.3);">Active</span>
			{:else}
				<button
					onclick={handleSetActive}
					class="text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border cursor-pointer transition-colors duration-150"
					style="background: transparent; color: var(--text-secondary); border-color: var(--border-color);"
					onmouseenter={(e) => { e.currentTarget.style.color = 'var(--accent-teal)'; e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
					onmouseleave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
				>Set Active</button>
			{/if}
		{/if}

		<!-- Divider -->
		<div class="h-5 w-px mx-1" style="background: var(--border-color);"></div>

		<!-- Action buttons -->
		{#if selectedIteration !== null}
			<button onclick={playAll}
				class="studio-btn"
				style="background: {isPlayingAll ? 'rgba(0,210,211,0.25)' : 'rgba(0,210,211,0.15)'}; color: var(--accent-teal); border: 1px solid rgba(0,210,211,0.3);"
			>{isPlayingAll ? '⏹ Stop Play' : selectedChunk ? `▶ From #${selectedChunk.index + 1}` : '▶ Play All'}</button>

			<button onclick={() => runBatchAll(false)} disabled={isGenerating}
				class="studio-btn"
				style="background: var(--accent-purple); color: var(--bg-main);"
			>Generate All</button>

			<button onclick={() => { if (confirm('Force regen all chunks?')) runBatchAll(true); }} disabled={isGenerating}
				class="studio-btn"
				style="background: #e74c3c; color: white;"
			>Regen All</button>

			<button onclick={stopAll} disabled={!isGenerating}
				class="studio-btn"
				style="background: var(--bg-card-hover); color: var(--text-secondary);"
			>Stop</button>

			<button onclick={handleGenSummary}
				class="studio-btn"
				style="background: rgba(0,210,211,0.15); color: var(--accent-teal); border: 1px solid rgba(0,210,211,0.3);"
			>Gen Summary</button>

			<button onclick={handleConcat}
				class="studio-btn"
				style="background: rgba(162,155,254,0.15); color: var(--accent-purple); border: 1px solid rgba(162,155,254,0.3);"
			>Concatenate</button>

			<button onclick={handleFixSync}
				class="studio-btn"
				style="background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-color);"
			>Fix Sync</button>

			{#if fullAudioUrl}
				<a href={fullAudioUrl} download
					class="studio-btn no-underline"
					style="background: rgba(41,128,185,0.2); color: #74b9ff; border: 1px solid rgba(74,185,255,0.3);"
				>Download Full</a>
			{/if}
		{/if}

		<!-- Status message -->
		{#if statusMsg}
			<span class="text-[0.75rem] ml-auto" style="color: var(--text-secondary);">{statusMsg}</span>
		{/if}
	</header>

	<!-- Batch progress -->
	{#if isGenerating}
		<BatchProgress completed={batchCompleted} total={batchTotal} />
	{/if}

	<!-- Chapter title -->
	{#if chapterTitle}
		<div class="px-6 pt-5 pb-1">
			<h2 class="text-[1.4rem] font-black m-0" style="color: var(--text-primary);">{chapterTitle}</h2>
			{#if selectedIteration !== null}
				<p class="text-[0.7rem] uppercase tracking-widest mt-0.5 mb-0" style="color: var(--text-secondary);">iteration-{selectedIteration}</p>
			{/if}
		</div>
	{/if}

	<!-- Summary panel -->
	{#if summaryText}
		<div class="px-6 pt-3">
			<SummaryPanel summary={summaryText} audioUrl={summaryAudioUrl} open={summaryOpen} onToggle={() => summaryOpen = !summaryOpen} />
		</div>
	{/if}

	<!-- Chunk sections -->
	{#if selectedIteration !== null && (storyChunks.length > 0 || lessonChunks.length > 0)}
		<div class="flex-1 px-6 pb-10 pt-4 flex flex-col gap-8">

			<!-- Story section -->
			{#if storyChunks.length > 0}
				<section>
					<div class="flex items-center gap-3 mb-3">
						<span class="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background: rgba(162,155,254,0.12); color: var(--accent-purple); border: 1px solid rgba(162,155,254,0.25);">Story</span>
						<span class="text-[0.7rem]" style="color: var(--text-secondary);">{storyChunks.length} chunks · {storyAudioUrls.filter(Boolean).length} generated</span>
						<button
							onclick={() => runBatchGeneration('story', storyChunks, false)}
							disabled={isGenerating}
							class="studio-btn-sm ml-auto"
							style="background: rgba(162,155,254,0.1); color: var(--accent-purple); border-color: rgba(162,155,254,0.3);"
						>Gen Story</button>
					</div>
					<div class="flex flex-col gap-2">
						{#each storyChunks as chunk, i}
							<ChunkRow
								{chunk} index={i}
								chunkType="story"
								chapterId={selectedId}
								iteration={selectedIteration}
								audioUrl={storyAudioUrls[i] ?? null}
								onRefresh={refreshIteration}
								isPlayingExternal={playAllCurrentUrl !== null && storyAudioUrls[i] != null && storyAudioUrls[i].split('?')[0] === playAllCurrentUrl}
								isSelected={selectedChunk?.type === 'story' && selectedChunk?.index === i}
								onSelect={() => toggleChunkSelect('story', i)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Lesson section -->
			{#if lessonChunks.length > 0}
				<section>
					<div class="flex items-center gap-3 mb-3">
						<span class="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background: rgba(0,210,211,0.1); color: var(--accent-teal); border: 1px solid rgba(0,210,211,0.25);">Lesson</span>
						<span class="text-[0.7rem]" style="color: var(--text-secondary);">{lessonChunks.length} chunks · {lessonAudioUrls.filter(Boolean).length} generated</span>
						<button
							onclick={() => runBatchGeneration('lesson', lessonChunks, false)}
							disabled={isGenerating}
							class="studio-btn-sm ml-auto"
							style="background: rgba(0,210,211,0.1); color: var(--accent-teal); border-color: rgba(0,210,211,0.25);"
						>Gen Lesson</button>
					</div>
					<div class="flex flex-col gap-2">
						{#each lessonChunks as chunk, i}
							<ChunkRow
								{chunk} index={i}
								chunkType="lesson"
								chapterId={selectedId}
								iteration={selectedIteration}
								audioUrl={lessonAudioUrls[i] ?? null}
								onRefresh={refreshIteration}
								isPlayingExternal={playAllCurrentUrl !== null && lessonAudioUrls[i] != null && lessonAudioUrls[i].split('?')[0] === playAllCurrentUrl}
								isSelected={selectedChunk?.type === 'lesson' && selectedChunk?.index === i}
								onSelect={() => toggleChunkSelect('lesson', i)}
							/>
						{/each}
					</div>
				</section>
			{/if}
		</div>

	{:else if selectedId && selectedIteration === null && iterations.length > 0}
		<div class="flex-1 flex items-center justify-center" style="color: var(--text-secondary);">
			Select an iteration to load chunks
		</div>
	{:else if selectedId && iterations.length === 0}
		<div class="flex-1 flex items-center justify-center" style="color: var(--text-secondary);">
			No iterations found for this chapter
		</div>
	{:else if !selectedId}
		<div class="flex-1 flex items-center justify-center" style="color: var(--text-secondary);">
			Select a chapter to begin
		</div>
	{/if}
</div>

<style>
	:global(.studio-btn) {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.3rem 0.75rem;
		border-radius: 0.375rem;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s, filter 0.15s;
		white-space: nowrap;
	}
	:global(.studio-btn:hover:not(:disabled)) { filter: brightness(1.15); }
	:global(.studio-btn:disabled) { opacity: 0.4; cursor: not-allowed; }
	:global(.studio-btn-sm) {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.6rem;
		border-radius: 0.375rem;
		border: 1px solid;
		cursor: pointer;
		background: transparent;
		transition: filter 0.15s;
	}
	:global(.studio-btn-sm:hover:not(:disabled)) { filter: brightness(1.2); }
	:global(.studio-btn-sm:disabled) { opacity: 0.4; cursor: not-allowed; }
</style>
