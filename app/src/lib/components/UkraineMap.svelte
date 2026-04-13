<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { UkraineData } from '$lib/types';

	let {
		data,
		visibleLayers
	}: {
		data: UkraineData;
		visibleLayers: Set<string>;
	} = $props();

	let mapContainer: HTMLDivElement;
	let miniMapContainer: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let miniMap: maplibregl.Map | null = null;
	const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

	const BBOX: [[number, number], [number, number]] = [[19.81, 43.88], [42.29, 52.95]];

	function updateMiniMapViewport() {
		if (!map || !miniMap?.getSource('viewport')) return;
		const b = map.getBounds();
		const rect = {
			type: 'FeatureCollection' as const,
			features: [{
				type: 'Feature' as const,
				geometry: {
					type: 'Polygon' as const,
					coordinates: [[
						[b.getWest(), b.getSouth()],
						[b.getEast(), b.getSouth()],
						[b.getEast(), b.getNorth()],
						[b.getWest(), b.getNorth()],
						[b.getWest(), b.getSouth()],
					]]
				},
				properties: {}
			}]
		};
		(miniMap.getSource('viewport') as maplibregl.GeoJSONSource).setData(rect);
	}

	onMount(() => {
		const tileVariant = isDark ? 'dark_nolabels' : 'light_nolabels';
		const isMobile = window.innerWidth <= 768;

		map = new maplibregl.Map({
			container: mapContainer,
			style: {
				version: 8,
				sources: {
					'carto-basemap': {
						type: 'raster',
						tiles: [
							`https://a.basemaps.cartocdn.com/${tileVariant}/{z}/{x}/{y}@2x.png`,
							`https://b.basemaps.cartocdn.com/${tileVariant}/{z}/{x}/{y}@2x.png`,
						],
						tileSize: 256,
						attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
					}
				},
				layers: [{ id: 'carto-basemap', type: 'raster', source: 'carto-basemap' }]
			},
			maxBounds: [[BBOX[0][0] - 5, BBOX[0][1] - 5], [BBOX[1][0] + 5, BBOX[1][1] + 5]],
			maxZoom: 14,
			minZoom: 3,
			cooperativeGestures: true
		});

		map.fitBounds(BBOX, { padding: isMobile ? 10 : 40 });

		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }), 'bottom-right');

		map.on('load', () => {
			// Ukraine border from CARTO boundaries
			map!.addSource('ukraine-border', {
				type: 'vector',
				tiles: ['https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.mvt'],
				maxzoom: 14
			});

			map!.addLayer({
				id: 'ukraine-border-line',
				type: 'line',
				source: 'carto-basemap',
				paint: { 'line-opacity': 0 }
			});

			// Use a simple GeoJSON boundary instead
			fetch('https://nominatim.openstreetmap.org/search?q=Ukraine&format=geojson&polygon_geojson=1&limit=1')
				.then(r => r.json())
				.then(geojson => {
					if (!geojson.features?.length || !map) return;
					map.addSource('ukraine-outline', {
						type: 'geojson',
						data: geojson.features[0]
					});
					map.addLayer({
						id: 'ukraine-outline-line',
						type: 'line',
						source: 'ukraine-outline',
						paint: {
							'line-color': isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
							'line-width': 2,
							'line-dasharray': [4, 3]
						}
					}, data.meta.layers.length ? `ukraine-${data.meta.layers[0].id}-fill` : undefined);
				})
				.catch(() => {});
			for (const layerDef of data.meta.layers) {
				const features = data.features.filter(f => f.properties.layer === layerDef.id);
				const sourceId = `ukraine-${layerDef.id}`;

				map!.addSource(sourceId, {
					type: 'geojson',
					data: { type: 'FeatureCollection', features } as any
				});

				map!.addLayer({
					id: `${sourceId}-fill`,
					type: 'fill',
					source: sourceId,
					paint: {
						'fill-color': layerDef.fillColor,
						'fill-opacity': layerDef.fillOpacity
					}
				});

				map!.addLayer({
					id: `${sourceId}-line`,
					type: 'line',
					source: sourceId,
					paint: {
						'line-color': layerDef.color,
						'line-width': 1.5,
						'line-opacity': 0.8
					}
				});
			}

			// Country labels
			map!.addSource('country-labels', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: [
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [32.0, 49.0] }, properties: { name: 'UKRAINE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [38.0, 52.5] }, properties: { name: 'RUSSIE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [27.9, 53.7] }, properties: { name: 'BIELORUSSIE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [19.4, 51.9] }, properties: { name: 'POLOGNE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [25.0, 45.9] }, properties: { name: 'ROUMANIE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [19.7, 48.7] }, properties: { name: 'SLOVAQUIE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [28.8, 47.0] }, properties: { name: 'MOLDAVIE' } },
						{ type: 'Feature', geometry: { type: 'Point', coordinates: [20.3, 47.5] }, properties: { name: 'HONGRIE' } },
					]
				}
			});

			map!.addLayer({
				id: 'country-labels-text',
				type: 'symbol',
				source: 'country-labels',
				layout: {
					'text-field': ['get', 'name'],
					'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14, 10, 18],
					'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
					'text-transform': 'uppercase',
					'text-letter-spacing': 0.15,
					'text-allow-overlap': false
				},
				paint: {
					'text-color': isDark ? '#777' : '#999',
					'text-halo-color': isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
					'text-halo-width': 1.5
				}
			});
		});

		// Mini map
		miniMap = new maplibregl.Map({
			container: miniMapContainer,
			style: {
				version: 8,
				sources: {
					'carto-mini': {
						type: 'raster',
						tiles: [`https://a.basemaps.cartocdn.com/${tileVariant}/{z}/{x}/{y}.png`],
						tileSize: 256
					}
				},
				layers: [{ id: 'carto-mini', type: 'raster', source: 'carto-mini' }]
			},
			center: [31, 49],
			zoom: 0,
			interactive: false,
			attributionControl: false
		});

		miniMap.on('load', () => {
			miniMap!.addSource('viewport', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			miniMap!.addLayer({
				id: 'viewport-fill',
				type: 'fill',
				source: 'viewport',
				paint: { 'fill-color': '#4a9eff', 'fill-opacity': 0.15 }
			});
			miniMap!.addLayer({
				id: 'viewport-line',
				type: 'line',
				source: 'viewport',
				paint: { 'line-color': '#4a9eff', 'line-width': 1.5 }
			});

			map!.on('move', updateMiniMapViewport);
			updateMiniMapViewport();
		});
	});

	onDestroy(() => {
		map?.remove();
		miniMap?.remove();
	});

	$effect(() => {
		const visible = visibleLayers;
		if (!map) return;
		for (const layerDef of data.meta.layers) {
			const sourceId = `ukraine-${layerDef.id}`;
			const visibility = visible.has(layerDef.id) ? 'visible' : 'none';
			if (map.getLayer(`${sourceId}-fill`)) map.setLayoutProperty(`${sourceId}-fill`, 'visibility', visibility);
			if (map.getLayer(`${sourceId}-line`)) map.setLayoutProperty(`${sourceId}-line`, 'visibility', visibility);
		}
	});
</script>

<div bind:this={mapContainer} class="map"></div>
<div class="minimap-wrapper">
	<div bind:this={miniMapContainer} class="minimap"></div>
</div>

<style>
	.map {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
	}

	.minimap-wrapper {
		position: absolute;
		bottom: 6px;
		left: 16px;
		width: 140px;
		height: 140px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--border);
		box-shadow: 0 4px 16px rgba(0,0,0,0.3);
		z-index: 10;
	}

	@media (max-width: 768px) {
		.minimap-wrapper {
			width: 90px;
			height: 90px;
			bottom: 6px;
			left: 10px;
		}
	}

	.minimap {
		width: 100%;
		height: 100%;
	}

	:global(.minimap-wrapper .maplibregl-canvas) {
		border-radius: 50%;
	}
</style>
