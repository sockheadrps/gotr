<script>
	import ChapterCard from './ChapterCard.svelte';

	/**
	 * @type {{
	 *   allChapters: import('../types.js').ChapterEntry[],
	 *   commandmentsEntry: import('../types.js').ChapterEntry | null,
	 *   activeIndex: number | null,
	 *   focusedIndex: number,
	 *   onCardClick: (index: number) => void,
	 *   onTitleClick: () => void,
	 *   onCommandmentsClick: () => void,
	 * }}
	 */
	let { allChapters, commandmentsEntry = null, activeIndex, focusedIndex, onCardClick, onTitleClick, onCommandmentsClick } = $props();

	const isDev = import.meta.env.VITE_IS_DEV === 'true';

	/** @type {HTMLElement[]} */
	let cardEls = $state([]);
	/** @type {HTMLElement} */
	let navEl = $state();
	/** @type {HTMLElement} */
	let headerEl = $state();

	$effect(() => {
		const el = cardEls[focusedIndex];
		if (!el || !navEl || !headerEl) return;

		const headerH = headerEl.offsetHeight;
		const navScrollTop = navEl.scrollTop;
		const cardTop = el.offsetTop;
		const cardBottom = cardTop + el.offsetHeight;
		const visibleTop = navScrollTop + headerH;
		const visibleBottom = navScrollTop + navEl.clientHeight;

		if (cardTop < visibleTop) {
			// Card is hidden under the header — scroll so card top clears header
			navEl.scrollTo({ top: cardTop - headerH, behavior: 'smooth' });
		} else if (cardBottom > visibleBottom) {
			// Card is below the visible area
			navEl.scrollTo({ top: cardBottom - navEl.clientHeight, behavior: 'smooth' });
		}
	});
</script>

<nav bind:this={navEl} class="w-87.5 shrink-0 flex flex-col overflow-y-auto h-full" style="background: var(--bg-sidebar); border-right: 1px solid var(--border-color);">
	<header bind:this={headerEl} class="sidebar-header sticky top-0 z-10" style="background: var(--bg-sidebar);">

		<!-- Title -->
		<h1 class="sidebar-title m-0 leading-none cursor-pointer select-none" onclick={onTitleClick}>
			<span class="sidebar-eyebrow">The</span>
			<span class="sidebar-wordmark">
				Got<em class="sidebar-r">R</em>
			</span>
		</h1>

		<!-- Rule -->
		<div class="sidebar-rule"></div>

		<!-- Commandments link -->
		{#if commandmentsEntry}
			<button class="sidebar-cmd-btn" onclick={onCommandmentsClick}>
				<span class="sidebar-cmd-num">X</span>
				<span class="sidebar-cmd-label">Commandments of Real</span>
				<span class="sidebar-cmd-arrow">→</span>
			</button>
		{/if}

		{#if isDev}
			<a
				href="/studio"
				class="text-[0.6rem] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full border transition-colors duration-200 no-underline mt-2 inline-block"
				style="color: var(--text-secondary); border-color: var(--border-color);"
				onmouseenter={(e) => { e.currentTarget.style.color = 'var(--accent-teal)'; e.currentTarget.style.borderColor = 'var(--accent-teal)'; }}
				onmouseleave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
			>🛠️ Studio</a>
		{/if}

		<!-- Bottom border that draws in -->
		<div class="sidebar-header-rule"></div>
	</header>

	<div class="flex flex-col">
		{#each allChapters as chapter, i}
			<div bind:this={cardEls[i]}>
				<ChapterCard
					{chapter}
					active={activeIndex === i}
					focused={focusedIndex === i && activeIndex !== i}
					onclick={() => onCardClick(i)}
				/>
			</div>
		{/each}
	</div>
</nav>

<style>
  .sidebar-header {
    padding: 1.5rem 1.5rem 0;
  }

  .sidebar-title {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-bottom: 0.7rem;
  }

  .sidebar-eyebrow {
    font-size: 0.45rem;
    font-weight: 900;
    letter-spacing: 0.45em;
    text-transform: uppercase;
    color: var(--accent-teal);
    opacity: 0.5;
    display: block;
  }

  .sidebar-wordmark {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 2rem;
    font-weight: bold;
    letter-spacing: -0.03em;
    color: white;
    line-height: 1;
    display: block;
    text-shadow:
      0 4px 32px rgba(0, 0, 0, 0.8),
      0 1px 12px rgba(162, 155, 254, 0.12);
  }

  .sidebar-r {
    font-style: normal;
    color: var(--accent-teal);
  }

  .sidebar-rule {
    height: 1px;
    background: linear-gradient(to right, rgba(162, 155, 254, 0.25), transparent);
    margin-bottom: 0.5rem;
  }

  /* Commandments: compact subtitle-style label beneath the title */
  .sidebar-cmd-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.15rem 0 0.25rem;
  }

  .sidebar-cmd-num {
    font-size: 0.42rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: var(--accent-purple);
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .sidebar-cmd-label {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.28);
    transition: color 0.2s;
  }

  .sidebar-cmd-btn:hover .sidebar-cmd-num {
    opacity: 1;
  }

  .sidebar-cmd-btn:hover .sidebar-cmd-label {
    color: var(--accent-teal);
  }

  .sidebar-cmd-arrow {
    font-size: 0.55rem;
    color: rgba(255, 255, 255, 0.12);
    transition: color 0.2s, transform 0.2s;
  }

  .sidebar-cmd-btn:hover .sidebar-cmd-arrow {
    color: var(--accent-teal);
    transform: translateX(2px);
  }

  .sidebar-header-rule {
    height: 1px;
    margin-top: 0.6rem;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.05), transparent);
  }
</style>
