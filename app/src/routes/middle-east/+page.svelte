<script lang="ts">
	import { onMount } from 'svelte';
	import type { StrikeData } from '$lib/types';
	import { initPym, sendHeight } from '$lib/pym';
	import Map from '$lib/components/Map.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import Timeline from '$lib/components/Timeline.svelte';

	initPym();

	onMount(() => {
		if (window.self === window.top) {
			document.body.classList.add('standalone');
		}
	});

	let data: StrikeData | null = $state(null);
	let selectedIndex = $state(0);
	let playing = $state(false);
	let visibleLayers = $state(new Set<string>());
	let showAnnotations = $state(true);
	let cumulative = $state(true);

	let selectedDate = $derived((data as StrikeData | null)?.meta.dates[selectedIndex] ?? '');
	let lastUpdate = $derived((data as StrikeData | null)?.meta.generated ?? '');

	let featureCount = $derived.by(() => {
		if (!data) return 0;
		let count = 0;
		for (const f of data.features) {
			const match = cumulative ? f.date <= selectedDate : f.date === selectedDate;
			if (match && visibleLayers.has(f.layer)) count++;
		}
		return count;
	});

	let countsByLayer = $derived.by(() => {
		if (!data) return {};
		const counts: Record<string, number> = {};
		for (const f of data.features) {
			const match = cumulative ? f.date <= selectedDate : f.date === selectedDate;
			if (match) {
				counts[f.layer] = (counts[f.layer] || 0) + 1;
			}
		}
		return counts;
	});

	onMount(async () => {
		const res = await fetch(`${import.meta.env.BASE_URL}data/strikes.json`);
		data = await res.json();
		if (data) {
			visibleLayers = new Set(data.meta.layers.map((l) => l.id));
			selectedIndex = data.meta.dates.length - 1;
			sendHeight();
		}
	});
</script>

<div class="page-root">
	{#if data}
		<Legend
			layers={data.meta.layers}
			bind:visibleLayers
			{countsByLayer}
		/>
		<div class="map-frame">
			<Map {data} {selectedDate} {visibleLayers} {showAnnotations} {cumulative} />
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
			<span class="last-update">Màj : {new Date(lastUpdate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
		</div>
	{:else}
		<div class="loading">Chargement des donnees...</div>
	{/if}
</div>

<style>
	.page-root {
		width: 100%;
		height: 800px;
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	:global(body.standalone) .page-root {
		height: 100dvh;
	}

	.map-frame {
		position: relative;
		width: 100%;
		flex: 1;
		min-height: 300px;
		overflow: hidden;
		border-radius: 10px;
	}

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
