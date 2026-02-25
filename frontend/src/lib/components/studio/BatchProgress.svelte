<script>
	/** @type {{ completed: number, total: number }} */
	let { completed, total } = $props();

	const percent = $derived(total > 0 ? Math.round((completed / total) * 100) : 0);
</script>

<div class="px-6 py-2" style="background: var(--bg-sidebar); border-bottom: 1px solid var(--border-color);">
	<div class="flex items-center gap-3">
		<div class="flex-1 h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.12);">
			<div
				class="h-full rounded-full transition-all duration-300"
				style="width: {percent}%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-teal));"
			></div>
		</div>
		<span class="progress-label text-[0.75rem] font-extrabold tabular-nums shrink-0" style="color: var(--text-secondary);">{completed}/{total} — {percent}%</span>
	</div>
</div>

<style>
	.progress-label {
		letter-spacing: 0.02em;
	}
</style>
