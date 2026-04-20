<script lang="ts">
	import { onMount } from 'svelte';
	import type { StrikeData } from '$lib/types';
	import Map from '$lib/components/Map.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import Timeline from '$lib/components/Timeline.svelte';

	onMount(() => {
		document.body.classList.add('standalone');
	});

	let data: StrikeData | null = $state(null);
	let selectedIndex = $state(0);
	let playing = $state(false);
	let visibleLayers = $state(new Set<string>());
	let showAnnotations = $state(true);
	let cumulative = $state(true);
	let lockedBounds: [number, number, number, number] | null = $state(null);
	let getCurrentBounds: (() => [number, number, number, number] | null) | null = $state(null);
	let copied = $state(false);

	let selectedDate = $derived((data as StrikeData | null)?.meta.dates[selectedIndex] ?? '');
	let lastUpdate = $derived((data as StrikeData | null)?.meta.generated ?? '');

	let countsByLayer = $derived.by(() => {
		if (!data) return {};
		const counts: Record<string, number> = {};
		for (const f of data.features) {
			const match = cumulative ? f.date <= selectedDate : f.date === selectedDate;
			if (match) counts[f.layer] = (counts[f.layer] || 0) + 1;
		}
		return counts;
	});

	let featureCount = $derived.by(() => {
		if (!data) return 0;
		let count = 0;
		for (const f of data.features) {
			const match = cumulative ? f.date <= selectedDate : f.date === selectedDate;
			if (match && visibleLayers.has(f.layer)) count++;
		}
		return count;
	});

	onMount(async () => {
		const res = await fetch(`${import.meta.env.BASE_URL}data/strikes.json`);
		data = await res.json();
		if (data) {
			visibleLayers = new Set(data.meta.layers.map((l) => l.id));
			selectedIndex = data.meta.dates.length - 1;
		}
	});

	function lockView() {
		if (getCurrentBounds) lockedBounds = getCurrentBounds();
		copied = false;
	}

	function resetView() {
		lockedBounds = null;
		copied = false;
	}

	let embedCode = $derived.by(() => {
		const base = 'https://amcaw.github.io/WarMaps/middle-east';
		const params = new URLSearchParams();
		if (lockedBounds) params.set('bounds', lockedBounds.join(','));
		if (selectedDate) params.set('date', selectedDate);
		params.set('cumulative', String(cumulative));
		const src = `${base}?${params.toString()}`;
		return `<div data-pym-src="${src}" data-pym-id="warmaps-middle-east"></div>\n\n<script src="https://pym.nprapps.org/pym-loader.v1.js"><\/script>`;
	});

	async function copyCode() {
		await navigator.clipboard.writeText(embedCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="page-root">
	{#if data}
		<Legend layers={data.meta.layers} bind:visibleLayers {countsByLayer} />
		<div class="map-frame">
			<Map
				{data}
				{selectedDate}
				{visibleLayers}
				{showAnnotations}
				{cumulative}
				initialBounds={lockedBounds}
				bind:getCurrentBounds
			/>
			<div class="lock-bar">
				{#if lockedBounds}
					<span class="bounds-label">
						Vue verrouillée · {selectedDate} · {cumulative ? 'cumulatif' : 'jour par jour'}
					</span>
					<button class="btn-reset" onclick={resetView}>Réinitialiser</button>
				{:else}
					<span class="hint">Naviguez, choisissez une date et un mode, puis verrouillez.</span>
					<button class="btn-lock" onclick={lockView}>Verrouiller la vue</button>
				{/if}
			</div>
		</div>
		<Timeline
			dates={data.meta.dates}
			bind:selectedIndex
			bind:playing
			bind:showAnnotations
			bind:cumulative
			{featureCount}
		/>
		<div class="source-credit">
			<span>Source : Institute for the Study of War and AEI's Critical Threats Project.</span>
			<span class="last-update">{new Date(lastUpdate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
		</div>

		<div class="embed-panel">
			<div class="embed-header">
				<span class="embed-title">Code d'intégration</span>
				<button class="btn-copy" onclick={copyCode}>
					{copied ? 'Copié !' : 'Copier'}
				</button>
			</div>
			<pre class="embed-code">{embedCode}</pre>
		</div>
	{:else}
		<div class="loading">Chargement des données...</div>
	{/if}
</div>

<style>
	.page-root {
		width: 100%;
		min-height: 100dvh;
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	.map-frame {
		position: relative;
		width: 100%;
		flex: 1;
		min-height: 400px;
		overflow: hidden;
		border-radius: 10px;
	}

	.lock-bar {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--bg);
		border: 1px solid var(--border, #ddd);
		border-radius: 8px;
		padding: 6px 12px;
		font-size: 12px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.15);
		z-index: 10;
		white-space: nowrap;
	}

	.hint {
		color: var(--text-dim);
	}

	.bounds-label {
		font-family: monospace;
		font-size: 11px;
		color: var(--text-dim);
	}

	.btn-lock {
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 6px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-lock:hover { background: #1d4ed8; }

	.btn-reset {
		background: transparent;
		color: var(--text-dim);
		border: 1px solid var(--border, #ddd);
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 12px;
		cursor: pointer;
	}

	.btn-reset:hover { color: var(--text); }

	.source-credit {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		color: var(--text-dim);
		padding: 6px 16px;
		font-weight: 500;
	}

	.last-update {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	.embed-panel {
		border-top: 1px solid var(--border, #e5e7eb);
		padding: 16px;
	}

	.embed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.embed-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.btn-copy {
		background: var(--bg-alt, #f3f4f6);
		border: 1px solid var(--border, #ddd);
		border-radius: 6px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		color: var(--text);
		min-width: 64px;
	}

	.btn-copy:hover { background: var(--border, #e5e7eb); }

	.embed-code {
		background: var(--bg-alt, #f9fafb);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 6px;
		padding: 12px;
		font-size: 12px;
		font-family: monospace;
		white-space: pre-wrap;
		word-break: break-all;
		color: var(--text);
		margin: 0;
	}

	.loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		color: var(--text-dim);
		background: var(--bg);
	}
</style>
