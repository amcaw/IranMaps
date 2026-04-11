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
	<div class="timeline-header">
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
		<div class="date-display">
			<span class="current-date">{formatDate(dates[selectedIndex])}</span>
			<span class="feature-count">{featureCount.toLocaleString()} frappes</span>
		</div>
		<div class="header-right">
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
			<span class="last-update">Maj : {new Date(lastUpdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
		</div>
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
	</div>
</div>

<style>
	.timeline {
		background: var(--bg);
		padding: 12px 20px;
	}

	.timeline-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.play-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}

	.play-btn:hover {
		background: var(--surface);
	}

	.date-display {
		display: flex;
		flex-direction: column;
	}

	.current-date {
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.3px;
	}

	.feature-count {
		font-size: 12px;
		color: var(--text-dim);
	}

	.header-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.last-update {
		font-size: 10px;
		color: var(--text-dim);
		opacity: 0.7;
	}

	.mode-tabs {
		display: flex;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
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

	.slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
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
			min-width: unset;
			padding: 10px 12px;
		}

		.timeline-header {
			flex-wrap: wrap;
			gap: 8px;
		}

		.header-right {
			width: 100%;
			margin-left: 0;
		}

		.current-date {
			font-size: 15px;
		}
	}
</style>
