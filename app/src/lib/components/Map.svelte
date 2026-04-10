<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { StrikeData, LayerMeta } from '$lib/types';
	import { t } from '$lib/i18n';

	let {
		data,
		selectedDate,
		visibleLayers
	}: {
		data: StrikeData;
		selectedDate: string;
		visibleLayers: Set<string>;
	} = $props();

	let mapContainer: HTMLDivElement;
	let miniMapContainer: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let miniMap: maplibregl.Map | null = null;
	let popup: maplibregl.Popup | null = null;

	// Bounding box from the data (with padding)
	const DATA_BOUNDS: [number, number, number, number] = [32.34, 22.19, 63.43, 39.04];

	// Country labels in French with approximate centroids
	const COUNTRY_LABELS: { name: string; lng: number; lat: number }[] = [
		{ name: 'Iran', lng: 53.5, lat: 32.5 },
		{ name: 'Irak', lng: 43.5, lat: 33.2 },
		{ name: 'Liban', lng: 35.9, lat: 33.9 },
		{ name: 'Syrie', lng: 38.5, lat: 35.0 },
		{ name: 'Turquie', lng: 35.0, lat: 39.0 },
		{ name: 'Arabie\nSaoudite', lng: 45.0, lat: 24.0 },
		{ name: 'Israël', lng: 34.8, lat: 31.5 },
		{ name: 'Jordanie', lng: 36.5, lat: 31.2 },
		{ name: 'Koweït', lng: 47.5, lat: 29.3 },
		{ name: 'Bahreïn', lng: 50.5, lat: 26.1 },
		{ name: 'Qatar', lng: 51.2, lat: 25.3 },
		{ name: 'É.A.U.', lng: 54.5, lat: 24.0 },
		{ name: 'Oman', lng: 57.0, lat: 21.5 },
		{ name: 'Pakistan', lng: 63.0, lat: 28.0 },
		{ name: 'Afghanistan', lng: 65.0, lat: 34.0 },
		{ name: 'Égypte', lng: 30.0, lat: 27.0 },
		{ name: 'Yémen', lng: 48.0, lat: 15.5 },
	];

	function buildGeoJSON(date: string, visible: Set<string>): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];
		for (const f of data.features) {
			if (f.date > date || !visible.has(f.layer)) continue;
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
				properties: {
					layer: f.layer,
					date: f.date,
					city: f.city,
					type: f.type,
					actor: f.actor
				}
			});
		}
		return { type: 'FeatureCollection', features };
	}

	function buildCountryLabelsGeoJSON(): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: COUNTRY_LABELS.map(c => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
				properties: { name: c.name }
			}))
		};
	}

	function getColorExpression(layers: LayerMeta[]): maplibregl.ExpressionSpecification {
		const stops: (string | maplibregl.ExpressionSpecification)[] = ['match', ['get', 'layer']];
		for (const l of layers) {
			stops.push(l.id, l.color);
		}
		stops.push('#888');
		return stops as maplibregl.ExpressionSpecification;
	}

	function updateMiniMapViewport() {
		if (!map || !miniMap) return;
		const bounds = map.getBounds();

		// Update the viewport rectangle on the mini map
		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();
		const rectGeoJSON: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [{
				type: 'Feature',
				geometry: {
					type: 'Polygon',
					coordinates: [[
						[sw.lng, sw.lat],
						[ne.lng, sw.lat],
						[ne.lng, ne.lat],
						[sw.lng, ne.lat],
						[sw.lng, sw.lat]
					]]
				},
				properties: {}
			}]
		};

		const src = miniMap.getSource('viewport') as maplibregl.GeoJSONSource;
		if (src) src.setData(rectGeoJSON);
	}

	onMount(() => {
		// Main map
		map = new maplibregl.Map({
			container: mapContainer,
			style: {
				version: 8,
				sources: {
					'carto-dark': {
						type: 'raster',
						tiles: [
							'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
							'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
						],
						tileSize: 256,
						attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
					}
				},
				layers: [{ id: 'carto-dark', type: 'raster', source: 'carto-dark' }]
			},
			maxBounds: [DATA_BOUNDS[0] - 5, DATA_BOUNDS[1] - 5, DATA_BOUNDS[2] + 5, DATA_BOUNDS[3] + 5],
			maxZoom: 14,
			minZoom: 3
		});

		map.fitBounds(
			[[DATA_BOUNDS[0], DATA_BOUNDS[1]], [DATA_BOUNDS[2], DATA_BOUNDS[3]]],
			{ padding: 60 }
		);

		map.addControl(new maplibregl.NavigationControl(), 'top-right');

		map.on('load', () => {
			// Country labels
			map!.addSource('country-labels', {
				type: 'geojson',
				data: buildCountryLabelsGeoJSON()
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
					'text-allow-overlap': false,
					'text-ignore-placement': false
				},
				paint: {
					'text-color': '#555',
					'text-halo-color': 'rgba(0,0,0,0.7)',
					'text-halo-width': 1.5
				}
			});

			// Strike points
			const geojson = buildGeoJSON(selectedDate, visibleLayers);

			map!.addSource('strikes', {
				type: 'geojson',
				data: geojson
			});

			map!.addLayer({
				id: 'strikes-circle',
				type: 'circle',
				source: 'strikes',
				paint: {
					'circle-radius': [
						'interpolate', ['linear'], ['zoom'],
						3, 2.5,
						8, 5,
						14, 10
					],
					'circle-color': getColorExpression(data.meta.layers),
					'circle-opacity': 0.8,
					'circle-stroke-width': 0.5,
					'circle-stroke-color': '#000',
					'circle-stroke-opacity': 0.5
				}
			});

			// Hover popup
			popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 10,
				className: 'strike-popup'
			});

			map!.on('mouseenter', 'strikes-circle', (e) => {
				if (!map || !e.features?.length) return;
				map.getCanvas().style.cursor = 'pointer';
				const f = e.features[0];
				const props = f.properties;
				const layerMeta = data.meta.layers.find(l => l.id === props.layer);
				const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];

				const label = layerMeta ? t(layerMeta.label) : props.layer;
				const dateStr = new Date(props.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
				let html = `<div class="popup-layer" style="color:${layerMeta?.color || '#fff'}">${label}</div>`;
				if (props.city) html += `<div class="popup-city">${props.city}</div>`;
				html += `<div class="popup-date">${dateStr}</div>`;
				if (props.type) html += `<div class="popup-type">${t(props.type)}</div>`;

				popup!.setLngLat(coords).setHTML(html).addTo(map!);
			});

			map!.on('mouseleave', 'strikes-circle', () => {
				if (!map) return;
				map.getCanvas().style.cursor = '';
				popup?.remove();
			});
		});

		// Mini map (globe medallion)
		miniMap = new maplibregl.Map({
			container: miniMapContainer,
			style: {
				version: 8,
				sources: {
					'carto-dark-mini': {
						type: 'raster',
						tiles: [
							'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
						],
						tileSize: 256
					}
				},
				layers: [{ id: 'carto-dark-mini', type: 'raster', source: 'carto-dark-mini' }]
			},
			center: [40, 30],
			zoom: 0.5,
			interactive: false,
			attributionControl: false
		});

		miniMap.on('load', () => {
			// Viewport rectangle
			miniMap!.addSource('viewport', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			miniMap!.addLayer({
				id: 'viewport-fill',
				type: 'fill',
				source: 'viewport',
				paint: {
					'fill-color': '#4a9eff',
					'fill-opacity': 0.15
				}
			});

			miniMap!.addLayer({
				id: 'viewport-line',
				type: 'line',
				source: 'viewport',
				paint: {
					'line-color': '#4a9eff',
					'line-width': 1.5
				}
			});

			updateMiniMapViewport();
		});

		// Sync mini map viewport on main map move
		map.on('moveend', updateMiniMapViewport);
		map.on('zoomend', updateMiniMapViewport);
	});

	onDestroy(() => {
		map?.remove();
		miniMap?.remove();
	});

	$effect(() => {
		const date = selectedDate;
		const layers = visibleLayers;
		if (!map?.getSource('strikes')) return;
		const geojson = buildGeoJSON(date, layers);
		(map.getSource('strikes') as maplibregl.GeoJSONSource).setData(geojson);
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
		bottom: 110px;
		right: 16px;
		width: 140px;
		height: 140px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--border);
		box-shadow: 0 4px 16px rgba(0,0,0,0.6);
		z-index: 10;
	}

	.minimap {
		width: 100%;
		height: 100%;
	}

	:global(.minimap-wrapper .maplibregl-canvas) {
		border-radius: 50%;
	}

	:global(.strike-popup .maplibregl-popup-content) {
		background: #1a1a1a;
		color: #e0e0e0;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 8px 12px;
		font-family: 'Montserrat', sans-serif;
		font-size: 13px;
		line-height: 1.4;
		box-shadow: 0 4px 12px rgba(0,0,0,0.5);
	}

	:global(.strike-popup .maplibregl-popup-tip) {
		border-top-color: #1a1a1a;
	}

	:global(.popup-layer) {
		font-weight: 600;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}

	:global(.popup-city) {
		font-weight: 500;
	}

	:global(.popup-date) {
		color: #888;
		font-size: 12px;
	}

	:global(.popup-type) {
		color: #aaa;
		font-size: 11px;
		margin-top: 2px;
	}
</style>
