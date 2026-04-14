<script lang="ts">
	import { onMount } from 'svelte';
	import { initPym, sendHeight } from '$lib/pym';
	import UkraineTimelineMap from '$lib/components/UkraineTimelineMap.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import UkraineTimeline from '$lib/components/UkraineTimeline.svelte';

	initPym();

	onMount(() => {
		if (window.self === window.top) {
			document.body.classList.add('standalone');
		}
	});

	let manifest: { dates: string[]; layers: Array<{ id: string; label: string; color: string; fillColor: string; fillOpacity: number }> } | null = $state(null);
	let selectedIndex = $state(0);
	let playing = $state(false);
	let visibleLayers = $state(new Set<string>());

	let selectedDate = $derived(manifest?.dates[selectedIndex] ?? '');
	let currentData: any = $state(null);

	// Compute area per layer from current GeoJSON
	function ringArea(ring: number[][]) {
		const RAD = Math.PI / 180, R = 6371000;
		let area = 0;
		for (let i = 0; i < ring.length - 1; i++) {
			const p1 = ring[i], p2 = ring[i + 1];
			area += (p2[0] - p1[0]) * RAD * (2 + Math.sin(p1[1] * RAD) + Math.sin(p2[1] * RAD));
		}
		return Math.abs(area * R * R / 2);
	}

	function featureArea(geom: any): number {
		if (!geom) return 0;
		if (geom.type === 'Polygon') {
			let a = ringArea(geom.coordinates[0]);
			for (let i = 1; i < geom.coordinates.length; i++) a -= ringArea(geom.coordinates[i]);
			return a;
		}
		if (geom.type === 'MultiPolygon') {
			let a = 0;
			for (const poly of geom.coordinates) {
				a += ringArea(poly[0]);
				for (let i = 1; i < poly.length; i++) a -= ringArea(poly[i]);
			}
			return a;
		}
		return 0;
	}

	let countsByLayer = $derived.by(() => {
		if (!currentData?.features) return {};
		const counts: Record<string, number> = {};
		for (const f of currentData.features) {
			const id = f.properties.layer;
			counts[id] = (counts[id] || 0) + 1;
		}
		return counts;
	});

	let layersWithCount = $derived.by(() => {
		if (!manifest) return [];
		return manifest.layers.map(l => {
			const features = currentData?.features?.filter((f: any) => f.properties.layer === l.id) ?? [];
			const areaKm2 = Math.round(features.reduce((sum: number, f: any) => sum + featureArea(f.geometry), 0) / 1e6);
			return { ...l, count: features.length, areaKm2 };
		});
	});

	onMount(async () => {
		const res = await fetch(`${import.meta.env.BASE_URL}data/ukraine-archive/manifest.json`);
		manifest = await res.json();
		if (manifest) {
			visibleLayers = new Set(manifest.layers.map(l => l.id));
			selectedIndex = manifest.dates.length - 1;
			sendHeight();
		}
	});
</script>

<div class="page-root">
	{#if manifest}
		<Legend
			layers={layersWithCount}
			bind:visibleLayers
			{countsByLayer}
		>
			{#snippet extra()}
				<span class="crimea-row">
					<span class="hatch-dot"></span>
					<span class="crimea-label">Territoires ukrainiens contrôlés par la Russie avant février 2022</span>
				</span>
			{/snippet}
		</Legend>
		<div class="map-frame">
			<UkraineTimelineMap
				{selectedDate}
				layers={manifest.layers}
				{visibleLayers}
				bind:currentData
			/>
		</div>
		<UkraineTimeline
			dates={manifest.dates}
			bind:selectedIndex
			bind:playing
		/>
		<div class="source-credit">
			<span>Source : Institute for the Study of War and AEI's Critical Threats Project.</span>
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

	.crimea-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		font-size: 12px;
		color: var(--text);
		line-height: 1.3;
	}

	.hatch-dot {
		width: 12px;
		height: 8px;
		flex-shrink: 0;
		border-radius: 2px;
		background: repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(153, 27, 27, 0.6) 2px, rgba(153, 27, 27, 0.6) 3px);
		border: 1px solid #991b1b;
	}

	.crimea-label {
		white-space: normal;
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
