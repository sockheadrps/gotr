// --- Global State ---
let currentAudio = null;
let isPlayingAll = false;
let isGeneratingAll = false;

// --- DOM Elements ---
const chapterSelect = document.getElementById('chapterSelect');
const chunksContainer = document.getElementById('chunksContainer');
const chapterTitle = document.getElementById('chapterTitle');
const statusIndicator = document.getElementById('statusIndicator');
const fill = document.getElementById('progressBarFill');
const label = document.getElementById('progressLabel');
const wrapper = document.getElementById('progressWrapper');

// Buttons
const concatBtn = document.getElementById('concatBtn');
const downloadFullBtn = document.getElementById('downloadFullBtn');
const stopBtn = document.getElementById('stopBtn');
const generateAllBtn = document.getElementById('generateAllBtn');
const regenAllBtn = document.getElementById('regenAllBtn');
const genSummaryBtn = document.getElementById('genSummaryBtn');
const genAllSummariesBtn = document.getElementById('genAllSummariesBtn');
const summaryPanel = document.getElementById('summaryPanel');
const summaryText = document.getElementById('summaryText');
const summaryAudioResult = document.getElementById('summaryAudioResult');

// --- Utilities ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. Audio Core ---

async function playChunk(text, row) {
  if (currentAudio) currentAudio.pause();
  const audioSrc =
    row.dataset.audioUrl || `/stream?text=${encodeURIComponent(text)}`;
  currentAudio = new Audio(audioSrc);
  currentAudio.play().catch((e) => console.warn('Playback interrupted:', e));
}

async function generateChunk(
  text,
  btn,
  statusDiv,
  chapterId,
  index,
  force = false
) {
  btn.disabled = true;
  statusDiv.innerHTML = '⏳ processing...';

  try {
    const params = new URLSearchParams({
      text,
      chapter_id: chapterId,
      chunk_index: index,
      force,
    });
    const res = await fetch(`/generate?${params.toString()}`, {
      method: 'POST',
    });
    const data = await res.json();

    if (data.success) {
      const cacheBusted = `${data.url}?t=${Date.now()}`;
      const row = btn.closest('.chunk-row');
      row.dataset.audioUrl = cacheBusted;

      await sleep(400); // Buffer for Windows file lock

      statusDiv.innerHTML = `
                <audio controls preload="none" src="${cacheBusted}"></audio>
                <div class="audio-meta">
                    <a href="${data.url}" download class="download-link">Download</a>
                    <button class="regen-btn-action">Regenerate</button>
                </div>
                <div class="trim-controls">
                    <input type="number" step="0.1" class="trim-input" placeholder="End (sec)">
                    <button class="trim-btn-action">✂️ Trim End</button>
                </div>
            `;
      bindInternalTools(row, statusDiv, chapterId, index, data.url);
      return true;
    }
  } catch (e) {
    statusDiv.innerHTML = '❌ Error';
  } finally {
    btn.disabled = false;
  }
  return false;
}

function bindInternalTools(row, statusDiv, chapterId, index, rawUrl) {
  const player = statusDiv.querySelector('audio');
  const regenBtn = statusDiv.querySelector('.regen-btn-action');
  const trimBtn = statusDiv.querySelector('.trim-btn-action');
  const trimInput = statusDiv.querySelector('.trim-input');
  const textDisplay = row.querySelector('.chunk-text');
  const genBtn = row.querySelector('.gen-btn');

  if (regenBtn) {
    regenBtn.onclick = () =>
      generateChunk(
        textDisplay.textContent,
        genBtn,
        statusDiv,
        chapterId,
        index,
        true
      );
  }

  if (trimBtn && player) {
    player.onloadedmetadata = () => {
      if (!trimInput.value) trimInput.value = player.duration.toFixed(2);
    };

    player.ontimeupdate = () => {
      const limit = parseFloat(trimInput.value);
      if (!isNaN(limit) && player.currentTime >= limit) {
        player.pause();
        player.currentTime = Math.max(0, limit - 0.1);
      }
    };

    trimBtn.onclick = async () => {
      const endTime = parseFloat(trimInput.value);
      if (isNaN(endTime) || endTime <= 0) return alert('Invalid time');
      try {
        const res = await fetch(`/api/trim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_path: rawUrl.split('?')[0],
            end_time: endTime,
          }),
        });
        const data = await res.json();
        if (data.success) {
          row.dataset.audioUrl = data.url;
          player.src = data.url;
          player.load();
          statusIndicator.textContent = '✅ Trimmed!';
          downloadFullBtn.style.display = 'none';
        }
      } catch (err) {
        console.error(err);
      }
    };
  }
}

// --- 2. Sequential Playback ---

async function playSequential(index) {
  const rows = document.querySelectorAll('.chunk-row');
  if (index >= rows.length || !isPlayingAll) {
    stopPlayback();
    return;
  }

  const row = rows[index];
  const text = row.querySelector('.chunk-text').textContent;
  const audioSrc =
    row.dataset.audioUrl || `/stream?text=${encodeURIComponent(text)}`;

  rows.forEach((r) => r.classList.remove('active-playing'));
  row.classList.add('active-playing');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });

  currentAudio = new Audio(audioSrc);
  currentAudio.onended = () => {
    setTimeout(() => {
      if (isPlayingAll) playSequential(index + 1);
    }, 300);
  };
  currentAudio.play();
}

function stopPlayback() {
  isPlayingAll = false;
  isGeneratingAll = false; // Stop batch generation too
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  document
    .querySelectorAll('.chunk-row')
    .forEach((r) => r.classList.remove('active-playing'));
  stopBtn.disabled = true;
}

// --- 3. UI Rendering ---

function renderChunks(chunks, existingUrls = []) {
  chunksContainer.innerHTML = '';
  const chapterId = chapterSelect.value;

  chunks.forEach((text, index) => {
    const row = document.createElement('div');
    row.className = 'chunk-row';
    const rawUrl = existingUrls[index];
    const initialUrl = rawUrl ? `${rawUrl}?t=${Date.now()}` : null;
    if (initialUrl) row.dataset.audioUrl = initialUrl;

    row.innerHTML = `
            <div class="chunk-header">
                <span class="chunk-num">#${index + 1}</span>
                <div class="content-area">
                    <p class="chunk-text">${text}</p>
                    <textarea class="edit-area" style="display:none;">${text}</textarea>
                </div>
            </div>
            <div class="chunk-actions">
                <div class="primary-actions">
                    <button class="stream-btn">Stream</button>
                    <button class="gen-btn">Generate</button>
                    <button class="edit-toggle-btn">Edit</button>
                    <button class="insert-btn" style="background: #27ae60;">+ Insert</button>
                    <button class="delete-btn" style="background: #c0392b;">Del</button>
                </div>
                <div class="audio-result">
                    ${
                      initialUrl
                        ? `
                        <audio controls preload="none" src="${initialUrl}"></audio>
                        <div class="audio-meta">
                            <a href="${rawUrl}" download class="download-link">Download</a>
                            <button class="regen-btn-action">Regenerate</button>
                        </div>
                        <div class="trim-controls">
                            <input type="number" step="0.1" class="trim-input" placeholder="End (sec)">
                            <button class="trim-btn-action">✂️ Trim End</button>
                        </div>
                    `
                        : ''
                    }
                </div>
            </div>`;

    const statusDiv = row.querySelector('.audio-result');
    const textDisplay = row.querySelector('.chunk-text');
    const editArea = row.querySelector('.edit-area');
    const genBtn = row.querySelector('.gen-btn');
    const editBtn = row.querySelector('.edit-toggle-btn');

    row.querySelector('.insert-btn').onclick = async () => {
      const res = await fetch(`/chapters/${chapterId}/insert?index=${index}`, {
        method: 'POST',
      });
      if ((await res.json()).success) {
        downloadFullBtn.style.display = 'none';
        chapterSelect.dispatchEvent(new Event('change'));
      }
    };

    row.querySelector('.delete-btn').onclick = async () => {
      if (!confirm('Delete this chunk?')) return;
      const res = await fetch(`/chapters/${chapterId}/delete?index=${index}`, {
        method: 'POST',
      });
      if ((await res.json()).success) {
        downloadFullBtn.style.display = 'none';
        chapterSelect.dispatchEvent(new Event('change'));
      }
    };

    if (initialUrl) bindInternalTools(row, statusDiv, chapterId, index, rawUrl);
    row.querySelector('.stream-btn').onclick = () =>
      playChunk(textDisplay.textContent, row);
    genBtn.onclick = () =>
      generateChunk(
        textDisplay.textContent,
        genBtn,
        statusDiv,
        chapterId,
        index,
        false
      );

    editBtn.onclick = async (e) => {
      if (editArea.style.display !== 'none') {
        const res = await fetch(`/chapters/${chapterId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: index, text: editArea.value }),
        });
        if ((await res.json()).success) {
          textDisplay.textContent = editArea.value;
          textDisplay.style.display = 'block';
          editArea.style.display = 'none';
          e.target.textContent = 'Edit';
          downloadFullBtn.style.display = 'none';
          if (row.dataset.audioUrl) statusDiv.style.opacity = '0.5';
        }
      } else {
        textDisplay.style.display = 'none';
        editArea.style.display = 'block';
        e.target.textContent = 'Save';
      }
    };
    chunksContainer.appendChild(row);
  });
}

// --- 4. Pooled Batch Generation Logic ---

async function runBatchGeneration(force = false) {
  if (isGeneratingAll) return;
  const rows = Array.from(document.querySelectorAll('.chunk-row'));
  const chapterId = chapterSelect.value;
  if (!chapterId || rows.length === 0) return;

  isGeneratingAll = true;
  stopBtn.disabled = false;
  wrapper.style.display = 'block';
  fill.style.width = '0%';
  label.textContent = 'Starting...';

  const BATCH_SIZE = 3;
  const total = rows.length;
  let completed = 0;

  // Filter out chunks that don't need work if not forcing
  const tasks = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => force || !item.row.dataset.audioUrl);

  // Update starting progress for skipped items
  completed = total - tasks.length;
  updateProgress(completed, total);

  statusIndicator.textContent = `🚀 Processing ${tasks.length} chunks in batches of ${BATCH_SIZE}...`;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    if (!isGeneratingAll) break; // Check for stop flag

    const batch = tasks.slice(i, i + BATCH_SIZE);

    // Process this small batch concurrently
    await Promise.all(
      batch.map(async (item) => {
        const text = item.row.querySelector('.chunk-text').textContent;
        const btn = item.row.querySelector('.gen-btn');
        const statusDiv = item.row.querySelector('.audio-result');

        item.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await generateChunk(text, btn, statusDiv, chapterId, item.index, force);

        completed++;
        updateProgress(completed, total);
      })
    );
  }

  statusIndicator.textContent = isGeneratingAll
    ? `✅ Batch complete.`
    : `🛑 Batch stopped.`;
  isGeneratingAll = false;
  setTimeout(() => {
    wrapper.style.display = 'none';
  }, 2000);
}

function updateProgress(completed, total) {
  const percent = Math.round((completed / total) * 100);
  fill.style.width = `${percent}%`;
  label.textContent = `${percent}%`;
}

// --- 5. Global Events ---

generateAllBtn.onclick = () => runBatchGeneration(false);

if (regenAllBtn) {
  regenAllBtn.onclick = () => {
    if (confirm('Force regenerate all audio for this chapter?'))
      runBatchGeneration(true);
  };
}

document.getElementById('addEndBtn').onclick = async () => {
  const chapterId = chapterSelect.value;
  if (!chapterId) return alert('Select a chapter');
  const res = await fetch(`/chapters/${chapterId}/insert?index=-1`, {
    method: 'POST',
  });
  if ((await res.json()).success) {
    downloadFullBtn.style.display = 'none';
    chapterSelect.dispatchEvent(new Event('change'));
  }
};

concatBtn.onclick = async () => {
  const chapterId = chapterSelect.value;
  if (!chapterId) return alert('Select a chapter.');
  const originalText = concatBtn.innerText;
  concatBtn.innerText = 'Stitching...';
  concatBtn.disabled = true;
  try {
    const response = await fetch(`/chapters/${chapterId}/concatenate`, {
      method: 'POST',
    });
    const result = await response.json();
    if (result.success) {
      statusIndicator.textContent = '✅ Full chapter file ready.';
      downloadFullBtn.style.display = 'inline-block';
      downloadFullBtn.dataset.url = result.url;
      downloadFullBtn.dataset.filename = result.filename;
    } else {
      alert('Error: ' + result.error);
    }
  } catch (err) {
    alert('Failed to concatenate.');
  } finally {
    concatBtn.innerText = originalText;
    concatBtn.disabled = false;
  }
};

downloadFullBtn.onclick = () => {
  const url = downloadFullBtn.dataset.url;
  const filename = downloadFullBtn.dataset.filename;
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

document.getElementById('playAllBtn').onclick = () => {
  isPlayingAll = true;
  stopBtn.disabled = false;
  playSequential(0);
};

stopBtn.onclick = stopPlayback;

chapterSelect.onchange = async (e) => {
  const chapterId = e.target.value;
  if (!chapterId) {
    downloadFullBtn.style.display = 'none';
    summaryPanel.style.display = 'none';
    return;
  }
  const res = await fetch(`/chapters/${chapterId}`);
  const data = await res.json();
  chapterTitle.textContent = data.title;
  if (data.full_audio_filename) {
    downloadFullBtn.style.display = 'inline-block';
    downloadFullBtn.dataset.url = `/files/${data.full_audio_filename}`;
    downloadFullBtn.dataset.filename = data.full_audio_filename;
  } else {
    downloadFullBtn.style.display = 'none';
  }
  renderChunks(data.chunks, data.audio_urls);
  renderSummaryPanel(data.summary, data.summary_audio_filename);
};

function renderSummaryPanel(summary, summaryAudioFilename) {
  if (!summary || !summary.summary) {
    summaryPanel.style.display = 'none';
    return;
  }
  summaryText.textContent = summary.summary;
  summaryPanel.style.display = 'block';
  if (summaryAudioFilename) {
    summaryAudioResult.innerHTML = `<audio controls preload="none" src="/files/${summaryAudioFilename}?t=${Date.now()}"></audio>`;
  } else {
    summaryAudioResult.innerHTML = '<span style="color:#888; font-size:0.85em;">No audio yet</span>';
  }
}

genSummaryBtn.onclick = async () => {
  const chapterId = chapterSelect.value;
  if (!chapterId) return alert('Select a chapter first.');
  const orig = genSummaryBtn.textContent;
  genSummaryBtn.disabled = true;
  genSummaryBtn.textContent = '⏳ Generating...';
  statusIndicator.textContent = '';
  try {
    const res = await fetch(`/chapters/${chapterId}/generate-summary`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      summaryAudioResult.innerHTML = `<audio controls preload="none" src="${data.url}?t=${Date.now()}"></audio>`;
      statusIndicator.textContent = '✅ Summary audio ready.';
    } else {
      statusIndicator.textContent = '❌ Failed to generate summary.';
    }
  } catch (e) {
    statusIndicator.textContent = '❌ Error generating summary.';
  } finally {
    genSummaryBtn.disabled = false;
    genSummaryBtn.textContent = orig;
  }
};

genAllSummariesBtn.onclick = async () => {
  if (!confirm('Generate summary audio for all chapters? This may take a while.')) return;
  const orig = genAllSummariesBtn.textContent;
  genAllSummariesBtn.disabled = true;
  genAllSummariesBtn.textContent = '⏳ Working...';
  statusIndicator.textContent = 'Generating all summaries...';
  try {
    const res = await fetch('/chapters/generate-all-summaries', { method: 'POST' });
    const data = await res.json();
    const done = data.results.filter((r) => r.success).length;
    const skipped = data.results.filter((r) => r.skipped).length;
    statusIndicator.textContent = `✅ Done: ${done} generated, ${skipped} skipped.`;
    // Refresh current chapter if one is selected
    if (chapterSelect.value) chapterSelect.dispatchEvent(new Event('change'));
  } catch (e) {
    statusIndicator.textContent = '❌ Error generating summaries.';
  } finally {
    genAllSummariesBtn.disabled = false;
    genAllSummariesBtn.textContent = orig;
  }
};

document.getElementById('fixSyncBtn').onclick = async () => {
  const chapterId = chapterSelect.value;
  if (!chapterId) return alert('Select a chapter.');
  if (!confirm('Remove orphan files?')) return;
  statusIndicator.textContent = '🔧 Synchronizing...';
  try {
    const res = await fetch(`/chapters/${chapterId}/fix-alignment`, {
      method: 'POST',
    });
    if ((await res.json()).success) {
      statusIndicator.textContent = `✅ Synced!`;
      chapterSelect.dispatchEvent(new Event('change'));
    }
  } catch (e) {
    statusIndicator.textContent = '❌ Sync failed.';
  }
};

async function init() {
  const res = await fetch('/chapters');
  const chapters = await res.json();
  chapters.forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    chapterSelect.appendChild(opt);
  });
}

init();
