<script>
	/** @type {{ text: string, onClose: () => void }} */
	let { text, onClose } = $props();
</script>

<div
	class="fixed inset-0 flex items-center justify-center z-5000"
	style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);"
	onclick={onClose}
>
	<div
		class="modal-panel w-[90%] max-w-xl rounded-2xl p-8 border"
		style="background: var(--bg-sidebar); border-color: var(--border-color); box-shadow: 0 20px 50px rgba(0,0,0,0.5);"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex justify-between items-center mb-5 pb-4" style="border-bottom: 1px solid var(--border-color);">
			<h3 class="m-0 text-xl font-extrabold" style="color: var(--accent-purple);">The Ryan Ideology</h3>
			<button
				onclick={onClose}
				class="modal-close bg-transparent border-none text-2xl cursor-pointer leading-none"
				style="color: var(--text-secondary);"
			>×</button>
		</div>
		<div class="rounded-lg p-6 text-base leading-[1.8] whitespace-pre-line" style="background: rgba(0,210,211,0.03); color: var(--text-primary);">
			{text}
		</div>
	</div>
</div>

<style>
	.modal-panel {
		animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes modalIn {
		from { opacity: 0; transform: translateY(10px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-panel { animation: none; }
	}

	.modal-close:focus-visible {
		outline: 2px solid rgba(162, 155, 254, 0.6);
		outline-offset: 3px;
	}
</style>
