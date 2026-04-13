/**
 * Preprocesses Ukraine GeoJSON polygon data for the SvelteKit app.
 * - Reads from data/ukraine/geojson/
 * - Reprojects EPSG:3857 → EPSG:4326 if needed
 * - Outputs a single JSON file with polygon layers
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dirname, '../../data/ukraine/geojson');
const OUT_DIR = join(import.meta.dirname, '../static/data');

const LAYERS = [
  { file: 'ukraine_control_map.geojson', id: 'control_map', label: 'Ukraine Control Map', color: '#b91c1c', fillColor: '#b91c1c', fillOpacity: 0.15 },
  { file: 'russian_advances.geojson', id: 'russian_advances', label: 'Assessed Russian Advances', color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.3 },
  { file: 'ukrainian_counteroffensives.geojson', id: 'counteroffensives', label: 'Claimed Ukrainian Counteroffensives', color: '#facc15', fillColor: '#facc15', fillOpacity: 0.25 },
];

function reprojectCoord(x, y) {
  const lon = (x * 180) / 20037508.34;
  const lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}

function isWebMercator(coord) {
  return Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90;
}

function reprojectRing(ring) {
  if (!ring.length) return ring;
  if (isWebMercator(ring[0])) {
    return ring.map(c => reprojectCoord(c[0], c[1]));
  }
  return ring;
}

function reprojectGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return geometry;

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(reprojectRing) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(reprojectRing)) };
  }
  return geometry;
}

// Compute geodesic area of a polygon ring in m² (Shoelace on sphere)
function ringArea(ring) {
  const RAD = Math.PI / 180;
  const R = 6371000; // Earth radius in meters
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    area += (p2[0] - p1[0]) * RAD * (2 + Math.sin(p1[1] * RAD) + Math.sin(p2[1] * RAD));
  }
  return Math.abs(area * R * R / 2);
}

function geometryAreaKm2(geometry) {
  let area = 0;
  if (geometry.type === 'Polygon') {
    area += ringArea(geometry.coordinates[0]);
    for (let i = 1; i < geometry.coordinates.length; i++) {
      area -= ringArea(geometry.coordinates[i]); // holes
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      area += ringArea(poly[0]);
      for (let i = 1; i < poly.length; i++) {
        area -= ringArea(poly[i]);
      }
    }
  }
  return area / 1e6; // m² → km²
}

function processLayer(layerDef) {
  let filePath = join(DATA_DIR, layerDef.file);

  if (!existsSync(filePath)) {
    const pattern = layerDef.file.replace('.geojson', '').replace(/_/g, '');
    const files = readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.geojson'))
      .filter(f => f.toLowerCase().replace(/[^a-z]/g, '').includes(pattern))
      .sort();

    if (files.length === 0) {
      console.warn(`  ${layerDef.id}: no file found`);
      return [];
    }
    filePath = join(DATA_DIR, files[files.length - 1]);
  }

  console.log(`  ${layerDef.id}: ${filePath.split('/').pop()}`);
  const geojson = JSON.parse(readFileSync(filePath, 'utf-8'));
  const features = [];

  for (const feature of geojson.features) {
    if (!feature.geometry || !feature.geometry.coordinates) continue;

    const geometry = reprojectGeometry(feature.geometry);

    features.push({
      type: 'Feature',
      geometry,
      properties: { layer: layerDef.id }
    });
  }

  const totalArea = features.reduce((sum, f) => sum + geometryAreaKm2(f.geometry), 0);
  console.log(`    → ${features.length} features (${Math.round(totalArea)} km²)`);
  return { features, areaKm2: Math.round(totalArea) };
}

console.log('Preprocessing Ukraine GeoJSON data...');

const allFeatures = [];
const layerMeta = [];

for (const layerDef of LAYERS) {
  const result = processLayer(layerDef);
  allFeatures.push(...result.features);
  layerMeta.push({
    id: layerDef.id,
    label: layerDef.label,
    color: layerDef.color,
    fillColor: layerDef.fillColor,
    fillOpacity: layerDef.fillOpacity,
    count: result.features.length,
    areaKm2: result.areaKm2
  });
}

console.log(`\nTotal features: ${allFeatures.length}`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const output = {
  meta: { layers: layerMeta, generated: new Date().toISOString() },
  type: 'FeatureCollection',
  features: allFeatures
};
const outPath = join(OUT_DIR, 'ukraine.json');
writeFileSync(outPath, JSON.stringify(output));
console.log(`Written: ${outPath} (${Math.round(readFileSync(outPath).length / 1024)} KB)`);
