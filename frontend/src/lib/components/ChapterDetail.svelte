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
	<header class="chapter-header mb-10 pb-6" style="border-bottom: none;">
		<div class="mb-3 flex gap-2.5 flex-wrap">
			<span class="inline-block px-3 py-1 rounded-full text-[0.65rem] font-extrabold uppercase tracking-[1.2px]"
				style="background: rgba(0,210,211,0.12); border: 1px solid rgba(0,210,211,0.4); color: var(--accent-teal);">
				{s.original_topic}
			</span>
			<button
				type="button"
				class="ideology-chip inline-block px-3 py-1 rounded-full text-[0.65rem] font-extrabold uppercase tracking-[1px] cursor-pointer transition-all duration-200 hover:-translate-y-px"
				style="background: rgba(162,155,254,0.1); border: 1px solid rgba(162,155,254,0.3); color: var(--accent-purple);"
				onmouseenter={(e) => { e.currentTarget.style.background = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--bg-main)'; }}
				onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(162,155,254,0.1)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
				onclick={() => (ideologyOpen = true)}
			>Ryan's Ideology 🔍</button>
		</div>

		<h1 class="chapter-title text-[3.5rem] font-extrabold m-0 mb-2.5 leading-tight text-white">{s.gospel_title}</h1>
		<p class="chapter-subtitle font-serif text-[1.2rem] italic m-0 leading-snug" style="color: var(--text-secondary);">{s.subtitle}</p>

	</header>

	<ManuscriptView chunks={manuscriptChunks} audioUrls={manuscriptAudioUrls} {lessonOffset} />

	{#if ideologyOpen}
		<IdeologyModal text={s.ideology_summary} onClose={() => (ideologyOpen = false)} />
	{/if}
</div>

<style>
	.chapter-header {
		animation: headerReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.chapter-title {
		letter-spacing: -0.02em;
	}

	.chapter-header {
		position: relative;
	}

	.chapter-header::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: linear-gradient(to right, var(--accent-teal), transparent);
		transform-origin: left;
		animation: cmdDrawRule 1s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes cmdDrawRule {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}

	@keyframes headerReveal {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.chapter-header { animation: none; }
	}

	@media (max-width: 767px) {
		.chapter-title {
			font-size: 2.2rem;
			line-height: 1.15;
		}

		.chapter-subtitle {
			font-size: 1rem;
		}
	}

	.chapter-subtitle {
		line-height: 1.6;
	}

	.ideology-chip:focus-visible {
		outline: 2px solid rgba(162, 155, 254, 0.6);
		outline-offset: 2px;
	}
</style>
