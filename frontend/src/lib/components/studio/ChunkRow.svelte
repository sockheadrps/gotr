<script>
	import {
		generateIterationChunk, trimAudio, padAudio,
		updateIterationChunk, insertIterationChunk, deleteIterationChunk,
	} from '$lib/api.js';

	/**
	 * @type {{
	 *   chunk: string,
	 *   index: number,
	 *   chunkType: 'story'|'lesson',
	 *   chapterId: string,
	 *   iteration: number,
	 *   audioUrl: string|null,
	 *   onRefresh: () => void,
	 *   isPlayingExternal?: boolean,
	 *   isSelected?: boolean,
	 *   onSelect?: () => void,
	 * }}
	 */
	let { chunk, index, chunkType, chapterId, iteration, audioUrl, onRefresh, isPlayingExternal = false, isSelected = false, onSelect } = $props();

	let isPlayingLocal = $state(false);

	let currentUrl = $state(audioUrl ? `${audioUrl}?t=${Date.now()}` : null);
	let status = $state(/** @type {'idle'|'generating'|'error'} */ ('idle'));
	let isEditing = $state(false);
	let editText = $state(chunk);
	let trimValue = $state('');
	let padValue = $state('');
	/** @type {HTMLAudioElement|null} */
	let streamAudio = $state(null);

	$effect(() => {
		currentUrl = audioUrl ? `${audioUrl}?t=${Date.now()}` : null;
	});

	$effect(() => {
		if (!isEditing) editText = chunk;
	});

	/** @param {boolean} force */
	async function generate(force = false) {
		status = 'generating';
		const result = await generateIterationChunk({
			text: isEditing ? editText : chunk,
			chapter_id: chapterId,
			iteration,
			chunk_type: chunkType,
			chunk_index: index,
			force,
		});
		if (result.success) {
			currentUrl = `${result.url}?t=${Date.now()}`;
			status = 'idle';
		} else {
			status = 'error';
		}
	}

	function stream() {
		const src = `/stream?text=${encodeURIComponent(chunk)}`;
		if (streamAudio) streamAudio.pause();
		streamAudio = new Audio(src);
		streamAudio.play();
	}

	async function saveEdit() {
		const result = await updateIterationChunk(chapterId, iteration, chunkType, index, editText);
		if (result.success) { isEditing = false; onRefresh(); }
	}

	async function handleInsert() {
		const result = await insertIterationChunk(chapterId, iteration, chunkType, index);
		if (result.success) onRefresh();
	}

	async function handleDelete() {
		if (!confirm('Delete this chunk?')) return;
		const result = await deleteIterationChunk(chapterId, iteration, chunkType, index);
		if (result.success) onRefresh();
	}

	async function handleTrim() {
		const endTime = parseFloat(trimValue);
		if (isNaN(endTime) || endTime <= 0) return;
		const rawPath = currentUrl?.split('?')[0] ?? '';
		const result = await trimAudio(rawPath, endTime);
		if (result.success) currentUrl = result.url;
	}

	async function handlePad() {
		const secs = parseFloat(padValue);
		if (isNaN(secs) || secs <= 0) return;
		const rawPath = currentUrl?.split('?')[0] ?? '';
		const result = await padAudio(rawPath, secs);
		if (result.success) { currentUrl = result.url; padValue = ''; }
	}

	/** @param {Event} e */
	function onAudioLoad(e) {
		const audio = /** @type {HTMLAudioElement} */ (e.target);
		if (!trimValue) trimValue = audio.duration.toFixed(2);
	}

	const typeColor = chunkType === 'story' ? 'var(--accent-purple)' : 'var(--accent-teal)';
	const typeBg = chunkType === 'story' ? 'rgba(162,155,254,0.08)' : 'rgba(0,210,211,0.08)';
	const typeBorder = chunkType === 'story' ? 'rgba(162,155,254,0.25)' : 'rgba(0,210,211,0.25)';

	const isPlaying = $derived(isPlayingExternal || isPlayingLocal);
	const playingBorder = chunkType === 'story' ? 'rgba(162,155,254,0.7)' : 'rgba(0,210,211,0.7)';
	const selectedBorder = chunkType === 'story' ? 'rgba(162,155,254,0.45)' : 'rgba(0,210,211,0.45)';
	const selectedBg = chunkType === 'story' ? 'rgba(162,155,254,0.04)' : 'rgba(0,210,211,0.04)';

	const cardBorderColor = $derived(
		isPlaying ? playingBorder :
		isSelected ? selectedBorder :
		'var(--border-color)'
	);
	const cardShadow = $derived(
		isPlaying ? `0 0 0 1px ${playingBorder}` :
		isSelected ? `0 0 0 1px ${selectedBorder}` :
		'none'
	);
	const cardBg = $derived(isSelected && !isPlaying ? selectedBg : 'var(--bg-card)');
</script>

<div class="rounded-lg border" style="background: {cardBg}; border-color: {cardBorderColor}; box-shadow: {cardShadow}; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;">

	<!-- Text section (click to select) -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="flex items-start gap-3 px-4 pt-4 pb-4 cursor-pointer" onclick={onSelect}>
		<span class="text-[0.65rem] font-black tabular-nums shrink-0 px-2 py-1 rounded mt-0.5" style="background: {typeBg}; color: {typeColor}; border: 1px solid {typeBorder}; min-width: 2.5rem; text-align: center;">
			#{index + 1}
		</span>
		<div class="flex-1 min-w-0">
			{#if isEditing}
				<textarea
					class="w-full rounded border px-3 py-2 text-[0.95rem] leading-relaxed resize-y outline-none"
					style="background: var(--bg-main); border-color: var(--border-color); color: var(--text-primary); min-height: 80px;"
					rows="3"
					bind:value={editText}
				></textarea>
			{:else}
				<p class="text-[0.95rem] leading-relaxed m-0" style="color: var(--text-primary);">{chunk}</p>
			{/if}
		</div>
	</div>

	<!-- Footer -->
	<div class="flex items-center gap-4 px-4 pb-3 pt-3 border-t flex-wrap" style="border-color: var(--border-color);">

		<!-- Buttons: all in one row -->
		<div class="flex items-center gap-1.5 shrink-0">
			<button onclick={stream} class="chunk-btn" style="color: var(--text-secondary); border-color: var(--border-color);">Stream</button>

			<button
				disabled={status === 'generating'}
				onclick={() => generate(false)}
				class="chunk-btn"
				style="color: {currentUrl ? 'var(--text-secondary)' : typeColor}; border-color: {currentUrl ? 'var(--border-color)' : typeColor};"
			>{status === 'generating' ? '⏳' : 'Generate'}</button>

			{#if currentUrl}
				<button onclick={() => generate(true)} class="chunk-btn" style="color: #e74c3c; border-color: rgba(231,76,60,0.4);">Regen</button>
			{/if}

			<div class="w-px h-3 mx-0.5" style="background: var(--border-color);"></div>

			{#if isEditing}
				<button onclick={saveEdit} class="chunk-btn" style="color: #2ecc71; border-color: rgba(46,204,113,0.4);">Save</button>
				<button onclick={() => (isEditing = false)} class="chunk-btn" style="color: var(--text-secondary); border-color: var(--border-color);">Cancel</button>
			{:else}
				<button onclick={() => (isEditing = true)} class="chunk-btn" style="color: var(--text-secondary); border-color: var(--border-color);">Edit</button>
			{/if}

			<button onclick={handleInsert} class="chunk-btn" style="color: #2ecc71; border-color: rgba(46,204,113,0.4);">+ Insert</button>
			<button onclick={handleDelete} class="chunk-btn" style="color: #e74c3c; border-color: rgba(231,76,60,0.4);">Del</button>
		</div>

		<!-- Audio + trim: all in one row -->
		{#if currentUrl}
			<div class="flex items-center gap-2">
				<audio
				controls preload="none" src={currentUrl}
				onloadedmetadata={onAudioLoad}
				onplay={() => isPlayingLocal = true}
				onpause={() => isPlayingLocal = false}
				onended={() => isPlayingLocal = false}
				style="height: 32px; width: 280px;"
			></audio>
				<input
					type="number" step="0.1"
					class="w-20 text-[0.78rem] px-2 py-1 rounded border outline-none text-center"
					style="background: var(--bg-main); border-color: var(--border-color); color: var(--text-primary);"
					placeholder="End s"
					bind:value={trimValue}
				/>
				<button onclick={handleTrim} class="chunk-btn" style="color: var(--accent-teal); border-color: rgba(0,210,211,0.4);">✂ Trim</button>

				<div class="w-px h-3" style="background: var(--border-color);"></div>

				<input
					type="number" step="0.1" min="0.1"
					class="w-16 text-[0.78rem] px-2 py-1 rounded border outline-none text-center"
					style="background: var(--bg-main); border-color: var(--border-color); color: var(--text-primary);"
					placeholder="+s"
					bind:value={padValue}
				/>
				<button onclick={handlePad} class="chunk-btn" style="color: var(--accent-purple); border-color: rgba(162,155,254,0.4);">+ Pad</button>

				<a href={currentUrl.split('?')[0]} download class="text-[0.72rem] no-underline" style="color: var(--text-secondary);">↓ DL</a>
			</div>
		{:else if status === 'error'}
			<span class="text-[0.8rem]" style="color: #e74c3c;">Generation failed</span>
		{/if}
	</div>
</div>

<style>
	:global(.chunk-btn) {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.6rem;
		border-radius: 0.3rem;
		border: 1px solid;
		cursor: pointer;
		background: transparent;
		transition: filter 0.15s;
		white-space: nowrap;
	}
	:global(.chunk-btn:hover:not(:disabled)) { filter: brightness(1.25); }
	:global(.chunk-btn:disabled) { opacity: 0.4; cursor: not-allowed; }
	:global(.chunk-btn:focus-visible) {
		outline: 2px solid rgba(255, 255, 255, 0.35);
		outline-offset: 2px;
	}
	:global(textarea:focus-visible),
	:global(input:focus-visible) {
		outline: 2px solid rgba(0, 210, 211, 0.35);
		outline-offset: 2px;
	}
</style>
