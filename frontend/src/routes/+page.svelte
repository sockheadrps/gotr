<script>
  import { getContext } from 'svelte';
  import Carousel from '$lib/components/Carousel.svelte';
  import ChapterDetail from '$lib/components/ChapterDetail.svelte';
  import { fetchChapter } from '$lib/api.js';
  import { openChapter, playChunk, pause, stop, player } from '$lib/audioState.svelte.js';

  const layout = getContext('layout');

  /** @type {import('$lib/types.js').Chapter|null} */
  let currentChapter = $state(null);

  // Animation state
  let showCommandments = $state(false);
  let carouselVisible = $state(true); // opacity driver for carousel
  let cmdVisible = $state(false); // opacity driver for commandments

  // Register callbacks so layout can trigger view changes
  layout.registerCallbacks(
    // onCarouselJump: sidebar card clicked
    async (index) => {
      stop();
      layout.carouselIndex = index;
      if (showCommandments) {
        await closeCommandments();
        currentChapter = null;
      }
    },
    // onBackToCarousel: nav title clicked
    async () => {
      stop();
      await closeCommandments();
      layout.activeIndex = null;
      currentChapter = null;
    },
    // onCommandments: commandments button clicked
    async () => {
      const entry = layout.commandmentsEntry;
      if (!entry) return;
      const full = await fetchChapter(entry.id);
      currentChapter = { ...entry.data, ...full };
      openChapter(entry.id, currentChapter);

      // Sequence: fade carousel out → mount commandments → fade in
      carouselVisible = false;
      await new Promise((r) => setTimeout(r, 400));
      showCommandments = true;
      layout.activeIndex = -1; // switch template branch AFTER carousel fades out
      await new Promise((r) => setTimeout(r, 30)); // allow mount
      cmdVisible = true;
    }
  );

  /** @returns {Promise<void>} resolves after fade-out completes */
  function closeCommandments() {
    if (!showCommandments) return Promise.resolve();
    cmdVisible = false;
    return new Promise((r) =>
      setTimeout(() => {
        showCommandments = false;
        carouselVisible = true;
        r();
      }, 400)
    );
  }

  /** @param {number} index */
  async function handleReadChapter(index) {
    stop();
    const { id, data } = layout.allChapters[index];
    const full = await fetchChapter(id);
    currentChapter = { ...data, ...full };
    openChapter(id, currentChapter);
    layout.activeIndex = index;
    layout.carouselIndex = index;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const showCarousel = $derived(
    layout.activeIndex === null && !showCommandments
  );

  /**
   * Reconstruct commandment objects from story_chunks (groups of 3: title, text, attribution)
   * or fall back to the raw commandments array if present.
   */
  function buildCommandmentItems(chapter) {
    if (!chapter) return [];
    const raw = /** @type {any} */ (chapter);
    if (Array.isArray(raw.commandments)) {
      return raw.commandments.map((c, i) => ({
        number: c.number ?? i + 1,
        title: c.title ?? '',
        text: c.text ?? '',
        source: c.source_chapter ?? '',
      }));
    }
    const chunks = raw.story_chunks ?? [];
    const items = [];
    for (let i = 0; i < chunks.length; i += 3) {
      const titleLine = chunks[i] ?? '';
      const colonIdx = titleLine.indexOf(':');
      const title = colonIdx >= 0 ? titleLine.slice(colonIdx + 2) : titleLine;
      items.push({
        number: Math.floor(i / 3) + 1,
        title,
        text: chunks[i + 1] ?? '',
        source: chunks[i + 2] ?? '',
      });
    }
    return items;
  }

  const commandmentItems = $derived(buildCommandmentItems(currentChapter));

  // Commandments audio progress (chunk-based)
  const cmdIsPlaying = $derived(
    player.chapterId === 'commandments' && player.isPlaying
  );
  const cmdTotalChunks = $derived(player.audioUrls.length || 1);
  const cmdChunkProgress = $derived.by(() => {
    const d = player.duration;
    if (!d || d <= 0) return 0;
    return Math.min(1, player.currentTime / d);
  });
  const cmdOverallProgress = $derived(
    (player.chunkIndex + cmdChunkProgress) / cmdTotalChunks
  );
  const cmdProgressPct = $derived(Math.round(cmdOverallProgress * 100));

  function toggleCmdPlay() {
    if (cmdIsPlaying) {
      pause();
    } else {
      playChunk(player.chunkIndex ?? 0, player.audioUrls);
    }
  }

  /** @param {MouseEvent} e */
  function scrubCmd(e) {
    const total = cmdTotalChunks;
    if (!total || total <= 0) return;
    const el = /** @type {HTMLElement} */ (e.currentTarget);
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const ratio = Math.max(0, Math.min(1, x));
    const scaled = ratio * total;
    const index = Math.max(0, Math.min(total - 1, Math.floor(scaled)));
    const frac = Math.max(0, Math.min(0.999, scaled - index));
    const wasPlaying = !!player.isPlaying;
    playChunk(index, player.audioUrls);
    const a = player.audio;
    if (!a) return;
    const applySeek = () => {
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      if (!d || d <= 0) return;
      a.currentTime = frac * d;
      player.currentTime = a.currentTime;
      if (!wasPlaying) pause();
    };
    if (a.readyState >= 1) applySeek();
    else a.addEventListener('loadedmetadata', applySeek, { once: true });
  }

  // Which commandment is focused (clicked or playing)
  let focusedCmd = $state(0);

  // Sync focused commandment to audio player position
  $effect(() => {
    if (
      showCommandments &&
      player.chapterId === 'commandments' &&
      player.isPlaying
    ) {
      focusedCmd = Math.floor(player.chunkIndex / 3);
    }
  });
</script>

{#if showCarousel}
  <div
    style="opacity: {carouselVisible
      ? 1
      : 0}; transition: opacity 0.4s ease; height: 100%; overflow: hidden; display: flex; flex-direction: column;"
  >
    {#if layout.allChapters.length > 0}
      <Carousel
        allChapters={layout.allChapters}
        currentIndex={layout.carouselIndex}
        onReadChapter={handleReadChapter}
        onSlideChange={(i) => {
          layout.carouselIndex = i;
        }}
      />
    {:else}
      <div
        class="flex items-center justify-center h-full"
        style="color: var(--text-secondary);"
      >
        Loading chapters...
      </div>
    {/if}
  </div>
{:else if showCommandments && currentChapter}
  <div
    class="cmd-layout h-full overflow-hidden"
    style="background: var(--bg-main);"
  >
    <!-- LEFT COLUMN -->
    <div
      class="cmd-left flex flex-col overflow-y-auto"
      style="border-right: 1px solid rgba(255,255,255,0.06);"
    >
      <div
        class="px-7 pt-8 pb-5 shrink-0"
        style="border-bottom: 1px solid rgba(255,255,255,0.06);"
      >
        <div
          class="text-[0.5rem] font-bold tracking-[0.3em] uppercase mb-1.5"
          style="color: var(--accent-teal); opacity: 0.55;"
        >
          The Gospel of the Real
        </div>

        <h1
          class="text-xl font-black leading-tight m-0"
          style="color: white; letter-spacing: -0.02em;"
        >
          The 10 Commandments
          <em
            class="not-italic"
            style="color: var(--accent-purple); opacity: 0.85;"
          >
            of Real
          </em>
        </h1>
      </div>

      <div class="flex flex-col pt-3">
        {#key cmdVisible}
          {#each commandmentItems as cmd, i}
            <button
              class="cmd-list-item {focusedCmd === i ? 'cmd-list-item--active' : ''}"
              style="animation-delay: {cmdVisible ? i * 0.055 : 0}s;"
              onclick={() => (focusedCmd = i)}
            >
              <span class="cmd-list-num">{String(cmd.number).padStart(2, '0')}</span>
              <span class="cmd-list-title">{cmd.title}</span>
            </button>
          {/each}
        {/key}
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div class="cmd-right h-full overflow-y-auto relative">
      {#key focusedCmd}
        {#if commandmentItems[focusedCmd]}
          <div class="cmd-right-inner" style="max-width: 660px; padding-top: 16vh; padding-bottom: 14rem;">

            <!-- Number: pure opacity fade, no movement — arrives first -->
            <div class="cmd-num">
              Commandment {String(commandmentItems[focusedCmd].number).padStart(2, '0')}
            </div>

            <!-- Title: rises with weight from deeper below -->
            <h2 class="cmd-title-main">
              {commandmentItems[focusedCmd].title}
            </h2>

            <!-- Audio toolbar -->
            <div class="cmd-audio-toolbar">
              <button
                class="cmd-play-btn"
                onclick={toggleCmdPlay}
                aria-label={cmdIsPlaying ? 'Pause' : 'Play'}
                title={cmdIsPlaying ? 'Pause' : 'Play'}
              >
                {#if cmdIsPlaying}
                  <svg viewBox="0 0 24 24" fill="currentColor" class="cmd-play-icon"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="currentColor" class="cmd-play-icon"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86z"/></svg>
                {/if}
              </button>
              <div
                class="cmd-scrubber"
                role="slider"
                tabindex="0"
                aria-label="Audio progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={cmdProgressPct}
                onclick={scrubCmd}
              >
                <div class="cmd-scrub-track"></div>
                <div class="cmd-scrub-fill" style="transform: translateY(-50%) scaleX({cmdOverallProgress});"></div>
                <div class="cmd-scrub-head" style="left: calc({cmdOverallProgress * 100}% - 6px);"></div>
              </div>
              <div class="cmd-scrub-meta" aria-live="polite">{cmdProgressPct}%</div>
            </div>

            <!-- Body: surfaces with blur — arrives last among visible content -->
            <div class="cmd-body-text">
              {commandmentItems[focusedCmd].text}
            </div>

            <!-- Source: whispers in last of all, offset right -->
            <div class="cmd-source-text">
              — {commandmentItems[focusedCmd].source}
            </div>

          </div>
        {/if}
      {/key}
    </div>
  </div>
{:else if currentChapter}
  <ChapterDetail chapter={currentChapter} />
{/if}

<style>
  /* ── Commandments two-column layout ── */
  .cmd-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
  }

  .cmd-left {
    height: 100%;
  }

  .cmd-right {
    padding: 0 5.5rem 0 4.5rem;
  }

  @media (max-width: 767px) {
    .cmd-layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
      overflow-y: auto;
    }

    .cmd-left {
      height: auto;
      overflow-y: visible;
      border-right: none !important;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .cmd-right {
      padding: 2rem 1.5rem 10rem;
      height: auto;
      overflow-y: visible;
    }
  }

  /* ── Left column list items ── */
  .cmd-list-item {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    padding: 0.85rem 1.75rem;
    text-align: left;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition: background 0.2s ease, color 0.2s ease;
    animation: cmdListIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .cmd-list-item:focus-visible {
    outline: 2px solid rgba(162, 155, 254, 0.5);
    outline-offset: -2px;
    background: rgba(162, 155, 254, 0.08);
  }

  .cmd-list-item::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 1.75rem;
    right: 1.75rem;
    height: 1px;
    background: var(--accent-purple);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0s;
  }

  .cmd-list-item--active::after {
    transform: scaleX(1);
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .cmd-list-num {
    font-size: 0.5rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    font-variant-numeric: tabular-nums;
    min-width: 1.3rem;
    flex-shrink: 0;
    transition: color 0.2s;
    color: rgba(255, 255, 255, 0.2);
  }

  .cmd-list-item--active .cmd-list-num {
    color: var(--accent-purple);
  }

  .cmd-list-title {
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.3;
    transition: color 0.2s, font-weight 0.1s;
    color: rgba(255, 255, 255, 0.38);
  }

  .cmd-list-item--active .cmd-list-title {
    color: var(--accent-teal);
    font-weight: 700;
  }

  .cmd-list-item:not(.cmd-list-item--active):hover .cmd-list-title {
    color: rgba(255, 255, 255, 0.75);
  }

  .cmd-list-item:not(.cmd-list-item--active):hover {
    background: linear-gradient(
      to right,
      rgba(162, 155, 254, 0.08),
      rgba(0, 0, 0, 0)
    );
  }

  @keyframes cmdListIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* ── Commandment number: pure opacity, no movement ── */
  .cmd-num {
    font-size: 0.6rem;
    letter-spacing: 0.45em;
    text-transform: uppercase;
    color: var(--accent-purple);
    opacity: 0;
    margin-bottom: 2rem;
    animation: cmdFadeOnly 0.6s ease forwards;
    animation-delay: 0.05s;
  }

  /* ── Title: rises from deeper below with shadow depth ── */
  .cmd-title-main {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: clamp(3.05rem, 4.9vw, 4.4rem);
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.022em;
    color: white;
    margin: 0 0 3.1rem 0;
    opacity: 0;
    text-shadow:
      0 8px 60px rgba(0, 0, 0, 0.9),
      0 2px 24px rgba(162, 155, 254, 0.18);
    animation: cmdRise 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.18s;
  }

  /* ── Audio toolbar: teal scrubber ── */
  .cmd-audio-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 3.5rem;
    opacity: 0;
    animation: cmdFadeOnly 0.7s ease forwards;
    animation-delay: 0.5s;
  }

  .cmd-play-btn {
    width: 2.4rem;
    height: 2.4rem;
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

  .cmd-play-btn:hover {
    background:
      radial-gradient(circle at 35% 35%, rgba(0, 210, 211, 0.2), transparent 70%),
      rgba(0, 210, 211, 0.08);
    border-color: rgba(0, 210, 211, 0.6);
    box-shadow:
      0 0 20px rgba(0, 210, 211, 0.2),
      0 0 0 1px rgba(0, 210, 211, 0.15) inset;
    transform: scale(1.06);
  }

  .cmd-play-btn:active {
    transform: scale(0.96);
  }

  .cmd-play-btn:focus-visible {
    outline: 2px solid rgba(0, 210, 211, 0.55);
    outline-offset: 2px;
  }

  .cmd-play-icon {
    width: 48%;
    height: 48%;
  }

  .cmd-scrubber {
    position: relative;
    flex: 1;
    height: 18px;
    cursor: pointer;
  }

  .cmd-scrub-track {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
  }

  .cmd-scrub-fill {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    border-radius: 999px;
    transform-origin: left;
    background: var(--accent-teal);
    box-shadow: 0 0 10px rgba(0, 210, 211, 0.4);
    transition: transform 0.08s linear;
  }

  .cmd-scrub-head {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translateY(-50%);
    border-radius: 999px;
    background: #c5f9ff;
    box-shadow:
      0 0 0 2px rgba(0, 210, 211, 0.25),
      0 0 8px rgba(0, 210, 211, 0.4);
  }

  .cmd-scrub-meta {
    min-width: 3ch;
    text-align: right;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: rgba(215, 238, 255, 0.6);
  }

  /* ── Body: surfaces with blur, arrives after rule ── */
  .cmd-body-text {
    font-family: Georgia, serif;
    font-size: clamp(1.22rem, 1.8vw, 1.45rem);
    line-height: 2;
    color: rgba(255, 255, 255, 0.72);
    opacity: 0;
    animation: cmdSurface 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: 0.75s;
  }

  /* ── Source: whispers in last, indented right ── */
  .cmd-source-text {
    margin-top: 1.5rem;
    margin-left: 7rem;
    font-size: 0.6rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-teal);
    opacity: 0;
    animation: cmdFadeOnly 0.8s ease forwards;
    animation-delay: 1.1s;
  }

  @keyframes cmdFadeOnly {
    from { opacity: 0; }
    to   { opacity: 0.5; }
  }

  @keyframes cmdRise {
    from {
      opacity: 0;
      transform: translateY(36px);
      filter: blur(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @keyframes cmdDrawRule {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  @keyframes cmdSurface {
    from {
      opacity: 0;
      transform: translateY(18px);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  .cmd-right-inner {
    animation: cmdPanelIn 0.5s ease;
  }

  @keyframes cmdPanelIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .cmd-right-inner { animation: none; }
  }
</style>
