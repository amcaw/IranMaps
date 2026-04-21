<script lang="ts">
	let {
		dates,
		selectedIndex = $bindable(),
		playing = $bindable(),
	}: {
		dates: string[];
		selectedIndex: number;
		playing: boolean;
	} = $props();

	let interval: ReturnType<typeof setInterval> | null = null;

	function togglePlay() {
		playing = !playing;
		if (playing) {
			if (selectedIndex >= dates.length - 1) selectedIndex = 0;
			interval = setInterval(() => {
				if (selectedIndex >= dates.length - 1) {
					playing = false;
					if (interval) clearInterval(interval);
					return;
				}
				selectedIndex++;
			}, 600);
		} else {
			if (interval) clearInterval(interval);
		}
	}

	// Compute year tick positions as percentages along the slider
	let yearTicks = $derived.by(() => {
		const ticks: Array<{ year: string; pct: number }> = [];
		const total = dates.length - 1;
		if (total <= 0) return ticks;
		for (let i = 0; i < dates.length; i++) {
			const year = dates[i].slice(0, 4);
			if (i === 0 || dates[i - 1].slice(0, 4) !== year) {
				ticks.push({ year, pct: (i / total) * 100 });
			}
		}
		return ticks;
	});

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T12:00:00Z');
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
	}

	$effect(() => {
		return () => { if (interval) clearInterval(interval); };
	});
</script>

<div class="timeline">
	<div class="row-controls">
		<button class="play-btn" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
				{#if playing}
					<rect x="5" y="3" width="5" height="18" rx="1" />
					<rect x="14" y="3" width="5" height="18" rx="1" />
				{:else}
					<polygon points="6,3 20,12 6,21" />
				{/if}
			</svg>
		</button>
		<span class="current-date">{formatDate(dates[selectedIndex])}</span>
	</div>
	<div class="row-slider">
		<div class="slider-wrapper">
			<div class="frame-ticks">
				{#each dates as _, i}
					<span class="frame-tick" style="left: {(i / (dates.length - 1)) * 100}%"></span>
				{/each}
			</div>
			<input
				type="range"
				min="0"
				max={dates.length - 1}
				bind:value={selectedIndex}
				class="slider"
			/>
			<div class="ticks">
				{#each yearTicks as tick}
					<span class="tick" style="left: {tick.pct}%">
						<span class="tick-line"></span>
						<span class="tick-label">{tick.year}</span>
					</span>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.timeline {
		background: var(--bg);
		padding: 10px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row-controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.play-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.play-btn:hover { background: var(--surface); }

	.current-date {
		font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.3px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		min-width: 7.5em;
	}

	.row-slider {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.slider-wrapper {
		flex: 1;
		position: relative;
		padding-bottom: 18px;
	}

	.frame-ticks {
		position: absolute;
		left: 0;
		right: 0;
		top: 7px;
		height: 4px;
		pointer-events: none;
	}

	.frame-tick {
		position: absolute;
		width: 1px;
		height: 4px;
		background: var(--text-dim);
		opacity: 0.2;
		transform: translateX(-50%);
	}

	.ticks {
		position: absolute;
		left: 0;
		right: 0;
		top: 14px;
		height: 18px;
		pointer-events: none;
	}

	.tick {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
	}

	.tick-line {
		width: 1px;
		height: 6px;
		background: var(--text-dim);
		opacity: 0.4;
	}

	.tick-label {
		font-size: 9px;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.slider {
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		min-width: 0;
		position: relative;
		z-index: 1;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid var(--bg);
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.timeline { padding: 8px 10px; gap: 4px; }
		.row-controls { gap: 6px; }
		.current-date { font-size: 13px; min-width: 6.5em; }
		.row-slider { gap: 6px; }
		.tick-label { font-size: 8px; }
	}
</style>
