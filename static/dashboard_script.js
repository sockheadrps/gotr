// --- Global State & DOM Elements ---
const cardsContainer = document.getElementById('chapterCardsContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const chapterDetail = document.getElementById('chapterDetail');

// Audio Elements
const player = document.getElementById('fullPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const seekSlider = document.getElementById('seekSlider');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

let currentData = null;
let currentChunkIndex = 0; // Tracks which segment is active
let currentCarouselIndex = 0;
let allChapters = [];

/**
 * Initial Load: Fetches the list of chapters and populates the navigation rail and carousel.
 */
async function loadDashboard() {
  const res = await fetch('/chapters');
  const chapterIds = await res.json();

  // Load chapter data for all chapters
  for (const id of chapterIds) {
    const detailRes = await fetch(`/chapters/${id}`);
    const data = await detailRes.json();
    const index = allChapters.length;
    allChapters.push({ id, data });
    createCard(id, data, index);
  }

  // Initialize carousel
  initializeCarousel();
}

/**
 * Creates a navigation card and initializes the full chapter view logic.
 */
function createCard(id, data, index) {
  const card = document.createElement('div');
  card.className = 'chapter-card';

  card.innerHTML = `
        <div class="card-id">Chapter ${data.summary.chapter || id}</div>
        <div class="card-title">${data.summary.gospel_title}</div>
        <div class="card-hook">${data.summary.subtitle}</div>
    `;

  card._chapterIndex = index;

  card.onclick = () => goToCarouselSlide(card._chapterIndex);

  cardsContainer.appendChild(card);
}

/**
 * Initializes the carousel with all chapters
 */
function initializeCarousel() {
  const carouselTrack = document.getElementById('carouselTrack');
  const carouselIndicators = document.getElementById('carouselIndicators');

  if (!carouselTrack || !carouselIndicators) return;

  carouselTrack.innerHTML = '';
  carouselIndicators.innerHTML = '';

  // Create carousel items
  allChapters.forEach((chapter, index) => {
    const item = document.createElement('div');
    item.className = 'carousel-item' + (index === 0 ? ' active' : '');
    item.dataset.index = index;

    const summary = chapter.data.summary;
    const summaryAudio = chapter.data.summary_audio_filename;
    const chapterNum = String(summary.chapter || index + 1).padStart(2, '0');
    const imagePath = `/static/chapters/chapter-${chapterNum}-${summary.gospel_title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/img.png`;

    const audioPlayerHTML = summaryAudio ? `
      <div class="carousel-audio-player">
        <span class="carousel-audio-label">Summary</span>
        <div class="carousel-audio-controls">
          <button class="carousel-play-btn" data-src="/files/${summaryAudio}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="carousel-audio-bar">
            <div class="carousel-audio-progress"></div>
          </div>
          <span class="carousel-audio-time">0:00</span>
        </div>
      </div>` : '';

    item.innerHTML = `
      <div class="carousel-content">
        <div class="carousel-image">
          <img src="${imagePath}" alt="${summary.gospel_title}" style="display: block;" onerror="this.parentElement.style.display='none'">
        </div>
        <div class="carousel-info">
          <h2>${summary.gospel_title}</h2>
          <p class="carousel-summary">${summary.summary}</p>
          <div class="carousel-bottom-row">
            <div class="carousel-read-row">
              <button class="carousel-read-btn">Read Chapter</button>
            </div>
            ${audioPlayerHTML}
          </div>
        </div>
      </div>
    `;

    item.querySelector('.carousel-read-btn').addEventListener('click', () => {
      selectChapterFromCarousel(index);
    });

    const playBtn = item.querySelector('.carousel-play-btn');
    if (playBtn) {
      const progressBar = item.querySelector('.carousel-audio-progress');
      const timeEl = item.querySelector('.carousel-audio-time');
      let audio = null;

      playBtn.addEventListener('click', () => {
        // Pause any other playing carousel audio
        document.querySelectorAll('.carousel-play-btn.playing').forEach(btn => {
          if (btn !== playBtn) btn.click();
        });

        if (!audio) audio = new Audio(playBtn.dataset.src);

        if (playBtn.classList.contains('playing')) {
          audio.pause();
          playBtn.classList.remove('playing');
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        } else {
          audio.play();
          playBtn.classList.add('playing');
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        }

        audio.ontimeupdate = () => {
          if (!audio.duration) return;
          const pct = (audio.currentTime / audio.duration) * 100;
          progressBar.style.width = pct + '%';
          const m = Math.floor(audio.currentTime / 60);
          const s = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
          timeEl.textContent = `${m}:${s}`;
        };

        audio.onended = () => {
          playBtn.classList.remove('playing');
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
          progressBar.style.width = '0%';
          timeEl.textContent = '0:00';
        };
      });

      item.querySelector('.carousel-audio-bar').addEventListener('click', (e) => {
        if (!audio) return;
        const rect = e.currentTarget.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
      });
    }

    carouselTrack.appendChild(item);

    // Create indicator dot
    const dot = document.createElement('div');
    dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
    dot.onclick = () => goToCarouselSlide(index);
    carouselIndicators.appendChild(dot);
  });

  // Set up carousel navigation
  document.getElementById('prevBtn').onclick = () => prevCarouselSlide();
  document.getElementById('nextBtn').onclick = () => nextCarouselSlide();

  highlightSidebarCard(0);
}

function goToCarouselSlide(index) {
  currentCarouselIndex = index;
  const items = document.querySelectorAll('.carousel-item');
  const dots = document.querySelectorAll('.carousel-dot');

  items.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  highlightSidebarCard(index);
}

function highlightSidebarCard(index) {
  const cards = document.querySelectorAll('.chapter-card');
  cards.forEach((card, i) => {
    card.classList.toggle('carousel-focused', i === index);
  });
  const target = cards[index];
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextCarouselSlide() {
  const totalSlides = allChapters.length;
  goToCarouselSlide((currentCarouselIndex + 1) % totalSlides);
}

function prevCarouselSlide() {
  const totalSlides = allChapters.length;
  goToCarouselSlide((currentCarouselIndex - 1 + totalSlides) % totalSlides);
}

async function selectChapterFromCarousel(index) {
  const { id, data } = allChapters[index];

  // Mark active in sidebar
  document.querySelectorAll('.chapter-card').forEach((c) => c.classList.remove('active', 'carousel-focused'));
  const cards = document.querySelectorAll('.chapter-card');
  if (cards[index]) {
    cards[index].classList.add('active');
    cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Fetch full chapter details
  const res = await fetch(`/chapters/${id}`);
  const fullChapter = await res.json();

  currentData = data;
  currentData.chunks = fullChapter.chunks;
  currentData.audio_urls = fullChapter.audio_urls;
  currentChunkIndex = 0;

  welcomeScreen.style.display = 'none';
  chapterDetail.style.display = 'block';

  const footer = document.getElementById('globalPlayer');
  if (footer) footer.style.display = 'block';

  const msSection = document.getElementById('manuscriptSection');
  if (msSection) msSection.classList.add('locked');

  const elements = {
    originalTopic: data.summary.original_topic,
    gospelTitle: data.summary.gospel_title,
    gospelSubtitle: data.summary.subtitle,
    narrativeSummary: data.summary.summary,
    ideologyModalBody: data.summary.ideology_summary,
    playerTitle: data.summary.gospel_title,
  };

  for (const [elementId, value] of Object.entries(elements)) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
  }

  const downloadLink = document.getElementById('downloadLink');
  if (downloadLink && fullChapter.full_audio_filename) {
    downloadLink.href = `/files/${fullChapter.full_audio_filename}`;
  }

  renderManuscript(fullChapter.chunks, fullChapter.audio_urls);
  loadSequentialChunk(0, fullChapter.audio_urls);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Renders paragraphs and links them to audio chunks.
 */
function renderManuscript(chunks, audioUrls) {
  const container = document.getElementById('manuscript');
  container.innerHTML = '';

  chunks.forEach((text, index) => {
    const p = document.createElement('p');
    p.className = 'manuscript-chunk';
    p.id = `chunk-para-${index}`;
    p.textContent = text.replace(/\[.*?\]/g, '').trim();

    p.onclick = () => {
      unlockManuscript();
      playSequentialChunk(index, audioUrls);
    };

    container.appendChild(p);
  });
}

/**
 * Sequential Audio Logic
 */
function loadSequentialChunk(index, audioUrls) {
  if (!audioUrls || !audioUrls[index]) return;
  currentChunkIndex = index;
  player.src = audioUrls[index];
  player.load();
  document.getElementById('playerStatus').textContent =
    `Ready: Chunk ${index + 1}`;
}

function playSequentialChunk(index, audioUrls) {
  if (!audioUrls || !audioUrls[index]) return;
  currentChunkIndex = index;

  // Visual Highlighting
  document
    .querySelectorAll('.manuscript-chunk')
    .forEach((el) => el.classList.remove('reading-now'));
  const currentPara = document.getElementById(`chunk-para-${index}`);
  if (currentPara) {
    currentPara.classList.add('reading-now');
    currentPara.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  player.src = audioUrls[index];
  document.getElementById('playerStatus').textContent =
    `Reading Chunk ${index + 1}...`;
  player.play();

  // The Chain: Trigger next when finished
  player.onended = () => {
    if (currentChunkIndex + 1 < audioUrls.length) {
      playSequentialChunk(currentChunkIndex + 1, audioUrls);
    } else {
      document.getElementById('playerStatus').textContent = 'Chapter Finished';
      document
        .querySelectorAll('.manuscript-chunk')
        .forEach((el) => el.classList.remove('reading-now'));
    }
  };
}

/**
 * Custom Audio Player Controls
 */
playPauseBtn.onclick = () => {
  if (player.paused) {
    unlockManuscript();
    // Use the sequential logic to ensure it chains after clicking Play
    if (currentData && currentData.audio_urls) {
      playSequentialChunk(currentChunkIndex, currentData.audio_urls);
    } else {
      player.play();
    }
  } else {
    player.pause();
  }
};

player.onplay = () => {
  document.getElementById('playIcon').style.display = 'none';
  document.getElementById('pauseIcon').style.display = 'block';
};

player.onpause = () => {
  document.getElementById('playIcon').style.display = 'block';
  document.getElementById('pauseIcon').style.display = 'none';
};

player.ontimeupdate = () => {
  if (!isNaN(player.duration)) {
    seekSlider.max = Math.floor(player.duration);
    seekSlider.value = Math.floor(player.currentTime);
    currentTimeEl.textContent = formatTime(player.currentTime);
    durationTimeEl.textContent = formatTime(player.duration);
  }
};

seekSlider.oninput = () => {
  player.currentTime = seekSlider.value;
};

/**
 * UI Utilities
 */
function formatTime(secs) {
  const mins = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
}

function unlockManuscript() {
  document.getElementById('manuscriptSection').classList.remove('locked');
}

function openIdeologyModal() {
  const modal = document.getElementById('ideologyModal');
  const body = document.getElementById('ideologyModalBody');
  if (currentData) {
    body.textContent = currentData.summary.ideology_summary;
    modal.style.display = 'flex';
  }
}

function closeIdeologyModal() {
  document.getElementById('ideologyModal').style.display = 'none';
}

// Nav title click → back to carousel
document.getElementById('navTitle').onclick = () => {
  chapterDetail.style.display = 'none';
  welcomeScreen.style.display = 'block';
  const footer = document.getElementById('globalPlayer');
  if (footer) footer.style.display = 'none';
  document.querySelectorAll('.chapter-card').forEach((c) => c.classList.remove('active'));
};

// Initialize Dashboard
loadDashboard();
