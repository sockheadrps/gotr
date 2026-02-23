const reviewSelect = document.getElementById('reviewSelect');
const contentArea = document.getElementById('contentArea');

// Initial Load of Chapters
async function init() {
  const res = await fetch('/chapters');
  const chapters = await res.json();
  chapters.forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    reviewSelect.appendChild(opt);
  });
}

reviewSelect.onchange = async (e) => {
  const chapterId = e.target.value;
  if (!chapterId) return (contentArea.style.display = 'none');

  const res = await fetch(`/api/chapters/${chapterId}/review`);
  const data = await res.json();

  document.getElementById('pageTitle').textContent = data.title;

  // --- Render Summary ---
  const summaryBox = document.getElementById('summaryBox');
  let summaryHtml = '<h3>Chapter Overview</h3>';

  Object.entries(data.summary).forEach(([k, v]) => {
    const label = k.replace(/_/g, ' ').toUpperCase();

    // Handle the specific Blurb object (Hook, Conflict, Stakes)
    if (k.toLowerCase() === 'blurb' && typeof v === 'object' && v !== null) {
      summaryHtml += `
          <div class="blurb-section">
              <p><strong>${label} - HOOK:</strong> ${v.hook || 'N/A'}</p>
              <p><strong>${label} - CONFLICT:</strong> ${v.conflict || 'N/A'}</p>
              <p><strong>${label} - STAKES:</strong> ${v.stakes || 'N/A'}</p>
          </div>`;
    } else if (Array.isArray(v)) {
      summaryHtml += `<p><strong>${label}:</strong> ${v.join(', ')}</p>`;
    } else {
      summaryHtml += `<p><strong>${label}:</strong> ${v}</p>`;
    }
  });

  summaryBox.innerHTML = summaryHtml;

  // --- Render Audio ---
  const player = document.getElementById('fullPlayer');
  const warning = document.getElementById('audioWarning');
  if (data.audio_url) {
    player.src = data.audio_url;
    player.style.display = 'block';
    warning.style.display = 'none';
  } else {
    player.style.display = 'none';
    warning.style.display = 'block';
  }

  // --- Render Markdown ---
  document.getElementById('manuscript').innerHTML = marked.parse(data.markdown);

  contentArea.style.display = 'block';
};

init();