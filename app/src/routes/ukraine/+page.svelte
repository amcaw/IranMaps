<script lang="ts">
	import { onMount } from 'svelte';
	import type { UkraineData } from '$lib/types';
	import { initPym, sendHeight } from '$lib/pym';
	import UkraineMap from '$lib/components/UkraineMap.svelte';
	import Legend from '$lib/components/Legend.svelte';

	initPym();

	onMount(() => {
		if (window.self === window.top) {
			document.body.classList.add('standalone');
		}
	});

	let data: UkraineData | null = $state(null);
	let visibleLayers = $state(new Set<string>());

	let countsByLayer = $derived.by(() => {
		if (!data) return {};
		const counts: Record<string, number> = {};
		for (const f of data.features) {
			const id = f.properties.layer;
			if (visibleLayers.has(id)) {
				counts[id] = (counts[id] || 0) + 1;
			}
		}
		return counts;
	});

	onMount(async () => {
		const res = await fetch(`${import.meta.env.BASE_URL}data/ukraine.json`);
		data = await res.json();
		if (data) {
			visibleLayers = new Set(data.meta.layers.map((l) => l.id));
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
			<UkraineMap {data} {visibleLayers} />
		</div>
		<div class="source-credit">
			<span>Source : Institute for the Study of War and AEI's Critical Threats Project.</span>
			<span class="last-update">Maj : {new Date(data.meta.generated).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
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
