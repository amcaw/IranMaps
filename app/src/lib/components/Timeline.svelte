<script lang="ts">
	let {
		dates,
		selectedIndex = $bindable(),
		playing = $bindable(),
		showAnnotations = $bindable(),
		cumulative = $bindable(),
		featureCount,
		lastUpdate
	}: {
		dates: string[];
		selectedIndex: number;
		playing: boolean;
		showAnnotations: boolean;
		cumulative: boolean;
		featureCount: number;
		lastUpdate: string;
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
			}, 400);
		} else {
			if (interval) clearInterval(interval);
		}
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T12:00:00Z');
		return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
	}

	$effect(() => {
		return () => { if (interval) clearInterval(interval); };
	});
</script>

<div class="timeline">
	<div class="row-top">
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
		<span class="feature-count">{featureCount.toLocaleString()} frappes</span>
		<div class="spacer"></div>
		<div class="mode-tabs">
			<button class="mode-tab" class:active={cumulative} onclick={() => cumulative = true}>Cumulatif</button>
			<button class="mode-tab" class:active={!cumulative} onclick={() => cumulative = false}>Jour par jour</button>
		</div>
		<button class="annotation-toggle" class:disabled={!cumulative} onclick={() => { if (cumulative) showAnnotations = !showAnnotations; }}>
			<span class="toggle-switch" class:on={showAnnotations && cumulative}>
				<span class="toggle-knob"></span>
			</span>
			<span class="toggle-label">Annotations</span>
		</button>
	</div>
	<div class="slider-row">
		<span class="date-label">{formatDate(dates[0])}</span>
		<input
			type="range"
			min="0"
			max={dates.length - 1}
			bind:value={selectedIndex}
			class="slider"
		/>
		<span class="date-label">{formatDate(dates[dates.length - 1])}</span>
		<span class="last-update">Maj : {new Date(lastUpdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
	</div>
</div>

<style>
	.timeline {
		background: var(--bg);
		padding: 10px 16px;
	}

	.row-top {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}

	.spacer {
		flex: 1;
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

	.play-btn:hover {
		background: var(--surface);
	}

	.current-date {
		font-size: 16px;
		font-weight: 600;
		letter-spacing: -0.3px;
		white-space: nowrap;
	}

	.feature-count {
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}

	.mode-tabs {
		display: flex;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.mode-tab {
		font-size: 11px;
		padding: 4px 10px;
		border: none;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		font-family: inherit;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.mode-tab.active {
		background: var(--surface);
		color: var(--text);
	}

	.annotation-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--text-dim);
		cursor: pointer;
		border: none;
		background: transparent;
		padding: 0;
		flex-shrink: 0;
	}

	.annotation-toggle.disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.annotation-toggle:not(.disabled):hover .toggle-label {
		color: var(--text);
	}

	.toggle-switch {
		width: 28px;
		height: 16px;
		border-radius: 8px;
		background: var(--border);
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.toggle-switch.on {
		background: var(--accent);
	}

	.toggle-knob {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--bg);
		position: absolute;
		top: 2px;
		left: 2px;
		transition: transform 0.2s;
	}

	.toggle-switch.on .toggle-knob {
		transform: translateX(12px);
	}

	.toggle-label {
		transition: color 0.15s;
		white-space: nowrap;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.date-label {
		font-size: 11px;
		color: var(--text-dim);
		white-space: nowrap;
	}

	.last-update {
		font-size: 10px;
		color: var(--text-dim);
		opacity: 0.7;
		white-space: nowrap;
		margin-left: auto;
	}

	.slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		min-width: 0;
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
		.timeline {
			padding: 8px 10px;
		}

		.row-top {
			gap: 6px;
		}

		.current-date {
			font-size: 14px;
		}

		.feature-count {
			font-size: 11px;
		}

		.spacer {
			display: none;
		}

		.slider-row {
			gap: 6px;
		}

		.date-label {
			font-size: 10px;
		}

		.last-update {
			display: none;
		}
	}
</style>
