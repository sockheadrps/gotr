<script>
  /** @type {{ chapter: import('../types.js').ChapterEntry, active: boolean, focused: boolean, onclick: () => void }} */
  let { chapter, active = false, focused = false, onclick } = $props();
</script>

<div class="card-stagger mx-2.5 my-2" {onclick} role="button" tabindex="0">
  {#key focused}
    <div
      class="chapter-card rounded-lg cursor-pointer border overflow-hidden {focused &&
      !active
        ? 'card-focus-flash card-focused-border'
        : ''}"
      class:border-l-4={active}
      style="
    background: {active
        ? 'rgba(162,155,254,0.05)'
        : focused
          ? 'var(--bg-card-hover)'
          : 'var(--bg-card)'};
    {!focused && !active
        ? 'border-color: var(--border-color); transition: border-color 0.2s, background 0.2s;'
        : active
          ? 'border-color: var(--accent-purple); transition: border-color 0.2s, background 0.2s;'
          : ''}
  "
    >
      <div class="card-hero">
        {#if chapter.data?.summary?.image || chapter.data?.image}
          <img
            class="card-hero-img"
            src={chapter.data?.summary?.image ?? chapter.data?.image}
            alt=""
            loading="lazy"
          />
        {/if}

        <div class="card-hero-bridge"></div>
        <div class="card-hero-fade"></div>
      </div>

      <div
        class="p-4 card-body hover:translate-x-1 transition-transform duration-200"
      >
        <div
          class="text-[0.7rem] uppercase tracking-[0.08em] mb-1"
          style="color: var(--text-secondary);"
        >
          {chapter.data.summary?.chapter
            ? `Chapter ${chapter.data.summary.chapter}`
            : (chapter.data.title ?? chapter.id)}
        </div>

        <div
          class="text-[1.15rem] font-bold my-2"
          style="color: var(--text-primary);"
        >
          {chapter.data.summary?.gospel_title ??
            chapter.data.title ??
            chapter.id}
        </div>

        <div
          class="text-[0.88rem] leading-snug line-clamp-2"
          style="color: var(--text-secondary);"
        >
          {chapter.data.summary?.subtitle ?? ''}
        </div>
      </div>
    </div>
  {/key}
</div>

<style>
  .card-stagger {
    animation: cardFadeIn 0.35s ease;
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-stagger {
      animation: none;
    }
  }

  .card-stagger:focus-visible .chapter-card {
    outline: 2px solid rgba(162, 155, 254, 0.6);
    outline-offset: 2px;
  }

  .chapter-card {
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .chapter-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
</style>
