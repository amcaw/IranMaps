<script lang="ts">
	import { onMount } from 'svelte';
	import type { StrikeData } from '$lib/types';
	import { initPym } from '$lib/pym';
	import Map from '$lib/components/Map.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import Timeline from '$lib/components/Timeline.svelte';

	initPym();

	let data: StrikeData | null = $state(null);
	let selectedIndex = $state(0);
	let playing = $state(false);
	let visibleLayers = $state(new Set<string>());
	let showAnnotations = $state(true);

	let selectedDate = $derived((data as StrikeData | null)?.meta.dates[selectedIndex] ?? '');
	let lastUpdate = $derived((data as StrikeData | null)?.meta.generated ?? '');

	let featureCount = $derived.by(() => {
		if (!data) return 0;
		let count = 0;
		for (const f of data.features) {
			if (f.date <= selectedDate && visibleLayers.has(f.layer)) count++;
		}
		return count;
	});

	let countsByLayer = $derived.by(() => {
		if (!data) return {};
		const counts: Record<string, number> = {};
		for (const f of data.features) {
			if (f.date <= selectedDate) {
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
		}
	});
</script>

{#if data}
	<Map {data} {selectedDate} {visibleLayers} {showAnnotations} />
	<Legend
		layers={data.meta.layers}
		bind:visibleLayers
		bind:showAnnotations
		{countsByLayer}
	/>
	<Timeline
		dates={data.meta.dates}
		bind:selectedIndex
		bind:playing
		{featureCount}
		{lastUpdate}
	/>
	<div class="source-credit">Source : Institute for the Study of War and AEI's Critical Threats Project.</div>
{:else}
	<div class="loading">Chargement des données…</div>
{/if}

<style>
	.source-credit {
		position: absolute;
		bottom: 6px;
		left: 16px;
		font-size: 11px;
		color: var(--text-dim);
		background: rgba(10, 10, 10, 0.75);
		padding: 4px 10px;
		border-radius: 4px;
		z-index: 10;
		font-weight: 500;
	}

	.loading {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		color: var(--text-dim);
		background: var(--bg);
	}
</style>
