<script>
	import { updateIterationSummary } from '$lib/api.js';

	/**
	 * @type {{
	 *   summary: string,
	 *   audioUrl: string|null,
	 *   open: boolean,
	 *   onToggle: () => void,
	 *   chapterId?: string,
	 *   iteration?: number|null,
	 *   onRefresh?: () => void,
	 * }}
	 */
	let { summary, audioUrl, open, onToggle, chapterId = '', iteration = null, onRefresh } = $props();

	const cacheBustedSrc = $derived(audioUrl ? `${audioUrl}?t=${Date.now()}` : null);

	let isEditing = $state(false);
	let editText = $state(summary);
	let saving = $state(false);

	$effect(() => {
		if (!isEditing) editText = summary;
	});

	async function saveEdit() {
		if (!chapterId || iteration === null) return;
		saving = true;
		const res = await updateIterationSummary(chapterId, iteration, editText);
		saving = false;
		if (res.success) {
			isEditing = false;
			if (onRefresh) onRefresh();
		}
	}
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

			{#if isEditing}
				<textarea
					class="w-full rounded border px-3 py-2 text-[0.85rem] leading-relaxed resize-y outline-none mt-3"
					style="background: var(--bg-main); border-color: var(--border-color); color: var(--text-primary); min-height: 100px;"
					rows="5"
					bind:value={editText}
				></textarea>
				<div class="flex gap-2 mt-2">
					<button onclick={saveEdit} disabled={saving} class="chunk-btn" style="color: #2ecc71; border-color: rgba(46,204,113,0.4);">{saving ? '⏳' : 'Save'}</button>
					<button onclick={() => isEditing = false} class="chunk-btn" style="color: var(--text-secondary); border-color: var(--border-color);">Cancel</button>
				</div>
			{:else}
				<div class="flex items-start gap-3 mt-3">
					<p class="text-[0.85rem] leading-relaxed m-0 flex-1" style="color: var(--text-secondary);">{summary}</p>
					{#if chapterId && iteration !== null}
						<button onclick={() => isEditing = true} class="chunk-btn shrink-0" style="color: var(--text-secondary); border-color: var(--border-color);">Edit</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
