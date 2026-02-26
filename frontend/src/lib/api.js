/** @returns {Promise<string[]>} */
export async function fetchChapters() {
	// Use relative URLs in dev to leverage Vite proxy, full URLs in production
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters`);
	return res.json();
}

/** @returns {Promise<import('./types.js').Chapter>} */
export async function fetchChapter(id) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');

	const res = await fetch(`${baseUrl}/chapters/${id}`);
	return res.json();
}

export async function generateChunk({ text, chapter_id, chunk_index, force = false }) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const params = new URLSearchParams({ text, chapter_id, chunk_index, force });
	const res = await fetch(`${baseUrl}/generate?${params}`, { method: 'POST' });
	return res.json();
}

export async function trimAudio(file_path, end_time) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/api/trim`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ file_path, end_time }),
	});
	return res.json();
}

export async function padAudio(file_path, pad_seconds) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/api/pad`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ file_path, pad_seconds }),
	});
	return res.json();
}

export async function concatenateChapter(chapter_id) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/concatenate`, { method: 'POST' });
	return res.json();
}

export async function generateSummary(chapter_id) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/generate-summary`, { method: 'POST' });
	return res.json();
}

export async function generateAllSummaries() {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/generate-all-summaries`, { method: 'POST' });
	return res.json();
}

export async function updateChunk(chapter_id, index, text) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/update`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ index, text }),
	});
	return res.json();
}

export async function insertChunk(chapter_id, index) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/insert?index=${index}`, { method: 'POST' });
	return res.json();
}

export async function deleteChunk(chapter_id, index) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/delete?index=${index}`, { method: 'POST' });
	return res.json();
}

export async function fixAlignment(chapter_id) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/fix-alignment`, { method: 'POST' });
	return res.json();
}

// --- Iteration API ---

/** @returns {Promise<{ iterations: number[], active_iteration: number|null }>} */
export async function fetchIterations(chapter_id) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations`);
	return res.json();
}

export async function fetchIteration(chapter_id, iteration) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}`);
	return res.json();
}

export async function setActiveIteration(chapter_id, iteration) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/set-active`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ iteration }),
	});
	return res.json();
}

export async function generateIterationChunk({ chapter_id, iteration, chunk_type, chunk_index, text, force = false }) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const params = new URLSearchParams({ text, chapter_id, chunk_index, force, iteration, chunk_type });
	const res = await fetch(`${baseUrl}/generate?${params}`, { method: 'POST' });
	return res.json();
}

export async function concatenateIteration(chapter_id, iteration) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/concatenate`, { method: 'POST' });
	return res.json();
}

export async function generateIterationSummary(chapter_id, iteration) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/generate-summary`, { method: 'POST' });
	return res.json();
}

export async function insertIterationChunk(chapter_id, iteration, chunk_type, index) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/insert`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index }),
	});
	return res.json();
}

export async function deleteIterationChunk(chapter_id, iteration, chunk_type, index) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/delete`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index }),
	});
	return res.json();
}

export async function updateIterationChunk(chapter_id, iteration, chunk_type, index, text) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/update`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chunk_type, index, text }),
	});
	return res.json();
}

export async function updateIterationSummary(chapter_id, iteration, summary) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/summary`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ summary }),
	});
	return res.json();
}

export async function fixIterationAlignment(chapter_id, iteration) {
	const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8100');
	const res = await fetch(`${baseUrl}/chapters/${chapter_id}/iterations/${iteration}/fix-alignment`, { method: 'POST' });
	return res.json();
}