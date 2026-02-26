<script>
  import { onDestroy } from 'svelte';

  /** @type {{ chapter: import('../types.js').ChapterEntry, onRead: () => void, slideDir?: 'left'|'right', phase?: 'enter'|'leave' }} */
  let { chapter, onRead, slideDir = 'right', phase = 'enter' } = $props();

  const apiBase = import.meta.env.DEV
    ? ''
    : import.meta.env.VITE_API_URL || 'http://localhost:8100';

  /** @param {string|null|undefined} value */
  function toApiUrl(value) {
    if (!value) return null;
    const v = String(value).trim();
    if (!v) return null;
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    if (v.startsWith('/')) return `${apiBase}${v}`;
    return `${apiBase}/files/${v}`;
  }

  const chapterData = $derived(chapter.data ?? {});
  const summary = $derived(chapter.data.summary ?? {});
  const imagePath = $derived(`/static/chapters/${chapter.id}/img.png`);
  const summaryAudioSrc = $derived.by(() => {
    const raw = /** @type {any} */ (chapterData);
    if (raw?.summary_audio_url) return toApiUrl(raw.summary_audio_url);
    if (raw?.summary_audio_filename)
      return toApiUrl(raw.summary_audio_filename);
    return null;
  });
  const summaryText = $derived(
    summary.summary ||
      (summary.summary_chunks ? summary.summary_chunks.join(' ') : '')
  );

  let imgLoaded = $state(false);

  let lastId = $state('');
  /** @type {HTMLAudioElement|null} */
  let summaryAudio = $state(null);
  let summaryAudioSrcLoaded = $state(/** @type {string|null} */ (null));
  let resolvedSummarySrc = $state(/** @type {string|null} */ (null));
  let summaryAudioUnavailable = $state(false);
  let prefetchedChapterId = $state('');
  let summaryPlaying = $state(false);
  let summaryCurrent = $state(0);
  let summaryDuration = $state(0);
  const summaryProgress = $derived.by(() => {
    if (!summaryDuration || summaryDuration <= 0) return 0;
    return Math.max(0, Math.min(1, summaryCurrent / summaryDuration));
  });
  const summaryProgressPct = $derived(Math.round(summaryProgress * 100));
  const hasSummaryAudio = $derived(
    !summaryAudioUnavailable && (!!summaryAudioSrc || !!chapter?.id)
  );

  function stopSummaryAudio() {
    if (!summaryAudio) return;
    summaryAudio.pause();
    summaryPlaying = false;
  }

  $effect(() => {
    if (chapter.id !== lastId) {
      stopSummaryAudio();
      summaryAudio = null;
      summaryAudioSrcLoaded = null;
      resolvedSummarySrc = null;
      summaryAudioUnavailable = false;
      summaryPlaying = false;
      summaryCurrent = 0;
      summaryDuration = 0;
      prefetchedChapterId = '';
      lastId = chapter.id;
      imgLoaded = false;
    }
  });

  $effect(() => {
    if (phase === 'leave') {
      stopSummaryAudio();
    }
  });

  onDestroy(() => {
    stopSummaryAudio();
  });

  $effect(() => {
    if (!chapter?.id || prefetchedChapterId === chapter.id) return;
    prefetchedChapterId = chapter.id;
    void resolveSummarySrc();
  });

  /** @param {string} src @returns {Promise<boolean>} */
  function probeAudioSource(src) {
    return new Promise((resolve) => {
      const test = new Audio();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        test.pause();
        test.removeAttribute('src');
        test.load();
        resolve(ok);
      };
      const t = setTimeout(() => finish(false), 4500);
      const onOk = () => {
        clearTimeout(t);
        finish(true);
      };
      const onErr = () => {
        clearTimeout(t);
        finish(false);
      };
      test.preload = 'metadata';
      test.addEventListener('loadedmetadata', onOk, { once: true });
      test.addEventListener('canplay', onOk, { once: true });
      test.addEventListener('error', onErr, { once: true });
      test.src = src;
      test.load();
    });
  }

  /** @returns {Promise<string|null>} */
  async function resolveSummarySrc() {
    if (resolvedSummarySrc) return resolvedSummarySrc;
    const candidates = [
      summaryAudioSrc,
      toApiUrl(`/files/${chapter.id}_summary.wav`),
      toApiUrl(`/files/${chapter.id}_summary.mp3`),
      toApiUrl(`/files/${chapter.id}/iteration-0/audio/summary.wav`),
      toApiUrl(`/files/${chapter.id}/iteration-0/audio/summary.mp3`),
    ].filter(Boolean);
    for (const c of candidates) {
      const ok = await probeAudioSource(c);
      if (ok) {
        resolvedSummarySrc = c;
        summaryAudioUnavailable = false;
        return c;
      }
    }
    summaryAudioUnavailable = true;
    return null;
  }

  /** @returns {Promise<HTMLAudioElement|null>} */
  async function ensureSummaryAudio() {
    const src = await resolveSummarySrc();
    if (!src) return null;
    if (!summaryAudio) {
      const a = new Audio(src);
      summaryAudioSrcLoaded = src;
      a.preload = 'metadata';
      a.addEventListener('timeupdate', () => {
        summaryCurrent = Number.isFinite(a.currentTime) ? a.currentTime : 0;
      });
      a.addEventListener('loadedmetadata', () => {
        summaryDuration = Number.isFinite(a.duration) ? a.duration : 0;
      });
      a.addEventListener('durationchange', () => {
        summaryDuration = Number.isFinite(a.duration) ? a.duration : 0;
      });
      a.addEventListener('play', () => {
        summaryPlaying = true;
      });
      a.addEventListener('pause', () => {
        summaryPlaying = false;
      });
      a.addEventListener('ended', () => {
        summaryPlaying = false;
      });
      summaryAudio = a;
    } else if (summaryAudioSrcLoaded !== src) {
      summaryAudio.pause();
      summaryAudio.src = src;
      summaryAudio.load();
      summaryAudioSrcLoaded = src;
      summaryCurrent = 0;
      summaryDuration = 0;
    }
    return summaryAudio;
  }

  async function toggleSummaryAudio() {
    const a = await ensureSummaryAudio();
    if (!a) {
      summaryAudioUnavailable = true;
      return;
    }
    if (summaryPlaying) {
      a.pause();
      return;
    }
    try {
      await a.play();
    } catch {
      // Autoplay/user-gesture policies can block playback; keep UI unchanged.
    }
  }

  /** @param {MouseEvent} e */
  function scrubSummary(e) {
    const a = summaryAudio;
    if (!a) return;
    const d = Number.isFinite(a.duration) ? a.duration : 0;
    if (!d || d <= 0) return;
    const el = /** @type {HTMLElement} */ (e.currentTarget);
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(d, x * d));
    a.currentTime = t;
    summaryCurrent = t;
  }
</script>

<div class="flex w-full h-full slide-{slideDir} phase-{phase}">
  <!-- One sacred surface — no card border, no box feeling -->
  <div class="relative flex w-full rounded-xl overflow-hidden slide-card">
    <!-- Image fills its side / full background on mobile -->
    <div class="slide-image relative overflow-hidden">
      {#if imagePath}
        <img
          src={imagePath}
          alt={summary.gospel_title}
          class="absolute inset-0 w-full h-full object-cover object-[center_15%] mobile-img {imgLoaded
            ? 'img-loaded'
            : 'img-loading'}"
          onload={() => {
            imgLoaded = true;
          }}
          onerror={(e) => {
            e.currentTarget.parentElement.style.display = 'none';
          }}
        />
      {/if}
      <!-- Desktop: right-fade seam into content panel -->
      <div class="desktop-fade absolute inset-0"></div>
      <!-- Mobile: blur-bridge at bottom -->
      <div class="blur-bridge absolute bottom-0 left-0 right-0"></div>
    </div>

    <!-- Info panel: atmospheric darkness, no border -->
    <div class="slide-info flex flex-col relative z-10">
      <div class="mobile-seam-under" aria-hidden="true"></div>
      <div class="mobile-audio-overlay" aria-hidden={!hasSummaryAudio}>
        <button
          class="rule-play mobile-rule-play"
          aria-label={summaryPlaying
            ? 'Pause summary audio'
            : 'Play summary audio'}
          title={summaryPlaying ? 'Pause summary audio' : 'Play summary audio'}
          onclick={toggleSummaryAudio}
          type="button"
          disabled={!hasSummaryAudio}
        >
          {#if summaryPlaying}<svg viewBox="0 0 24 24" fill="currentColor" class="play-icon"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>{:else}<svg viewBox="0 0 24 24" fill="currentColor" class="play-icon"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86z"/></svg>{/if}
        </button>
        <div
          class="rule-scrubber"
          role="slider"
          tabindex="0"
          aria-label="Summary audio progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={summaryProgressPct}
          onclick={scrubSummary}
          onkeydown={(e) => {
            const a = summaryAudio;
            if (!a) return;
            const d = Number.isFinite(a.duration) ? a.duration : 0;
            if (!d || d <= 0) return;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              a.currentTime = Math.min(d, a.currentTime + 5);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              a.currentTime = Math.max(0, a.currentTime - 5);
            }
            summaryCurrent = a.currentTime;
          }}
        >
          <div class="rule-track"></div>
          <div
            class="rule-fill"
            style="transform: translateY(-50%) scaleX({summaryProgress});"
          ></div>
          <div
            class="rule-head"
            style="left: calc({summaryProgress * 100}% - 6px);"
          ></div>
        </div>
        <div class="rule-meta" aria-live="polite">{summaryProgressPct}%</div>
      </div>
      <!-- Top meta -->
      <div class="slide-meta">
        <div class="slide-kicker">
          {summary.chapter
            ? `Chapter ${String(summary.chapter).padStart(2, '0')}`
            : (chapter.data.title ?? chapter.id)}
        </div>

        <h2 class="slide-title">
          {summary.gospel_title ?? chapter.data.title ?? chapter.id}
        </h2>

        <!-- Audio toolbar (desktop: inline after title / mobile: seam overlay) -->
        <div class="desktop-audio-toolbar" aria-hidden={!hasSummaryAudio}>
          <button
            class="rule-play"
            aria-label={summaryPlaying
              ? 'Pause summary audio'
              : 'Play summary audio'}
            title={summaryPlaying ? 'Pause summary audio' : 'Play summary audio'}
            onclick={toggleSummaryAudio}
            type="button"
            disabled={!hasSummaryAudio}
          >
            {#if summaryPlaying}<svg viewBox="0 0 24 24" fill="currentColor" class="play-icon"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>{:else}<svg viewBox="0 0 24 24" fill="currentColor" class="play-icon"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86z"/></svg>{/if}
          </button>
          <div
            class="rule-scrubber"
            role="slider"
            tabindex="0"
            aria-label="Summary audio progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={summaryProgressPct}
            onclick={scrubSummary}
            onkeydown={(e) => {
              const a = summaryAudio;
              if (!a) return;
              const d = Number.isFinite(a.duration) ? a.duration : 0;
              if (!d || d <= 0) return;
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                a.currentTime = Math.min(d, a.currentTime + 5);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                a.currentTime = Math.max(0, a.currentTime - 5);
              }
              summaryCurrent = a.currentTime;
            }}
          >
            <div class="rule-track"></div>
            <div
              class="rule-fill"
              style="transform: translateY(-50%) scaleX({summaryProgress});"
            ></div>
            <div
              class="rule-head"
              style="left: calc({summaryProgress * 100}% - 6px);"
            ></div>
          </div>
          <div class="rule-meta" aria-live="polite">{summaryProgressPct}%</div>
        </div>

        <p class="slide-summary">
          {summaryText}
        </p>
      </div>

      <!-- Bottom actions -->
      <div class="slide-actions">
        <button onclick={onRead} class="slide-read-btn">Read Chapter</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* ── Shared card surface ── */
  .slide-card {
    flex-direction: row;
    height: 100%;
    background: linear-gradient(
      to bottom,
      rgba(12, 18, 28, 0.85),
      rgba(12, 18, 28, 1)
    );
    border: none;
    box-shadow:
      inset 0 0 80px rgba(0, 0, 0, 0.5),
      0 24px 60px rgba(0, 0, 0, 0.6);
  }

  /* ── Slide animations ── */

  .phase-leave .slide-card {
    animation: cardFadeOut 2.15s ease both;
  }
  .phase-enter .slide-image img {
    animation: imageBreathIn 1.7s ease both;
    animation-delay: 0.12s;
  }
  .phase-leave .slide-image img {
    animation: imageBreathOut 1.55s ease both;
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes cardFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes imageBreathIn {
    from {
      transform: scale(1.02);
    }
    to {
      transform: scale(1);
    }
  }
  @keyframes imageBreathOut {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.01);
    }
  }

  /* ── Image panel ── */
  .slide-image {
    flex: 1.2;
    min-width: 0;
    background: rgba(12, 18, 28, 1);
  }

  .img-loading {
    filter: blur(12px) saturate(0.9);
    transform: scale(1.04);
    opacity: 0.4;
    transition:
      filter 0.6s ease,
      transform 0.6s ease,
      opacity 0.6s ease;
  }
  .img-loaded {
    filter: blur(0);
    transform: scale(1);
    opacity: 1;
  }

  /* Desktop: right-edge seam fade into content panel */
  .desktop-fade {
    background: linear-gradient(
      to right,
      transparent 70%,
      rgba(12, 18, 28, 0.95) 100%
    );
  }

  /* Blur-bridge: hidden on desktop, shown on mobile */
  .blur-bridge {
    display: none;
  }

  .mobile-audio-overlay,
  .mobile-seam-blur,
  .mobile-seam-under {
    display: none;
  }

  /* ── Info panel ── */
  .slide-info {
    width: 24rem;
    flex-shrink: 0;
    justify-content: space-between;
    padding: 2.5rem 2rem 2rem;
    background: linear-gradient(
      to bottom,
      rgba(12, 18, 28, 0.85),
      rgba(12, 18, 28, 1)
    );
    box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.37);
    animation: slideFadeUp 0.55s ease both;
    animation-delay: 0.5s;
  }

  @keyframes slideFadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Kicker label ── */
  .slide-kicker {
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--accent-teal);
    opacity: 0.5;
    margin-bottom: 1.25rem;
    animation: fadeOnly 0.5s ease both;
    animation-delay: 0.05s;
  }

  /* ── Title ── */
  .slide-title {
    font-size: 2.2rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1.12;
    color: white;
    margin: 0 0 1rem;
    animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: 0.12s;
  }

  /* ── Play icon SVG sizing ── */
  .play-icon {
    width: 50%;
    height: 50%;
  }

  /* ── Desktop audio toolbar (replaces accent rule) ── */
  .desktop-audio-toolbar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 1.25rem;
    animation: fadeOnly 0.6s ease both;
    animation-delay: 0.28s;
  }

  .desktop-audio-toolbar .rule-play {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    border: 1.5px solid rgba(0, 210, 211, 0.3);
    background:
      radial-gradient(circle at 35% 35%, rgba(0, 210, 211, 0.12), transparent 70%),
      rgba(0, 210, 211, 0.04);
    color: var(--accent-teal);
    display: grid;
    place-items: center;
    cursor: pointer;
    flex: 0 0 auto;
    transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.15s;
    box-shadow:
      0 0 12px rgba(0, 210, 211, 0.08),
      0 0 0 0.5px rgba(0, 210, 211, 0.1) inset;
  }

  .desktop-audio-toolbar .rule-play:hover {
    background:
      radial-gradient(circle at 35% 35%, rgba(0, 210, 211, 0.2), transparent 70%),
      rgba(0, 210, 211, 0.08);
    border-color: rgba(0, 210, 211, 0.6);
    box-shadow:
      0 0 20px rgba(0, 210, 211, 0.2),
      0 0 0 1px rgba(0, 210, 211, 0.15) inset;
    transform: scale(1.06);
  }

  .desktop-audio-toolbar .rule-play:active {
    transform: scale(0.96);
  }

  .desktop-audio-toolbar .rule-play:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }

  .desktop-audio-toolbar .rule-play:focus-visible {
    outline: 2px solid rgba(0, 210, 211, 0.55);
    outline-offset: 2px;
  }

  .desktop-audio-toolbar .rule-scrubber {
    position: relative;
    flex: 1;
    height: 18px;
    cursor: pointer;
  }

  .desktop-audio-toolbar .rule-track {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
  }

  .desktop-audio-toolbar .rule-fill {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    border-radius: 999px;
    transform-origin: left;
    background: var(--accent-teal);
    transition: transform 0.08s linear;
  }

  .desktop-audio-toolbar .rule-head {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translateY(-50%);
    border-radius: 999px;
    background: #c5f9ff;
    box-shadow: 0 0 0 2px rgba(0, 210, 211, 0.22);
  }

  .desktop-audio-toolbar .rule-meta {
    min-width: 3ch;
    text-align: right;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: rgba(215, 238, 255, 0.7);
  }

  /* ── Body text ── */
  .slide-summary {
    font-size: 0.9rem;
    line-height: 1.8;
    color: rgba(220, 230, 240, 0.85);
    margin: 0;
    overflow-y: auto;
    animation: surface 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: 0.36s;
  }

  /* ── Actions ── */
  .slide-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
    animation: fadeOnly 0.7s ease both;
    animation-delay: 0.48s;
  }

  .slide-read-btn {
    width: 100%;
    padding: 0.6rem 0;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    background: transparent;
    color: var(--accent-teal);
    border: 1px solid rgba(0, 210, 211, 0.4);
    transition:
      background 0.2s,
      border-color 0.2s;
  }
  .slide-read-btn:hover {
    background: rgba(0, 210, 211, 0.08);
    border-color: rgba(0, 210, 211, 0.85);
  }
  .slide-read-btn:focus-visible {
    outline: 2px solid rgba(0, 210, 211, 0.6);
    outline-offset: 2px;
  }

  /* ── Keyframes ── */
  @keyframes fadeOnly {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
      filter: blur(1px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }
  @keyframes drawRule {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
  @keyframes surface {
    from {
      opacity: 0;
      transform: translateY(10px);
      filter: blur(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slide-card,
    .slide-info,
    .slide-image img,
    .slide-kicker,
    .slide-title,
    .desktop-audio-toolbar,
    .slide-summary,
    .slide-actions {
      animation: none !important;
    }
  }

  /* ── Mobile: image fills card, blur-bridge + overlay panel ── */
  @media (max-width: 767px) {
    .slide-card {
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    .slide-image {
      position: absolute;
      inset: 0;
      height: 100%;
      width: 100%;
      flex: none;
    }

    .mobile-img {
      object-fit: cover;
      object-position: center 15%;
    }

    /* Hide desktop right-fade on mobile */
    .desktop-fade {
      display: none;
    }

    /* Hide desktop audio toolbar, show mobile seam overlay */
    .desktop-audio-toolbar {
      display: none !important;
    }

    .mobile-seam-under {
      display: block;
    }

    /* Blur-bridge: soft gradient band at seam between image and text panel */
    .blur-bridge {
      display: block;
      height: 80px;
      background: linear-gradient(
        to bottom,
        transparent,
        rgba(12, 18, 28, 0.6) 60%,
        rgba(12, 18, 28, 0.85)
      );
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 5;
    }

    /* Info panel: translucent bottom sheet */
    .slide-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      max-height: min(62%, 28rem);
      overflow-y: auto;
      padding: 2.8rem 1.25rem 1.1rem;
      background: linear-gradient(
        to bottom,
        rgba(12, 18, 28, 0.75) 0%,
        rgba(12, 18, 28, 0.92) 30%,
        rgba(12, 18, 28, 0.97) 100%
      );
      box-shadow: none;
      justify-content: flex-start;
      min-height: 0;
    }

    .mobile-audio-overlay {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      position: absolute;
      left: 0;
      right: 0.5rem;
      top: 0;
      transform: translateY(-50%);
      z-index: 14;
      pointer-events: none;
    }

    .mobile-rule-play {
      width: 3.4rem;
      height: 3.4rem;
      border-radius: 999px;
      border: 1.5px solid rgba(140, 255, 255, 0.5);
      background:
        radial-gradient(circle at 30% 30%, rgba(0, 240, 255, 0.2), rgba(0, 20, 30, 0.9)),
        rgba(4, 16, 28, 0.85);
      color: var(--accent-teal);
      display: grid;
      place-items: center;
      cursor: pointer;
      backdrop-filter: blur(10px);
      margin-left: -0.6rem;
      flex: 0 0 auto;
      pointer-events: auto;
      box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(0, 210, 211, 0.18) inset,
        0 0 28px rgba(0, 210, 211, 0.35);
    }

    .mobile-rule-play:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .mobile-rule-play .play-icon {
      width: 44%;
      height: 44%;
      filter: drop-shadow(0 0 6px rgba(0, 210, 211, 0.4));
    }

    .rule-scrubber {
      position: relative;
      flex: 1;
      height: 18px;
      cursor: pointer;
      pointer-events: auto;
      margin-right: 0;
    }

    .rule-track {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      border-radius: 999px;
      transform: translateY(-50%);
      background: rgba(0, 210, 211, 0.18);
      box-shadow: 0 0 8px rgba(0, 210, 211, 0.15);
    }

    .rule-fill {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      border-radius: 999px;
      transform-origin: left;
      background: var(--accent-teal);
      box-shadow: 0 0 14px rgba(0, 210, 211, 0.65);
      transition: transform 0.08s linear;
    }

    .rule-head {
      position: absolute;
      top: 50%;
      width: 12px;
      height: 12px;
      transform: translateY(-50%);
      border-radius: 999px;
      background: #c5f9ff;
      box-shadow:
        0 0 0 2px rgba(0, 210, 211, 0.35),
        0 0 10px rgba(0, 210, 211, 0.5);
    }

    .rule-meta {
      min-width: 3ch;
      text-align: right;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      font-weight: 700;
      color: rgba(215, 238, 255, 0.82);
      margin-right: 0.45rem;
      pointer-events: none;
    }

    .mobile-seam-under {
      position: absolute;
      left: 0;
      right: 0;
      top: -28px;
      height: 64px;
      transform: none;
      background: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(12, 18, 28, 0.3) 30%,
        rgba(12, 18, 28, 0.55) 60%,
        rgba(12, 18, 28, 0.75) 100%
      );
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      pointer-events: none;
      z-index: 13;
    }

    .slide-title {
      font-size: 1.2rem;
      letter-spacing: 0.06em;
    }

    /* Seam-first mobile layout: button hangs outside, bar runs full seam width */
    .mobile-audio-overlay .rule-meta {
      display: none;
    }
  }

  /* Desktop: one coherent motion */
  @media (min-width: 768px) {
    .phase-enter {
      animation: slideIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .phase-leave {
      animation: slideOut 0.32s ease both;
    }

    .slide-right.phase-enter {
      --dx: 22px;
    }
    .slide-left.phase-enter {
      --dx: -22px;
    }
    .slide-right.phase-leave {
      --dx: -18px;
    }
    .slide-left.phase-leave {
      --dx: 18px;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(var(--dx)) scale(0.995);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(var(--dx)) scale(0.995);
      }
    }

    /* Kill the "page load" feel inside the card on desktop */
    .phase-enter .slide-card,
    .phase-leave .slide-card,
    .phase-enter .slide-image img,
    .phase-leave .slide-image img,
    .slide-info,
    .slide-kicker,
    .slide-title,
    .desktop-audio-toolbar,
    .slide-summary,
    .slide-actions {
      animation: none !important;
    }
  }
</style>
