<script lang="ts">
	let {
		dates,
		selectedIndex = $bindable(),
		playing = $bindable(),
		featureCount,
		lastUpdate
	}: {
		dates: string[];
		selectedIndex: number;
		playing: boolean;
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
			{playing ? '⏸' : '▶'}
		</button>
		<div class="date-display">
			<span class="current-date">{formatDate(dates[selectedIndex])}</span>
			<span class="feature-count">{featureCount.toLocaleString()} frappes</span>
			<span class="last-update">Dernière mise à jour : {new Date(lastUpdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}</span>
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
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(20, 20, 20, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 20px;
		min-width: 480px;
		max-width: 600px;
		z-index: 10;
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
		background: #222;
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

	.last-update {
		font-size: 10px;
		color: var(--text-dim);
		opacity: 0.7;
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
			left: 12px;
			right: 12px;
			transform: none;
		}
	}
</style>
