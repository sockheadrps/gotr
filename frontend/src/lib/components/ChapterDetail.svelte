<script>
	import ManuscriptView from './ManuscriptView.svelte';
	import { player } from '$lib/audioState.svelte.js';

	/** @type {{ chapter: import('../types.js').Chapter }} */
	let { chapter } = $props();

	let manuscriptUnlocked = $state(false);
	let pageEl = $state(/** @type {HTMLElement|null} */ (null));
	let scrollY = $state(0);
	let bgHidden = $state(false);

	const s = $derived(chapter.summary);
	const chapterId = $derived(player.chapterId);
	const bgImage = $derived.by(() => {
		const raw = /** @type {any} */ (chapter);
		return raw?.summary?.image || raw?.image || (chapterId ? `/static/chapters/${chapterId}/img.png` : null);
	});
	const bgTransform = $derived(`transform: translate3d(0, ${Math.round(scrollY * -0.08)}px, 0) scale(1.04);`);

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

<div
	class="chapter-page px-6 md:px-10 py-10 md:py-12 h-full overflow-y-auto "
	bind:this={pageEl}
	onscroll={() => {
		scrollY = pageEl?.scrollTop ?? 0;
	}}
>
	{#if bgImage && !bgHidden}
		<div class="chapter-bg" aria-hidden="true">
			<img
				src={bgImage}
				alt=""
				class="chapter-bg-img"
				style={bgTransform}
				onerror={() => {
					bgHidden = true;
				}}
			/>
			<div class="chapter-bg-vignette"></div>
		</div>
	{/if}

	<header class="chapter-header max-w-5xl mx-auto mb-7 md:mb-8 pb-2">
		<h1 class="chapter-title text-[2.6rem] md:text-[3.35rem] font-extrabold m-0 mb-3 leading-tight text-white">{s.gospel_title}</h1>
		<p class="chapter-subtitle font-serif text-[1.05rem] md:text-[1.2rem] italic m-0 leading-snug" style="color: var(--text-secondary);">{s.subtitle}</p>
	</header>

	<ManuscriptView
		chunks={manuscriptChunks}
		audioUrls={manuscriptAudioUrls}
		unlockFromParent={manuscriptUnlocked}
		{lessonOffset}
	/>
</div>

<style>
	.chapter-header {
		animation: headerReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
	}

	.chapter-page {
		background: none;
		position: relative;
		isolation: isolate;
	}

	.chapter-bg {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.chapter-bg-img {
		position: absolute;
		inset: -6% -4%;
		width: 108%;
		height: 112%;
		object-fit: cover;
		object-position: center 4%;
		opacity: 0.20;
		filter: saturate(0.99) contrast(0.99) blur(0.9px);
		will-change: transform;
	}

	.chapter-bg-vignette {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(120% 90% at 50% -10%, rgba(4, 8, 24, 0.342), rgba(4, 8, 24, 0.92) 70%),
			linear-gradient(to bottom, rgba(4, 8, 24, 0.4), rgba(4, 8, 24, 0.95));
	}

	.chapter-header,
	:global(.manuscript-shell) {
		position: relative;
		z-index: 1;
	}

	.chapter-title {
		letter-spacing: -0.02em;
		max-width: 22ch;
	}

	.chapter-subtitle {
		line-height: 1.6;
		max-width: 62ch;
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
</style>
