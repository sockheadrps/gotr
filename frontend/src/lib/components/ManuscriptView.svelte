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

<section class="relative transition-all duration-500" class:max-h-[400px]={!unlocked} class:overflow-hidden={!unlocked}>
	<div class="manuscript-view leading-loose font-serif text-xl max-w-3xl mx-auto" style="color: var(--text-primary);">
		{#if lessonOffset !== null}
			{#each chunks.slice(0, lessonOffset) as text, i}
				<p
					bind:this={paraEls[i]}
					class="px-5 py-3 mb-4 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
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
				<div class="text-[0.6rem] font-black uppercase tracking-[0.2em] mb-3" style="color: var(--accent-purple);">The Wanderer's Wisdom</div>
				{#each chunks.slice(lessonOffset) as text, j}
					{@const i = lessonOffset + j}
					<p
						bind:this={paraEls[i]}
						class="px-5 py-2 mb-2 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
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
					class="px-5 py-3 mb-4 rounded-lg cursor-pointer transition-all duration-300 border-l-4 opacity-90 hover:opacity-100"
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
				class="px-6 py-2.5 rounded-full font-semibold cursor-pointer border transition-all duration-300 hover:text-(--bg-main)"
				style="background: rgba(162,155,254,0.1); border-color: var(--accent-purple); color: var(--accent-purple); backdrop-filter: blur(5px);"
				onmouseenter={(e) => { e.currentTarget.style.background = 'var(--accent-purple)'; }}
				onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(162,155,254,0.1)'; }}
			>Reveal Full Manuscript</button>
		</div>
	{/if}
</section>
