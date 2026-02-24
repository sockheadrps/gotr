<script>
	import ManuscriptView from './ManuscriptView.svelte';
	import IdeologyModal from './IdeologyModal.svelte';

	/** @type {{ chapter: import('../types.js').Chapter }} */
	let { chapter } = $props();

	let ideologyOpen = $state(false);

	const s = $derived(chapter.summary);

	// Iteration chapters return story_chunks + lesson_chunks; legacy chapters return chunks.
	const manuscriptChunks = $derived(
		chapter.story_chunks
			? [...(chapter.story_chunks ?? []), ...(chapter.lesson_chunks ?? [])]
			: (chapter.chunks ?? [])
	);
	const manuscriptAudioUrls = $derived(
		chapter.story_audio_urls
			? [...(chapter.story_audio_urls ?? []), ...(chapter.lesson_audio_urls ?? [])]
			: (chapter.audio_urls ?? [])
	);
	// Index where lesson section begins (null for legacy chapters)
	const lessonOffset = $derived(
		chapter.story_chunks ? (chapter.story_chunks?.length ?? 0) : null
	);

</script>

<div class="px-15 py-15 pb-36 h-full overflow-y-auto">
	<header class="mb-10 pb-6" style="border-bottom: 1px solid var(--border-color);">
		<div class="mb-3 flex gap-2.5 flex-wrap">
			<span class="inline-block px-3 py-1 rounded-full text-[0.65rem] font-extrabold uppercase tracking-[1.2px]"
				style="background: rgba(0,210,211,0.12); border: 1px solid rgba(0,210,211,0.4); color: var(--accent-teal);">
				{s.original_topic}
			</span>
			<span
				class="inline-block px-3 py-1 rounded-full text-[0.65rem] font-extrabold uppercase tracking-[1px] cursor-pointer transition-all duration-200 hover:-translate-y-px"
				style="background: rgba(162,155,254,0.1); border: 1px solid rgba(162,155,254,0.3); color: var(--accent-purple);"
				onmouseenter={(e) => { e.currentTarget.style.background = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--bg-main)'; }}
				onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(162,155,254,0.1)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
				onclick={() => (ideologyOpen = true)}
			>Ryan's Ideology 🔍</span>
		</div>

		<h1 class="text-[3.2rem] font-bold m-0 mb-2.5 leading-tight text-white">{s.gospel_title}</h1>
		<p class="font-serif text-[1.1rem] italic m-0 leading-snug" style="color: var(--text-secondary);">{s.subtitle}</p>

	</header>

	<ManuscriptView chunks={manuscriptChunks} audioUrls={manuscriptAudioUrls} {lessonOffset} />

	{#if ideologyOpen}
		<IdeologyModal text={s.ideology_summary} onClose={() => (ideologyOpen = false)} />
	{/if}
</div>
