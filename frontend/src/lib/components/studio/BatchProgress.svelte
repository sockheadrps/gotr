<script>
	/** @type {{ completed: number, total: number }} */
	let { completed, total } = $props();

	const percent = $derived(total > 0 ? Math.round((completed / total) * 100) : 0);
</script>

<div class="px-6 py-2" style="background: var(--bg-sidebar); border-bottom: 1px solid var(--border-color);">
	<div class="flex items-center gap-3">
		<div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.08);">
			<div
				class="h-full rounded-full transition-all duration-300"
				style="width: {percent}%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-teal));"
			></div>
		</div>
		<span class="text-[0.7rem] font-bold tabular-nums shrink-0" style="color: var(--text-secondary);">{completed}/{total} — {percent}%</span>
	</div>
</div>
