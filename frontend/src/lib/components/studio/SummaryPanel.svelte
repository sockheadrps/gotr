<script>
	/**
	 * @type {{
	 *   summary: string,
	 *   audioUrl: string|null,
	 *   open: boolean,
	 *   onToggle: () => void,
	 * }}
	 */
	let { summary, audioUrl, open, onToggle } = $props();

	const cacheBustedSrc = $derived(audioUrl ? `${audioUrl}?t=${Date.now()}` : null);
</script>

<div class="rounded-lg border overflow-hidden" style="background: var(--bg-card); border-color: var(--border-color);">
	<!-- Collapsible header -->
	<button
		onclick={onToggle}
		class="w-full flex items-center justify-between px-4 py-3 cursor-pointer border-none text-left transition-colors duration-150"
		style="background: transparent;"
		onmouseenter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
		onmouseleave={(e) => { e.currentTarget.style.background = 'transparent'; }}
	>
		<div class="flex items-center gap-3">
			<span class="text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background: rgba(0,210,211,0.1); color: var(--accent-teal); border: 1px solid rgba(0,210,211,0.25);">Summary</span>
			{#if cacheBustedSrc}
				<span class="text-[0.65rem]" style="color: var(--accent-teal);">● Audio ready</span>
			{:else}
				<span class="text-[0.65rem]" style="color: var(--text-secondary);">No audio</span>
			{/if}
		</div>
		<span class="text-[0.7rem] transition-transform duration-200" style="color: var(--text-secondary); transform: {open ? 'rotate(180deg)' : 'rotate(0deg)'};">▼</span>
	</button>

	{#if open}
		<div class="px-4 pb-4 border-t" style="border-color: var(--border-color);">
			{#if cacheBustedSrc}
				<audio controls preload="none" src={cacheBustedSrc} class="w-full h-8 mt-3 mb-3"></audio>
			{/if}
			<p class="text-[0.85rem] leading-relaxed m-0" style="color: var(--text-secondary);">{summary}</p>
		</div>
	{/if}
</div>
