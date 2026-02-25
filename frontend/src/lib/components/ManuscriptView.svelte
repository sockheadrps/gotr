<script>
	import { player, playChunk } from '$lib/audioState.svelte.js';

	/** @type {{ chunks: string[], audioUrls: (string|null)[], lessonOffset?: number|null }} */
	let { chunks, audioUrls, lessonOffset = null } = $props();

	let unlocked = $state(false);
	/** @type {HTMLElement[]} */
	let paraEls = $state([]);
	let userClicking = $state(false);

	/** @param {number} index */
	function handleClick(index) {
		unlocked = true;
		userClicking = true;
		playChunk(index, audioUrls);
		// Reset after the effect has had a chance to run
		setTimeout(() => { userClicking = false; }, 50);
	}

	$effect(() => {
		const i = player.chunkIndex;
		if (player.isPlaying && !userClicking && paraEls[i]) {
			paraEls[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});
</script>

<section class="manuscript-shell relative transition-all duration-500" class:max-h-[400px]={!unlocked} class:overflow-hidden={!unlocked}>
	<div class="manuscript-view leading-loose font-serif text-[1.3rem] max-w-3xl mx-auto" style="color: var(--text-primary);">
		{#if lessonOffset !== null}
			{#each chunks.slice(0, lessonOffset) as text, i}
				<p
					bind:this={paraEls[i]}
					class="chunk-text px-5 py-3 mb-4 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
					class:reading-now={player.chunkIndex === i && player.isPlaying}
					onclick={() => handleClick(i)}
					style="
						border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'transparent'};
						background: {player.chunkIndex === i && player.isPlaying ? 'rgba(0,210,211,0.1)' : 'transparent'};
						color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'inherit'};
					"
				>
					{text.replace(/\[.*?\]/g, '').trim()}
				</p>
			{/each}

			<div class="mt-6 mb-4 rounded-2xl px-8 pt-5 pb-2" style="background: rgba(162,155,254,0.04); border: 1px solid rgba(162,155,254,0.18);">
				<div class="text-[0.6rem] font-black uppercase tracking-[0.2em] mb-2" style="color: var(--accent-purple);">The Wanderer's Wisdom</div>
				<div class="wisdom-rule"></div>
				{#each chunks.slice(lessonOffset) as text, j}
					{@const i = lessonOffset + j}
					<p
						bind:this={paraEls[i]}
						class="chunk-text chunk-text--lesson px-5 py-2 mb-2 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
						class:reading-now={player.chunkIndex === i && player.isPlaying}
						onclick={() => handleClick(i)}
						style="
							border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-purple)' : 'transparent'};
							background: {player.chunkIndex === i && player.isPlaying ? 'rgba(162,155,254,0.08)' : 'transparent'};
							color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-purple)' : 'inherit'};
							font-style: italic;
						"
					>
						{text.replace(/\[.*?\]/g, '').trim()}
					</p>
				{/each}
			</div>
		{:else}
			{#each chunks as text, i}
				<p
					bind:this={paraEls[i]}
					class="chunk-text px-5 py-3 mb-4 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
					class:reading-now={player.chunkIndex === i && player.isPlaying}
					onclick={() => handleClick(i)}
					style="
						border-left-color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'transparent'};
						background: {player.chunkIndex === i && player.isPlaying ? 'rgba(0,210,211,0.1)' : 'transparent'};
						color: {player.chunkIndex === i && player.isPlaying ? 'var(--accent-teal)' : 'inherit'};
					"
				>
					{text.replace(/\[.*?\]/g, '').trim()}
				</p>
			{/each}
		{/if}
	</div>

	{#if !unlocked}
		<div
			class="absolute bottom-0 left-0 right-0 h-72 flex items-end justify-center pb-10"
			style="background: linear-gradient(transparent, var(--bg-main) 90%);"
			onclick={() => (unlocked = true)}
		>
			<button
				class="reveal-btn px-6 py-2.25 rounded-full font-semibold cursor-pointer border transition-all duration-300 tracking-[0.22em] uppercase text-[0.7rem]"
				style="background: transparent; border-color: rgba(162,155,254,0.55); color: var(--accent-purple);"
				onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(162,155,254,0.12)'; e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
				onmouseleave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(162,155,254,0.55)'; }}
			>Reveal Full Manuscript</button>
		</div>
	{/if}
</section>

<style>
	.manuscript-shell {
		animation: manuscriptIn 0.5s ease;
	}

	@keyframes manuscriptIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.manuscript-shell { animation: none; }
	}

	@media (max-width: 767px) {
		.manuscript-view {
			font-size: 1.05rem;
			line-height: 1.75;
		}

		.manuscript-view p {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}

	.chunk-text {
		animation: cmdSurface 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.chunk-text--lesson {
		animation-delay: 0.08s;
	}

	.wisdom-rule {
		height: 1px;
		width: 6rem;
		margin-bottom: 1.25rem;
		background: linear-gradient(to right, var(--accent-purple), var(--accent-teal), transparent);
		transform-origin: left;
		animation: cmdDrawRule 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes cmdDrawRule {
		from { transform: scaleX(0); }
		to { transform: scaleX(1); }
	}

	@keyframes cmdSurface {
		from { opacity: 0; transform: translateY(8px); filter: blur(1px); }
		to { opacity: 1; transform: translateY(0); filter: blur(0); }
	}

	.reveal-btn:hover {
		background: rgba(162, 155, 254, 0.12);
		border-color: var(--accent-purple);
	}

	.reveal-btn:focus-visible {
		outline: 2px solid rgba(162, 155, 254, 0.6);
		outline-offset: 3px;
	}
</style>
