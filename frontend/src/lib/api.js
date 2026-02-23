/** @returns {Promise<string[]>} */
export async function fetchChapters() {
	const res = await fetch('/chapters');
	return res.json();
}

/** @returns {Promise<import('./types.js').Chapter>} */
export async function fetchChapter(id) {
	const res = await fetch(`/chapters/${id}`);
	return res.json();
}

export async function generateChunk({ text, chapter_id, chunk_index, force = false }) {
	const params = new URLSearchParams({ text, chapter_id, chunk_index, force });
	const res = await fetch(`/generate?${params}`, { method: 'POST' });
	return res.json();
}

export async function trimAudio(file_path, end_time) {
	const res = await fetch('/api/trim', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ file_path, end_time }),
	});
	return res.json();
}

export async function padAudio(file_path, pad_seconds) {
	const res = await fetch('/api/pad', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ file_path, pad_seconds }),
	});
	return res.json();
}

export async function concatenateChapter(chapter_id) {
	const res = await fetch(`/chapters/${chapter_id}/concatenate`, { method: 'POST' });
	return res.json();
}

export async function generateSummary(chapter_id) {
	const res = await fetch(`/chapters/${chapter_id}/generate-summary`, { method: 'POST' });
	return res.json();
}

export async function generateAllSummaries() {
	const res = await fetch('/chapters/generate-all-summaries', { method: 'POST' });
	return res.json();
}

export async function updateChunk(chapter_id, index, text) {
	const res = await fetch(`/chapters/${chapter_id}/update`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ index, text }),
	});
	return res.json();
}

export async function insertChunk(chapter_id, index) {
	const res = await fetch(`/chapters/${chapter_id}/insert?index=${index}`, { method: 'POST' });
	return res.json();
}

export async function deleteChunk(chapter_id, index) {
	const res = await fetch(`/chapters/${chapter_id}/delete?index=${index}`, { method: 'POST' });
	return res.json();
}

export async function fixAlignment(chapter_id) {
	const res = await fetch(`/chapters/${chapter_id}/fix-alignment`, { method: 'POST' });
	return res.json();
}

// --- Iteration API ---

/** @returns {Promise<{ iterations: number[], active_iteration: number|null }>} */
export async function fetchIterations(chapter_id) {
	const res = await fetch(`/chapters/${chapter_id}/iterations`);
	return res.json();
}

export async function fetchIteration(chapter_id, iteration) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}`);
	return res.json();
}

export async function setActiveIteration(chapter_id, iteration) {
	const res = await fetch(`/chapters/${chapter_id}/set-active`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ iteration }),
	});
	return res.json();
}

export async function generateIterationChunk({ chapter_id, iteration, chunk_type, chunk_index, text, force = false }) {
	const params = new URLSearchParams({ text, chapter_id, chunk_index, force, iteration, chunk_type });
	const res = await fetch(`/generate?${params}`, { method: 'POST' });
	return res.json();
}

export async function concatenateIteration(chapter_id, iteration) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/concatenate`, { method: 'POST' });
	return res.json();
}

export async function generateIterationSummary(chapter_id, iteration) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/generate-summary`, { method: 'POST' });
	return res.json();
}

export async function insertIterationChunk(chapter_id, iteration, chunk_type, index) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/insert`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index }),
	});
	return res.json();
}

export async function deleteIterationChunk(chapter_id, iteration, chunk_type, index) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/delete`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index }),
	});
	return res.json();
}

export async function updateIterationChunk(chapter_id, iteration, chunk_type, index, text) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/update`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index, text }),
	});
	return res.json();
}

export async function fixIterationAlignment(chapter_id, iteration) {
	const res = await fetch(`/chapters/${chapter_id}/iterations/${iteration}/fix-alignment`, { method: 'POST' });
	return res.json();
}
